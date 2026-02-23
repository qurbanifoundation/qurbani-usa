import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    // First, get the existing row
    const { data: existing } = await supabaseAdmin
      .from('site_settings')
      .select('id')
      .limit(1)
      .single();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'No site_settings row found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update using the actual ID - keys come from environment variables
    const publishableKey = import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const secretKey = import.meta.env.STRIPE_SECRET_KEY;

    if (!publishableKey || !secretKey) {
      return new Response(JSON.stringify({
        error: 'Stripe keys not found in environment variables. Set PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY in .env'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .update({
        stripe_enabled: true,
        stripe_publishable_key: publishableKey,
        stripe_secret_key: secretKey,
        google_pay_enabled: true,
        apple_pay_enabled: true,
        paypal_enabled: false,
        payment_test_mode: publishableKey.startsWith('pk_test'),
      })
      .eq('id', existing.id)
      .select();

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      message: 'Stripe test keys configured successfully!',
      updated_id: existing.id,
      data: data,
      next_steps: [
        'Go to /campaigns/thirst-relief',
        'Click Donate Now',
        'Use test card: 4242 4242 4242 4242',
        'Any future expiry and any CVC'
      ]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
