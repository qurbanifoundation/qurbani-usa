import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { syncOrderToGHL } from '../../../lib/gohighlevel';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

// GoHighLevel config
const ghlApiKey = import.meta.env.GHL_API_KEY;
const ghlLocationId = import.meta.env.GHL_LOCATION_ID;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature (skip in development if no secret set)
    if (webhookSecret && webhookSecret !== 'whsec_placeholder') {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // In development, parse the event without verification
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

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

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) {
    console.error('No order_id in session metadata');
    return;
  }

  // Update order status to paid
  const { data: order, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      stripe_payment_intent_id: session.payment_intent as string,
      payment_method: 'card',
      paid_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (updateError) {
    console.error('Failed to update order:', updateError);
    return;
  }

  console.log(`Order ${orderId} marked as paid`);

  // Create or update donor record
  await upsertDonor(order);

  // Create fulfillment record
  await createFulfillment(orderId);

  // Sync to GoHighLevel
  await syncToGoHighLevel(order);
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) return;

  // Update order if not already updated
  await supabase
    .from('orders')
    .update({
      status: 'paid',
      stripe_payment_intent_id: paymentIntent.id,
      paid_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .eq('status', 'pending'); // Only update if still pending
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) return;

  await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      internal_notes: `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`
    })
    .eq('id', orderId);

  console.log(`Order ${orderId} marked as cancelled due to payment failure`);
}

async function handleRefund(charge: Stripe.Charge) {
  // Find order by payment intent
  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_payment_intent_id', charge.payment_intent)
    .limit(1);

  if (orders && orders.length > 0) {
    await supabase
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', orders[0].id);

    console.log(`Order ${orders[0].id} marked as refunded`);
  }
}

async function upsertDonor(order: any) {
  // Check if donor exists
  const { data: existingDonor } = await supabase
    .from('donors')
    .select('id, total_donated, donation_count')
    .eq('email', order.donor_email)
    .single();

  let donorId: string;

  if (existingDonor) {
    // Update existing donor
    await supabase
      .from('donors')
      .update({
        total_donated: (existingDonor.total_donated || 0) + order.total_amount,
        donation_count: (existingDonor.donation_count || 0) + 1,
        last_donation_at: new Date().toISOString(),
        full_name: order.donor_name,
        phone: order.donor_phone
      })
      .eq('id', existingDonor.id);

    donorId = existingDonor.id;
  } else {
    // Create new donor
    const { data: newDonor } = await supabase
      .from('donors')
      .insert({
        email: order.donor_email,
        full_name: order.donor_name,
        phone: order.donor_phone,
        total_donated: order.total_amount,
        donation_count: 1,
        first_donation_at: new Date().toISOString(),
        last_donation_at: new Date().toISOString()
      })
      .select()
      .single();

    donorId = newDonor?.id;
  }

  // Link donor to order
  if (donorId) {
    await supabase
      .from('orders')
      .update({ donor_id: donorId })
      .eq('id', order.id);
  }
}

async function createFulfillment(orderId: string) {
  // Create a fulfillment record for tracking
  await supabase
    .from('fulfillments')
    .insert({
      order_id: orderId,
      status: 'pending'
    });

  // Create initial fulfillment event
  const { data: fulfillment } = await supabase
    .from('fulfillments')
    .select('id')
    .eq('order_id', orderId)
    .single();

  if (fulfillment) {
    await supabase
      .from('fulfillment_events')
      .insert({
        fulfillment_id: fulfillment.id,
        order_id: orderId,
        event_type: 'status_change',
        new_status: 'pending',
        description: 'Order received and awaiting fulfillment'
      });
  }
}

async function syncToGoHighLevel(order: any) {
  if (!ghlApiKey || !ghlLocationId) {
    console.log('GoHighLevel not configured, skipping sync');
    return;
  }

  try {
    // Get campaign name from order items
    const { data: items } = await supabase
      .from('order_items')
      .select('campaign_name')
      .eq('order_id', order.id)
      .limit(1);

    const campaignName = items?.[0]?.campaign_name;

    const result = await syncOrderToGHL(
      {
        donorEmail: order.donor_email,
        donorName: order.donor_name,
        donorPhone: order.donor_phone,
        totalAmount: order.total_amount,
        orderNumber: order.order_number,
        campaignName
      },
      ghlApiKey,
      ghlLocationId
    );

    if (result.success) {
      console.log(`Order ${order.id} synced to GHL, contact ID: ${result.contactId}`);

      // Store GHL contact ID in donor record
      if (result.contactId) {
        await supabase
          .from('donors')
          .update({ ghl_contact_id: result.contactId })
          .eq('email', order.donor_email);
      }
    } else {
      console.error('GHL sync failed:', result.error);
    }
  } catch (error) {
    console.error('GHL sync error:', error);
    // Don't throw - GHL sync failure shouldn't break the webhook
  }
}
