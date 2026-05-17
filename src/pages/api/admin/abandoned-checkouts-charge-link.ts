/**
 * POST /api/admin/abandoned-checkouts-charge-link
 *
 * Generates a Stripe Checkout link for an abandoned checkout, so admins can
 * send a payment link to the donor over the phone / SMS to complete payment.
 *
 * Body: { abandoned_checkout_id, amount, campaign_name?, campaign_slug? }
 * Returns: { url, session_id }
 */
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { getStripe } from '../../../lib/stripe-cache';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { abandoned_checkout_id, amount, campaign_name, campaign_slug } = body;

    if (!abandoned_checkout_id) {
      return jsonError('abandoned_checkout_id is required', 400);
    }
    const numericAmount = parseFloat(String(amount));
    if (!numericAmount || numericAmount < 1) {
      return jsonError('A valid amount (>=$1) is required', 400);
    }

    const { data: checkout, error: lookupError } = await supabaseAdmin
      .from('abandoned_checkouts')
      .select('*')
      .eq('id', abandoned_checkout_id)
      .single();

    if (lookupError || !checkout) {
      return jsonError('Abandoned checkout not found', 404);
    }

    // Pull best-known phone + billing address from prior donations on file
    // (so we can correct stale data on the existing Stripe customer).
    let derivedPhone: string | null = checkout.phone || null;
    let derivedAddress: any = null;
    if (checkout.email) {
      const { data: priorDonations } = await supabaseAdmin
        .from('donations')
        .select('donor_phone, metadata')
        .eq('donor_email', checkout.email.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(20);
      if (priorDonations) {
        if (!derivedPhone) {
          derivedPhone = priorDonations.find((d: any) => d.donor_phone)?.donor_phone || null;
        }
        derivedAddress = priorDonations.find((d: any) => (d.metadata as any)?.billing_address)?.metadata?.billing_address || null;
      }
    }

    const stripe = await getStripe();
    const requestUrl = new URL(request.url);
    const siteBase = `${requestUrl.protocol}//${requestUrl.host}`;

    const finalCampaignSlug = campaign_slug || checkout.campaign_slug || 'general';
    const finalCampaignName = campaign_name
      || (checkout.campaign_slug
        ? checkout.campaign_slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        : 'Donation');

    const fullName = [checkout.first_name, checkout.last_name].filter(Boolean).join(' ') || undefined;
    const stripeAddress = derivedAddress ? {
      line1: derivedAddress.line1 || undefined,
      line2: derivedAddress.line2 || undefined,
      city: derivedAddress.city || undefined,
      state: derivedAddress.state || undefined,
      postal_code: derivedAddress.postal_code || undefined,
      country: (derivedAddress.country || checkout.country || 'US').toUpperCase(),
    } : (checkout.country ? { country: String(checkout.country).toUpperCase() } : undefined);

    // Reuse / create Stripe customer — and OVERWRITE stale phone/address with our
    // server-of-record values so the Checkout session prefills correctly.
    let stripeCustomerId: string | undefined;
    if (checkout.email) {
      const customers = await stripe.customers.list({ email: checkout.email, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
        await stripe.customers.update(stripeCustomerId, {
          name: fullName,
          phone: derivedPhone || undefined,
          address: stripeAddress,
        }).catch((e: any) => console.error('Stripe customer update error:', e));
      } else {
        const newCustomer = await stripe.customers.create({
          email: checkout.email,
          name: fullName,
          phone: derivedPhone || undefined,
          address: stripeAddress,
        });
        stripeCustomerId = newCustomer.id;
      }
    }

    const sessionParams: any = {
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd', // Force USD — donations are USD-only on this platform
          product_data: {
            name: `${finalCampaignName} Donation`,
            description: 'Qurbani Foundation USA',
          },
          unit_amount: Math.round(numericAmount * 100),
        },
        quantity: 1,
      }],
      success_url: `${siteBase}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteBase}/donate`,
      payment_intent_data: {
        description: `${finalCampaignName} Donation - Qurbani Foundation USA`,
        metadata: {
          abandoned_checkout_id: String(abandoned_checkout_id),
          source: 'admin-charge-link',
          customer_email: checkout.email || '',
          customer_name: fullName || '',
          customer_phone: derivedPhone || '',
          campaign_slug: finalCampaignSlug,
          campaign_name: finalCampaignName,
          base_amount: numericAmount.toString(),
        },
      },
      metadata: {
        abandoned_checkout_id: String(abandoned_checkout_id),
        source: 'admin-charge-link',
        campaign_slug: finalCampaignSlug,
      },
      phone_number_collection: { enabled: true },
      billing_address_collection: 'required',
      allow_promotion_codes: false,
      // Disable Stripe's adaptive pricing so the donor never sees a converted
      // foreign-currency option (e.g. CAD) — donations are always charged in USD.
      adaptive_pricing: { enabled: false },
      expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24-hour link
    };

    // Stripe Checkout: pass `customer` OR `customer_email` (not both).
    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
      sessionParams.customer_update = { address: 'auto', name: 'auto' };
    } else if (checkout.email) {
      sessionParams.customer_email = checkout.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return jsonError('Stripe did not return a checkout URL', 500);
    }

    // Pre-create a pending donations row keyed by session.id. Stripe Checkout
    // doesn't mint a payment_intent until the donor actually pays, so we link
    // by stripe_checkout_session_id now and the webhook backfills the PI ID
    // when payment_intent.succeeded fires (via metadata.abandoned_checkout_id).
    // Without this row, the post-payment webhook silently no-ops and the
    // donor never gets a receipt.
    const items = [{
      id: `${finalCampaignSlug}-admin-${Date.now()}`,
      name: finalCampaignName,
      campaign: finalCampaignSlug,
      amount: numericAmount,
      quantity: 1,
      type: 'single',
      label: finalCampaignName,
      metadata: {},
    }];

    const { error: donationInsertError } = await supabaseAdmin
      .from('donations')
      .insert({
        stripe_checkout_session_id: session.id,
        amount: numericAmount,
        currency: 'USD',
        status: 'pending',
        donation_type: 'single',
        donor_email: checkout.email || null,
        donor_name: fullName || null,
        donor_phone: derivedPhone || null,
        items,
        campaign_slug: finalCampaignSlug,
        campaign_name: finalCampaignName,
        base_amount: numericAmount,
        metadata: {
          source: 'admin-charge-link',
          abandoned_checkout_id: String(abandoned_checkout_id),
          stripe_customer_id: stripeCustomerId || null,
          billing_address: derivedAddress || null,
          // Carry attribution forward from the abandoned checkout so the
          // recovered donation reports the correct source.
          ...(checkout.utm_source ? { utm_source: checkout.utm_source } : {}),
          ...(checkout.utm_medium ? { utm_medium: checkout.utm_medium } : {}),
          ...(checkout.utm_campaign ? { utm_campaign: checkout.utm_campaign } : {}),
          ...(checkout.utm_content ? { utm_content: checkout.utm_content } : {}),
          ...(checkout.checkout_source ? { checkout_source: checkout.checkout_source } : {}),
        },
      });

    if (donationInsertError) {
      console.error('Error creating pending donation for charge link:', donationInsertError);
    }

    // Track that an admin generated a manual charge link
    await supabaseAdmin
      .from('abandoned_checkouts')
      .update({
        last_activity_at: new Date().toISOString(),
        admin_charge_link_url: session.url,
        admin_charge_link_amount: numericAmount,
        admin_charge_link_created_at: new Date().toISOString(),
      })
      .eq('id', abandoned_checkout_id);

    return new Response(
      JSON.stringify({ success: true, url: session.url, session_id: session.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Charge link error:', error);
    return jsonError(error.message || 'Failed to generate charge link', 500);
  }
};

function jsonError(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}
