/**
 * POST /api/donations/qurbani-confirmation-test
 * Body: { donationId, hijriDay }
 *
 * Renders the email exactly as the donor would receive it, but sends to the
 * admin email instead. Used by the admin preview modal "Send to me first" button.
 * Does NOT mark the donation as confirmed.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { formatOrderNumber } from '../../../lib/order-number';
import {
  getQurbaniItems,
  deriveOnBehalfOf,
  renderQurbaniItemsHtml,
  renderConfirmationEmail,
} from '../../../lib/qurbani-confirmation';

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
const ADMIN_EMAIL = import.meta.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'qurbanifoundation@gmail.com';

export const POST: APIRoute = async ({ request }) => {
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ success: false, error: 'Resend API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const donationId = body.donationId;
  const hijriDay = Number(body.hijriDay);

  if (!donationId || ![10, 11, 12].includes(hijriDay)) {
    return new Response(JSON.stringify({ success: false, error: 'donationId and valid hijriDay required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: donation } = await supabaseAdmin
    .from('donations')
    .select('id, donor_name, donor_email, amount, items, campaign_name, order_number, created_at')
    .eq('id', donationId)
    .maybeSingle();

  if (!donation) {
    return new Response(JSON.stringify({ success: false, error: 'Donation not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const qurbaniItems = getQurbaniItems(donation as any);
  if (!qurbaniItems.length) {
    return new Response(JSON.stringify({ success: false, error: 'No qurbani items' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const donorFirstName = (donation.donor_name || 'Friend').split(' ')[0];
  const orderNumber = formatOrderNumber(donation.order_number, donation.created_at) || 'QF-Pending';
  const onBehalfOf = deriveOnBehalfOf(qurbaniItems, donation.donor_name);
  const itemsHtml = renderQurbaniItemsHtml(qurbaniItems);
  const country = qurbaniItems[0]?.metadata?.country || 'one of our partner countries';

  const html = renderConfirmationEmail({
    donor_first_name: donorFirstName,
    order_number: orderNumber,
    hijri_day: hijriDay as 10 | 11 | 12,
    on_behalf_of: onBehalfOf,
    qurbani_items_html: itemsHtml,
    country,
  });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Qurbani Foundation <donorcare@receipts.qurbani.com>',
      to: ADMIN_EMAIL,
      reply_to: 'donorcare@qurbani.com',
      subject: `[TEST — for ${donation.donor_email}] Alhamdulillah — Your Qurbani Has Been Performed`,
      html,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return new Response(JSON.stringify({ success: false, error: `Resend error ${res.status}: ${t}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = await res.json().catch(() => ({}));
  return new Response(JSON.stringify({ success: true, emailId: data.id, sentTo: ADMIN_EMAIL }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
