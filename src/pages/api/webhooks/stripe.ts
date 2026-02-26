import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { trackDonation } from '../../../lib/ghl-advanced';
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

    // Verify webhook signature if secret is configured
    if (settings.stripe_webhook_secret) {
      try {
        // Use constructEventAsync for Cloudflare Workers compatibility
        // (Workers use Web Crypto API, not Node's crypto module)
        event = await stripe.webhooks.constructEventAsync(body, signature, settings.stripe_webhook_secret);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return new Response(JSON.stringify({ error: 'Invalid signature', detail: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Parse without verification (not recommended for production)
      event = JSON.parse(body);
    }

    // Check for idempotency - prevent duplicate processing
    const { data: existingEvent } = await supabaseAdmin
      .from('webhook_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single();

    if (existingEvent) {
      console.log('Event already processed:', event.id);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Record the event for idempotency
    await supabaseAdmin.from('webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event.data.object,
    });

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

  // Update donation record
  const { data: donation, error } = await supabaseAdmin
    .from('donations')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      stripe_charge_id: paymentIntent.latest_charge as string,
    })
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
      });

      console.log('Donation synced to GHL:', {
        contactId: result.contactId,
        lifetimeGiving: result.lifetimeGiving,
        donationCount: result.donationCount,
        donorTier: result.donorTier
      });
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
    });
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

      await sendSubscriptionConfirmation({
        donorEmail: subRecord.donor_email,
        donorName: subRecord.donor_name || 'Donor',
        amount: parseFloat(subRecord.amount),
        interval: (subRecord.interval as 'monthly' | 'weekly') || 'monthly',
        nextBillingDate: nextBillingDate,
        items: items,
      });
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

  const { error } = await supabaseAdmin
    .from('donation_subscriptions')
    .update({
      status,
      next_billing_date: nextBillingDate,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error updating subscription:', error);
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
    // Still update the donation status to completed
    if (invoice.payment_intent) {
      const paymentIntentId = typeof invoice.payment_intent === 'string'
        ? invoice.payment_intent
        : invoice.payment_intent.id;

      await supabaseAdmin
        .from('donations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
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
      });

      console.log('Recurring donation synced to GHL:', {
        contactId: result.contactId,
        lifetimeGiving: result.lifetimeGiving,
        donationCount: result.donationCount,
        donationType: donationType,
      });
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
