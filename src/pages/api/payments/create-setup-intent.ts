import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { getStripe } from '../../../lib/stripe-cache';

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
    const { customer, billingAddress, resumeToken } = body;

    // Validate customer email
    if (!customer?.email?.trim()) {
      return new Response(JSON.stringify({ error: 'Email is required for recurring donations' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get cached Stripe instance
    const stripe = await getStripe();

    // Create or retrieve Stripe customer
    let stripeCustomerId: string;
    const customers = await stripe.customers.list({ email: customer.email, limit: 1 });

    if (customers.data.length > 0) {
      stripeCustomerId = customers.data[0].id;
      // Update with latest info (fire-and-forget — don't block setup)
      stripe.customers.update(stripeCustomerId, {
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
      }).catch((e: any) => console.error('Customer update error:', e));
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
        ...(resumeToken ? { resume_token: resumeToken } : {}),
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
