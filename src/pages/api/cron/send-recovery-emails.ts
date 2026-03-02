/**
 * GET /api/cron/send-recovery-emails
 *
 * Cron job that runs every 15 minutes (called externally).
 * Processes abandoned checkouts and sends timed recovery emails.
 *
 * Schedule:
 *   Step 1: 1 hour after abandoned_at
 *   Step 2: 24 hours after abandoned_at
 *   Step 3: 72 hours after abandoned_at
 *   Step 4: 5 days after abandoned_at
 *   Step 5: 7 days after abandoned_at (then mark closed lost)
 *
 * Authentication: Bearer token via CRON_SECRET env var.
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { sendRecoveryEmail } from '../../../lib/abandoned-checkout-emails';
import { syncCheckoutToGHL } from '../../../lib/abandoned-checkout-ghl';

export const prerender = false;

const CRON_SECRET = import.meta.env.CRON_SECRET || '';

// Delay thresholds in milliseconds from abandoned_at
const RECOVERY_SCHEDULE = [
  { step: 1, delayMs: 1 * 60 * 60 * 1000 },         // 1 hour
  { step: 2, delayMs: 24 * 60 * 60 * 1000 },        // 24 hours
  { step: 3, delayMs: 72 * 60 * 60 * 1000 },        // 72 hours
  { step: 4, delayMs: 5 * 24 * 60 * 60 * 1000 },    // 5 days
  { step: 5, delayMs: 7 * 24 * 60 * 60 * 1000 },    // 7 days
];

// Minimum gap between emails to prevent double-sends
const MIN_EMAIL_GAP_MS = 6 * 60 * 60 * 1000; // 6 hours

export const GET: APIRoute = async ({ request }) => {
  try {
    // Verify cron secret
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
    let closedLost = 0;
    let errors = 0;

    console.log(`[Recovery Cron] Processing at ${new Date(now).toISOString()}`);

    // Fetch abandoned checkouts eligible for recovery emails
    const { data: checkouts, error: fetchError } = await supabaseAdmin
      .from('abandoned_checkouts')
      .select('*')
      .eq('status', 'abandoned')
      .is('unsubscribed_at', null)
      .order('abandoned_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('[Recovery Cron] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Database error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    for (const checkout of checkouts || []) {
      const currentStep = checkout.recovery_step_last_sent || 0;
      const nextStep = currentStep + 1;

      // All 5 emails already sent
      if (nextStep > 5) {
        skipped++;
        continue;
      }

      // Check if enough time has elapsed for the next step
      // Use last_activity_at (when donor actually stopped) for more accurate timing
      // Falls back to abandoned_at if last_activity_at isn't available
      const inactiveAt = new Date(checkout.last_activity_at || checkout.abandoned_at).getTime();
      const schedule = RECOVERY_SCHEDULE[nextStep - 1];
      const sendAfter = inactiveAt + schedule.delayMs;

      if (now < sendAfter) {
        skipped++;
        continue;
      }

      // Rate limit: don't send more than one email per 6 hours
      if (checkout.recovery_last_sent_at) {
        const lastSent = new Date(checkout.recovery_last_sent_at).getTime();
        if (now - lastSent < MIN_EMAIL_GAP_MS) {
          skipped++;
          continue;
        }
      }

      // Build URLs
      const unsubscribeUrl = `https://www.qurbani.com/api/abandoned-checkout/unsubscribe?token=${checkout.resume_token}`;

      // Send the recovery email
      const result = await sendRecoveryEmail(nextStep, {
        email: checkout.email,
        firstName: checkout.first_name || 'Friend',
        amount: checkout.amount,
        campaignSlug: checkout.campaign_slug,
        campaignType: checkout.campaign_type,
        resumeUrl: checkout.resume_url,
        unsubscribeUrl,
      });

      if (result.success) {
        // Update the checkout record
        await supabaseAdmin
          .from('abandoned_checkouts')
          .update({
            recovery_step_last_sent: nextStep,
            recovery_last_sent_at: new Date().toISOString(),
          })
          .eq('id', checkout.id);

        // Sync to GHL: update recovery step + move pipeline stage
        await syncCheckoutToGHL({
          email: checkout.email,
          firstName: checkout.first_name,
          lastName: checkout.last_name,
          status: 'abandoned',
          amount: checkout.amount,
          currency: checkout.currency,
          campaignType: checkout.campaign_type,
          campaignSlug: checkout.campaign_slug,
          resumeUrl: checkout.resume_url,
          recoveryStep: nextStep,
          checkoutStartedAt: checkout.checkout_started_at,
          abandonedAt: checkout.abandoned_at,
          checkoutId: checkout.id,
        }).catch(err => console.error('[Recovery Cron] GHL sync error:', err));

        // After step 5: mark as expired (closed lost)
        if (nextStep === 5) {
          await supabaseAdmin
            .from('abandoned_checkouts')
            .update({ status: 'expired' })
            .eq('id', checkout.id);

          // Move GHL to Closed Lost
          await syncCheckoutToGHL({
            email: checkout.email,
            status: 'expired',
            amount: checkout.amount,
            currency: checkout.currency,
            campaignType: checkout.campaign_type,
            campaignSlug: checkout.campaign_slug,
            resumeUrl: checkout.resume_url,
            recoveryStep: 5,
            checkoutId: checkout.id,
          }).catch(err => console.error('[Recovery Cron] GHL closed-lost error:', err));

          closedLost++;
        }

        sent++;
      } else {
        errors++;
        console.error(`[Recovery Cron] Failed step ${nextStep} for ${checkout.email}: ${result.error}`);
      }

      // Rate limit between sends (avoid hitting Resend/GHL rate limits)
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[Recovery Cron] Done: ${sent} sent, ${skipped} skipped, ${closedLost} closed lost, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results: { sent, skipped, closed_lost: closedLost, errors },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Recovery Cron] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = GET;
