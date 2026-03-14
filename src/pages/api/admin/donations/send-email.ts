import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { sendDonationReceipt, sendEmailAndLogToGHL, getEmailWrapper } from '../../../../lib/donor-emails';
import { buildPreferencesUrls } from '../../../../lib/email-preferences';

export const prerender = false;

/**
 * POST /api/admin/donations/send-email
 *
 * Send an email related to a donation:
 *   - action: 'resend_receipt' → Re-sends the donation receipt
 *   - action: 'custom'        → Sends a custom email with subject + message
 *
 * Body: {
 *   donation_id: string,
 *   action: 'resend_receipt' | 'custom',
 *   subject?: string,   // required for custom
 *   message?: string,   // required for custom (plain text or simple HTML)
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { donation_id, action, subject, message } = body;

    if (!donation_id || typeof donation_id !== 'string') {
      return new Response(JSON.stringify({ error: 'donation_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!action || !['resend_receipt', 'custom'].includes(action)) {
      return new Response(JSON.stringify({ error: 'action must be "resend_receipt" or "custom"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch donation
    const { data: donation, error: fetchError } = await supabaseAdmin
      .from('donations')
      .select('*')
      .eq('id', donation_id)
      .single();

    if (fetchError || !donation) {
      return new Response(JSON.stringify({ error: 'Donation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!donation.donor_email) {
      return new Response(JSON.stringify({ error: 'Donation has no email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ──── RESEND RECEIPT ────
    if (action === 'resend_receipt') {
      const items = typeof donation.items === 'string'
        ? JSON.parse(donation.items)
        : (donation.items || []);

      const receiptItems = items.map((item: any) => ({
        name: item.name || item.label || 'Donation',
        amount: item.amount || 0,
        quantity: item.quantity || 1,
        type: item.type || donation.donation_type || 'single',
      }));

      const meta = donation.metadata || {};

      const result = await sendDonationReceipt({
        donorEmail: donation.donor_email,
        donorName: donation.donor_name || 'Donor',
        amount: parseFloat(donation.amount) || 0,
        items: receiptItems,
        transactionId: donation.stripe_payment_intent_id || donation.id,
        donationType: donation.donation_type === 'monthly' ? 'monthly' : 'single',
        date: new Date(donation.created_at),
        billingAddress: meta.billing_address || undefined,
      });

      if (!result.success) {
        return new Response(JSON.stringify({ error: 'Failed to send receipt email' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Mark receipt as sent
      await supabaseAdmin
        .from('donations')
        .update({ receipt_sent: true, updated_at: new Date().toISOString() })
        .eq('id', donation_id);

      console.log(`[Admin] Resent receipt to ${donation.donor_email} for donation ${donation_id}`);

      return new Response(JSON.stringify({
        success: true,
        message: `Receipt sent to ${donation.donor_email}`,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ──── CUSTOM EMAIL ────
    if (action === 'custom') {
      if (!subject || typeof subject !== 'string' || !subject.trim()) {
        return new Response(JSON.stringify({ error: 'Subject is required for custom emails' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (!message || typeof message !== 'string' || !message.trim()) {
        return new Response(JSON.stringify({ error: 'Message is required for custom emails' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const firstName = (donation.donor_name || 'Donor').split(' ')[0];

      // Convert newlines to <br> for HTML
      const htmlMessage = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

      // Build preferences URLs
      let prefUrls: { manage: string; unsubscribe: string } | undefined;
      try {
        prefUrls = await buildPreferencesUrls(donation.donor_email);
      } catch {
        // Non-critical - send without preferences links
      }

      const content = `
        <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">
          Assalamu Alaikum${firstName !== 'Donor' ? `, ${firstName}` : ''},
        </h2>
        <div style="color: #374151; font-size: 15px; line-height: 1.7;">
          ${htmlMessage}
        </div>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 13px;">
            This email was sent regarding your donation of <strong>$${parseFloat(donation.amount).toFixed(2)}</strong>
            on ${new Date(donation.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })}.
          </p>
        </div>
      `;

      const html = getEmailWrapper(content, subject, prefUrls);

      const result = await sendEmailAndLogToGHL({
        to: donation.donor_email,
        subject: subject.trim(),
        html,
        plainText: `${message}\n\nThis email was sent regarding your donation of $${parseFloat(donation.amount).toFixed(2)} on ${new Date(donation.created_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}.`,
        emailType: 'admin_custom',
      });

      if (!result.success) {
        return new Response(JSON.stringify({ error: result.error || 'Failed to send email' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      console.log(`[Admin] Custom email sent to ${donation.donor_email} for donation ${donation_id}: "${subject}"`);

      return new Response(JSON.stringify({
        success: true,
        message: `Email sent to ${donation.donor_email}`,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Admin] Send email error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to send email' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
