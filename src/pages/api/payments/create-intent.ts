import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { getStripe } from '../../../lib/stripe-cache';

export const prerender = false;

// Product names for recurring donations
const MONTHLY_DONATION_PRODUCT_NAME = 'Monthly Donation';
const WEEKLY_DONATION_PRODUCT_NAME = 'Jummah (Friday) Donation';
const DONATION_PRODUCT_NAMES: Record<string, string> = {
  monthly: 'Monthly Donation',
  weekly: 'Jummah (Friday) Donation',
  yearly: 'Yearly Donation',
  daily: 'Daily Donation',
};
const STRIPE_INTERVALS: Record<string, string> = {
  monthly: 'month',
  weekly: 'week',
  yearly: 'year',
  daily: 'day',
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { amount, currency = 'usd', items, customer, billingAddress, type = 'single', coverFees = false, feeAmount = 0, baseAmount, resumeToken, checkout_source, ga_client_id, ga_session_id, utm_source, utm_medium, utm_campaign, utm_content, journey } = body;

    // Validate amount
    if (!amount || amount < 1) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate customer email is provided (required for GHL sync, receipts, admin notifications)
    if (!customer?.email?.trim()) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
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

    // Get cached Stripe instance (avoids Supabase query on warm requests)
    const stripe = await getStripe();

    // Create or retrieve Stripe customer — run in parallel with abandoned checkout recovery
    const customerPromise = (async () => {
      if (customer?.email) {
        const customers = await stripe.customers.list({ email: customer.email, limit: 1 });
        if (customers.data.length > 0) {
          const existingId = customers.data[0].id;
          // Update customer with latest address (fire-and-forget — don't block payment)
          if (billingAddress) {
            stripe.customers.update(existingId, {
              address: {
                line1: billingAddress.line1,
                line2: billingAddress.line2 || undefined,
                city: billingAddress.city,
                state: billingAddress.state,
                postal_code: billingAddress.postal_code,
                country: billingAddress.country,
              },
            }).catch((e: any) => console.error('Customer update error:', e));
          }
          return existingId;
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
          return newCustomer.id;
        }
      } else {
        if (type === 'monthly' || type === 'weekly' || type === 'yearly' || type === 'daily') {
          throw new Error('Email is required for recurring donations');
        }
        const newCustomer = await stripe.customers.create({
          description: 'Anonymous donor',
        });
        return newCustomer.id;
      }
    })();

    // Abandoned checkout recovery — runs in parallel with customer lookup
    const abandonedPromise = resumeToken ? supabaseAdmin
      .from('abandoned_checkouts')
      .update({ status: 'recovered', recovered_at: new Date().toISOString() })
      .eq('resume_token', resumeToken)
      .eq('status', 'abandoned')
      .then(() => {})
      .catch((e: any) => console.error('Error marking abandoned checkout as recovered:', e))
    : Promise.resolve();

    // Wait for both in parallel
    const [stripeCustomerId] = await Promise.all([customerPromise, abandonedPromise]);

    // Build metadata for tracking - include item metadata (childName, notes, etc.)
    // Stripe limits metadata values to 500 chars, so we build a compact summary
    const itemsSummary = items?.map((i: any) => ({
      c: i.campaign,
      a: i.amount,
      q: i.quantity,
      n: i.name,
    })) || [];
    let itemsJson = JSON.stringify(itemsSummary);
    // If still over 500 chars, truncate to just campaign + amount
    if (itemsJson.length > 500) {
      const minimal = items?.map((i: any) => ({ c: i.campaign, a: i.amount, q: i.quantity })) || [];
      itemsJson = JSON.stringify(minimal);
    }
    // Final safety: truncate to 500 chars
    if (itemsJson.length > 500) {
      itemsJson = itemsJson.substring(0, 497) + '...';
    }
    const metadata: Record<string, string> = {
      donation_type: type,
      covers_fees: coverFees ? 'true' : 'false',
      fee_amount: feeAmount.toString(),
      base_amount: (baseAmount || amount).toString(),
      items: itemsJson,
    };

    if (customer) {
      metadata.customer_email = customer.email;
      metadata.customer_name = `${customer.firstName} ${customer.lastName}`;
      metadata.customer_phone = customer.phone || '';
    }

    // GA4 tracking IDs for server-side Measurement Protocol (preserves user journey + session attribution)
    if (ga_client_id) {
      metadata.ga_client_id = ga_client_id;
    }
    if (ga_session_id) {
      metadata.ga_session_id = ga_session_id;
    }

    // Checkout source tracking (e.g. 'gg-one-step-checkout', 'social-proof-popup', 'three-step-checkout')
    if (checkout_source) metadata.checkout_source = String(checkout_source).substring(0, 500);

    // UTM tracking for email/ad campaign attribution
    if (utm_source) metadata.utm_source = String(utm_source).substring(0, 500);
    if (utm_medium) metadata.utm_medium = String(utm_medium).substring(0, 500);
    if (utm_campaign) metadata.utm_campaign = String(utm_campaign).substring(0, 500);
    if (utm_content) metadata.utm_content = String(utm_content).substring(0, 500);

    // Journey data — extract first-touch + last-touch attribution, drop verbose page history
    // Stripe metadata values max 500 chars; full journey is preserved in Supabase donations.metadata
    if (journey) {
      try {
        const j = typeof journey === 'string' ? JSON.parse(journey) : journey;
        const compact: Record<string, any> = {};
        if (j.device) compact.device = j.device;
        if (j.browser) compact.browser = j.browser;
        if (j.session_started) compact.session_started = j.session_started;

        // First-touch attribution (how the donor originally found us)
        if (j.first_touch) {
          const ft = j.first_touch;
          if (ft.utm?.utm_source) compact.first_source = ft.utm.utm_source;
          if (ft.utm?.utm_medium) compact.first_medium = ft.utm.utm_medium;
          if (ft.utm?.utm_campaign) compact.first_campaign = ft.utm.utm_campaign;
          if (ft.utm?.utm_term) compact.first_term = ft.utm.utm_term;
          if (ft.landing_page) compact.first_landing = ft.landing_page;
          if (ft.referrer && ft.referrer !== 'direct') compact.first_referrer = ft.referrer;
          if (ft.gclid) compact.first_gclid = ft.gclid;
          if (ft.fbclid) compact.first_fbclid = ft.fbclid;
          if (ft.matchtype) compact.first_matchtype = ft.matchtype;
          if (ft.network) compact.first_network = ft.network;
          if (ft.campaignid) compact.first_campaignid = ft.campaignid;
          if (ft.adgroupid) compact.first_adgroupid = ft.adgroupid;
          if (ft.keyword) compact.first_keyword = ft.keyword;
          if (ft.creative) compact.first_creative = ft.creative;
          if (ft.placement) compact.first_placement = ft.placement;
          if (ft.adposition) compact.first_adposition = ft.adposition;
          if (ft.device) compact.first_device = ft.device;
        }

        // Last-touch attribution (what brought them back to donate)
        if (j.last_touch) {
          const lt = j.last_touch;
          if (lt.utm?.utm_source) compact.last_source = lt.utm.utm_source;
          if (lt.utm?.utm_medium) compact.last_medium = lt.utm.utm_medium;
          if (lt.utm?.utm_campaign) compact.last_campaign = lt.utm.utm_campaign;
          if (lt.utm?.utm_term) compact.last_term = lt.utm.utm_term;
          if (lt.landing_page) compact.last_landing = lt.landing_page;
          if (lt.referrer && lt.referrer !== 'direct') compact.last_referrer = lt.referrer;
          if (lt.gclid) compact.last_gclid = lt.gclid;
          if (lt.fbclid) compact.last_fbclid = lt.fbclid;
          if (lt.matchtype) compact.last_matchtype = lt.matchtype;
          if (lt.network) compact.last_network = lt.network;
          if (lt.campaignid) compact.last_campaignid = lt.campaignid;
          if (lt.adgroupid) compact.last_adgroupid = lt.adgroupid;
          if (lt.keyword) compact.last_keyword = lt.keyword;
          if (lt.creative) compact.last_creative = lt.creative;
          if (lt.placement) compact.last_placement = lt.placement;
          if (lt.adposition) compact.last_adposition = lt.adposition;
          if (lt.device) compact.last_device = lt.device;
        }

        if (j.checkout?.last_page_before_checkout) compact.last_page = j.checkout.last_page_before_checkout;
        metadata.journey = JSON.stringify(compact).substring(0, 500);
      } catch {
        metadata.journey = String(journey).substring(0, 500);
      }
    }

    // Abandoned checkout recovery token (actual update already ran in parallel above)
    if (resumeToken) {
      metadata.resume_token = resumeToken;
    }

    // Recurring donations (monthly/weekly/yearly/daily) now use the SetupIntent → create-subscription flow
    // See: /api/payments/create-setup-intent + /api/payments/create-subscription
    // This endpoint only handles one-time (single) donations
    if (type === 'monthly' || type === 'weekly' || type === 'yearly' || type === 'daily') {
      return new Response(JSON.stringify({
        error: 'Recurring donations should use the SetupIntent flow. Use /api/payments/create-setup-intent instead.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
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

    // Extract campaign info from items
    const primaryItem = items?.[0];
    const campaignSlug = primaryItem?.campaign || 'general';
    const campaignName = primaryItem?.name || 'General Donation';

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
        campaign_slug: campaignSlug,
        campaign_name: campaignName,
        covers_fees: coverFees,
        fee_amount: feeAmount,
        base_amount: baseAmount || amount,
        metadata: (() => {
          // Parse journey for first/last touch extraction
          let journeyObj: any = null;
          if (journey) {
            try { journeyObj = typeof journey === 'string' ? JSON.parse(journey) : journey; } catch {}
          }
          const ft = journeyObj?.first_touch;
          const lt = journeyObj?.last_touch;

          return {
            stripe_customer_id: stripeCustomerId,
            billing_address: billingAddress || null,
            ...(checkout_source ? { checkout_source } : {}),
            ...(ga_client_id ? { ga_client_id } : {}),
            ...(ga_session_id ? { ga_session_id } : {}),
            // Last-touch UTMs (what brought them back to donate)
            ...(utm_source ? { utm_source } : {}),
            ...(utm_medium ? { utm_medium } : {}),
            ...(utm_campaign ? { utm_campaign } : {}),
            ...(utm_content ? { utm_content } : {}),
            // Explicit first-touch & last-touch source for easy querying
            ...(ft?.utm?.utm_source ? { first_source: ft.utm.utm_source } : {}),
            ...(ft?.utm?.utm_medium ? { first_medium: ft.utm.utm_medium } : {}),
            ...(ft?.utm?.utm_campaign ? { first_campaign: ft.utm.utm_campaign } : {}),
            ...(ft?.landing_page ? { first_landing: ft.landing_page } : {}),
            ...(lt?.utm?.utm_source ? { last_source: lt.utm.utm_source } : {}),
            ...(lt?.utm?.utm_medium ? { last_medium: lt.utm.utm_medium } : {}),
            ...(lt?.utm?.utm_campaign ? { last_campaign: lt.utm.utm_campaign } : {}),
            ...(lt?.landing_page ? { last_landing: lt.landing_page } : {}),
            // Full journey preserved for detailed attribution reports
            ...(journeyObj ? { journey: journeyObj } : {}),
          };
        })(),
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
  interval: 'monthly' | 'weekly' | 'yearly' | 'daily';
}) {
  try {
    const isWeekly = interval === 'weekly';
    const stripeInterval = STRIPE_INTERVALS[interval] || 'month';
    const productName = DONATION_PRODUCT_NAMES[interval] || 'Recurring Donation';
    const productDescription = isWeekly
      ? 'Jummah (Friday) recurring donation to Qurbani USA'
      : `${interval.charAt(0).toUpperCase() + interval.slice(1)} recurring donation to Qurbani USA`;

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
        interval: stripeInterval as any,
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
        donation_items: (() => {
          const summary = (items || []).map((i: any) => ({ c: i.campaign, a: i.amount, q: i.quantity, n: i.name }));
          let json = JSON.stringify(summary);
          if (json.length > 500) {
            const minimal = (items || []).map((i: any) => ({ c: i.campaign, a: i.amount, q: i.quantity }));
            json = JSON.stringify(minimal);
          }
          return json.length > 500 ? json.substring(0, 497) + '...' : json;
        })(),
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

    // Calculate next billing date based on interval
    const nextBillingDate = isWeekly ? getNextFriday() : new Date();
    if (interval === 'monthly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else if (interval === 'yearly') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else if (interval === 'daily') {
      nextBillingDate.setDate(nextBillingDate.getDate() + 1);
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

    // Extract campaign info from items
    const primaryItem = items?.[0];
    const campaignSlug = primaryItem?.campaign || 'general';
    const campaignName = primaryItem?.name || 'General Donation';

    // Create subscription record in database
    const { data: subscriptionRecord, error: subError } = await supabaseAdmin
      .from('donation_subscriptions')
      .insert({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: stripeCustomerId,
        donor_email: customer?.email,
        donor_name: customer ? `${customer.firstName} ${customer.lastName}` : null,
        donor_phone: customer?.phone,
        amount,
        currency,
        status: 'active',
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
        campaign_slug: campaignSlug,
        campaign_name: campaignName,
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
