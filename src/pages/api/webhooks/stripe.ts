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

    // Handle the event
    switch (event.type) {
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
