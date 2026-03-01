import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { clearSettingsCache } from '../../../lib/settings';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Update site_settings with payment configuration
    const { error } = await supabaseAdmin
      .from('site_settings')
      .update({
        stripe_enabled: data.stripe_enabled,
        stripe_publishable_key: data.stripe_publishable_key,
        stripe_secret_key: data.stripe_secret_key,
        google_pay_enabled: data.google_pay_enabled,
        apple_pay_enabled: data.apple_pay_enabled,
        paypal_enabled: data.paypal_enabled,
        paypal_client_id: data.paypal_client_id,
        paypal_client_secret: data.paypal_client_secret,
        payment_test_mode: data.payment_test_mode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (error) throw error;

    // Clear settings cache so changes appear immediately
    clearSettingsCache();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('stripe_enabled, stripe_publishable_key, google_pay_enabled, apple_pay_enabled, paypal_enabled, payment_test_mode')
      .single();

    if (error) throw error;

    // Only return public settings (not secret keys)
    return new Response(JSON.stringify({
      stripe_enabled: data?.stripe_enabled ?? true,
      stripe_publishable_key: data?.stripe_publishable_key || '',
      google_pay_enabled: data?.google_pay_enabled ?? true,
      apple_pay_enabled: data?.apple_pay_enabled ?? true,
      paypal_enabled: data?.paypal_enabled ?? false,
      test_mode: data?.payment_test_mode ?? true,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
