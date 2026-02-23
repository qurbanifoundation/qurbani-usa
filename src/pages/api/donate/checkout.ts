/**
 * Donation Checkout API
 * POST /api/donate/checkout
 *
 * Creates a Stripe Checkout session for donations
 * Also saves lead to Supabase and syncs to GHL
 */
import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../../lib/supabase';
import { syncDonationToGHL } from '../../../lib/ghl';

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

interface DonationRequest {
  cause: string;
  amount: number;
  frequency: 'single' | 'monthly';
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  onBehalfOf?: string;
}

// Cause labels for display
const causeLabels: Record<string, string> = {
  'most-needed': 'Where Most Needed',
  'emergencies': 'Emergency Relief',
  'zakat': 'Zakat',
  'water-for-life': 'Water Projects',
  'orphan-sponsorship': 'Orphan Care',
  'food-aid': 'Food Aid',
  'healthcare': 'Healthcare',
  'education': 'Education',
  'sadaqah-jariyah': 'Sadaqah Jariyah',
  'qurbani': 'Qurbani',
  'ramadan': 'Ramadan',
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body: DonationRequest = await request.json();
    const { cause, amount, frequency, firstName, lastName, email, phone, onBehalfOf } = body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return errorResponse('Please provide your name and email', 400);
    }

    if (!amount || amount < 1) {
      return errorResponse('Please enter a valid donation amount', 400);
    }

    const donorName = `${firstName} ${lastName}`;
    const causeLabel = causeLabels[cause] || cause || 'General Donation';

    // 1. Save lead to Supabase
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .insert({
        email: email.toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        source: 'donation',
        subject: causeLabel,
        form_data: {
          cause,
          amount,
          frequency,
          onBehalfOf,
        },
        status: 'new',
      })
      .select('id')
      .single();

    // 2. Create donation record
    const { data: donation, error: donationError } = await supabaseAdmin
      .from('donations')
      .insert({
        donor_email: email.toLowerCase(),
        donor_name: donorName,
        donor_phone: phone || null,
        amount,
        campaign_name: causeLabel,
        campaign_slug: cause, // For GHL campaign tracking
        donation_type: frequency,
        on_behalf_of: onBehalfOf || null,
        status: 'pending',
        items: [{ name: causeLabel, amount }],
      })
      .select('id')
      .single();

    if (donationError) {
      console.error('Donation record error:', donationError);
    }

    // 3. Create Stripe Checkout Session
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: causeLabel,
          description: onBehalfOf ? `On behalf of: ${onBehalfOf}` : `Donation to ${causeLabel}`,
        },
        unit_amount: Math.round(amount * 100), // Convert to cents
        ...(frequency === 'monthly' ? { recurring: { interval: 'month' } } : {}),
      },
      quantity: 1,
    }];

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: frequency === 'monthly' ? 'subscription' : 'payment',
      success_url: `${new URL(request.url).origin}/donation/success?donation_id=${donation?.id || ''}&amount=${amount}`,
      cancel_url: `${new URL(request.url).origin}/donate`,
      customer_email: email,
      metadata: {
        donation_id: donation?.id || '',
        lead_id: lead?.id || '',
        cause,
        donor_name: donorName,
        donor_phone: phone || '',
        on_behalf_of: onBehalfOf || '',
        frequency,
      },
      ...(frequency === 'single' ? {
        payment_intent_data: {
          metadata: {
            donation_id: donation?.id || '',
            cause,
          },
        },
      } : {
        subscription_data: {
          metadata: {
            donation_id: donation?.id || '',
            cause,
          },
        },
      }),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    // 4. Update donation with Stripe session ID
    if (donation?.id) {
      await supabaseAdmin
        .from('donations')
        .update({
          stripe_checkout_session_id: session.id,
        })
        .eq('id', donation.id);
    }

    // 5. Sync to GHL (async, don't wait)
    syncDonationToGHL({
      donorEmail: email,
      donorName,
      donorPhone: phone,
      amount,
      campaignName: causeLabel,
      donationType: frequency,
    }).catch(err => console.error('GHL sync error:', err));

    // Update lead with GHL sync attempt
    if (lead?.id) {
      supabaseAdmin
        .from('leads')
        .update({ ghl_synced_at: new Date().toISOString() })
        .eq('id', lead.id)
        .then(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: session.url,
        sessionId: session.id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Donation checkout error:', error);
    return errorResponse(error.message || 'Failed to process donation', 500);
  }
};

function errorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}
