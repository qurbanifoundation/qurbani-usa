/**
 * Aqiqah Certificate Generator
 * ==============================
 * Pure JS implementation using pdf-lib — runs in Cloudflare Workers (no Python/PIL needed).
 *
 * Overlays dynamic text (child name, date, city, receipt ID) onto the
 * designer's PNG certificate template at the exact same pixel positions
 * as the original Python/PIL script.
 *
 * Template dimensions: 3173 x 2115 px @ 300 DPI
 * Fonts: Lora (Georgia-equivalent open-source serif) fetched from /fonts/
 */

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// ─── Constants ───────────────────────────────────────────────────────────────

const SCALE = 72 / 300;            // PIL pixels → PDF points
const TEMPLATE_W = 3173;           // px
const TEMPLATE_H = 2115;           // px
export const PAGE_W = TEMPLATE_W * SCALE;  // 762.48 pts
export const PAGE_H = TEMPLATE_H * SCALE;  // 507.6 pts

// Dark brown matching the certificate body text (#4a2a08)
const DARK_BROWN = rgb(74 / 255, 42 / 255, 8 / 255);

// Font size limits matching the Python script
const NAME_FONT_SIZE_START = 110;  // px — reduces until fits
const NAME_FONT_SIZE_MIN   = 60;   // px
const NAME_FONT_SIZE_STEP  = 5;    // px per reduction
const NAME_MAX_WIDTH_PX    = TEMPLATE_W - 700; // 2473px

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/** PIL pixel X → PDF point X */
function px(x: number): number {
  return x * SCALE;
}

/**
 * PIL top-left Y → PDF baseline Y.
 * PIL places text top-left at y; pdf-lib places text at baseline.
 * Approximate: baseline ≈ top + 0.75 * font_size.
 */
function py(yTop: number, fontSizePx: number): number {
  const baselinePx = yTop + fontSizePx * 0.75;
  return PAGE_H - baselinePx * SCALE;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface CertificateOptions {
  childName: string;
  date: string;         // e.g. "March 15, 2026"
  packageType: 'boy' | 'girl';
  receiptId: string;    // e.g. "AQQ-CB9A7A"
  city?: string;
  baseUrl: string;      // site origin, e.g. "https://www.qurbani.com"
}

export async function generateAqiqahCertificate(opts: CertificateOptions): Promise<Uint8Array> {
  const { childName, date, packageType, receiptId, city = 'Pakistan', baseUrl } = opts;

  // ── Fetch template + fonts in parallel ──────────────────────────────────────
  // JPEG templates give ~1.4MB PDFs vs ~12MB with PNG — same visual quality
  const templateFile = packageType === 'boy' ? 'QF-Boy-Certificate.jpg' : 'QF-Girl-Certificate.jpg';

  const [templateRes, boldItalicRes, boldRes, regularRes] = await Promise.all([
    fetch(`${baseUrl}/certificates/${templateFile}`),
    fetch(`${baseUrl}/fonts/Lora-BoldItalic.woff`),
    fetch(`${baseUrl}/fonts/Lora-Bold.woff`),
    fetch(`${baseUrl}/fonts/Lora-Regular.woff`),
  ]);

  if (!templateRes.ok) throw new Error(`Failed to fetch template: ${templateRes.status}`);

  const [templateBytes, boldItalicBytes, boldBytes, regularBytes] = await Promise.all([
    templateRes.arrayBuffer(),
    boldItalicRes.arrayBuffer(),
    boldRes.arrayBuffer(),
    regularRes.arrayBuffer(),
  ]);

  // ── Build PDF ────────────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [fontBoldItalic, fontBold, fontRegular] = await Promise.all([
    pdfDoc.embedFont(boldItalicBytes),
    pdfDoc.embedFont(boldBytes),
    pdfDoc.embedFont(regularBytes),
  ]);

  const templateImage = await pdfDoc.embedJpg(templateBytes);
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  // Full-page background image
  page.drawImage(templateImage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  // ── Date ─────────────────────────────────────────────────────────────────────
  const dateFontSize = 52 * SCALE;  // ~12.5 pts
  const dateWidth = fontBold.widthOfTextAtSize(date, dateFontSize);
  page.drawText(date, {
    x: px(1250) - dateWidth / 2,
    y: py(1098, 52),
    size: dateFontSize,
    font: fontBold,
    color: DARK_BROWN,
  });

  // ── City ─────────────────────────────────────────────────────────────────────
  const cityWidth = fontBold.widthOfTextAtSize(city, dateFontSize);
  page.drawText(city, {
    x: px(1850) - cityWidth / 2,
    y: py(1098, 52),
    size: dateFontSize,
    font: fontBold,
    color: DARK_BROWN,
  });

  // ── Child Name (auto-size to fit) ─────────────────────────────────────────
  let nameFontSizePx = NAME_FONT_SIZE_START;
  let nameFontSizePts = nameFontSizePx * SCALE;
  let nameWidth = fontBoldItalic.widthOfTextAtSize(childName, nameFontSizePts);

  while (nameWidth > NAME_MAX_WIDTH_PX * SCALE && nameFontSizePx > NAME_FONT_SIZE_MIN) {
    nameFontSizePx -= NAME_FONT_SIZE_STEP;
    nameFontSizePts = nameFontSizePx * SCALE;
    nameWidth = fontBoldItalic.widthOfTextAtSize(childName, nameFontSizePts);
  }

  page.drawText(childName, {
    x: px(TEMPLATE_W / 2) - nameWidth / 2,
    y: py(1230, nameFontSizePx),
    size: nameFontSizePts,
    font: fontBoldItalic,
    color: DARK_BROWN,
  });

  // ── Receipt ID ────────────────────────────────────────────────────────────
  const receiptFontSize = 42 * SCALE;  // ~10 pts
  page.drawText(receiptId, {
    x: px(1710),
    y: py(1745, 42),
    size: receiptFontSize,
    font: fontRegular,
    color: DARK_BROWN,
  });

  return pdfDoc.save();
}
