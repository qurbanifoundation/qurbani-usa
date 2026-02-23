import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import Stripe from 'stripe';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { amount, currency = 'usd', items, customer, billingAddress, type = 'single' } = body;

    // Validate amount
    if (!amount || amount < 1) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Stripe secret key from settings
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('stripe_secret_key, stripe_enabled, payment_test_mode')
      .single();

    if (!settings?.stripe_enabled) {
      return new Response(JSON.stringify({ error: 'Stripe payments are disabled' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!settings?.stripe_secret_key) {
      return new Response(JSON.stringify({ error: 'Stripe is not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(settings.stripe_secret_key, {
      apiVersion: '2023-10-16',
    });

    // Create or retrieve Stripe customer
    let stripeCustomerId: string | undefined;
    if (customer?.email) {
      const customers = await stripe.customers.list({ email: customer.email, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
        // Update customer with latest address
        if (billingAddress) {
          await stripe.customers.update(stripeCustomerId, {
            address: {
              line1: billingAddress.line1,
              line2: billingAddress.line2 || undefined,
              city: billingAddress.city,
              state: billingAddress.state,
              postal_code: billingAddress.postal_code,
              country: billingAddress.country,
            },
          });
        }
      } else {
        const newCustomer = await stripe.customers.create({
          email: customer.email,
          name: `${customer.firstName} ${customer.lastName}`,
          phone: customer.phone,
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
    }

    // Build metadata for tracking
    const metadata: Record<string, string> = {
      donation_type: type,
      items: JSON.stringify(items?.map((i: any) => ({
        campaign: i.campaign,
        amount: i.amount,
        quantity: i.quantity,
        label: i.label,
      })) || []),
    };

    if (customer) {
      metadata.customer_email = customer.email;
      metadata.customer_name = `${customer.firstName} ${customer.lastName}`;
      metadata.customer_phone = customer.phone || '';
    }

    // Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      customer: stripeCustomerId,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
      description: `Donation - ${items?.map((i: any) => i.name).join(', ') || 'General'}`,
    });

    // Create pending donation record
    const { data: donation, error: donationError } = await supabaseAdmin
      .from('donations')
      .insert({
        stripe_payment_intent_id: paymentIntent.id,
        amount,
        currency,
        status: 'pending',
        donation_type: type,
        donor_email: customer?.email,
        donor_name: customer ? `${customer.firstName} ${customer.lastName}` : null,
        donor_phone: customer?.phone,
        items: items || [],
        metadata: {
          stripe_customer_id: stripeCustomerId,
          billing_address: billingAddress || null,
        },
      })
      .select()
      .single();

    if (donationError) {
      console.error('Error creating donation record:', donationError);
    }

    return new Response(JSON.stringify({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      donationId: donation?.id,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Payment intent error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
