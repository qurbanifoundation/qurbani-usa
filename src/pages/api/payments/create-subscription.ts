import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { trackDonation, markReceiptSent, moveDonationThroughPipeline } from '../../../lib/ghl-advanced';
import { notifyDonationReceived } from '../../../lib/notifications';
import { sendDonationReceipt } from '../../../lib/donor-emails';
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
 * Handles MIXED carts: recurring items become a subscription, one-time items get charged separately.
 *
 * Flow:
 * 1. User's payment method was saved via SetupIntent + confirmSetup()
 * 2. Frontend sends the paymentMethodId here
 * 3. We split items into recurring vs one-time
 * 4. Create Subscription for recurring items (charges immediately)
 * 5. Create separate PaymentIntent for one-time items (off-session, using saved PM)
 * 6. Return combined result
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

    // ════════════════════════════════════════════════════════════════
    // SPLIT items into recurring and one-time
    // ════════════════════════════════════════════════════════════════
    const allItems = items || [];
    const recurringItems = allItems.filter((i: any) => {
      const t = (i.type || 'single').toLowerCase();
      return t === 'monthly' || t === 'weekly' || t === 'yearly' || t === 'daily';
    });
    const singleItems = allItems.filter((i: any) => {
      const t = (i.type || 'single').toLowerCase();
      return t !== 'monthly' && t !== 'weekly' && t !== 'yearly' && t !== 'daily';
    });

    const recurringTotal = recurringItems.reduce((sum: number, i: any) =>
      sum + ((parseFloat(i.amount) || 0) * (parseInt(i.quantity) || 1)), 0);
    const singleTotal = singleItems.reduce((sum: number, i: any) =>
      sum + ((parseFloat(i.amount) || 0) * (parseInt(i.quantity) || 1)), 0);

    // If coverFees, split fee proportionally between recurring and one-time
    const totalBeforeFees = recurringTotal + singleTotal;
    const recurringFee = coverFees && totalBeforeFees > 0
      ? Math.round((recurringTotal / totalBeforeFees) * (feeAmount || 0) * 100) / 100
      : 0;
    const singleFee = coverFees ? ((feeAmount || 0) - recurringFee) : 0;

    const subscriptionAmount = recurringTotal + recurringFee;
    const oneTimeAmount = singleTotal + singleFee;

    // Validate we have recurring items
    if (recurringItems.length === 0 || subscriptionAmount < 1) {
      return new Response(JSON.stringify({ error: 'No recurring items found. Use /api/payments/create-intent for one-time donations.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ════════════════════════════════════════════════════════════════
    // PART 1: Create SUBSCRIPTION for recurring items
    // ════════════════════════════════════════════════════════════════
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

    // Create a price for the RECURRING amount only
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(subscriptionAmount * 100),
      currency,
      recurring: {
        interval: stripeInterval,
      },
      metadata: {
        donation_amount: subscriptionAmount.toString(),
        interval_type: interval,
      },
    });

    // Build metadata for the subscription
    const recurringItemsSummary = recurringItems.map((i: any) => ({
      c: i.campaign,
      a: i.amount,
      q: i.quantity,
      n: i.name,
    }));
    let recurringItemsJson = JSON.stringify(recurringItemsSummary);
    if (recurringItemsJson.length > 500) {
      const minimal = recurringItems.map((i: any) => ({ c: i.campaign, a: i.amount, q: i.quantity }));
      recurringItemsJson = JSON.stringify(minimal);
    }
    if (recurringItemsJson.length > 500) {
      recurringItemsJson = recurringItemsJson.substring(0, 497) + '...';
    }

    const subMetadata: Record<string, string> = {
      donation_type: interval,
      covers_fees: coverFees ? 'true' : 'false',
      fee_amount: recurringFee.toString(),
      base_amount: recurringTotal.toString(),
      donation_items: recurringItemsJson,
      interval_type: interval,
      is_jummah: isWeekly ? 'true' : 'false',
    };

    if (customer) {
      subMetadata.customer_email = customer.email;
      subMetadata.customer_name = `${customer.firstName} ${customer.lastName}`;
      subMetadata.customer_phone = customer.phone || '';
    }

    // Create subscription with the saved payment method
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: price.id }],
      default_payment_method: paymentMethodId,
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: subMetadata,
    };

    // For weekly (Jummah/Friday) subscriptions:
    // - Anchor billing to next Friday so all future charges land on Fridays
    // - proration_behavior: 'none' means NO charge at subscription creation
    // - We charge the first payment separately via an off-session PaymentIntent
    if (isWeekly) {
      const nextFriday = getNextFriday();
      subscriptionParams.billing_cycle_anchor = Math.floor(nextFriday.getTime() / 1000);
      subscriptionParams.proration_behavior = 'none';
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    // Get payment info from first invoice — with null safety
    // For weekly subs with billing_cycle_anchor + no proration, invoice may be null/$0
    const invoice = subscription.latest_invoice as Stripe.Invoice | null;
    const subPaymentIntent = invoice
      ? (invoice.payment_intent as Stripe.PaymentIntent | null)
      : null;

    // For weekly subscriptions anchored to Friday, charge the first payment NOW
    // (the subscription won't charge until next Friday, so we need an immediate charge)
    let firstPaymentPI: Stripe.PaymentIntent | null = null;
    if (isWeekly && !subPaymentIntent) {
      firstPaymentPI = await stripe.paymentIntents.create({
        amount: Math.round(subscriptionAmount * 100),
        currency,
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          ...subMetadata,
          first_payment_for_subscription: subscription.id,
        },
        description: `First payment - Jummah (Friday) Donation`,
      });
    }

    // Use either the invoice PI or the first-payment PI
    const effectivePaymentIntentId = subPaymentIntent?.id || firstPaymentPI?.id || null;
    const effectivePaymentStatus = subPaymentIntent?.status || firstPaymentPI?.status || null;

    // Calculate next billing date based on interval
    const nextBillingDate = isWeekly ? getNextFriday() : new Date();
    if (interval === 'monthly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else if (interval === 'yearly') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else if (interval === 'daily') {
      nextBillingDate.setDate(nextBillingDate.getDate() + 1);
    }

    // Prepare recurring items with full metadata
    const recurringItemsWithMetadata = recurringItems.map((i: any) => ({
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
    }));

    // Extract campaign info from recurring items
    const primaryRecurringItem = recurringItems[0];
    const recurringCampaignSlug = primaryRecurringItem?.campaign || 'general';
    const recurringCampaignName = primaryRecurringItem?.name || 'General Donation';

    // Create subscription record in database
    const { data: subscriptionRecord, error: subError } = await supabaseAdmin
      .from('donation_subscriptions')
      .insert({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        donor_email: customer?.email,
        donor_name: customer ? `${customer.firstName} ${customer.lastName}` : null,
        donor_phone: customer?.phone,
        amount: subscriptionAmount,
        currency,
        status: subscription.status === 'active' ? 'active' : 'pending',
        interval: interval,
        items: recurringItemsWithMetadata,
        campaign_slug: recurringCampaignSlug,
        next_billing_date: nextBillingDate.toISOString(),
      })
      .select()
      .single();

    if (subError) {
      console.error('Error creating subscription record:', subError);
    }

    // Create donation record for the subscription's first payment
    const { data: recurringDonation, error: recurringDonationError } = await supabaseAdmin
      .from('donations')
      .insert({
        stripe_payment_intent_id: effectivePaymentIntentId,
        stripe_subscription_id: subscription.id,
        amount: subscriptionAmount,
        currency,
        status: effectivePaymentStatus === 'succeeded' ? 'completed' : 'pending',
        donation_type: interval,
        donor_email: customer?.email,
        donor_name: customer ? `${customer.firstName} ${customer.lastName}` : null,
        donor_phone: customer?.phone,
        items: recurringItemsWithMetadata,
        campaign_slug: recurringCampaignSlug,
        campaign_name: recurringCampaignName,
        covers_fees: coverFees,
        fee_amount: recurringFee,
        base_amount: recurringTotal,
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

    if (recurringDonationError) {
      console.error('Error creating recurring donation record:', recurringDonationError);
    }

    // ════════════════════════════════════════════════════════════════
    // PART 2: If there are ONE-TIME items, charge them separately
    // ════════════════════════════════════════════════════════════════
    let singleDonationId: string | null = null;
    let singlePaymentIntentId: string | null = null;

    if (oneTimeAmount >= 0.5 && singleItems.length > 0) {
      // Build metadata for one-time charge
      const singleItemsSummary = singleItems.map((i: any) => ({
        c: i.campaign,
        a: i.amount,
        q: i.quantity,
        n: i.name,
      }));
      let singleItemsJson = JSON.stringify(singleItemsSummary);
      if (singleItemsJson.length > 500) {
        singleItemsJson = singleItemsJson.substring(0, 497) + '...';
      }

      const singleMetadata: Record<string, string> = {
        donation_type: 'single',
        covers_fees: coverFees ? 'true' : 'false',
        fee_amount: singleFee.toString(),
        base_amount: singleTotal.toString(),
        items: singleItemsJson,
      };
      if (customer) {
        singleMetadata.customer_email = customer.email;
        singleMetadata.customer_name = `${customer.firstName} ${customer.lastName}`;
        singleMetadata.customer_phone = customer.phone || '';
      }

      // Create and confirm PaymentIntent using the saved payment method (off-session)
      const singlePI = await stripe.paymentIntents.create({
        amount: Math.round(oneTimeAmount * 100),
        currency,
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: singleMetadata,
        description: `One-time donation - ${singleItems.map((i: any) => i.name).join(', ') || 'General'}`,
      });

      singlePaymentIntentId = singlePI.id;

      // Prepare one-time items with metadata
      const singleItemsWithMetadata = singleItems.map((i: any) => ({
        id: i.id,
        campaign: i.campaign,
        amount: i.amount,
        quantity: i.quantity || 1,
        label: i.label,
        name: i.name,
        type: 'single',
        childName: i.metadata?.childName || null,
        packageType: i.metadata?.packageType || null,
        aqiqahFor: i.metadata?.aqiqahFor || null,
        notes: i.metadata?.notes || null,
        metadata: i.metadata || null,
      }));

      const primarySingleItem = singleItems[0];
      const singleCampaignSlug = primarySingleItem?.campaign || 'general';
      const singleCampaignName = primarySingleItem?.name || 'General Donation';

      // Create one-time donation record
      const { data: singleDonation, error: singleDonationError } = await supabaseAdmin
        .from('donations')
        .insert({
          stripe_payment_intent_id: singlePI.id,
          amount: oneTimeAmount,
          currency,
          status: singlePI.status === 'succeeded' ? 'completed' : 'pending',
          donation_type: 'single',
          donor_email: customer?.email,
          donor_name: customer ? `${customer.firstName} ${customer.lastName}` : null,
          donor_phone: customer?.phone,
          items: singleItemsWithMetadata,
          campaign_slug: singleCampaignSlug,
          campaign_name: singleCampaignName,
          covers_fees: coverFees,
          fee_amount: singleFee,
          base_amount: singleTotal,
          metadata: {
            stripe_customer_id: customerId,
            billing_address: billingAddress || null,
            is_recurring: false,
            linked_subscription_id: subscription.id,
          },
        })
        .select()
        .single();

      if (singleDonationError) {
        console.error('Error creating one-time donation record:', singleDonationError);
      }

      singleDonationId = singleDonation?.id || null;
    }

    // ════════════════════════════════════════════════════════════════
    // PART 3: Post-payment processing — GHL sync, notifications, receipts
    // Done here because the Stripe webhook fires BEFORE we insert the
    // donation row (race condition), so the webhook can't find the record.
    // ════════════════════════════════════════════════════════════════
    const donorName = customer ? `${customer.firstName} ${customer.lastName}` : null;
    const donorEmail = customer?.email;

    if (donorEmail && donorName) {
      // --- Sync RECURRING donation to GHL ---
      if (recurringDonation && (effectivePaymentStatus === 'succeeded' || subscription.status === 'active')) {
        try {
          const campaignSlug = recurringItems[0]?.campaign || 'general';
          const campaignName = recurringItems[0]?.name || 'General Donation';
          const itemsList = recurringItems.map((i: any) => ({
            name: i.name || 'Donation',
            amount: typeof i.amount === 'string' ? parseFloat(i.amount) : (i.amount || 0),
          }));

          const ghlResult = await trackDonation({
            email: donorEmail,
            name: donorName,
            phone: customer?.phone || null,
            amount: subscriptionAmount,
            campaignSlug,
            campaignName,
            donationType: interval as 'single' | 'monthly' | 'weekly',
            items: itemsList,
            address: billingAddress || null,
            stripePaymentId: effectivePaymentIntentId || subscription.id,
            donationId: recurringDonation.id,
            currency: currency.toUpperCase(),
          });

          console.log('[create-subscription] Recurring donation synced to GHL:', {
            contactId: ghlResult.contactId,
            lifetimeGiving: ghlResult.lifetimeGiving,
            donationCount: ghlResult.donationCount,
            donorTier: ghlResult.donorTier,
          });

          // Move pipeline
          await moveDonationThroughPipeline(donorEmail, 'payment received')
            .catch(err => console.error('[create-subscription] GHL pipeline error:', err));
          await moveDonationThroughPipeline(donorEmail, 'active subscriber')
            .catch(err => console.error('[create-subscription] GHL pipeline error:', err));

          // Mark donation as GHL-synced (prevents double-sync from webhook)
          await supabaseAdmin
            .from('donations')
            .update({ metadata: { ...recurringDonation.metadata, ghl_synced_at: new Date().toISOString() } })
            .eq('id', recurringDonation.id);
        } catch (ghlError) {
          console.error('[create-subscription] GHL sync error (recurring):', ghlError);
        }
      }

      // --- Sync ONE-TIME donation to GHL (if mixed cart) ---
      if (singleDonationId && singlePaymentIntentId) {
        try {
          const campaignSlug = singleItems[0]?.campaign || 'general';
          const campaignName = singleItems[0]?.name || 'General Donation';
          const itemsList = singleItems.map((i: any) => ({
            name: i.name || 'Donation',
            amount: typeof i.amount === 'string' ? parseFloat(i.amount) : (i.amount || 0),
          }));

          const ghlResult = await trackDonation({
            email: donorEmail,
            name: donorName,
            phone: customer?.phone || null,
            amount: oneTimeAmount,
            campaignSlug,
            campaignName,
            donationType: 'single',
            items: itemsList,
            address: billingAddress || null,
            stripePaymentId: singlePaymentIntentId,
            donationId: singleDonationId,
            currency: currency.toUpperCase(),
          });

          console.log('[create-subscription] One-time donation synced to GHL:', {
            contactId: ghlResult.contactId,
            lifetimeGiving: ghlResult.lifetimeGiving,
          });

          // Mark as GHL-synced
          await supabaseAdmin
            .from('donations')
            .update({ metadata: { ghl_synced_at: new Date().toISOString() } })
            .eq('id', singleDonationId);
        } catch (ghlError) {
          console.error('[create-subscription] GHL sync error (one-time):', ghlError);
        }
      }

      // --- Admin notification ---
      const allItemsList = allItems.map((i: any) => ({
        name: i.name || 'Donation',
        amount: typeof i.amount === 'string' ? parseFloat(i.amount) : (i.amount || 0),
      }));

      await notifyDonationReceived({
        amount: subscriptionAmount + oneTimeAmount,
        donorName,
        donorEmail,
        items: allItemsList,
        type: interval,
      }).catch(err => console.error('[create-subscription] Admin notification error:', err));

      // --- Donor receipt email ---
      // Fetch subscription management URL
      let managementUrl: string | undefined;
      try {
        const { data: sub } = await supabaseAdmin
          .from('donation_subscriptions')
          .select('id, management_token')
          .eq('donor_email', donorEmail)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (sub?.management_token) {
          managementUrl = `https://www.qurbani.com/manage-subscription/${sub.id}_${sub.management_token}`;
        }
      } catch {}

      await sendDonationReceipt({
        donorEmail,
        donorName,
        amount: subscriptionAmount + oneTimeAmount,
        items: allItemsList,
        transactionId: effectivePaymentIntentId || singlePaymentIntentId || subscription.id,
        donationType: interval as 'single' | 'monthly' | 'weekly',
        date: new Date(),
        billingAddress: billingAddress || undefined,
        managementUrl,
      }).catch(err => console.error('[create-subscription] Receipt email error:', err));

      // Mark receipt sent + GHL receipt status
      if (recurringDonation?.id) {
        await supabaseAdmin
          .from('donations')
          .update({ receipt_sent: true })
          .eq('id', recurringDonation.id);
      }
      await markReceiptSent(donorEmail).catch(err =>
        console.error('[create-subscription] GHL markReceiptSent error:', err)
      );
      await moveDonationThroughPipeline(donorEmail, 'receipt sent')
        .catch(err => console.error('[create-subscription] GHL pipeline receipt sent error:', err));
    }

    // Return combined result — primary IDs come from the subscription
    return new Response(JSON.stringify({
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      donationId: recurringDonation?.id || singleDonationId,
      paymentIntentId: effectivePaymentIntentId || singlePaymentIntentId || null,
      paymentIntentStatus: effectivePaymentStatus || null,
      type: 'subscription',
      interval: interval,
      isJummah: isWeekly,
      nextBillingDate: nextBillingDate.toISOString(),
      // Include one-time info if present
      ...(singleDonationId ? {
        singleDonationId,
        singlePaymentIntentId,
        singleAmount: oneTimeAmount,
      } : {}),
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
