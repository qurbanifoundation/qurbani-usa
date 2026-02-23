/**
 * Cron Job: Process Daily Ramadan Donations
 * GET /api/cron/process-ramadan-donations
 *
 * This endpoint should be called daily (ideally after Maghrib time)
 * by a cron service like Vercel Cron, Cloudflare Workers, or a scheduler.
 *
 * It processes all pending donations for the current date.
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Optional: Add a secret key to protect this endpoint
const CRON_SECRET = import.meta.env.CRON_SECRET || '';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('Authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split('T')[0];

    console.log(`[Cron] Processing donations for ${today}`);

    // Find all pending donation nights for today
    const { data: pendingNights, error: fetchError } = await supabase
      .from('automated_donation_nights')
      .select(`
        *,
        automated_donations!inner(
          id,
          donor_name,
          donor_email,
          status,
          stripe_customer_id,
          stripe_payment_intent_id
        )
      `)
      .eq('scheduled_date', today)
      .eq('status', 'pending')
      .eq('automated_donations.status', 'active');

    if (fetchError) {
      console.error('[Cron] Error fetching pending nights:', fetchError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Cron] Found ${pendingNights?.length || 0} donations to process`);

    const results = {
      processed: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    };

    // Process each pending night
    for (const night of pendingNights || []) {
      try {
        // Update status to processing
        await supabase
          .from('automated_donation_nights')
          .update({ status: 'processing' })
          .eq('id', night.id);

        // In a real implementation, you would:
        // 1. Create a Stripe charge or payment intent
        // 2. Record the transaction
        // 3. Send confirmation email

        // For now, we'll just mark it as completed
        // (In production, replace this with actual payment processing)

        /*
        // Example Stripe charge (commented out - implement when ready):
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const charge = await stripe.charges.create({
          amount: Math.round(night.amount * 100),
          currency: 'usd',
          customer: night.automated_donations.stripe_customer_id,
          description: `30 Days of Ramadan - Night ${night.night_number}`,
          metadata: {
            donation_id: night.automated_donation_id,
            night_id: night.id,
            night_number: night.night_number,
          }
        });
        */

        // Mark as completed
        const { error: updateError } = await supabase
          .from('automated_donation_nights')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            // stripe_charge_id: charge.id, // Uncomment when using Stripe
          })
          .eq('id', night.id);

        if (updateError) {
          throw new Error(`Failed to update night ${night.id}: ${updateError.message}`);
        }

        results.processed++;
        results.details.push({
          night_id: night.id,
          donation_id: night.automated_donation_id,
          night_number: night.night_number,
          amount: night.amount,
          status: 'completed'
        });

        console.log(`[Cron] Processed night ${night.night_number} for donation ${night.automated_donation_id}`);

      } catch (err: any) {
        console.error(`[Cron] Error processing night ${night.id}:`, err);

        // Mark as failed
        await supabase
          .from('automated_donation_nights')
          .update({
            status: 'failed',
            error_message: err.message || 'Unknown error'
          })
          .eq('id', night.id);

        results.failed++;
        results.details.push({
          night_id: night.id,
          donation_id: night.automated_donation_id,
          night_number: night.night_number,
          status: 'failed',
          error: err.message
        });
      }
    }

    // Check if any donations are now complete (all nights processed)
    await checkAndCompleteAutomatedDonations(supabase);

    console.log(`[Cron] Completed. Processed: ${results.processed}, Failed: ${results.failed}`);

    return new Response(JSON.stringify({
      success: true,
      date: today,
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Cron] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function checkAndCompleteAutomatedDonations(supabase: any) {
  // Find donations where all nights are completed
  const { data: donations } = await supabase
    .from('automated_donations')
    .select('id')
    .eq('status', 'active');

  for (const donation of donations || []) {
    const { data: nights } = await supabase
      .from('automated_donation_nights')
      .select('status')
      .eq('automated_donation_id', donation.id);

    const allCompleted = nights?.every((n: any) => n.status === 'completed');

    if (allCompleted && nights?.length > 0) {
      await supabase
        .from('automated_donations')
        .update({ status: 'completed' })
        .eq('id', donation.id);

      console.log(`[Cron] Marked donation ${donation.id} as completed`);
    }
  }
}

// Also support POST for some cron services
export const POST: APIRoute = GET;
