import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import Stripe from 'stripe';
import crypto from 'crypto';

export const prerender = false;

// Generate a secure token for subscription management
// Uses SUPABASE_SERVICE_ROLE_KEY as HMAC secret (always available, always secret)
export function generateManagementToken(subscriptionId: string, email: string): string {
  const secret = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }
  const data = `sub-manage:${subscriptionId}:${email}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex').substring(0, 32);
}

// Verify management token
export function verifyManagementToken(token: string, subscriptionId: string, email: string): boolean {
  const expectedToken = generateManagementToken(subscriptionId, email);
  return token === expectedToken;
}

// GET - Get donor's subscriptions by email or token
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const email = url.searchParams.get('email');
    const token = url.searchParams.get('token');
    const subscriptionId = url.searchParams.get('subscription_id');

    // Validate access - either by token or by providing email
    if (token && subscriptionId) {
      // Token-based access (from email links)
      const { data: subscription } = await supabaseAdmin
        .from('donation_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (!subscription) {
        return new Response(JSON.stringify({ error: 'Subscription not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!verifyManagementToken(token, subscriptionId, subscription.donor_email)) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ subscriptions: [subscription] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (email) {
      // Email-only lookup: return subscription info WITHOUT management tokens
      // Tokens are only generated server-side when sending management emails to the donor
      const { data: subscriptions, error } = await supabaseAdmin
        .from('donation_subscriptions')
        .select('id, status, amount, interval, campaign_name, created_at, current_period_end')
        .eq('donor_email', email)
        .in('status', ['active', 'paused', 'past_due'])
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ subscriptions: subscriptions || [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Email or token required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST - Pause or resume subscription
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { subscription_id, token, action } = body;

    if (!subscription_id || !token || !action) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get subscription from database
    const { data: subscription } = await supabaseAdmin
      .from('donation_subscriptions')
      .select('*')
      .eq('id', subscription_id)
      .single();

    if (!subscription) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify token
    if (!verifyManagementToken(token, subscription_id, subscription.donor_email)) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Stripe settings
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('stripe_secret_key')
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

    let updatedStatus: string;

    switch (action) {
      case 'pause': {
        // Pause the subscription at the end of the current period
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          pause_collection: {
            behavior: 'void',
          },
        });
        updatedStatus = 'paused';

        // Update paused_at timestamp
        await supabaseAdmin
          .from('donation_subscriptions')
          .update({ paused_at: new Date().toISOString() })
          .eq('id', subscription_id);
        break;
      }

      case 'resume': {
        // Resume paused subscription
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          pause_collection: '',
        });
        updatedStatus = 'active';

        // Clear paused_at
        await supabaseAdmin
          .from('donation_subscriptions')
          .update({ paused_at: null })
          .eq('id', subscription_id);
        break;
      }

      case 'skip': {
        // Skip the next payment by pausing for one billing cycle
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        const nextBillingDate = stripeSubscription.current_period_end;

        // Calculate resume date based on interval (weekly or monthly)
        const resumeDate = new Date(nextBillingDate * 1000);
        const isWeekly = subscription.interval === 'weekly';
        if (isWeekly) {
          // For weekly (Jummah), skip to next Friday
          resumeDate.setDate(resumeDate.getDate() + 7);
        } else {
          // For monthly, add one month
          resumeDate.setMonth(resumeDate.getMonth() + 1);
        }

        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          pause_collection: {
            behavior: 'void',
            resumes_at: Math.floor(resumeDate.getTime() / 1000),
          },
        });

        // Update database
        await supabaseAdmin
          .from('donation_subscriptions')
          .update({
            skip_next_payment: true,
            resume_at: resumeDate.toISOString(),
          })
          .eq('id', subscription_id);

        const dateFormat: Intl.DateTimeFormatOptions = {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          ...(isWeekly && { weekday: 'long' }),
        };

        return new Response(JSON.stringify({
          success: true,
          status: 'active',
          message: `Next ${isWeekly ? 'Jummah' : ''} payment skipped. Billing will resume on ${resumeDate.toLocaleDateString('en-US', dateFormat)}.`,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action. Use "pause", "resume", or "skip"' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    // Update database
    const { error: updateError } = await supabaseAdmin
      .from('donation_subscriptions')
      .update({ status: updatedStatus })
      .eq('id', subscription_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({
      success: true,
      status: updatedStatus,
      message: action === 'pause'
        ? 'Subscription paused. You will not be charged until you resume.'
        : 'Subscription resumed. Regular billing will continue.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE - Cancel subscription
export const DELETE: APIRoute = async ({ request, url }) => {
  try {
    const subscription_id = url.searchParams.get('subscription_id');
    const token = url.searchParams.get('token');

    if (!subscription_id || !token) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get subscription from database
    const { data: subscription } = await supabaseAdmin
      .from('donation_subscriptions')
      .select('*')
      .eq('id', subscription_id)
      .single();

    if (!subscription) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify token
    if (!verifyManagementToken(token, subscription_id, subscription.donor_email)) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Stripe settings
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('stripe_secret_key')
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

    // Cancel the subscription at the end of the current period
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Update database
    const { error: updateError } = await supabaseAdmin
      .from('donation_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', subscription_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Subscription cancelled. You will not be charged again after the current period ends.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error cancelling subscription:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
