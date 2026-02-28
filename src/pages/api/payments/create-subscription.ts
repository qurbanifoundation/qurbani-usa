import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import Stripe from 'stripe';

export const prerender = false;

// Product names for recurring donations
const DONATION_PRODUCT_NAMES: Record<string, string> = {
  monthly: 'Monthly Donation',
  weekly: 'Jummah (Friday) Donation',
  yearly: 'Yearly Donation',
  daily: 'Daily Donation',
};

// Map interval keys to Stripe interval values
const STRIPE_INTERVALS: Record<string, Stripe.Price.Recurring.Interval> = {
  monthly: 'month',
  weekly: 'week',
  yearly: 'year',
  daily: 'day',
};

// Helper function to get next Friday (for Jummah donations)
function getNextFriday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  const nextFriday = new Date(now);
  nextFriday.setDate(now.getDate() + daysUntilFriday);
  nextFriday.setHours(12, 0, 0, 0);
  return nextFriday;
}

/**
 * Creates a Subscription AFTER the user has confirmed their payment method via SetupIntent.
 *
 * Flow:
 * 1. User's payment method was saved via SetupIntent + confirmSetup()
 * 2. Frontend sends the paymentMethodId here
 * 3. We attach the PM to the customer, create the Subscription, and charge immediately
 * 4. The Subscription is REAL from the start — no "incomplete" junk
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      paymentMethodId,
      customerId,
      amount,
      currency = 'usd',
      items,
      customer,
      billingAddress,
      interval = 'monthly',
      coverFees = false,
      feeAmount = 0,
      baseAmount,
    } = body;

    // Validate required fields
    if (!paymentMethodId) {
      return new Response(JSON.stringify({ error: 'Payment method is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!customerId) {
      return new Response(JSON.stringify({ error: 'Customer ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!amount || amount < 1) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Stripe secret key
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

    // Attach payment method to customer and set as default
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Get or create the donation product
    const isWeekly = interval === 'weekly';
    const stripeInterval = STRIPE_INTERVALS[interval] || 'month';
    const productName = DONATION_PRODUCT_NAMES[interval] || 'Recurring Donation';
    const productDescription = isWeekly
      ? 'Jummah (Friday) recurring donation to Qurbani USA'
      : `${interval.charAt(0).toUpperCase() + interval.slice(1)} recurring donation to Qurbani USA`;

    let product: Stripe.Product;
    const existingProducts = await stripe.products.list({ active: true, limit: 100 });
    const existingProduct = existingProducts.data.find(p => p.name === productName);

    if (existingProduct) {
      product = existingProduct;
    } else {
      product = await stripe.products.create({
        name: productName,
        description: productDescription,
      });
    }

    // Create a price for this amount
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100),
      currency,
      recurring: {
        interval: stripeInterval,
      },
      metadata: {
        donation_amount: amount.toString(),
        interval_type: interval,
      },
    });

    // Build metadata
    const itemsSummary = items?.map((i: any) => ({
      c: i.campaign,
      a: i.amount,
      q: i.quantity,
      n: i.name,
    })) || [];
    let itemsJson = JSON.stringify(itemsSummary);
    if (itemsJson.length > 500) {
      const minimal = items?.map((i: any) => ({ c: i.campaign, a: i.amount, q: i.quantity })) || [];
      itemsJson = JSON.stringify(minimal);
    }
    if (itemsJson.length > 500) {
      itemsJson = itemsJson.substring(0, 497) + '...';
    }

    const metadata: Record<string, string> = {
      donation_type: interval,
      covers_fees: coverFees ? 'true' : 'false',
      fee_amount: (feeAmount || 0).toString(),
      base_amount: (baseAmount || amount).toString(),
      donation_items: itemsJson,
      interval_type: interval,
      is_jummah: isWeekly ? 'true' : 'false',
    };

    if (customer) {
      metadata.customer_email = customer.email;
      metadata.customer_name = `${customer.firstName} ${customer.lastName}`;
      metadata.customer_phone = customer.phone || '';
    }

    // Create the subscription with the saved payment method
    // Since the PM is already confirmed via SetupIntent, this charges immediately
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: price.id }],
      default_payment_method: paymentMethodId,
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata,
    };

    // For weekly subscriptions, anchor billing to next Friday
    if (isWeekly) {
      const nextFriday = getNextFriday();
      subscriptionParams.billing_cycle_anchor = Math.floor(nextFriday.getTime() / 1000);
      subscriptionParams.proration_behavior = 'none';
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    // Get payment info from first invoice
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    // Calculate next billing date based on interval
    const nextBillingDate = isWeekly ? getNextFriday() : new Date();
    if (interval === 'monthly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else if (interval === 'yearly') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else if (interval === 'daily') {
      nextBillingDate.setDate(nextBillingDate.getDate() + 1);
    }

    // Prepare items with full metadata
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

    // Extract campaign info
    const primaryItem = items?.[0];
    const campaignSlug = primaryItem?.campaign || 'general';
    const campaignName = primaryItem?.name || 'General Donation';

    // Create subscription record in database
    const { data: subscriptionRecord, error: subError } = await supabaseAdmin
      .from('donation_subscriptions')
      .insert({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        donor_email: customer?.email,
        donor_name: customer ? `${customer.firstName} ${customer.lastName}` : null,
        donor_phone: customer?.phone,
        amount,
        currency,
        status: subscription.status === 'active' ? 'active' : 'pending',
        interval: interval,
        items: itemsWithMetadata,
        campaign_slug: campaignSlug,
        next_billing_date: nextBillingDate.toISOString(),
      })
      .select()
      .single();

    if (subError) {
      console.error('Error creating subscription record:', subError);
    }

    // Create donation record for the first payment
    const { data: donation, error: donationError } = await supabaseAdmin
      .from('donations')
      .insert({
        stripe_payment_intent_id: paymentIntent?.id || null,
        stripe_subscription_id: subscription.id,
        amount,
        currency,
        status: paymentIntent?.status === 'succeeded' ? 'completed' : 'pending',
        donation_type: interval,
        donor_email: customer?.email,
        donor_name: customer ? `${customer.firstName} ${customer.lastName}` : null,
        donor_phone: customer?.phone,
        items: itemsWithMetadata,
        campaign_slug: campaignSlug,
        campaign_name: campaignName,
        covers_fees: coverFees,
        fee_amount: feeAmount,
        base_amount: baseAmount || amount,
        metadata: {
          stripe_customer_id: customerId,
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
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      donationId: donation?.id,
      paymentIntentId: paymentIntent?.id || null,
      paymentIntentStatus: paymentIntent?.status || null,
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
};
