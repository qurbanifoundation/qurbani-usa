import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

// ─── Helpers (mirrored from process-aqiqah-certificates.cjs) ───

const PERFORMANCE_DAYS = 2;
const LOCATION = 'Pakistan';

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

function getPackageInfo(items: any) {
  const parsed = typeof items === 'string' ? JSON.parse(items) : (items || []);
  const aqiqahItem = parsed.find((i: any) => i.packageType === 'boy' || i.packageType === 'girl');
  if (!aqiqahItem) return null;
  return {
    childName: (aqiqahItem.childName || '').trim(),
    packageType: aqiqahItem.packageType as 'boy' | 'girl',
    sheepTextNice: aqiqahItem.packageType === 'boy' ? 'Two Sheep (Baby Boy)' : 'One Sheep (Baby Girl)',
  };
}

function buildCertificateEmail(donorName: string, childName: string, sheepText: string, performanceDate: Date, receiptId: string): string {
  const firstName = donorName.split(' ')[0];
  const dateStr = formatDate(performanceDate);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f3ef;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ef;">
<tr><td align="center" style="padding:30px 15px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#1a5632 0%,#0d3b1f 100%);padding:35px 40px;text-align:center;">
<img src="https://epsjdbnxhmeprjrgcbyw.supabase.co/storage/v1/object/public/media/1771815889576-drvcgb.png" alt="Qurbani Foundation USA" width="180" style="display:block;margin:0 auto 15px;">
<h1 style="color:#ffffff;font-size:26px;margin:0;font-family:Georgia,serif;letter-spacing:1px;">Certificate of Aqiqah</h1>
<p style="color:#c5d9c5;font-size:14px;margin:8px 0 0;font-family:Georgia,serif;">شهادة العقيقة</p>
</td></tr>
<tr><td style="padding:30px 40px 0;text-align:center;">
<p style="color:#8b7355;font-size:18px;margin:0;direction:rtl;">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
</td></tr>
<tr><td style="padding:25px 40px 0;text-align:center;">
<p style="color:#333;font-size:16px;margin:0;line-height:1.6;">As-salamu Alaykum <strong>${firstName}</strong>,</p>
</td></tr>
<tr><td style="padding:20px 40px;text-align:center;">
<p style="color:#444;font-size:15px;margin:0 0 15px;line-height:1.7;">
Alhamdulillah! We are pleased to inform you that the <strong>Aqiqah</strong> for your child has been <strong>successfully performed</strong> according to the Sunnah of Prophet Muhammad &#xFDFA;.
</p>
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
<tr><td style="padding:0 40px 20px;text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;background-color:#1a5632;border-radius:8px;">
<tr><td style="padding:14px 30px;">
<span style="color:#ffffff;font-size:14px;font-weight:bold;">📎 Your Aqiqah Certificate is attached to this email</span>
</td></tr></table>
<p style="color:#888;font-size:13px;margin:12px 0 0;">
Please find the personalized certificate attached as a PDF.<br>Perfect for framing and keeping as a blessed memory.
</p>
</td></tr>
<tr><td style="padding:20px 40px;text-align:center;background-color:#f8f6f2;">
<p style="color:#8b7355;font-size:15px;margin:0;font-style:italic;line-height:1.7;">
"May Allah make this child a blessing for you and a blessing for the Ummah of Muhammad (Allah bless him &amp; give him peace)."
</p>
</td></tr>
<tr><td style="padding:25px 40px;text-align:center;">
<h3 style="color:#1a5632;font-size:16px;margin:0 0 10px;">Meat Distribution</h3>
<p style="color:#555;font-size:14px;margin:0;line-height:1.6;">
The Aqiqah meat has been distributed to families in need in ${LOCATION}, following Islamic guidelines. Your generosity has brought joy and nourishment to those less fortunate.
</p>
</td></tr>
<tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e2d8;margin:0;"></td></tr>
<tr>
<td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="text-align: center;">
        <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Qurbani Foundation USA</p>
        <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 12px;">4245 N Central Expy, Dallas, TX 75205</p>
        <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 12px;">1-800-900-0027 · +1 989-QURBANI (787-2265)</p>
        <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 12px;">EIN: 38-4109716 · A 501(c)(3) Tax-Exempt Organization</p>
        <p style="margin: 0; color: #9ca3af; font-size: 11px;">Please do not reply to this email. Contact <a href="mailto:donorcare@us.qurbani.com" style="color: #d97706; text-decoration: none;">donorcare@us.qurbani.com</a> for any inquiries.</p>
      </td>
    </tr>
  </table>
</td>
</tr>
</table>
</td></tr></table>
</body>
</html>`;
}

// ─── Main API Handler ───

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { donationId, action } = body;

    if (!donationId || !['send', 'resend'].includes(action)) {
      return new Response(JSON.stringify({ error: 'donationId and action (send|resend) required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch donation
    const { data: donation, error: donationErr } = await supabaseAdmin
      .from('donations')
      .select('*')
      .eq('id', donationId)
      .single();

    if (donationErr || !donation) {
      return new Response(JSON.stringify({ error: 'Donation not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    const pkg = getPackageInfo(donation.items);
    if (!pkg) {
      return new Response(JSON.stringify({ error: 'No Aqiqah package found in this donation' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Check if certificate exists in Supabase Storage
    const storagePath = `aqiqah-certificates/${donationId}.pdf`;
    let pdfBase64: string | null = null;

    if (donation.certificate_storage_path || donation.certificate_url) {
      // Certificate already generated — download it
      const { data: fileData, error: downloadErr } = await supabaseAdmin.storage
        .from('media')
        .download(donation.certificate_storage_path || storagePath);

      if (!downloadErr && fileData) {
        const buffer = await fileData.arrayBuffer();
        pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        console.log(`[Certificate API] Downloaded existing certificate from storage`);
      }
    }

    // If no existing certificate, try to download by convention path
    if (!pdfBase64) {
      const { data: fileData, error: downloadErr } = await supabaseAdmin.storage
        .from('media')
        .download(storagePath);

      if (!downloadErr && fileData) {
        const buffer = await fileData.arrayBuffer();
        pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        console.log(`[Certificate API] Found certificate at convention path`);
      }
    }

    if (!pdfBase64) {
      // Certificate not generated yet — need to run the batch script first
      return new Response(JSON.stringify({
        error: 'Certificate PDF not yet generated. Run the batch script first: node scripts/process-aqiqah-certificates.cjs --send --id ' + donationId,
      }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Get RESEND_API_KEY from env or site_settings
    let resendKey = import.meta.env.RESEND_API_KEY;
    if (!resendKey) {
      const { data: settings } = await supabaseAdmin
        .from('site_settings')
        .select('resend_api_key')
        .limit(1)
        .single();
      resendKey = settings?.resend_api_key;
    }

    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'Resend API key not configured' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Build and send email
    const performanceDate = getPerformanceDate(donation.created_at);
    const receiptId = getReceiptId(donation.id);
    const safeChildName = pkg.childName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

    const html = buildCertificateEmail(
      donation.donor_name, pkg.childName, pkg.sheepTextNice, performanceDate, receiptId
    );

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Qurbani Foundation <donations@receipts.qurbani.com>',
        reply_to: 'donorcare@us.qurbani.com',
        to: donation.donor_email,
        subject: `Aqiqah Certificate for ${pkg.childName} — Qurbani Foundation USA`,
        html,
        attachments: [{
          filename: `Aqiqah-Certificate-${safeChildName}.pdf`,
          content: pdfBase64,
        }],
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('[Certificate API] Resend error:', errText);
      return new Response(JSON.stringify({ error: 'Failed to send email: ' + errText }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const emailResult = await emailRes.json();
    console.log(`[Certificate API] Email sent to ${donation.donor_email} (ID: ${emailResult.id})`);

    // 5. Update donation record
    const { data: urlData } = supabaseAdmin.storage.from('media').getPublicUrl(storagePath);

    await supabaseAdmin
      .from('donations')
      .update({
        certificate_url: urlData.publicUrl,
        certificate_storage_path: storagePath,
        certificate_sent_at: new Date().toISOString(),
      })
      .eq('id', donationId);

    // 6. Log to GHL (best effort)
    try {
      let ghlKey = import.meta.env.GHL_API_KEY;
      const ghlLocationId = import.meta.env.GHL_LOCATION_ID || 'W0zaxipAVHwutqUazGwL';

      if (!ghlKey) {
        const { data: settings } = await supabaseAdmin
          .from('site_settings')
          .select('ghl_api_key')
          .limit(1)
          .single();
        ghlKey = settings?.ghl_api_key;
      }

      if (ghlKey) {
        const searchRes = await fetch(
          `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${ghlLocationId}&email=${encodeURIComponent(donation.donor_email)}`,
          { headers: { 'Authorization': `Bearer ${ghlKey}`, 'Version': '2021-07-28' } }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json() as any;
          const contactId = searchData.contact?.id;
          if (contactId) {
            const ghlSubject = `Aqiqah Certificate for ${pkg.childName} — Qurbani Foundation USA`;
            const ghlPlain = `Aqiqah Certificate ${action === 'resend' ? 'Resent' : 'Sent'}\n\nChild: ${pkg.childName}\nDate Performed: ${formatDate(performanceDate)}\nLocation: ${LOCATION}\nReceipt: #${receiptId}\n\nCertificate PDF was attached to the email.`;
            const ghlHtml = `<p>Aqiqah Certificate ${action === 'resend' ? 'resent' : 'sent'} for <strong>${pkg.childName}</strong>. Performed: ${formatDate(performanceDate)} in ${LOCATION}. Receipt: #${receiptId}. Certificate PDF attached to email.</p>`;
            await fetch('https://services.leadconnectorhq.com/conversations/messages', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${ghlKey}`, 'Version': '2021-07-28', 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'Email', contactId,
                subject: ghlSubject,
                html: ghlHtml,
                message: ghlPlain,
                emailFrom: 'donations@receipts.qurbani.com',
                emailTo: donation.donor_email,
                direction: 'outbound',
              }),
            });
          }
        }
      }
    } catch (ghlErr) {
      console.log('[Certificate API] GHL log skipped:', ghlErr);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Certificate ${action === 'resend' ? 'resent' : 'sent'} to ${donation.donor_email}`,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[Certificate API] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
