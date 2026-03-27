/**
 * Test the new JS-based Aqiqah certificate generator.
 * Generates a sample certificate and emails it to the developer.
 * Usage: node scripts/test-aqiqah-cert.mjs
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ─── Config (same constants as aqiqah-certificate.ts) ────────────────────────
const SCALE = 72 / 300;
const TEMPLATE_W = 3173;
const TEMPLATE_H = 2115;
const PAGE_W = TEMPLATE_W * SCALE;
const PAGE_H = TEMPLATE_H * SCALE;
const DARK_BROWN = rgb(74 / 255, 42 / 255, 8 / 255);
const LOCATION = 'Pakistan';

function px(x) { return x * SCALE; }
function py(yTop, fontSizePx) {
  return PAGE_H - (yTop + fontSizePx * 0.75) * SCALE;
}

// ─── Generate PDF ─────────────────────────────────────────────────────────────
async function generateCert({ childName, date, packageType, receiptId, city = LOCATION }) {
  const templateFile = packageType === 'boy'
    ? path.join(ROOT, 'public/certificates/QF-Boy-Certificate.jpg')
    : path.join(ROOT, 'public/certificates/QF-Girl-Certificate.jpg');

  const templateBytes = readFileSync(templateFile);
  const boldItalicBytes = readFileSync(path.join(ROOT, 'public/fonts/Lora-BoldItalic.woff'));
  const boldBytes      = readFileSync(path.join(ROOT, 'public/fonts/Lora-Bold.woff'));
  const regularBytes   = readFileSync(path.join(ROOT, 'public/fonts/Lora-Regular.woff'));

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [fontBoldItalic, fontBold, fontRegular] = await Promise.all([
    pdfDoc.embedFont(boldItalicBytes),
    pdfDoc.embedFont(boldBytes),
    pdfDoc.embedFont(regularBytes),
  ]);

  const templateImage = await pdfDoc.embedJpg(templateBytes);
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  page.drawImage(templateImage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  // Date
  const dateFontSize = 52 * SCALE;
  const dateWidth = fontBold.widthOfTextAtSize(date, dateFontSize);
  page.drawText(date, { x: px(1250) - dateWidth / 2, y: py(1098, 52), size: dateFontSize, font: fontBold, color: DARK_BROWN });

  // City
  const cityWidth = fontBold.widthOfTextAtSize(city, dateFontSize);
  page.drawText(city, { x: px(1850) - cityWidth / 2, y: py(1098, 52), size: dateFontSize, font: fontBold, color: DARK_BROWN });

  // Child Name (auto-size)
  const NAME_MAX_W = (TEMPLATE_W - 700) * SCALE;
  let nameSizePx = 110;
  let nameSizePts = nameSizePx * SCALE;
  let nameWidth = fontBoldItalic.widthOfTextAtSize(childName, nameSizePts);
  while (nameWidth > NAME_MAX_W && nameSizePx > 60) {
    nameSizePx -= 5;
    nameSizePts = nameSizePx * SCALE;
    nameWidth = fontBoldItalic.widthOfTextAtSize(childName, nameSizePts);
  }
  page.drawText(childName, { x: px(TEMPLATE_W / 2) - nameWidth / 2, y: py(1230, nameSizePx), size: nameSizePts, font: fontBoldItalic, color: DARK_BROWN });

  // Receipt ID
  const receiptFontSize = 42 * SCALE;
  page.drawText(receiptId, { x: px(1710), y: py(1745, 42), size: receiptFontSize, font: fontRegular, color: DARK_BROWN });

  return pdfDoc.save();
}

// ─── Send email ───────────────────────────────────────────────────────────────
async function sendTestEmail(pdfBytes, childName) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) { console.error('RESEND_API_KEY not set'); process.exit(1); }

  const certBase64 = Buffer.from(pdfBytes).toString('base64');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Qurbani Foundation <donations@receipts.qurbani.com>',
      reply_to: 'donorcare@us.qurbani.com',
      to: 'hhk800@gmail.com',
      subject: `[TEST] Aqiqah Certificate for ${childName} — Qurbani Foundation USA`,
      html: `<p>This is a <strong>test</strong> of the new JS-based Aqiqah certificate generator.</p>
             <p>Child: <strong>${childName}</strong><br>
             Certificate is attached as a PDF.</p>
             <p style="color:#888;font-size:12px;">This was generated with pdf-lib (pure JS) — no Python required. Runs on Cloudflare Workers.</p>`,
      attachments: [{
        filename: `Aqiqah-Certificate-${childName.replace(/\s+/g, '-')}.pdf`,
        content: certBase64,
      }],
    }),
  });

  const result = await response.json();
  if (!response.ok) { console.error('Resend error:', result); process.exit(1); }
  console.log('✅ Test email sent to hhk800@gmail.com (ID:', result.id, ')');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const testData = {
  childName: 'Aya Chehab',
  date: 'March 15, 2026',
  packageType: 'girl',
  receiptId: 'AQQ-CB9A7A',
  city: LOCATION,
};

console.log('Generating certificate for:', testData.childName);
const pdfBytes = await generateCert(testData);
console.log(`PDF generated: ${(pdfBytes.length / 1024).toFixed(1)} KB`);

await sendTestEmail(pdfBytes, testData.childName);
