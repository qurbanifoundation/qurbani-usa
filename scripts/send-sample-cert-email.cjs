require('dotenv').config();
const { readFileSync } = require('fs');
const { execSync } = require('child_process');

async function main() {
  // Generate the girl certificate
  execSync('python3 /Users/macbookpro/Developer/qurbani-usa/scripts/fill-aqiqah-certificate.py --type girl --name "Layla Sayed Sughayer" --date "March 12, 2026" --city "Pakistan" --receipt "AQQ-F1AFE7"');

  const certPath = '/Users/macbookpro/Developer/qurbani-usa/src/templates/certificates/aqiqah-certificate-filled.pdf';
  const certBase64 = readFileSync(certPath).toString('base64');

  const donorName = 'Sayed';
  const childName = 'Layla Sayed Sughayer';
  const sheepText = 'One Sheep (Baby Girl)';
  const performanceDate = 'March 12, 2026';

  const html = `<!DOCTYPE html>
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
<p style="color:#333;font-size:16px;margin:0;line-height:1.6;">As-salamu Alaykum <strong>${donorName}</strong>,</p>
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
<strong style="color:#333;font-size:15px;">${performanceDate}</strong>
</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e8e2d8;">
<span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Location</span><br>
<strong style="color:#333;font-size:15px;">Pakistan</strong>
</td></tr>
<tr><td style="padding:8px 0;">
<span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Receipt ID</span><br>
<strong style="color:#333;font-size:15px;">#AQQ-F1AFE7</strong>
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
The Aqiqah meat has been distributed to families in need in Pakistan, following Islamic guidelines. Your generosity has brought joy and nourishment to those less fortunate.
</p>
</td></tr>

<!-- Divider -->
<tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e2d8;margin:0;"></td></tr>

<!-- Footer -->
<tr><td style="padding:25px 40px;text-align:center;background-color:#fafafa;">
<p style="color:#333;font-size:14px;margin:0 0 5px;font-weight:bold;">Qurbani Foundation USA</p>
<p style="color:#888;font-size:12px;margin:0 0 3px;">
<a href="https://www.qurbani.com" style="color:#1a5632;text-decoration:none;">www.qurbani.com</a> &nbsp;|&nbsp; 1-800-900-0027 &nbsp;|&nbsp; info@qurbani.com
</p>
<p style="color:#aaa;font-size:11px;margin:8px 0 0;">Qurbani Foundation USA is a registered 501(c)(3) nonprofit organization.</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Qurbani Foundation <donations@receipts.qurbani.com>',
      reply_to: 'donorcare@us.qurbani.com',
      to: 'qurbanifoundation@gmail.com',
      subject: `Aqiqah Certificate for ${childName} — Qurbani Foundation USA`,
      html: html,
      attachments: [
        {
          filename: `Aqiqah-Certificate-${childName.replace(/\s+/g, '-')}.pdf`,
          content: certBase64,
        }
      ]
    }),
  });

  const result = await response.text();
  console.log('Status:', response.status);
  console.log('Result:', result);
}

main().catch(console.error);
