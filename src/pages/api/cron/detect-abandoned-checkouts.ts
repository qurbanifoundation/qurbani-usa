/**
 * GET /api/cron/detect-abandoned-checkouts
 *
 * Cron job that runs every 10 minutes (called externally).
 * 1. Marks checkouts as "abandoned" if inactive for 30+ minutes.
 * 2. Marks old abandoned checkouts as "expired" after 14 days.
 *
 * Authentication: Bearer token via CRON_SECRET env var.
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { syncCheckoutToGHL } from '../../../lib/abandoned-checkout-ghl';

export const prerender = false;

const CRON_SECRET = import.meta.env.CRON_SECRET || '';
const ABANDONMENT_THRESHOLD_MIN = 30;
const EXPIRATION_THRESHOLD_DAYS = 14;

export const GET: APIRoute = async ({ request }) => {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('Authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    console.log(`[Cron] Detecting abandoned checkouts at ${now.toISOString()}`);

    // Step 1: Mark stale "started" checkouts as "abandoned"
    const thresholdTime = new Date(now.getTime() - ABANDONMENT_THRESHOLD_MIN * 60 * 1000).toISOString();

    const { data: abandoned, error: abandonError } = await supabaseAdmin
      .from('abandoned_checkouts')
      .update({
        status: 'abandoned',
        abandoned_at: now.toISOString(),
      })
      .eq('status', 'started')
      .lt('last_activity_at', thresholdTime)
      .select('id, email');

    if (abandonError) {
      console.error('[Cron] Error marking abandoned:', abandonError);
    }

    const newlyAbandoned = abandoned?.length || 0;
    if (newlyAbandoned > 0) {
      console.log(`[Cron] Marked ${newlyAbandoned} checkout(s) as abandoned`);

      // Sync newly abandoned checkouts to GHL
      for (const checkout of abandoned || []) {
        const { data: full } = await supabaseAdmin
          .from('abandoned_checkouts')
          .select('*')
          .eq('id', checkout.id)
          .single();

        if (full) {
          await syncCheckoutToGHL({
            email: full.email,
            firstName: full.first_name,
            lastName: full.last_name,
            status: 'abandoned',
            amount: full.amount,
            currency: full.currency,
            campaignType: full.campaign_type,
            campaignSlug: full.campaign_slug,
            resumeUrl: full.resume_url,
            recoveryStep: 0,
            checkoutStartedAt: full.checkout_started_at,
            abandonedAt: full.abandoned_at,
            utmSource: full.utm_source,
            utmMedium: full.utm_medium,
            utmCampaign: full.utm_campaign,
            utmTerm: full.utm_term,
            checkoutId: full.id,
          }).catch(err => console.error('[Cron] GHL sync error for', checkout.email, err));

          // Rate limit between GHL calls
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    // Step 2: Expire old abandoned checkouts (14+ days)
    const expirationTime = new Date(now.getTime() - EXPIRATION_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: expired, error: expireError } = await supabaseAdmin
      .from('abandoned_checkouts')
      .update({ status: 'expired' })
      .eq('status', 'abandoned')
      .lt('abandoned_at', expirationTime)
      .select('id');

    if (expireError) {
      console.error('[Cron] Error expiring old checkouts:', expireError);
    }

    const newlyExpired = expired?.length || 0;
    if (newlyExpired > 0) {
      console.log(`[Cron] Expired ${newlyExpired} old checkout(s)`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now.toISOString(),
        results: {
          newly_abandoned: newlyAbandoned,
          newly_expired: newlyExpired,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Cron] Detect abandoned checkouts error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Also support POST for cron services that only send POST
export const POST: APIRoute = GET;
