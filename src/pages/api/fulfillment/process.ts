/**
 * Auto-Fulfillment Processor
 *
 * Called on a schedule (Cloudflare Cron Trigger every 15 min) or manually.
 *
 * Two-phase processing:
 *   Phase 1: FULFILL — Mark donations as fulfilled when scheduled_fulfillment_at <= now
 *   Phase 2: EMAIL  — Send fulfillment emails when fulfillment_email_scheduled_at <= now
 *
 * This separation ensures:
 *   - Fulfillment happens on time (24h / Eid date)
 *   - Email always arrives at 1:30 PM in donor's local timezone
 *
 * Handles ALL campaign types (auto_24h, eid_scheduled, eid_next_day)
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { moveDonationThroughPipeline, markFulfilled as ghlMarkFulfilled } from '../../../lib/ghl-advanced';
import { sendFulfillmentEmail } from '../../../lib/donor-emails';

export const prerender = false;

function isAuthorized(request: Request): boolean {
  const url = new URL(request.url);
  const apiKey = url.searchParams.get('key') || request.headers.get('x-api-key');
  const expectedKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  return apiKey === expectedKey?.substring(0, 32);
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const now = new Date().toISOString();

    // ============================================
    // PHASE 1: FULFILL donations that are due
    // ============================================

    // Fetch donations due for fulfillment
    // Excludes recurring donations (monthly/weekly) — they follow the Active Subscriber lifecycle
    const { data: readyToFulfill, error: fetchError } = await supabaseAdmin
      .from('donations')
      .select('*')
      .eq('fulfillment_status', 'pending')
      .eq('status', 'completed')
      .not('donation_type', 'in', '("monthly","weekly")')
      .lte('scheduled_fulfillment_at', now)
      .not('scheduled_fulfillment_at', 'is', null)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching pending donations:', fetchError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let fulfilled = 0;
    let fulfillFailed = 0;

    for (const donation of readyToFulfill || []) {
      try {
        // Mark as fulfilled in Supabase
        await supabaseAdmin
          .from('donations')
          .update({
            fulfillment_status: 'fulfilled',
            fulfilled_at: now,
            fulfillment_event_id: crypto.randomUUID(),
          })
          .eq('id', donation.id);

        // Move GHL pipeline to "Fulfilled"
        if (donation.donor_email) {
          await moveDonationThroughPipeline(donation.donor_email, 'fulfilled')
            .catch(err => console.error('GHL pipeline move error:', err));

          await ghlMarkFulfilled(donation.donor_email)
            .catch(err => console.error('GHL markFulfilled error:', err));
        }

        fulfilled++;
        console.log(`Fulfilled donation ${donation.id} (${donation.donor_email})`);
      } catch (err) {
        console.error('Fulfillment error for', donation.id, err);
        fulfillFailed++;
        await supabaseAdmin
          .from('donations')
          .update({ fulfillment_status: 'failed' })
          .eq('id', donation.id);
      }
    }

    // ============================================
    // PHASE 2: SEND fulfillment emails that are due
    // ============================================

    const { data: readyToEmail, error: emailFetchError } = await supabaseAdmin
      .from('donations')
      .select('*')
      .eq('fulfillment_status', 'fulfilled')
      .eq('fulfillment_email_sent', false)
      .lte('fulfillment_email_scheduled_at', now)
      .not('fulfillment_email_scheduled_at', 'is', null)
      .order('fulfillment_email_scheduled_at', { ascending: true })
      .limit(50);

    if (emailFetchError) {
      console.error('Error fetching email queue:', emailFetchError);
    }

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const donation of readyToEmail || []) {
      try {
        if (!donation.donor_email) continue;

        // Parse items
        let items: Array<{ name: string; amount: number }> = [];
        if (donation.items) {
          items = typeof donation.items === 'string'
            ? JSON.parse(donation.items)
            : donation.items;
        }

        await sendFulfillmentEmail({
          donorEmail: donation.donor_email,
          donorName: donation.donor_name || 'Donor',
          amount: parseFloat(donation.amount),
          items,
          campaignName: donation.campaign_name || 'General Donation',
          fulfilledAt: new Date(donation.fulfilled_at || now),
          certificateUrl: donation.certificate_url || undefined,
        });

        // Mark email as sent
        await supabaseAdmin
          .from('donations')
          .update({ fulfillment_email_sent: true })
          .eq('id', donation.id);

        emailsSent++;
        console.log(`Fulfillment email sent for donation ${donation.id} (${donation.donor_email})`);
      } catch (err) {
        console.error('Fulfillment email error for', donation.id, err);
        emailsFailed++;
      }
    }

    return new Response(JSON.stringify({
      phase1_fulfillment: {
        processed: (readyToFulfill || []).length,
        fulfilled,
        failed: fulfillFailed,
      },
      phase2_emails: {
        processed: (readyToEmail || []).length,
        sent: emailsSent,
        failed: emailsFailed,
      },
      timestamp: now,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Fulfillment processor error:', errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// GET: Status dashboard
export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();

  // Stats exclude recurring donations (monthly/weekly) — they follow Active Subscriber lifecycle
  const [readyFulfill, pendingFulfill, readyEmail, pendingEmail, recentFulfilled] = await Promise.all([
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true })
      .eq('fulfillment_status', 'pending').eq('status', 'completed')
      .not('donation_type', 'in', '("monthly","weekly")')
      .lte('scheduled_fulfillment_at', now).not('scheduled_fulfillment_at', 'is', null),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true })
      .eq('fulfillment_status', 'pending').eq('status', 'completed')
      .not('donation_type', 'in', '("monthly","weekly")'),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true })
      .eq('fulfillment_status', 'fulfilled').eq('fulfillment_email_sent', false)
      .lte('fulfillment_email_scheduled_at', now).not('fulfillment_email_scheduled_at', 'is', null),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true })
      .eq('fulfillment_status', 'fulfilled').eq('fulfillment_email_sent', false),
    supabaseAdmin.from('donations').select('id, donor_email, campaign_name, fulfilled_at, fulfillment_email_sent')
      .eq('fulfillment_status', 'fulfilled').order('fulfilled_at', { ascending: false }).limit(5),
  ]);

  return new Response(JSON.stringify({
    fulfillment: {
      ready_now: readyFulfill.count || 0,
      total_pending: pendingFulfill.count || 0,
    },
    emails: {
      ready_now: readyEmail.count || 0,
      total_pending: pendingEmail.count || 0,
    },
    recent_fulfilled: recentFulfilled.data || [],
    current_time: now,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
