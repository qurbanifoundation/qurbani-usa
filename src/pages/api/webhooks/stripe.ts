import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { trackDonation } from '../../../lib/ghl-advanced';
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
        event = stripe.webhooks.constructEvent(body, signature, settings.stripe_webhook_secret);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
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

  // Sync to GoHighLevel with full campaign attribution and lifetime tracking
  if (donation?.donor_email && donation?.donor_name) {
    try {
      // Parse items for campaign tracking
      let items: Array<{ name: string; amount: number }> = [];
      if (donation.items) {
        items = typeof donation.items === 'string'
          ? JSON.parse(donation.items)
          : donation.items;
      }

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
        donationType: (donation.donation_type as 'single' | 'monthly') || 'single',
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
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

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
}

async function handleRefund(charge: Stripe.Charge) {
  console.log('Charge refunded:', charge.id);

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

  // Create new donation record for this recurring payment
  const { data: donation, error: donationError } = await supabaseAdmin
    .from('donations')
    .insert({
      stripe_payment_intent_id: paymentIntentId,
      stripe_subscription_id: subscriptionId,
      amount: subscriptionRecord.amount,
      currency: subscriptionRecord.currency,
      status: 'completed',
      donation_type: 'monthly',
      donor_email: subscriptionRecord.donor_email,
      donor_name: subscriptionRecord.donor_name,
      items: subscriptionRecord.items || [],
      completed_at: new Date().toISOString(),
      metadata: {
        stripe_customer_id: subscriptionRecord.stripe_customer_id,
        is_recurring: true,
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

  // Update subscription's next billing date
  const nextBillingDate = new Date();
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

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

      const result = await trackDonation({
        email: subscriptionRecord.donor_email,
        name: subscriptionRecord.donor_name,
        phone: null,
        amount: parseFloat(subscriptionRecord.amount),
        campaignSlug: campaignSlug,
        campaignName: items.length > 0 ? items[0].name : 'Monthly Donation',
        donationType: 'monthly',
        items: items.map(item => ({
          name: item.name || 'Monthly Donation',
          amount: typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount
        })),
      });

      console.log('Recurring donation synced to GHL:', {
        contactId: result.contactId,
        lifetimeGiving: result.lifetimeGiving,
        donationCount: result.donationCount,
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
