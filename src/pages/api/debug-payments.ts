import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('stripe_enabled, stripe_publishable_key, stripe_secret_key, google_pay_enabled, apple_pay_enabled, paypal_enabled, payment_test_mode')
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      stripe_enabled: data?.stripe_enabled,
      stripe_publishable_key: data?.stripe_publishable_key ? `${data.stripe_publishable_key.substring(0, 15)}...` : 'NOT SET',
      stripe_secret_key: data?.stripe_secret_key ? `${data.stripe_secret_key.substring(0, 15)}...` : 'NOT SET',
      google_pay_enabled: data?.google_pay_enabled,
      apple_pay_enabled: data?.apple_pay_enabled,
      paypal_enabled: data?.paypal_enabled,
      payment_test_mode: data?.payment_test_mode,
    }, null, 2), {
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
