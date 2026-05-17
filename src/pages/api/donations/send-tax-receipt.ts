export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { siteConfig } from '../../../config/site';

// ─── Helpers ───

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });
}

function formatAmount(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function generateReceiptNumber(donationId: string, createdAt: string): string {
  const year = new Date(createdAt).getFullYear();
  const shortId = donationId.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `QF-${year}-${shortId}`;
}

function parseItems(donation: Record<string, unknown>): Array<Record<string, unknown>> {
  try {
    const items = donation.items;
    return typeof items === 'string' ? JSON.parse(items) : (items as Array<Record<string, unknown>> || []);
  } catch {
    return [];
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Build the Tax Receipt HTML ───

function buildTaxReceiptHtml(donation: Record<string, unknown>): string {
  const receiptNumber = generateReceiptNumber(
    donation.id as string,
    donation.created_at as string
  );
  const donationDate = formatDate(donation.created_at as string);
  const transactionId = (donation.stripe_charge_id || donation.stripe_payment_intent_id || 'N/A') as string;
  const donorName = escapeHtml((donation.donor_name as string) || 'Donor');
  const donorEmail = escapeHtml((donation.donor_email as string) || '');

  const metadata = (donation.metadata || {}) as Record<string, unknown>;
  const billingAddress = metadata.billing_address as Record<string, string> | undefined;

  let addressHtml = '';
  if (billingAddress) {
    const parts: string[] = [];
    if (billingAddress.line1) parts.push(escapeHtml(billingAddress.line1));
    if (billingAddress.city || billingAddress.state || billingAddress.postal_code) {
      const cityState = [billingAddress.city, billingAddress.state].filter(Boolean).join(', ');
      parts.push(escapeHtml([cityState, billingAddress.postal_code].filter(Boolean).join(' ')));
    }
    if (billingAddress.country && billingAddress.country !== 'US') {
      parts.push(escapeHtml(billingAddress.country));
    }
    addressHtml = parts.join('<br>');
  }

  // Build items rows
  const items = parseItems(donation);
  let itemsRowsHtml = '';
  for (const item of items) {
    const name = escapeHtml((item.name as string) || (item.label as string) || 'Donation');
    const qty = (item.quantity as number) || 1;
    const amt = (item.amount as number) || 0;
    itemsRowsHtml += `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #374151;">${name}${qty > 1 ? ` (x${qty})` : ''}</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #374151; text-align: right;">${formatAmount(amt * qty)}</td>
      </tr>
    `;
  }

  // If no items parsed, show a single row
  if (items.length === 0) {
    const campaignName = (donation.campaign_name as string) || 'Donation';
    const baseAmount = (donation.base_amount as number) || (donation.amount as number) || 0;
    itemsRowsHtml = `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #374151;">${escapeHtml(campaignName)}</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #374151; text-align: right;">${formatAmount(baseAmount)}</td>
      </tr>
    `;
  }

  // Fee row
  const coversFees = donation.covers_fees as boolean;
  const feeAmount = (donation.fee_amount as number) || 0;
  let feeRowHtml = '';
  if (coversFees && feeAmount > 0) {
    feeRowHtml = `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280; font-style: italic;">Processing Fee Covered <span style="font-size: 11px;">(Voluntarily covered by donor)</span></td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6b7280; text-align: right;">${formatAmount(feeAmount)}</td>
      </tr>
    `;
  }

  const totalAmount = (donation.amount as number) || 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Official Donation Receipt - ${receiptNumber}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .receipt-wrapper { box-shadow: none !important; border: 1px solid #d1d5db !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" class="receipt-wrapper" style="background-color: #ffffff; border: 2px solid #d1d5db; border-radius: 4px; max-width: 620px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px; text-align: center; border-bottom: 2px solid #1f2937;">
              <img src="https://epsjdbnxhmeprjrgcbyw.supabase.co/storage/v1/object/public/media/1771815947323-nkje6c.png" alt="Qurbani Foundation USA" width="180" style="display: inline-block; max-width: 180px; height: auto; margin-bottom: 16px;">
              <h1 style="margin: 0 0 4px; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: bold; color: #1f2937; letter-spacing: 0.5px;">OFFICIAL DONATION RECEIPT</h1>
              <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">For Tax Purposes</p>
            </td>
          </tr>

          <!-- Receipt Details -->
          <tr>
            <td style="padding: 28px 40px 0;">
              <h2 style="margin: 0 0 16px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px;">Receipt Information</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 4px;">
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280; width: 45%;">Receipt Number</td>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1f2937; font-weight: bold;">${receiptNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">Date of Donation</td>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1f2937;">${donationDate}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">Transaction ID</td>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #1f2937; word-break: break-all;">${escapeHtml(transactionId)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">Payment Method</td>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1f2937;">Credit Card</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">Donor Name</td>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1f2937;">${donorName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px;${addressHtml ? ' border-bottom: 1px solid #e5e7eb;' : ''} font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">Donor Email</td>
                  <td style="padding: 10px 16px;${addressHtml ? ' border-bottom: 1px solid #e5e7eb;' : ''} font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1f2937;">${donorEmail}</td>
                </tr>
                ${addressHtml ? `
                <tr>
                  <td style="padding: 10px 16px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">Donor Address</td>
                  <td style="padding: 10px 16px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1f2937; line-height: 1.5;">${addressHtml}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- Donation Details -->
          <tr>
            <td style="padding: 28px 40px 0;">
              <h2 style="margin: 0 0 16px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px;">Donation Details</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 4px;">
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Description</td>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Amount</td>
                </tr>
                ${itemsRowsHtml}
                ${feeRowHtml}
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 12px 16px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; color: #1f2937;">Total Charged</td>
                  <td style="padding: 12px 16px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; color: #1f2937; text-align: right;">${formatAmount(totalAmount)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tax Statement -->
          <tr>
            <td style="padding: 28px 40px 0;">
              <div style="border: 1px solid #d1d5db; border-radius: 4px; padding: 24px; background-color: #fafafa;">
                <p style="margin: 0 0 14px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #1f2937;">
                  This letter serves as your official receipt for tax purposes.
                </p>
                ${siteConfig.showFederalTaxIdInReceipts ? `<p style="margin: 0 0 14px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #1f2937;">
                  Qurbani Foundation USA is a tax-exempt organization under Section 501(c)(3) of the Internal Revenue Code.<br>
                  <strong>Federal Tax ID (EIN): 38-4109146</strong>
                </p>` : ''}
                <p style="margin: 0 0 14px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #1f2937;">
                  No goods or services were provided in exchange for this contribution. The entire amount of your donation is tax-deductible to the extent allowed by law.
                </p>
                <p style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #1f2937; font-weight: bold;">
                  Please retain this receipt for your tax records.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; text-align: center; border-top: 2px solid #1f2937; margin-top: 28px;">
              <p style="margin: 0 0 4px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; color: #1f2937;">Qurbani Foundation USA</p>
              <p style="margin: 0 0 2px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">5900 Balcones Dr, Suite 100, Austin, TX 78731</p>
              <p style="margin: 0 0 2px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">1-800-900-0027</p>
              <p style="margin: 0 0 2px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">info@qurbani.com</p>
              <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">www.qurbani.com</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ─── API Route ───

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { donationId } = body;

    if (!donationId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing donationId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch donation
    const { data: donation, error: fetchError } = await supabaseAdmin
      .from('donations')
      .select('*')
      .eq('id', donationId)
      .single();

    if (fetchError || !donation) {
      return new Response(JSON.stringify({ success: false, error: 'Donation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!donation.donor_email) {
      return new Response(JSON.stringify({ success: false, error: 'No donor email on record' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (donation.status !== 'completed') {
      return new Response(JSON.stringify({ success: false, error: 'Only completed donations can receive tax receipts' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Build the receipt
    const receiptNumber = generateReceiptNumber(donation.id, donation.created_at);
    const html = buildTaxReceiptHtml(donation);

    // 3. Send via Resend
    const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Resend API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Qurbani Foundation <donations@receipts.qurbani.com>',
        reply_to: 'info@qurbani.com',
        to: donation.donor_email,
        subject: `Official Donation Receipt -- Qurbani Foundation USA (${receiptNumber})`,
        html: html,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Resend error sending tax receipt:', errorText);
      return new Response(JSON.stringify({ success: false, error: 'Failed to send email' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Tax receipt ${receiptNumber} sent to ${donation.donor_email}`);

    // 4. Mark as sent in the database
    // Use metadata to track tax receipt separately from regular receipt
    const existingMeta = (donation.metadata || {}) as Record<string, unknown>;
    const updatedMeta = {
      ...existingMeta,
      tax_receipt_sent: true,
      tax_receipt_sent_at: new Date().toISOString(),
      tax_receipt_number: receiptNumber,
    };

    await supabaseAdmin
      .from('donations')
      .update({
        metadata: updatedMeta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', donationId);

    return new Response(JSON.stringify({
      success: true,
      message: `Tax receipt ${receiptNumber} sent to ${donation.donor_email}`,
      receiptNumber,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Tax receipt error:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
