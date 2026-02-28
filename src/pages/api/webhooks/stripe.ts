import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { trackDonation, trackRefund, markReceiptSent, moveDonationThroughPipeline } from '../../../lib/ghl-advanced';
import { calculateFulfillmentDate, calculateEmailSendTime, detectTimezone } from '../../../lib/fulfillment';
import {
  notifyDonationReceived,
  notifySubscriptionStarted,
  notifySubscriptionCancelled,
  notifyPaymentFailed,
  notifyRefund,
  notifyDispute,
  notifyDisputeClosed,
} from '../../../lib/notifications';
import {
  sendDonationReceipt,
  sendSubscriptionConfirmation,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail,
  sendRefundEmail,
} from '../../../lib/donor-emails';
import Stripe from 'stripe';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return new Response(JSON.stringify({ error: 'No signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Stripe settings
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('stripe_secret_key, stripe_webhook_secret')
      .single();

    if (!settings?.stripe_secret_key) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(settings.stripe_secret_key, {
      apiVersion: '2023-10-16',
    });

    let event: Stripe.Event;

    // Webhook secret is REQUIRED — never accept unverified payloads
    if (!settings.stripe_webhook_secret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured — rejecting webhook');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook signature (using async for Cloudflare Workers compatibility)
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, settings.stripe_webhook_secret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Atomic idempotency check — INSERT with ON CONFLICT prevents race conditions
    // If two webhook deliveries arrive simultaneously, only one will succeed
    const { data: insertedEvent, error: idempotencyError } = await supabaseAdmin
      .from('webhook_events')
      .upsert(
        {
          stripe_event_id: event.id,
          event_type: event.type,
          payload: event.data.object,
        },
        { onConflict: 'stripe_event_id', ignoreDuplicates: true }
      )
      .select('id, created_at')
      .single();

    // If upsert returned no row, this is a duplicate (ignoreDuplicates skipped the insert)
    if (idempotencyError || !insertedEvent) {
      console.log('Event already processed (atomic check):', event.id);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle the event
    switch (event.type) {
      // One-time payment events
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(paymentIntent);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(charge);
        break;
      }

      // Subscription events
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCancelled(subscription);
        break;
      }

      // Invoice events (for recurring payments)
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice, stripe);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      // Dispute/Chargeback events
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeCreated(dispute);
        break;
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeClosed(dispute);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);

  // Get the donation first to determine campaign type
  const { data: existingDonation } = await supabaseAdmin
    .from('donations')
    .select('campaign_slug, campaign_name, items, metadata')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .single();

  // Extract campaign slug from items if not set (backwards compatibility)
  let campaignSlugCheck = existingDonation?.campaign_slug?.toLowerCase() || '';
  if (!campaignSlugCheck && existingDonation?.items) {
    const donationItems = typeof existingDonation.items === 'string'
      ? JSON.parse(existingDonation.items) : existingDonation.items;
    if (Array.isArray(donationItems) && donationItems.length > 0) {
      campaignSlugCheck = (donationItems[0].campaign || '').toLowerCase();
    }
  }

  // Determine campaign type for fulfillment
  const campaignType = campaignSlugCheck.includes('zakat') ? 'zakat'
    : campaignSlugCheck.includes('qurbani') ? 'qurbani'
    : campaignSlugCheck.includes('aqeeqah') || campaignSlugCheck.includes('aqiqah') ? 'aqeeqah'
    : campaignSlugCheck.includes('sadaqah') ? 'sadaqah'
    : 'general';

  // Smart fulfillment: calculate date based on campaign type + Eid dates
  const { fulfillmentDate, mode: fulfillmentMode } = await calculateFulfillmentDate(
    campaignType,
    new Date(),
  );

  // Detect donor timezone from billing address
  const billingAddr = existingDonation?.metadata?.billing_address || paymentIntent.shipping?.address || null;
  const donorTimezone = detectTimezone(billingAddr);

  // Calculate when to send fulfillment email (1:30 PM donor's local time)
  const emailSendTime = calculateEmailSendTime(fulfillmentDate, donorTimezone);

  // Extract campaign info from items if not already set
  let campaignSlugForUpdate = existingDonation?.campaign_slug;
  let campaignNameForUpdate = existingDonation?.campaign_name;
  if (!campaignSlugForUpdate && existingDonation?.items) {
    const donItems = typeof existingDonation.items === 'string'
      ? JSON.parse(existingDonation.items) : existingDonation.items;
    if (Array.isArray(donItems) && donItems.length > 0) {
      campaignSlugForUpdate = donItems[0].campaign || 'general';
      campaignNameForUpdate = donItems[0].name || 'General Donation';
    }
  }

  // Update donation record with fulfillment data
  const updateFields: Record<string, unknown> = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    stripe_charge_id: paymentIntent.latest_charge as string,
    fulfillment_mode: fulfillmentMode,
    fulfillment_status: 'pending',
    scheduled_fulfillment_at: fulfillmentDate.toISOString(),
    fulfillment_email_scheduled_at: emailSendTime.toISOString(),
    donor_timezone: donorTimezone,
    campaign_type: campaignType,
  };

  // Backfill campaign_slug/name if missing
  if (!existingDonation?.campaign_slug && campaignSlugForUpdate) {
    updateFields.campaign_slug = campaignSlugForUpdate;
  }
  if (!existingDonation?.campaign_name && campaignNameForUpdate) {
    updateFields.campaign_name = campaignNameForUpdate;
  }

  const { data: donation, error } = await supabaseAdmin
    .from('donations')
    .update(updateFields)
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating donation:', error);
    return;
  }

  // Parse items for campaign tracking
  let items: Array<{ name: string; amount: number }> = [];
  if (donation.items) {
    items = typeof donation.items === 'string'
      ? JSON.parse(donation.items)
      : donation.items;
  }

  // Sync to GoHighLevel with full campaign attribution and lifetime tracking
  if (donation?.donor_email && donation?.donor_name) {
    try {
      // Extract campaign slug from the donation or items
      const campaignSlug = donation.campaign_slug ||
        (items.length > 0 ? items[0].name?.toLowerCase().replace(/\s+/g, '-') : 'general');

      // Extract billing address from metadata
      const billingAddress = donation.metadata?.billing_address || null;

      const result = await trackDonation({
        email: donation.donor_email,
        name: donation.donor_name,
        phone: donation.donor_phone,
        amount: parseFloat(donation.amount),
        campaignSlug: campaignSlug,
        campaignName: donation.campaign_name || 'General Donation',
        donationType: (donation.donation_type as 'single' | 'monthly' | 'weekly') || 'single',
        items: items.map(item => ({
          name: item.name || 'Donation',
          amount: typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount
        })),
        address: billingAddress,
        stripePaymentId: paymentIntent.id,
        donationId: donation.id,
        currency: donation.currency || 'USD',
      });

      console.log('Donation synced to GHL:', {
        contactId: result.contactId,
        lifetimeGiving: result.lifetimeGiving,
        donationCount: result.donationCount,
        donorTier: result.donorTier
      });

      // Move pipeline: New Donation → Payment Received
      await moveDonationThroughPipeline(donation.donor_email, 'payment received')
        .catch(err => console.error('GHL pipeline move error:', err));
    } catch (ghlError) {
      console.error('GHL sync error:', ghlError);
    }

    // Send admin notification (GHL)
    await notifyDonationReceived({
      amount: parseFloat(donation.amount),
      donorName: donation.donor_name,
      donorEmail: donation.donor_email,
      items: items,
      type: donation.donation_type,
    });

    // Fetch subscription management URL for recurring donations
    let managementUrl: string | undefined;
    if (donation.is_recurring || donation.donation_type === 'monthly' || donation.donation_type === 'weekly') {
      const { data: sub } = await supabaseAdmin
        .from('donation_subscriptions')
        .select('id, management_token')
        .eq('donor_email', donation.donor_email)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (sub?.management_token) {
        managementUrl = `https://www.qurbani.com/manage-subscription/${sub.id}_${sub.management_token}`;
      }
    }

    // Send donor receipt email (Resend + log to GHL Conversations)
    await sendDonationReceipt({
      donorEmail: donation.donor_email,
      donorName: donation.donor_name,
      amount: parseFloat(donation.amount),
      items: items,
      transactionId: paymentIntent.id,
      donationType: (donation.donation_type as 'single' | 'monthly' | 'weekly') || 'single',
      date: new Date(),
      billingAddress: donation.metadata?.billing_address,
      managementUrl,
    });

    // Mark receipt as sent in Supabase + GHL
    await supabaseAdmin
      .from('donations')
      .update({ receipt_sent: true })
      .eq('id', donation.id);

    await markReceiptSent(donation.donor_email).catch(err =>
      console.error('GHL markReceiptSent error:', err)
    );

    // Move pipeline: Payment Received → Receipt Sent
    await moveDonationThroughPipeline(donation.donor_email, 'receipt sent')
      .catch(err => console.error('GHL pipeline move to Receipt Sent error:', err));
  }

  // Server-side GA4 tracking via Measurement Protocol
  // This is the bulletproof backup — fires even if client-side tracking fails (ad blockers, etc.)
  // GA4 deduplicates by transaction_id so this won't double-count
  try {
    const GA4_MEASUREMENT_ID = 'G-0WC0W1PBKC';
    const GA4_API_SECRET = import.meta.env.GA4_API_SECRET;

    if (GA4_API_SECRET) {
      const mpPayload = {
        client_id: donation?.donor_email || paymentIntent.id, // Use email as client_id for server-side
        events: [{
          name: 'purchase',
          params: {
            transaction_id: paymentIntent.id,
            currency: 'USD',
            value: parseFloat(donation?.amount || '0'),
            items: items.map((item: { name: string; amount: number }) => ({
              item_id: (item.name || 'donation').toLowerCase().replace(/\s+/g, '-'),
              item_name: item.name || 'Donation',
              price: typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount,
              quantity: 1,
            })),
          }
        }]
      };

      await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`,
        {
          method: 'POST',
          body: JSON.stringify(mpPayload),
        }
      );
      console.log('GA4 server-side purchase event sent:', paymentIntent.id);
    }
  } catch (ga4Error) {
    // Non-critical — don't let GA4 errors break payment processing
    console.error('GA4 Measurement Protocol error:', ga4Error);
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

  // Get donation details first
  const { data: donation } = await supabaseAdmin
    .from('donations')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .single();

  // Update donation record
  const { error } = await supabaseAdmin
    .from('donations')
    .update({
      status: 'failed',
      error_message: paymentIntent.last_payment_error?.message,
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  if (error) {
    console.error('Error updating donation:', error);
  }

  // Send admin notification (GHL)
  if (donation) {
    await notifyPaymentFailed({
      amount: parseFloat(donation.amount),
      donorName: donation.donor_name || 'Unknown',
      donorEmail: donation.donor_email || 'Unknown',
      reason: paymentIntent.last_payment_error?.message,
    });

    // Send donor notification email (Resend + log to GHL Conversations)
    if (donation.donor_email) {
      await sendPaymentFailedEmail({
        donorEmail: donation.donor_email,
        donorName: donation.donor_name || 'Donor',
        amount: parseFloat(donation.amount),
        reason: paymentIntent.last_payment_error?.message,
      });
    }
  }
}

async function handleRefund(charge: Stripe.Charge) {
  console.log('Charge refunded:', charge.id);

  // Get donation details
  const { data: donation } = await supabaseAdmin
    .from('donations')
    .select('*')
    .eq('stripe_charge_id', charge.id)
    .single();

  // Update donation record
  const { error } = await supabaseAdmin
    .from('donations')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
    })
    .eq('stripe_charge_id', charge.id);

  if (error) {
    console.error('Error updating donation:', error);
  }

  // Send admin notification (GHL)
  const refundAmount = charge.amount_refunded / 100;
  await notifyRefund({
    amount: refundAmount,
    donorName: donation?.donor_name,
    donorEmail: donation?.donor_email,
    chargeId: charge.id,
  });

  // Send donor refund confirmation (Resend + log to GHL Conversations)
  if (donation?.donor_email) {
    await sendRefundEmail({
      donorEmail: donation.donor_email,
      donorName: donation.donor_name || 'Donor',
      amount: refundAmount,
      originalTransactionId: charge.id,
    });

    // Sync refund to GHL: update fields, add tag, close opportunity, add note
    try {
      await trackRefund({
        email: donation.donor_email,
        name: donation.donor_name || 'Donor',
        refundAmount: refundAmount,
        originalAmount: parseFloat(donation.amount),
        stripeChargeId: charge.id,
        stripePaymentId: donation.stripe_payment_intent_id,
        campaignName: donation.campaign_name,
      });
      console.log('Refund synced to GHL for', donation.donor_email);
    } catch (ghlError) {
      console.error('GHL refund sync error:', ghlError);
    }
  }
}

// ============================================
// SUBSCRIPTION HANDLERS
// ============================================

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Subscription created:', subscription.id);

  // Extract card details from the default payment method
  let cardData: Record<string, any> = {};
  const paymentMethod = subscription.default_payment_method;
  if (paymentMethod && typeof paymentMethod !== 'string') {
    const card = paymentMethod.card;
    if (card) {
      cardData = {
        card_last4: card.last4,
        card_brand: card.brand,
        card_exp_month: card.exp_month,
        card_exp_year: card.exp_year,
      };
    }
  }

  // Get subscription details
  const { data: subRecord } = await supabaseAdmin
    .from('donation_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  // Update subscription record with confirmed status and card info
  const { error } = await supabaseAdmin
    .from('donation_subscriptions')
    .update({
      status: 'active',
      failure_count: 0,
      last_failure_reason: null,
      ...cardData,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error updating subscription:', error);
  }

  // Send admin notification (GHL)
  if (subRecord) {
    await notifySubscriptionStarted({
      amount: parseFloat(subRecord.amount),
      donorName: subRecord.donor_name || 'Unknown',
      donorEmail: subRecord.donor_email || 'Unknown',
      interval: subRecord.interval || 'monthly',
    });

    // Send donor confirmation email (Resend + log to GHL Conversations)
    if (subRecord.donor_email) {
      // Calculate next billing date
      const nextBillingDate = subRecord.next_billing_date
        ? new Date(subRecord.next_billing_date)
        : new Date(Date.now() + (subRecord.interval === 'weekly' ? 7 : 30) * 24 * 60 * 60 * 1000);

      // Parse items
      let items: Array<{ name: string; amount: number }> = [];
      if (subRecord.items) {
        items = typeof subRecord.items === 'string'
          ? JSON.parse(subRecord.items)
          : subRecord.items;
      }

      // Build management URL
      const subManagementUrl = subRecord.management_token
        ? `https://www.qurbani.com/manage-subscription/${subRecord.id}_${subRecord.management_token}`
        : undefined;

      await sendSubscriptionConfirmation({
        donorEmail: subRecord.donor_email,
        donorName: subRecord.donor_name || 'Donor',
        amount: parseFloat(subRecord.amount),
        interval: (subRecord.interval as 'monthly' | 'weekly') || 'monthly',
        nextBillingDate: nextBillingDate,
        items: items,
        managementUrl: subManagementUrl,
      });

      // Move GHL pipeline to "Active Subscriber" for recurring donors
      await moveDonationThroughPipeline(subRecord.donor_email, 'active subscriber')
        .catch(err => console.error('GHL pipeline move to Active Subscriber error:', err));
    }
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Subscription updated:', subscription.id, 'Status:', subscription.status);

  // Map Stripe status to our status
  let status: 'active' | 'paused' | 'cancelled' | 'past_due' = 'active';
  switch (subscription.status) {
    case 'active':
      status = 'active';
      break;
    case 'past_due':
      status = 'past_due';
      break;
    case 'paused':
      status = 'paused';
      break;
    case 'canceled':
    case 'unpaid':
      status = 'cancelled';
      break;
  }

  // Calculate next billing date
  const nextBillingDate = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const { data: subRecord, error } = await supabaseAdmin
    .from('donation_subscriptions')
    .update({
      status,
      next_billing_date: nextBillingDate,
    })
    .eq('stripe_subscription_id', subscription.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating subscription:', error);
  }

  // Move GHL pipeline based on subscription status changes
  if (subRecord?.donor_email) {
    if (status === 'past_due') {
      await moveDonationThroughPipeline(subRecord.donor_email, 'past due')
        .catch(err => console.error('GHL pipeline move to Past Due error:', err));
    } else if (status === 'active') {
      await moveDonationThroughPipeline(subRecord.donor_email, 'active subscriber')
        .catch(err => console.error('GHL pipeline move to Active Subscriber error:', err));
    } else if (status === 'cancelled') {
      await moveDonationThroughPipeline(subRecord.donor_email, 'cancelled')
        .catch(err => console.error('GHL pipeline move to Cancelled error:', err));
    }
  }
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  console.log('Subscription cancelled:', subscription.id);

  // Get subscription details before updating
  const { data: subRecord } = await supabaseAdmin
    .from('donation_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  const { error } = await supabaseAdmin
    .from('donation_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error updating subscription:', error);
  }

  // Send admin notification (GHL)
  if (subRecord) {
    await notifySubscriptionCancelled({
      amount: parseFloat(subRecord.amount),
      donorName: subRecord.donor_name || 'Unknown',
      donorEmail: subRecord.donor_email || 'Unknown',
    });

    // Send donor cancellation confirmation (Resend + log to GHL Conversations)
    if (subRecord.donor_email) {
      await sendSubscriptionCancelledEmail({
        donorEmail: subRecord.donor_email,
        donorName: subRecord.donor_name || 'Donor',
        amount: parseFloat(subRecord.amount),
      });

      // Move GHL pipeline to "Cancelled"
      await moveDonationThroughPipeline(subRecord.donor_email, 'cancelled')
        .catch(err => console.error('GHL pipeline move to Cancelled error:', err));
    }
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice, stripe: Stripe) {
  console.log('Invoice payment succeeded:', invoice.id);

  // Only process subscription invoices (not one-time payments)
  if (!invoice.subscription) {
    console.log('Not a subscription invoice, skipping');
    return;
  }

  // Check if this is the first invoice (already handled during subscription creation)
  // We can detect this by checking if billing_reason is 'subscription_create'
  if (invoice.billing_reason === 'subscription_create') {
    console.log('First subscription invoice - already handled during creation');
    // Update the donation status to completed, and mark fulfillment as not applicable
    // (recurring donations follow Active Subscriber lifecycle, not Fulfilled)
    if (invoice.payment_intent) {
      const paymentIntentId = typeof invoice.payment_intent === 'string'
        ? invoice.payment_intent
        : invoice.payment_intent.id;

      await supabaseAdmin
        .from('donations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          fulfillment_status: 'not_applicable',
        })
        .eq('stripe_payment_intent_id', paymentIntentId);
    }
    return;
  }

  // This is a recurring payment - create a new donation record
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription.id;

  // Get the subscription details from our database
  const { data: subscriptionRecord } = await supabaseAdmin
    .from('donation_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscriptionRecord) {
    console.error('Subscription not found in database:', subscriptionId);
    return;
  }

  // Get payment intent ID
  const paymentIntentId = typeof invoice.payment_intent === 'string'
    ? invoice.payment_intent
    : invoice.payment_intent?.id;

  // Determine if this is weekly (Jummah) or monthly subscription
  const isWeekly = subscriptionRecord.interval === 'weekly';
  const donationType = isWeekly ? 'weekly' : 'monthly';

  // Create new donation record for this recurring payment
  // NOTE: Recurring donations do NOT get fulfillment fields (fulfillment_status, scheduled_fulfillment_at, etc.)
  // They follow the Active Subscriber lifecycle, not the Fulfilled lifecycle
  const { data: donation, error: donationError } = await supabaseAdmin
    .from('donations')
    .insert({
      stripe_payment_intent_id: paymentIntentId,
      stripe_subscription_id: subscriptionId,
      amount: subscriptionRecord.amount,
      currency: subscriptionRecord.currency,
      status: 'completed',
      donation_type: donationType,
      donor_email: subscriptionRecord.donor_email,
      donor_name: subscriptionRecord.donor_name,
      items: subscriptionRecord.items || [],
      completed_at: new Date().toISOString(),
      fulfillment_status: 'not_applicable',
      metadata: {
        stripe_customer_id: subscriptionRecord.stripe_customer_id,
        is_recurring: true,
        is_jummah: isWeekly,
        invoice_id: invoice.id,
        billing_reason: invoice.billing_reason,
      },
    })
    .select()
    .single();

  if (donationError) {
    console.error('Error creating recurring donation record:', donationError);
    return;
  }

  // Update subscription's next billing date (weekly or monthly)
  const nextBillingDate = new Date();
  if (isWeekly) {
    // Next Friday
    const dayOfWeek = nextBillingDate.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    nextBillingDate.setDate(nextBillingDate.getDate() + daysUntilFriday);
    nextBillingDate.setHours(12, 0, 0, 0);
  } else {
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
  }

  await supabaseAdmin
    .from('donation_subscriptions')
    .update({
      next_billing_date: nextBillingDate.toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  // Track to GoHighLevel
  if (donation && subscriptionRecord.donor_email && subscriptionRecord.donor_name) {
    try {
      let items: Array<{ name: string; amount: number }> = [];
      if (subscriptionRecord.items) {
        items = typeof subscriptionRecord.items === 'string'
          ? JSON.parse(subscriptionRecord.items)
          : subscriptionRecord.items;
      }

      const campaignSlug = subscriptionRecord.campaign_slug ||
        (items.length > 0 ? items[0].name?.toLowerCase().replace(/\s+/g, '-') : 'general');

      const donationLabel = isWeekly ? 'Jummah Donation' : 'Monthly Donation';
      const result = await trackDonation({
        email: subscriptionRecord.donor_email,
        name: subscriptionRecord.donor_name,
        phone: null,
        amount: parseFloat(subscriptionRecord.amount),
        campaignSlug: campaignSlug,
        campaignName: items.length > 0 ? items[0].name : donationLabel,
        donationType: donationType as 'single' | 'monthly' | 'weekly',
        items: items.map(item => ({
          name: item.name || donationLabel,
          amount: typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount
        })),
        stripePaymentId: paymentIntentId,
        donationId: donation?.id,
        currency: subscriptionRecord.currency || 'USD',
      });

      console.log('Recurring donation synced to GHL:', {
        contactId: result.contactId,
        lifetimeGiving: result.lifetimeGiving,
        donationCount: result.donationCount,
        donationType: donationType,
      });

      // Move pipeline: Payment Received → Active Subscriber (recurring lifecycle)
      await moveDonationThroughPipeline(subscriptionRecord.donor_email, 'payment received')
        .catch(err => console.error('GHL pipeline move to Payment Received error:', err));
      await moveDonationThroughPipeline(subscriptionRecord.donor_email, 'active subscriber')
        .catch(err => console.error('GHL pipeline move to Active Subscriber error:', err));
    } catch (ghlError) {
      console.error('GHL sync error for recurring donation:', ghlError);
    }
  }

  console.log('Created donation record for recurring payment:', donation?.id);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Invoice payment failed:', invoice.id);

  if (!invoice.subscription) {
    return;
  }

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription.id;

  // Get failure reason
  const failureReason = invoice.last_finalization_error?.message ||
    invoice.last_finalization_error?.code ||
    'Payment failed';

  // Update subscription with failure tracking
  const { data: subscription, error } = await supabaseAdmin
    .from('donation_subscriptions')
    .update({
      status: 'past_due',
      last_failure_reason: failureReason,
      last_failure_at: new Date().toISOString(),
      failure_count: supabaseAdmin.rpc ? undefined : 1, // Increment if RPC available
    })
    .eq('stripe_subscription_id', subscriptionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating subscription status:', error);
  }

  // Increment failure count separately
  if (subscription) {
    await supabaseAdmin
      .from('donation_subscriptions')
      .update({
        failure_count: (subscription.failure_count || 0) + 1,
      })
      .eq('stripe_subscription_id', subscriptionId);

    // Record notification for tracking
    await supabaseAdmin.from('donor_notifications').insert({
      donor_email: subscription.donor_email,
      notification_type: 'payment_failed',
      subscription_id: subscription.id,
      metadata: {
        failure_reason: failureReason,
        invoice_id: invoice.id,
        failure_count: (subscription.failure_count || 0) + 1,
      },
    });
  }

  // Move GHL pipeline to "Past Due"
  if (subscription?.donor_email) {
    await moveDonationThroughPipeline(subscription.donor_email, 'past due')
      .catch(err => console.error('GHL pipeline move to Past Due error:', err));
  }

  console.log('Subscription payment failed, status updated to past_due:', subscriptionId);
}

// ============================================
// DISPUTE/CHARGEBACK HANDLERS
// ============================================

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  console.log('🚨 DISPUTE CREATED:', dispute.id);

  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  const amount = dispute.amount / 100; // Convert from cents
  const reason = dispute.reason;
  const status = dispute.status;

  // Find the related donation
  const { data: donation } = await supabaseAdmin
    .from('donations')
    .select('*')
    .eq('stripe_charge_id', chargeId)
    .single();

  // Record the dispute in the database
  await supabaseAdmin.from('donation_disputes').insert({
    stripe_dispute_id: dispute.id,
    stripe_charge_id: chargeId,
    donation_id: donation?.id || null,
    amount: amount,
    currency: dispute.currency,
    reason: reason,
    status: status,
    donor_email: donation?.donor_email || null,
    donor_name: donation?.donor_name || null,
    created_at: new Date().toISOString(),
    metadata: {
      evidence_due_by: dispute.evidence_details?.due_by
        ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
        : null,
    },
  }).then(() => {
    console.log('Dispute recorded in database');
  }).catch((err) => {
    console.error('Error recording dispute:', err);
  });

  // Update donation status to disputed
  if (donation) {
    await supabaseAdmin
      .from('donations')
      .update({ status: 'disputed' })
      .eq('id', donation.id);
  }

  // Send admin notification (Email + GHL + Database)
  const evidenceDueBy = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    : undefined;

  await notifyDispute({
    amount: amount,
    donorName: donation?.donor_name,
    donorEmail: donation?.donor_email,
    reason: reason || 'Unknown',
    disputeId: dispute.id,
    evidenceDueBy: evidenceDueBy,
  });

  console.log('Dispute notification sent to admin');
}

async function handleDisputeClosed(dispute: Stripe.Dispute) {
  console.log('Dispute closed:', dispute.id, 'Status:', dispute.status);

  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  const won = dispute.status === 'won';

  // Update dispute record
  await supabaseAdmin
    .from('donation_disputes')
    .update({
      status: dispute.status,
      closed_at: new Date().toISOString(),
      won: won,
    })
    .eq('stripe_dispute_id', dispute.id);

  // Update donation status based on outcome
  const { data: donation } = await supabaseAdmin
    .from('donations')
    .select('id')
    .eq('stripe_charge_id', chargeId)
    .single();

  if (donation) {
    const newStatus = won ? 'completed' : 'chargedback';
    await supabaseAdmin
      .from('donations')
      .update({ status: newStatus })
      .eq('id', donation.id);
  }

  // Send admin notification (Email + GHL + Database)
  await notifyDisputeClosed({
    amount: dispute.amount / 100,
    won: won,
    disputeId: dispute.id,
  });

  console.log('Dispute closed notification sent');
}
