/**
 * Aqiqah Certificate Processing Script
 * ======================================
 *
 * RULES:
 * - Aqiqah is performed 2 days after order placement
 * - Certificate email is sent on day 2 at 10:00 AM Eastern
 * - Girl orders → QF-Girl-Certificate.png (1 sheep)
 * - Boy orders → QF-Boy-Certificate.png (2 sheep)
 * - Receipt ID format: #AQQ-{first 6 chars of donation UUID uppercase}
 * - Location: Pakistan (default)
 * - Emails sent via Resend + logged in GHL Conversations
 * - Certificate PDF stored in Supabase Storage + URL saved in donation record
 *
 * Usage:
 *   node scripts/process-aqiqah-certificates.cjs              # Process all pending (dry-run)
 *   node scripts/process-aqiqah-certificates.cjs --send       # Actually send emails
 *   node scripts/process-aqiqah-certificates.cjs --id UUID    # Process specific donation
 *   node scripts/process-aqiqah-certificates.cjs --resend UUID # Resend existing certificate
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
const { readFileSync } = require('fs');
const path = require('path');

// ============================================
// CONFIG
// ============================================

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'W0zaxipAVHwutqUazGwL';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CERT_DIR = path.join(__dirname, '..', 'src', 'templates', 'certificates');
const FILL_SCRIPT = path.join(__dirname, 'fill-aqiqah-certificate.py');
const PERFORMANCE_DAYS = 2; // Aqiqah performed 2 days after order
const LOCATION = 'Pakistan';

// ============================================
// HELPERS
// ============================================

function getPerformanceDate(orderDate) {
  const date = new Date(orderDate);
  date.setDate(date.getDate() + PERFORMANCE_DAYS);
  return date;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
}

function getReceiptId(donationId) {
  return 'AQQ-' + donationId.substring(0, 6).toUpperCase();
}

function getPackageInfo(items) {
  const aqiqahItem = items?.find(i => i.packageType === 'boy' || i.packageType === 'girl');
  if (!aqiqahItem) return null;
  return {
    childName: (aqiqahItem.childName || '').trim(),
    packageType: aqiqahItem.packageType,
    sheepText: aqiqahItem.packageType === 'boy' ? 'TWO SHEEP (BABY BOY)' : 'ONE SHEEP (BABY GIRL)',
    sheepTextNice: aqiqahItem.packageType === 'boy' ? 'Two Sheep (Baby Boy)' : 'One Sheep (Baby Girl)',
  };
}

// ============================================
// CERTIFICATE GENERATION
// ============================================

function generateCertificate(childName, performanceDate, receiptId, packageType) {
  const dateStr = formatDate(performanceDate);
  const type = packageType === 'boy' ? 'boy' : 'girl';

  console.log(`  📜 Generating ${type} certificate for "${childName}"...`);

  execSync(
    `python3 "${FILL_SCRIPT}" --type ${type} --name "${childName}" --date "${dateStr}" --city "${LOCATION}" --receipt "${receiptId}"`,
    { cwd: path.join(__dirname, '..') }
  );

  const pdfPath = path.join(CERT_DIR, 'aqiqah-certificate-filled.pdf');
  return readFileSync(pdfPath);
}

// ============================================
// SUPABASE STORAGE
// ============================================

async function uploadCertificate(donationId, pdfBuffer, childName) {
  const fileName = `aqiqah-certificates/${donationId}.pdf`;

  console.log(`  ☁️  Uploading to Supabase Storage...`);

  const { data, error } = await supabase.storage
    .from('media')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    console.error('  ❌ Upload error:', error.message);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('media')
    .getPublicUrl(fileName);

  console.log(`  ✅ Uploaded: ${urlData.publicUrl}`);
  return { path: fileName, url: urlData.publicUrl };
}

// ============================================
// EMAIL (Resend)
// ============================================

function buildCertificateEmail(donorName, childName, sheepText, performanceDate, receiptId, prefUrls) {
  const firstName = donorName.split(' ')[0];
  const dateStr = formatDate(performanceDate);

  const preferencesLine = prefUrls
    ? `<p style="margin: 8px 0 0 0; font-size: 11px; color: #9ca3af;">
        <a href="${prefUrls.manage}" style="color: #d97706; text-decoration: underline;">Update your preferences</a> or
        <a href="${prefUrls.unsubscribe}" style="color: #9ca3af; text-decoration: underline;">unsubscribe from this list</a>.
       </p>`
    : '';

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

<!-- Footer (matching other emails) -->
<tr>
<td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="text-align: center;">
        <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px; font-weight: 600;">
          Qurbani Foundation USA
        </p>
        <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 12px;">
          4245 N Central Expy, Dallas, TX 75205
        </p>
        <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 12px;">
          1-800-900-0027 · +1 989-QURBANI (787-2265)
        </p>
        <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 12px;">
          EIN: 38-4109716 · A 501(c)(3) Tax-Exempt Organization
        </p>
        <p style="margin: 0; color: #9ca3af; font-size: 11px;">
          Please do not reply to this email. Contact <a href="mailto:donorcare@us.qurbani.com" style="color: #d97706; text-decoration: none;">donorcare@us.qurbani.com</a> for any inquiries.
        </p>
        ${preferencesLine}
      </td>
    </tr>
  </table>
</td>
</tr>

</table>

<!-- Quran Verse Footer -->
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding: 24px; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.6; font-style: italic;">
        "Those who (in sadaqah) spend of their goods by night and by day, in secret and in public, have their reward with their Lord: On them shall be no fear, nor shall they grieve."<br>
        <span style="font-style: normal;">(Al-Quran, 2:274)</span>
      </p>
    </td>
  </tr>
</table>

</td></tr></table>
</body></html>`;
}

async function sendCertificateEmail(donorEmail, donorName, childName, sheepText, performanceDate, receiptId, pdfBuffer) {
  if (!RESEND_API_KEY) {
    console.log('  ⚠️  Resend not configured, skipping email');
    return false;
  }

  console.log(`  📧 Sending certificate email to ${donorEmail}...`);

  const html = buildCertificateEmail(donorName, childName, sheepText, performanceDate, receiptId);
  const certBase64 = pdfBuffer.toString('base64');
  const safeChildName = childName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Qurbani Foundation <donations@receipts.qurbani.com>',
      reply_to: 'donorcare@us.qurbani.com',
      to: donorEmail,
      subject: `Aqiqah Certificate for ${childName} — Qurbani Foundation USA`,
      html: html,
      attachments: [{
        filename: `Aqiqah-Certificate-${safeChildName}.pdf`,
        content: certBase64,
      }]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('  ❌ Resend error:', error);
    return false;
  }

  const result = await response.json();
  console.log(`  ✅ Email sent (ID: ${result.id})`);
  return true;
}

// ============================================
// GHL LOGGING
// ============================================

async function logToGHL(donorEmail, childName, performanceDate, receiptId) {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    console.log('  ⚠️  GHL not configured, skipping log');
    return;
  }

  console.log(`  📋 Logging to GHL...`);

  try {
    // Find contact
    const searchRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(donorEmail)}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28',
        },
      }
    );

    if (!searchRes.ok) return;
    const searchData = await searchRes.json();
    const contactId = searchData.contact?.id;
    if (!contactId) {
      console.log('  ⚠️  GHL contact not found');
      return;
    }

    // IMPORTANT: Do NOT use conversations/messages API — it sends a real email to the donor!
    // Use notes instead — safe, no email sent
    const noteBody = `📜 AQIQAH CERTIFICATE SENT\n${'━'.repeat(30)}\nChild: ${childName}\nDate Performed: ${formatDate(performanceDate)}\nLocation: ${LOCATION}\nReceipt: #${receiptId}\n\nCertificate PDF was emailed to ${donorEmail}.\nSent: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`;

    const noteRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: noteBody }),
    });

    if (noteRes.ok) {
      console.log('  ✅ GHL note logged');
    } else {
      const err = await noteRes.text();
      console.log('  ⚠️  GHL log failed:', err);
    }
  } catch (err) {
    console.log('  ⚠️  GHL error:', err.message);
  }
}

// ============================================
// DATABASE UPDATES
// ============================================

async function updateDonationCertificate(donationId, storageUrl, storagePath) {
  const { error } = await supabase
    .from('donations')
    .update({
      certificate_url: storageUrl,
      certificate_storage_path: storagePath,
      certificate_sent_at: new Date().toISOString(),
    })
    .eq('id', donationId);

  if (error) {
    console.error('  ❌ DB update error:', error.message);
    return false;
  }
  console.log('  ✅ Donation record updated');
  return true;
}

// ============================================
// MAIN PROCESSING
// ============================================

async function processDonation(donation, dryRun = true) {
  const pkg = getPackageInfo(donation.items);
  if (!pkg) {
    console.log(`  ⚠️  No aqiqah package found in items, skipping`);
    return false;
  }

  const performanceDate = getPerformanceDate(donation.created_at);
  const receiptId = getReceiptId(donation.id);

  console.log(`\n📦 Processing: ${pkg.childName}`);
  console.log(`  Donor: ${donation.donor_name} <${donation.donor_email}>`);
  console.log(`  Package: ${pkg.sheepTextNice}`);
  console.log(`  Order Date: ${new Date(donation.created_at).toLocaleDateString()}`);
  console.log(`  Performance Date: ${formatDate(performanceDate)}`);
  console.log(`  Receipt: #${receiptId}`);

  if (dryRun) {
    console.log(`  🏃 DRY RUN — would generate, upload, email, and log`);
    return true;
  }

  try {
    // 1. Generate certificate PDF
    const pdfBuffer = generateCertificate(pkg.childName, performanceDate, receiptId, pkg.packageType);

    // 2. Upload to Supabase Storage
    const upload = await uploadCertificate(donation.id, pdfBuffer, pkg.childName);
    if (!upload) return false;

    // 3. Send email via Resend (with PDF attachment)
    const emailSent = await sendCertificateEmail(
      donation.donor_email, donation.donor_name, pkg.childName,
      pkg.sheepTextNice, performanceDate, receiptId, pdfBuffer
    );

    // 4. Log to GHL as a note (safe — does NOT send email to donor)
    await logToGHL(donation.donor_email, pkg.childName, performanceDate, receiptId);

    // 5. Update donation record
    if (emailSent) {
      await updateDonationCertificate(donation.id, upload.url, upload.path);
    }

    return emailSent;
  } catch (err) {
    console.error(`  ❌ Error:`, err.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const sendMode = args.includes('--send');
  const specificId = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;
  const resendId = args.includes('--resend') ? args[args.indexOf('--resend') + 1] : null;

  console.log('🕌 Aqiqah Certificate Processor');
  console.log('================================');
  console.log(`Mode: ${sendMode ? '📤 SEND' : '🏃 DRY RUN'}`);
  console.log(`Performance delay: ${PERFORMANCE_DAYS} days`);
  console.log(`Location: ${LOCATION}`);
  console.log('');

  // Calculate cutoff: orders placed >= 2 days ago
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PERFORMANCE_DAYS);

  let query = supabase
    .from('donations')
    .select('*')
    .eq('campaign_slug', 'aqiqah')
    .eq('status', 'completed');

  if (specificId || resendId) {
    query = query.eq('id', specificId || resendId);
  } else {
    // Only pending certificates that are 2+ days old
    query = query
      .is('certificate_sent_at', null)
      .lte('created_at', cutoff.toISOString());
  }

  query = query.order('created_at', { ascending: true });

  const { data: donations, error } = await query;

  if (error) {
    console.error('❌ Query error:', error.message);
    process.exit(1);
  }

  if (!donations || donations.length === 0) {
    console.log('✅ No pending certificates to process');
    return;
  }

  console.log(`Found ${donations.length} Aqiqah order(s) to process:\n`);

  let sent = 0;
  let failed = 0;

  for (const donation of donations) {
    const success = await processDonation(donation, !sendMode && !resendId);
    if (success) sent++;
    else failed++;
  }

  console.log(`\n================================`);
  console.log(`📊 Results: ${sent} processed, ${failed} failed`);
  if (!sendMode && !resendId) {
    console.log(`\n💡 Run with --send to actually send emails`);
  }
}

main().catch(console.error);
