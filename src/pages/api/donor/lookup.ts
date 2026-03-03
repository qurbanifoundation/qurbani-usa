import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Fetch subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from('donation_subscriptions')
      .select('id, stripe_subscription_id, donor_name, donor_email, amount, currency, status, interval, items, next_billing_date, card_last4, card_brand, management_token, created_at, cancelled_at')
      .eq('donor_email', normalizedEmail)
      .order('created_at', { ascending: false });

    // Fetch recent donations (one-time + recurring) — include phone + metadata for auto-fill
    const { data: donations } = await supabaseAdmin
      .from('donations')
      .select('id, amount, currency, status, donation_type, items, donor_name, donor_phone, metadata, created_at, completed_at')
      .eq('donor_email', normalizedEmail)
      .order('created_at', { ascending: false })
      .limit(20);

    // Calculate total donated
    const totalDonated = (donations || [])
      .filter(d => d.status === 'completed')
      .reduce((sum, d) => sum + (d.amount || 0), 0);

    // Extract phone and billing address from most recent completed donation
    const completedDonation = (donations || []).find((d: any) => d.status === 'completed' && d.metadata?.billing_address);
    const latestDonation = (donations || [])[0];
    const donorPhone = completedDonation?.donor_phone || latestDonation?.donor_phone || null;
    const billingAddress = completedDonation?.metadata?.billing_address || latestDonation?.metadata?.billing_address || null;

    return new Response(JSON.stringify({
      subscriptions: subscriptions || [],
      donations: donations || [],
      totalDonated,
      donorName: subscriptions?.[0]?.donor_name || latestDonation?.donor_name || null,
      donorPhone,
      billingAddress,
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
