import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const ADMIN_EMAIL = import.meta.env.ADMIN_EMAIL || 'qurbanifoundation@gmail.com';

/**
 * Client-reported checkout failure. Called by donationFetch in DonationCart.astro
 * whenever a donor's Pay-button click results in a persistent (post-retry) error.
 *
 * Purpose: give admin near-real-time visibility into broken donations so they
 * can follow up with the donor before the donor gives up.
 *
 * Note: This is best-effort logging — we never block / never retry / never error.
 * The donor's UI will show its own error message regardless.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));

    const customer = body?.customer || {};
    const donorName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
    const donorEmail = customer.email || '';
    const donorPhone = customer.phone || '';
    const url = body?.url || 'unknown';
    const status = body?.status;
    const error = body?.error || 'unknown';
    const amount = typeof body?.amount === 'number' ? body.amount : null;
    const items = Array.isArray(body?.items) ? body.items : [];
    const checkoutSource = body?.checkout_source || 'unknown';
    const when = body?.when || new Date().toISOString();

    // 1) Persist to admin_notifications so it shows in the dashboard
    try {
      await supabaseAdmin.from('admin_notifications').insert({
        type: 'payment_failed',
        title: 'Checkout Submit Failed (Server Error)',
        message: `Donor "${donorName}" (${donorEmail || 'no email'}) clicked Pay but the server returned an error. Endpoint: ${url}, status: ${status}, error: ${error}. Follow up before they give up.`,
        severity: 'critical',
        metadata: {
          donor_name: donorName,
          donor_email: donorEmail,
          donor_phone: donorPhone,
          amount,
          items,
          url,
          status,
          error,
          checkout_source: checkoutSource,
          when,
        },
        read: false,
      });
    } catch (dbErr) {
      console.error('[checkout-failure] Failed to insert admin_notification:', dbErr);
    }

    // 2) Fire admin email via Resend so they see it immediately
    if (RESEND_API_KEY) {
      const itemsHtml = items.length > 0
        ? items.map((i: any) => `<li>${i.name || 'Item'} — $${(i.amount || 0)}${i.type && i.type !== 'single' ? ` (${i.type})` : ''}</li>`).join('')
        : '<li>No items captured</li>';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 16px;">
            <h2 style="margin: 0 0 8px; color: #991b1b;">⚠️ Donor Couldn't Complete Donation</h2>
            <p style="margin: 0; color: #7f1d1d;">A donor clicked Pay but received a server error. Please reach out before they give up.</p>
          </div>
          <h3 style="color: #111827; margin: 16px 0 8px;">Donor</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 8px; color: #6b7280;">Name</td><td style="padding: 4px 8px;"><strong>${donorName}</strong></td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">Email</td><td style="padding: 4px 8px;">${donorEmail ? `<a href="mailto:${donorEmail}">${donorEmail}</a>` : '<em>not provided</em>'}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">Phone</td><td style="padding: 4px 8px;">${donorPhone ? `<a href="tel:${donorPhone}">${donorPhone}</a>` : '<em>not provided</em>'}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">Amount</td><td style="padding: 4px 8px;"><strong>$${amount != null ? Number(amount).toFixed(2) : '?'}</strong></td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">When</td><td style="padding: 4px 8px;">${when}</td></tr>
          </table>
          <h3 style="color: #111827; margin: 16px 0 8px;">Items</h3>
          <ul>${itemsHtml}</ul>
          <h3 style="color: #111827; margin: 16px 0 8px;">Error Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 13px;">
            <tr><td style="padding: 4px 8px; color: #6b7280;">Endpoint</td><td style="padding: 4px 8px;">${url}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">Status</td><td style="padding: 4px 8px;">${status ?? '(no response)'}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">Error</td><td style="padding: 4px 8px;">${error}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">Source</td><td style="padding: 4px 8px;">${checkoutSource}</td></tr>
          </table>
          <p style="margin: 24px 0 0; color: #6b7280; font-size: 12px;">This alert fires after the donor's browser retried once and still got a server error. The donor saw an error message and may have given up.</p>
        </div>
      `;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Qurbani USA Alerts <alerts@notifications.qurbani.com>',
            to: ADMIN_EMAIL,
            subject: `🚨 Donor blocked at checkout — $${amount != null ? Number(amount).toFixed(2) : '?'} from ${donorName}`,
            html,
          }),
        });
      } catch (emailErr) {
        console.error('[checkout-failure] Resend email failed:', emailErr);
      }
    }

    return new Response(JSON.stringify({ logged: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[checkout-failure] Unexpected error:', error);
    // Always return 200 — this is a best-effort logging endpoint, not a critical path
    return new Response(JSON.stringify({ logged: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
