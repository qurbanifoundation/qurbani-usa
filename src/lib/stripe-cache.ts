/**
 * Cached Stripe instance — avoids querying site_settings on every payment API call.
 * 5-minute TTL balances performance with admin changes propagation.
 */
import { supabaseAdmin } from './supabase';
import Stripe from 'stripe';

let _cache: { stripe: Stripe; time: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getStripe(): Promise<Stripe> {
  if (_cache && (Date.now() - _cache.time < CACHE_TTL)) {
    return _cache.stripe;
  }

  const { data: settings } = await supabaseAdmin
    .from('site_settings')
    .select('stripe_secret_key, stripe_enabled')
    .single();

  if (!settings?.stripe_enabled) throw new Error('Stripe payments are disabled');
  if (!settings?.stripe_secret_key) throw new Error('Stripe is not configured');

  const stripe = new Stripe(settings.stripe_secret_key, { apiVersion: '2023-10-16' });
  _cache = { stripe, time: Date.now() };
  return stripe;
}
