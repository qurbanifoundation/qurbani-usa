import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import Stripe from 'stripe';

export const prerender = false;

// Product ID for monthly donations (will be created on first use)
const MONTHLY_DONATION_PRODUCT_NAME = 'Monthly Donation';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { amount, currency = 'usd', items, customer, billingAddress, type = 'single', coverFees = false, feeAmount = 0, baseAmount } = body;

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

    // Create or retrieve Stripe customer (required for subscriptions)
    let stripeCustomerId: string;
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
    } else {
      // Customer email is required for subscriptions
      if (type === 'monthly') {
        return new Response(JSON.stringify({ error: 'Email is required for monthly donations' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // For one-time donations, create anonymous customer
      const newCustomer = await stripe.customers.create({
        description: 'Anonymous donor',
      });
      stripeCustomerId = newCustomer.id;
    }

    // Build metadata for tracking
    const metadata: Record<string, string> = {
      donation_type: type,
      covers_fees: coverFees ? 'true' : 'false',
      fee_amount: feeAmount.toString(),
      base_amount: (baseAmount || amount).toString(),
      items: JSON.stringify(items?.map((i: any) => ({
        campaign: i.campaign,
        amount: i.amount,
        quantity: i.quantity,
        label: i.label,
        name: i.name,
      })) || []),
    };

    if (customer) {
      metadata.customer_email = customer.email;
      metadata.customer_name = `${customer.firstName} ${customer.lastName}`;
      metadata.customer_phone = customer.phone || '';
    }

    // Handle MONTHLY subscriptions
    if (type === 'monthly') {
      return await createMonthlySubscription({
        stripe,
        stripeCustomerId,
        amount,
        currency,
        items,
        customer,
        billingAddress,
        metadata,
      });
    }

    // Handle SINGLE (one-time) donations
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
        covers_fees: coverFees,
        fee_amount: feeAmount,
        base_amount: baseAmount || amount,
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
      type: 'single',
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

// Helper function to create monthly subscription
async function createMonthlySubscription({
  stripe,
  stripeCustomerId,
  amount,
  currency,
  items,
  customer,
  billingAddress,
  metadata,
}: {
  stripe: Stripe;
  stripeCustomerId: string;
  amount: number;
  currency: string;
  items: any[];
  customer: any;
  billingAddress: any;
  metadata: Record<string, string>;
}) {
  try {
    // Get or create the monthly donation product
    let product: Stripe.Product;
    const existingProducts = await stripe.products.list({
      active: true,
      limit: 100,
    });

    const existingProduct = existingProducts.data.find(p => p.name === MONTHLY_DONATION_PRODUCT_NAME);

    if (existingProduct) {
      product = existingProduct;
    } else {
      product = await stripe.products.create({
        name: MONTHLY_DONATION_PRODUCT_NAME,
        description: 'Monthly recurring donation to Qurbani USA',
      });
    }

    // Create a dynamic price for this specific amount
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100), // Convert to cents
      currency,
      recurring: {
        interval: 'month',
      },
      metadata: {
        donation_amount: amount.toString(),
      },
    });

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        ...metadata,
        donation_items: JSON.stringify(items || []),
      },
    });

    // Get the client secret from the subscription's first invoice
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    if (!paymentIntent?.client_secret) {
      throw new Error('Failed to create subscription payment');
    }

    // Calculate next billing date
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    // Create subscription record in database
    const { data: subscriptionRecord, error: subError } = await supabaseAdmin
      .from('donation_subscriptions')
      .insert({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: stripeCustomerId,
        donor_email: customer?.email,
        donor_name: customer ? `${customer.firstName} ${customer.lastName}` : null,
        amount,
        currency,
        status: 'active',
        items: items || [],
        next_billing_date: nextBillingDate.toISOString(),
      })
      .select()
      .single();

    if (subError) {
      console.error('Error creating subscription record:', subError);
    }

    // Create pending donation record for the first payment
    const { data: donation, error: donationError } = await supabaseAdmin
      .from('donations')
      .insert({
        stripe_payment_intent_id: paymentIntent.id,
        stripe_subscription_id: subscription.id,
        amount,
        currency,
        status: 'pending',
        donation_type: 'monthly',
        donor_email: customer?.email,
        donor_name: customer ? `${customer.firstName} ${customer.lastName}` : null,
        donor_phone: customer?.phone,
        items: items || [],
        metadata: {
          stripe_customer_id: stripeCustomerId,
          billing_address: billingAddress || null,
          is_recurring: true,
          subscription_id: subscriptionRecord?.id,
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
      subscriptionId: subscription.id,
      donationId: donation?.id,
      type: 'subscription',
      nextBillingDate: nextBillingDate.toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Subscription creation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
