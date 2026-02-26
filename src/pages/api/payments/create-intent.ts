import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import Stripe from 'stripe';

export const prerender = false;

// Product names for recurring donations
const MONTHLY_DONATION_PRODUCT_NAME = 'Monthly Donation';
const WEEKLY_DONATION_PRODUCT_NAME = 'Jummah (Friday) Donation';

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

    // Server-side amount verification: items total must match submitted amount
    if (items && Array.isArray(items) && items.length > 0) {
      const itemsTotal = items.reduce((sum: number, item: any) => {
        const itemAmount = parseFloat(item.amount) || 0;
        const qty = parseInt(item.quantity) || 1;
        return sum + (itemAmount * qty);
      }, 0);

      // Expected total = items total + optional fee
      const expectedAmount = coverFees ? itemsTotal + (parseFloat(feeAmount) || 0) : itemsTotal;

      // Allow small floating point tolerance (1 cent)
      if (Math.abs(amount - expectedAmount) > 0.01) {
        console.error(`Amount mismatch: client sent ${amount}, items total ${expectedAmount} (items: ${itemsTotal}, fees: ${feeAmount})`);
        return new Response(JSON.stringify({ error: 'Amount does not match items total' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
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
      if (type === 'monthly' || type === 'weekly') {
        return new Response(JSON.stringify({ error: 'Email is required for recurring donations' }), {
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

    // Build metadata for tracking - include item metadata (childName, notes, etc.)
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
        // Include item-specific metadata (Aqiqah child name, notes, etc.)
        metadata: i.metadata || null,
      })) || []),
    };

    if (customer) {
      metadata.customer_email = customer.email;
      metadata.customer_name = `${customer.firstName} ${customer.lastName}`;
      metadata.customer_phone = customer.phone || '';
    }

    // Handle recurring subscriptions (monthly or weekly/Jummah)
    if (type === 'monthly' || type === 'weekly') {
      return await createRecurringSubscription({
        stripe,
        stripeCustomerId,
        amount,
        currency,
        items,
        customer,
        billingAddress,
        metadata,
        interval: type, // 'monthly' or 'weekly'
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

    // Prepare items with full metadata (childName, notes, etc.)
    const itemsWithMetadata = items?.map((i: any) => ({
      id: i.id,
      campaign: i.campaign,
      amount: i.amount,
      quantity: i.quantity || 1,
      label: i.label,
      name: i.name,
      type: i.type,
      // Include item-specific metadata (Aqiqah child name, notes, etc.)
      childName: i.metadata?.childName || null,
      packageType: i.metadata?.packageType || null,
      aqiqahFor: i.metadata?.aqiqahFor || null,
      notes: i.metadata?.notes || null,
      metadata: i.metadata || null,
    })) || [];

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
        items: itemsWithMetadata,
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

// Helper function to get next Friday (for Jummah donations)
function getNextFriday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7; // If today is Friday, get next Friday
  const nextFriday = new Date(now);
  nextFriday.setDate(now.getDate() + daysUntilFriday);
  nextFriday.setHours(12, 0, 0, 0); // Set to noon on Friday
  return nextFriday;
}

// Helper function to create recurring subscription (monthly or weekly)
async function createRecurringSubscription({
  stripe,
  stripeCustomerId,
  amount,
  currency,
  items,
  customer,
  billingAddress,
  metadata,
  interval,
}: {
  stripe: Stripe;
  stripeCustomerId: string;
  amount: number;
  currency: string;
  items: any[];
  customer: any;
  billingAddress: any;
  metadata: Record<string, string>;
  interval: 'monthly' | 'weekly';
}) {
  try {
    const isWeekly = interval === 'weekly';
    const productName = isWeekly ? WEEKLY_DONATION_PRODUCT_NAME : MONTHLY_DONATION_PRODUCT_NAME;
    const productDescription = isWeekly
      ? 'Jummah (Friday) recurring donation to Qurbani USA'
      : 'Monthly recurring donation to Qurbani USA';

    // Get or create the donation product
    let product: Stripe.Product;
    const existingProducts = await stripe.products.list({
      active: true,
      limit: 100,
    });

    const existingProduct = existingProducts.data.find(p => p.name === productName);

    if (existingProduct) {
      product = existingProduct;
    } else {
      product = await stripe.products.create({
        name: productName,
        description: productDescription,
      });
    }

    // Create a dynamic price for this specific amount
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100), // Convert to cents
      currency,
      recurring: {
        interval: isWeekly ? 'week' : 'month',
      },
      metadata: {
        donation_amount: amount.toString(),
        interval_type: interval,
      },
    });

    // For weekly (Jummah) subscriptions, anchor to next Friday
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
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
        interval_type: interval,
        is_jummah: isWeekly ? 'true' : 'false',
      },
    };

    // For weekly subscriptions, set billing cycle anchor to next Friday
    if (isWeekly) {
      const nextFriday = getNextFriday();
      subscriptionParams.billing_cycle_anchor = Math.floor(nextFriday.getTime() / 1000);
      subscriptionParams.proration_behavior = 'none';
    }

    // Create the subscription
    const subscription = await stripe.subscriptions.create(subscriptionParams);

    // Get the client secret from the subscription's first invoice
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    if (!paymentIntent?.client_secret) {
      throw new Error('Failed to create subscription payment');
    }

    // Calculate next billing date
    const nextBillingDate = isWeekly ? getNextFriday() : new Date();
    if (!isWeekly) {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    // Prepare items with full metadata (childName, notes, etc.)
    const itemsWithMetadata = items?.map((i: any) => ({
      id: i.id,
      campaign: i.campaign,
      amount: i.amount,
      quantity: i.quantity || 1,
      label: i.label,
      name: i.name,
      type: i.type,
      childName: i.metadata?.childName || null,
      packageType: i.metadata?.packageType || null,
      aqiqahFor: i.metadata?.aqiqahFor || null,
      notes: i.metadata?.notes || null,
      metadata: i.metadata || null,
    })) || [];

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
        interval: interval,
        items: itemsWithMetadata,
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
        donation_type: interval,
        donor_email: customer?.email,
        donor_name: customer ? `${customer.firstName} ${customer.lastName}` : null,
        donor_phone: customer?.phone,
        items: itemsWithMetadata,
        metadata: {
          stripe_customer_id: stripeCustomerId,
          billing_address: billingAddress || null,
          is_recurring: true,
          is_jummah: isWeekly,
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
      interval: interval,
      isJummah: isWeekly,
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
