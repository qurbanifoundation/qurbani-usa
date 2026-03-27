/**
 * POST /api/cron/aqiqah-certificates
 *
 * Called daily at ~10:00 AM Eastern by the Cloudflare Cron Worker.
 * Finds completed aqiqah donations that are 2+ days old and haven't
 * received their certificate yet, then:
 *   1. Generates a PDF certificate (pure JS via pdf-lib — no Python needed)
 *   2. Uploads PDF to Supabase Storage
 *   3. Sends certificate email via Resend (with PDF attachment)
 *   4. Logs a note in GHL
 *   5. Marks the donation record as certificate_sent_at = now()
 *
 * Auth: x-api-key header = first 32 chars of SUPABASE_SERVICE_ROLE_KEY
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { generateAqiqahCertificate } from '../../../lib/aqiqah-certificate';

export const prerender = false;

const PERFORMANCE_DAYS = 2;
const LOCATION = 'Pakistan';
const GHL_LOCATION_ID = import.meta.env.GHL_LOCATION_ID || 'W0zaxipAVHwutqUazGwL';

// ─── Auth ────────────────────────────────────────────────────────────────────

function isAuthorized(request: Request): boolean {
  const url = new URL(request.url);
  const apiKey = url.searchParams.get('key') || request.headers.get('x-api-key');
  const expectedKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  return apiKey === expectedKey?.substring(0, 32);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPerformanceDate(orderDate: string): Date {
  const date = new Date(orderDate);
  date.setDate(date.getDate() + PERFORMANCE_DAYS);
  return date;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getReceiptId(donationId: string): string {
  return 'AQQ-' + donationId.substring(0, 6).toUpperCase();
}

interface PackageInfo {
  childName: string;
  packageType: 'boy' | 'girl';
  sheepTextNice: string;
}

function getPackageInfo(items: unknown): PackageInfo | null {
  if (!Array.isArray(items)) return null;
  const aqiqahItem = items.find((i: { packageType?: string }) =>
    i.packageType === 'boy' || i.packageType === 'girl'
  );
  if (!aqiqahItem) return null;
  return {
    childName: (aqiqahItem.childName || '').trim(),
    packageType: aqiqahItem.packageType,
    sheepTextNice: aqiqahItem.packageType === 'boy' ? 'Two Sheep (Baby Boy)' : 'One Sheep (Baby Girl)',
  };
}

// ─── Certificate Upload ───────────────────────────────────────────────────────

async function uploadCertificate(donationId: string, pdfBytes: Uint8Array) {
  const fileName = `aqiqah-certificates/${donationId}.pdf`;

  const { error } = await supabaseAdmin.storage
    .from('media')
    .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

  if (error) {
    console.error('Upload error:', error.message);
    return null;
  }

  const { data: urlData } = supabaseAdmin.storage.from('media').getPublicUrl(fileName);
  return { path: fileName, url: urlData.publicUrl };
}

// ─── Email ────────────────────────────────────────────────────────────────────

function buildCertificateEmail(
  donorName: string,
  childName: string,
  sheepText: string,
  performanceDate: Date,
  receiptId: string,
): string {
  const firstName = donorName.split(' ')[0];
  const dateStr = formatDate(performanceDate);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f3ef;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ef;">
<tr><td align="center" style="padding:30px 15px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#1a5632 0%,#0d3b1f 100%);padding:35px 40px;text-align:center;">
<img src="https://epsjdbnxhmeprjrgcbyw.supabase.co/storage/v1/object/public/media/1771815889576-drvcgb.png" alt="Qurbani Foundation USA" width="180" style="display:block;margin:0 auto 15px;">
<h1 style="color:#ffffff;font-size:26px;margin:0;font-family:Georgia,serif;letter-spacing:1px;">Certificate of Aqiqah</h1>
<p style="color:#c5d9c5;font-size:14px;margin:8px 0 0;font-family:Georgia,serif;">شهادة العقيقة</p>
</td></tr>

<!-- Bismillah -->
<tr><td style="padding:30px 40px 0;text-align:center;">
<p style="color:#8b7355;font-size:18px;margin:0;direction:rtl;">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
</td></tr>

<!-- Greeting -->
<tr><td style="padding:25px 40px 0;text-align:center;">
<p style="color:#333;font-size:16px;margin:0;line-height:1.6;">As-salamu Alaykum <strong>${firstName}</strong>,</p>
</td></tr>

<!-- Main Message -->
<tr><td style="padding:20px 40px;text-align:center;">
<p style="color:#444;font-size:15px;margin:0 0 15px;line-height:1.7;">
Alhamdulillah! We are pleased to inform you that the <strong>Aqiqah</strong> for your child has been <strong>successfully performed</strong> according to the Sunnah of Prophet Muhammad &#xFDFA;.
</p>

<!-- Certificate Details Box -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f6f2;border-radius:10px;border:1px solid #e8e2d8;margin:20px 0;">
<tr><td style="padding:25px 30px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:8px 0;border-bottom:1px solid #e8e2d8;">
<span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Child's Name</span><br>
<strong style="color:#333;font-size:18px;font-family:Georgia,serif;">${childName}</strong>
</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e8e2d8;">
<span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Aqiqah Type</span><br>
<strong style="color:#333;font-size:15px;">${sheepText}</strong>
</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e8e2d8;">
<span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Date Performed</span><br>
<strong style="color:#333;font-size:15px;">${dateStr}</strong>
</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e8e2d8;">
<span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Location</span><br>
<strong style="color:#333;font-size:15px;">${LOCATION}</strong>
</td></tr>
<tr><td style="padding:8px 0;">
<span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Receipt ID</span><br>
<strong style="color:#333;font-size:15px;">#${receiptId}</strong>
</td></tr>
</table>
</td></tr></table>
</td></tr>

<!-- Certificate Attachment Notice -->
<tr><td style="padding:0 40px 20px;text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;background-color:#1a5632;border-radius:8px;">
<tr><td style="padding:14px 30px;">
<span style="color:#ffffff;font-size:14px;font-weight:bold;">📎 Your Aqiqah Certificate is attached to this email</span>
</td></tr></table>
<p style="color:#888;font-size:13px;margin:12px 0 0;">
Please find the personalized certificate attached as a PDF.<br>Perfect for framing and keeping as a blessed memory.
</p>
</td></tr>

<!-- Dua -->
<tr><td style="padding:20px 40px;text-align:center;background-color:#f8f6f2;">
<p style="color:#8b7355;font-size:15px;margin:0;font-style:italic;line-height:1.7;">
"May Allah make this child a blessing for you and a blessing for the Ummah of Muhammad (Allah bless him &amp; give him peace)."
</p>
</td></tr>

<!-- Meat Distribution -->
<tr><td style="padding:25px 40px;text-align:center;">
<h3 style="color:#1a5632;font-size:16px;margin:0 0 10px;">Meat Distribution</h3>
<p style="color:#555;font-size:14px;margin:0;line-height:1.6;">
The Aqiqah meat has been distributed to families in need in ${LOCATION}, following Islamic guidelines. Your generosity has brought joy and nourishment to those less fortunate.
</p>
</td></tr>

<!-- Divider -->
<tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e2d8;margin:0;"></td></tr>

<!-- Footer -->
<tr>
<td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="text-align:center;">
        <p style="margin:0 0 4px 0;color:#6b7280;font-size:14px;font-weight:600;">Qurbani Foundation USA</p>
        <p style="margin:0 0 4px 0;color:#9ca3af;font-size:12px;">4245 N Central Expy, Dallas, TX 75205</p>
        <p style="margin:0 0 4px 0;color:#9ca3af;font-size:12px;">1-800-900-0027 · +1 989-QURBANI (787-2265)</p>
        <p style="margin:0 0 4px 0;color:#9ca3af;font-size:12px;">EIN: 38-4109716 · A 501(c)(3) Tax-Exempt Organization</p>
        <p style="margin:0;color:#9ca3af;font-size:11px;">
          Please do not reply to this email. Contact <a href="mailto:donorcare@us.qurbani.com" style="color:#d97706;text-decoration:none;">donorcare@us.qurbani.com</a> for any inquiries.
        </p>
      </td>
    </tr>
  </table>
</td>
</tr>

</table>

<!-- Quran Verse Footer -->
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding:24px;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.6;font-style:italic;">
        "Those who (in sadaqah) spend of their goods by night and by day, in secret and in public, have their reward with their Lord: On them shall be no fear, nor shall they grieve."<br>
        <span style="font-style:normal;">(Al-Quran, 2:274)</span>
      </p>
    </td>
  </tr>
</table>

</td></tr></table>
</body></html>`;
}

async function sendCertificateEmail(
  donorEmail: string,
  donorName: string,
  childName: string,
  sheepText: string,
  performanceDate: Date,
  receiptId: string,
  pdfBytes: Uint8Array,
): Promise<boolean> {
  const resendApiKey = import.meta.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not set, skipping email');
    return false;
  }

  const html = buildCertificateEmail(donorName, childName, sheepText, performanceDate, receiptId);
  const certBase64 = btoa(String.fromCharCode(...pdfBytes));
  const safeChildName = childName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Qurbani Foundation <donations@receipts.qurbani.com>',
      reply_to: 'donorcare@us.qurbani.com',
      to: donorEmail,
      subject: `Aqiqah Certificate for ${childName} — Qurbani Foundation USA`,
      html,
      attachments: [{
        filename: `Aqiqah-Certificate-${safeChildName}.pdf`,
        content: certBase64,
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Resend error:', err);
    return false;
  }

  const result = await response.json() as { id: string };
  console.log(`Email sent to ${donorEmail} (ID: ${result.id})`);
  return true;
}

// ─── GHL Logging ──────────────────────────────────────────────────────────────

async function logToGHL(
  donorEmail: string,
  childName: string,
  performanceDate: Date,
  receiptId: string,
): Promise<void> {
  const ghlApiKey = import.meta.env.GHL_API_KEY;
  if (!ghlApiKey) return;

  try {
    const searchRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(donorEmail)}`,
      { headers: { Authorization: `Bearer ${ghlApiKey}`, Version: '2021-07-28' } }
    );

    if (!searchRes.ok) return;
    const searchData = await searchRes.json() as { contact?: { id: string } };
    const contactId = searchData.contact?.id;
    if (!contactId) return;

    const noteBody = `📜 AQIQAH CERTIFICATE SENT\n${'━'.repeat(30)}\nChild: ${childName}\nDate Performed: ${formatDate(performanceDate)}\nLocation: ${LOCATION}\nReceipt: #${receiptId}\n\nCertificate PDF was emailed to ${donorEmail}.\nSent: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`;

    await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ghlApiKey}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: noteBody }),
    });
  } catch (err) {
    console.warn('GHL log error:', err);
  }
}

// ─── DB Update ────────────────────────────────────────────────────────────────

async function markCertificateSent(donationId: string, storageUrl: string, storagePath: string) {
  const { error } = await supabaseAdmin
    .from('donations')
    .update({
      certificate_url: storageUrl,
      certificate_storage_path: storagePath,
      certificate_sent_at: new Date().toISOString(),
    })
    .eq('id', donationId);

  if (error) console.error('DB update error:', error.message);
  return !error;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const baseUrl = new URL(request.url).origin;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PERFORMANCE_DAYS);

  // Optional: process a single donation by ID (for manual re-sends)
  const body = await request.json().catch(() => ({})) as { donationId?: string; resend?: boolean };
  const specificId = body?.donationId;
  const isResend = body?.resend === true;

  let query = supabaseAdmin
    .from('donations')
    .select('*')
    .eq('campaign_slug', 'aqiqah')
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  if (specificId) {
    query = query.eq('id', specificId);
  } else {
    query = query
      .is('certificate_sent_at', null)
      .lte('created_at', cutoff.toISOString());
  }

  const { data: donations, error: queryError } = await query;

  if (queryError) {
    console.error('Query error:', queryError.message);
    return new Response(JSON.stringify({ error: queryError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!donations || donations.length === 0) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, message: 'No pending certificates' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let sent = 0;
  let failed = 0;
  const results: { donationId: string; childName: string; status: string; error?: string }[] = [];

  for (const donation of donations) {
    const pkg = getPackageInfo(donation.items);
    if (!pkg) {
      results.push({ donationId: donation.id, childName: '(unknown)', status: 'skipped', error: 'No aqiqah package in items' });
      failed++;
      continue;
    }

    const performanceDate = getPerformanceDate(donation.created_at as string);
    const receiptId = getReceiptId(donation.id as string);

    try {
      // 1. Generate PDF (pure JS — works on Cloudflare Workers)
      const pdfBytes = await generateAqiqahCertificate({
        childName: pkg.childName,
        date: formatDate(performanceDate),
        packageType: pkg.packageType,
        receiptId,
        city: LOCATION,
        baseUrl,
      });

      // 2. Upload to Supabase Storage
      const upload = await uploadCertificate(donation.id as string, pdfBytes);
      if (!upload) {
        results.push({ donationId: donation.id, childName: pkg.childName, status: 'failed', error: 'Storage upload failed' });
        failed++;
        continue;
      }

      // 3. Send email
      const emailSent = await sendCertificateEmail(
        donation.donor_email as string,
        donation.donor_name as string,
        pkg.childName,
        pkg.sheepTextNice,
        performanceDate,
        receiptId,
        pdfBytes,
      );

      // 4. Log to GHL
      await logToGHL(donation.donor_email as string, pkg.childName, performanceDate, receiptId);

      // 5. Mark sent (skip if this was a manual resend)
      if (emailSent && !isResend) {
        await markCertificateSent(donation.id as string, upload.url, upload.path);
      }

      if (emailSent) {
        sent++;
        results.push({ donationId: donation.id, childName: pkg.childName, status: 'sent' });
      } else {
        failed++;
        results.push({ donationId: donation.id, childName: pkg.childName, status: 'failed', error: 'Email send failed' });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error processing ${donation.id}:`, errMsg);
      results.push({ donationId: donation.id, childName: pkg.childName, status: 'failed', error: errMsg });
      failed++;
    }
  }

  console.log(`Aqiqah certificates: ${sent} sent, ${failed} failed`);

  return new Response(JSON.stringify({ sent, failed, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
