import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import Stripe from 'stripe';

export const prerender = false;

/**
 * Creates a SetupIntent for recurring donations.
 * This does NOT create a Subscription — it only sets up the payment method.
 * The actual Subscription is created by /api/payments/create-subscription
 * AFTER the user successfully confirms their payment details.
 *
 * Flow:
 * 1. Frontend calls this endpoint when mounting Payment Element for recurring
 * 2. Returns clientSecret for the SetupIntent
 * 3. User fills card details and confirms → stripe.confirmSetup()
 * 4. Frontend gets the confirmed PaymentMethod ID
 * 5. Frontend calls /api/payments/create-subscription with the PM ID
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { customer, billingAddress } = body;

    // Validate customer email
    if (!customer?.email?.trim()) {
      return new Response(JSON.stringify({ error: 'Email is required for recurring donations' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Stripe secret key from settings
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('stripe_secret_key, stripe_enabled')
      .single();

    if (!settings?.stripe_enabled || !settings?.stripe_secret_key) {
      return new Response(JSON.stringify({ error: 'Stripe is not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(settings.stripe_secret_key, {
      apiVersion: '2023-10-16',
    });

    // Create or retrieve Stripe customer
    let stripeCustomerId: string;
    const customers = await stripe.customers.list({ email: customer.email, limit: 1 });

    if (customers.data.length > 0) {
      stripeCustomerId = customers.data[0].id;
      // Update with latest info
      await stripe.customers.update(stripeCustomerId, {
        name: `${customer.firstName} ${customer.lastName}`.trim() || undefined,
        phone: customer.phone || undefined,
        address: billingAddress ? {
          line1: billingAddress.line1,
          line2: billingAddress.line2 || undefined,
          city: billingAddress.city,
          state: billingAddress.state,
          postal_code: billingAddress.postal_code,
          country: billingAddress.country,
        } : undefined,
      });
    } else {
      const newCustomer = await stripe.customers.create({
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`.trim() || undefined,
        phone: customer.phone || undefined,
        address: billingAddress ? {
          line1: billingAddress.line1,
          line2: billingAddress.line2 || undefined,
          city: billingAddress.city,
          state: billingAddress.state,
          postal_code: billingAddress.postal_code,
          country: billingAddress.country,
        } : undefined,
      });
      stripeCustomerId = newCustomer.id;
    }

    // Create SetupIntent — no charge, no subscription, just saves payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        customer_email: customer.email,
        customer_name: `${customer.firstName} ${customer.lastName}`,
      },
    });

    return new Response(JSON.stringify({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId: stripeCustomerId,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('SetupIntent creation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
