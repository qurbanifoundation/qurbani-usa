/**
 * GET /api/donations/qurbani-confirmation-preview?donationId={id}&hijriDay={10|11|12}
 *
 * Returns the rendered HTML of the Qurbani confirmation email for a specific
 * donation. Used by the admin preview modal. Does NOT send any email.
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

export const GET: APIRoute = async ({ url }) => {
  const donationId = url.searchParams.get('donationId');
  const hijriDay = Number(url.searchParams.get('hijriDay'));

  if (!donationId) {
    return new Response('Missing donationId', { status: 400 });
  }
  if (![10, 11, 12].includes(hijriDay)) {
    return new Response('Invalid hijriDay', { status: 400 });
  }

  const { data: donation } = await supabaseAdmin
    .from('donations')
    .select('id, donor_name, donor_email, amount, items, campaign_name, order_number, created_at')
    .eq('id', donationId)
    .maybeSingle();

  if (!donation) {
    return new Response('Donation not found', { status: 404 });
  }

  const qurbaniItems = getQurbaniItems(donation as any);
  if (!qurbaniItems.length) {
    return new Response('No qurbani items in this donation', { status: 400 });
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

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
