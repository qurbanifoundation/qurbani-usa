/**
 * GET /api/cron/send-zakat-drip-emails
 *
 * Cron job that runs every 15 minutes (called by Cloudflare Worker).
 * Processes zakat_email_queue and sends timed drip emails.
 *
 * Schedule:
 *   Step 1: Immediate (handled by track-zakat.ts — already sent)
 *   Step 2: 24 hours after created_at
 *   Step 3: 72 hours (3 days) after created_at
 *   Step 4: 168 hours (7 days) after created_at → then mark expired
 *
 * Authentication: Bearer token via CRON_SECRET env var.
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { sendZakatDripEmail } from '../../../lib/zakat-drip-emails';

export const prerender = false;

const CRON_SECRET = import.meta.env.CRON_SECRET || '';

// Delay thresholds in milliseconds from created_at
const DRIP_SCHEDULE = [
  { step: 2, delayMs: 24 * 60 * 60 * 1000 },        // 24 hours
  { step: 3, delayMs: 72 * 60 * 60 * 1000 },         // 3 days
  { step: 4, delayMs: 168 * 60 * 60 * 1000 },        // 7 days
];

// Minimum gap between emails to prevent double-sends
const MIN_EMAIL_GAP_MS = 6 * 60 * 60 * 1000; // 6 hours

export const GET: APIRoute = async ({ request }) => {
  try {
    const requestUrl = new URL(request.url);
    const siteBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

    // Verify cron secret (skip in dev)
    const authHeader = request.headers.get('Authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = Date.now();
    let sent = 0;
    let skipped = 0;
    let expired = 0;
    let errors = 0;

    console.log(`[Zakat Drip Cron] Processing at ${new Date(now).toISOString()}`);

    // Fetch active queue entries
    const { data: queueItems, error: fetchError } = await supabaseAdmin
      .from('zakat_email_queue')
      .select('*')
      .eq('status', 'active')
      .is('unsubscribed_at', null)
      .is('converted_at', null)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('[Zakat Drip Cron] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Database error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    for (const item of queueItems || []) {
      const currentStep = item.drip_step_last_sent || 1;
      const nextStep = currentStep + 1;

      // All 4 emails already sent (steps 1-4)
      if (nextStep > 4) {
        skipped++;
        continue;
      }

      // Check if enough time has elapsed for the next step
      const createdAt = new Date(item.created_at).getTime();
      const schedule = DRIP_SCHEDULE.find(s => s.step === nextStep);
      if (!schedule) {
        skipped++;
        continue;
      }

      const sendAfter = createdAt + schedule.delayMs;
      if (now < sendAfter) {
        skipped++;
        continue;
      }

      // Rate limit: don't send more than one email per MIN_EMAIL_GAP_MS
      if (item.drip_last_sent_at) {
        const lastSent = new Date(item.drip_last_sent_at).getTime();
        if (now - lastSent < MIN_EMAIL_GAP_MS) {
          skipped++;
          continue;
        }
      }

      // Build URLs
      const unsubscribeUrl = `${siteBaseUrl}/api/zakat/unsubscribe?token=${item.unsubscribe_token}`;
      const payUrl = item.pay_url || `https://www.qurbani.com/zakat?amount=${Number(item.zakat_amount).toFixed(2)}`;

      // Send the drip email
      const result = await sendZakatDripEmail(nextStep, {
        email: item.email,
        firstName: item.first_name || 'Friend',
        zakatAmount: Number(item.zakat_amount),
        payUrl,
        unsubscribeUrl,
      });

      if (result.success) {
        // Update the queue record
        const updateData: Record<string, unknown> = {
          drip_step_last_sent: nextStep,
          drip_last_sent_at: new Date().toISOString(),
        };

        // After step 4: mark as expired (sequence complete)
        if (nextStep === 4) {
          updateData.status = 'expired';
          expired++;
        }

        await supabaseAdmin
          .from('zakat_email_queue')
          .update(updateData)
          .eq('id', item.id);

        sent++;
      } else {
        errors++;
        console.error(`[Zakat Drip Cron] Failed step ${nextStep} for ${item.email}: ${result.error}`);
      }

      // Rate limit between sends (avoid hitting Resend rate limits)
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[Zakat Drip Cron] Done: ${sent} sent, ${skipped} skipped, ${expired} expired, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results: { sent, skipped, expired, errors },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Zakat Drip Cron] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = GET;
