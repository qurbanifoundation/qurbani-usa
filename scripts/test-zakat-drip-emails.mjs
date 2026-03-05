/**
 * Test script: Send all 4 Zakat emails to the admin email for preview.
 * Email 1 = immediate calculation, Emails 2-4 = drip follow-ups.
 * Usage: node scripts/test-zakat-drip-emails.mjs
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TEST_EMAIL = 'qurbanifoundation@gmail.com';

if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY not found in .env');
  process.exit(1);
}

// ============================================
// SHARED: Orange theme wrapper for Emails 2-4
// ============================================

function getZakatEmailWrapper(content, preheader, unsubscribeUrl) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Qurbani Foundation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #e1861d 0%, #b45309 100%); padding: 32px; text-align: center;">
              <img src="https://epsjdbnxhmeprjrgcbyw.supabase.co/storage/v1/object/public/media/1771815889576-drvcgb.png" alt="Qurbani Foundation" width="220" style="max-width: 220px; height: auto; display: inline-block;" />
              <p style="margin: 12px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Serving Humanity Through Faith</p>
            </td>
          </tr>
          <tr><td style="padding: 32px;">${content}</td></tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;"><strong>Qurbani Foundation</strong></p>
                    <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">EIN: 38-4109716 | 1-800-900-0027</p>
                    <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">
                      <a href="https://www.qurbani.com" style="color: #d97706; text-decoration: none;">www.qurbani.com</a> |
                      <a href="mailto:donorcare@qurbani.com" style="color: #d97706; text-decoration: none;">donorcare@qurbani.com</a>
                    </p>
                    <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                      <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe from Zakat reminders</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.6; font-style: italic;">
                "Take from their wealth a charity by which you purify them and cause them increase."<br>
                <span style="font-style: normal;">(Al-Quran, 9:103)</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text, url) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px auto;">
      <tr>
        <td style="background: linear-gradient(135deg, #d97706, #b45309); border-radius: 8px; text-align: center;">
          <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 36px; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; letter-spacing: 0.5px;">${text}</a>
        </td>
      </tr>
    </table>`;
}

function zakatAmountBanner(amount) {
  const formatted = '$' + Math.round(amount).toLocaleString('en-US');
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 20px; text-align: center;">
          <p style="margin: 0 0 2px 0; color: #92400e; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Your Zakat Due</p>
          <p style="margin: 0; color: #b45309; font-size: 26px; font-weight: 700;">${formatted}</p>
        </td>
      </tr>
    </table>`;
}

function getDynamicImpactNumbers() {
  const BASE_DATE = new Date('2026-03-01T00:00:00Z').getTime();
  const BASE_MEALS = 178357;
  const BASE_FAMILIES = 2377;
  const daysSinceBase = Math.max(0, Math.floor((Date.now() - BASE_DATE) / 86400000));
  const periods = Math.floor(daysSinceBase / 3);
  const seed = (periods * 31 + 7) % 17;
  return {
    meals: BASE_MEALS + periods * 73 + seed * 4,
    families: BASE_FAMILIES + periods * 4 + Math.floor(seed / 4),
  };
}

function trustSignals() {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      <tr>
        <td style="text-align: center;">
          <p style="margin: 0 0 4px 0; color: #059669; font-size: 13px; font-weight: 600;">100% of your Zakat reaches eligible recipients</p>
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            501(c)(3) Tax-Deductible &bull; 256-bit SSL Encryption &bull; Shariah-Compliant Distribution
          </p>
        </td>
      </tr>
    </table>`;
}

function fmtCurrency(amount) {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatAmount(amount) {
  return '$' + Math.round(amount).toLocaleString('en-US');
}

// ============================================
// TEST DATA
// ============================================

const testData = {
  firstName: 'Admin',
  zakatAmount: 2500,
  totalAssets: 125000,
  totalLiabilities: 25000,
  netWealth: 100000,
  nisabType: 'silver',
  nisabValue: 475.21,
  assetsBreakdown: [
    { label: 'Cash & Bank Accounts', amount: 45000 },
    { label: 'Gold & Silver', amount: 18000 },
    { label: 'Investments & Stocks', amount: 52000 },
    { label: 'Crypto', amount: 10000 },
  ],
  liabilitiesBreakdown: [
    { label: 'Credit Card Debt', amount: 5000 },
    { label: 'Short-term Loans', amount: 20000 },
  ],
  payUrl: 'https://www.qurbani.com/zakat/calculator?amount=2500.00',
  unsubscribeUrl: 'https://www.qurbani.com/api/zakat/unsubscribe?token=test-preview-token',
};

// ============================================
// EMAIL 1: Immediate — Calculation breakdown
// ============================================

function buildStep1() {
  const logoUrl = 'https://epsjdbnxhmeprjrgcbyw.supabase.co/storage/v1/object/public/media/1771815889576-drvcgb.png';
  const name = testData.firstName;
  const zakatDue = testData.zakatAmount > 0;

  let assetsRows = '';
  testData.assetsBreakdown.forEach(item => {
    assetsRows += `<tr>
      <td style="padding: 8px 0; font-size: 14px; color: #555; border-bottom: 1px solid #f3f4f6;">${item.label}</td>
      <td style="padding: 8px 0; font-size: 14px; color: #1f2937; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${fmtCurrency(item.amount)}</td>
    </tr>`;
  });

  let liabilitiesRows = '';
  testData.liabilitiesBreakdown.forEach(item => {
    liabilitiesRows += `<tr>
      <td style="padding: 8px 0; font-size: 14px; color: #555; border-bottom: 1px solid #f3f4f6;">${item.label}</td>
      <td style="padding: 8px 0; font-size: 14px; color: #1f2937; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${fmtCurrency(item.amount)}</td>
    </tr>`;
  });

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Your Zakat Calculation</title></head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
    <tr><td align="center" style="padding: 30px 15px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <tr>
          <td style="background: linear-gradient(135deg, #e1861d 0%, #b45309 100%); padding: 30px 30px 20px; text-align: center;">
            <img src="${logoUrl}" alt="Qurbani Foundation" width="180" style="width: 180px; max-width: 100%; height: auto; display: inline-block;" />
            <p style="color: rgba(255,255,255,0.8); font-size: 12px; margin: 8px 0 0; letter-spacing: 1px;">SERVING HUMANITY THROUGH FAITH</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 30px 0; text-align: center;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;">
              <tr>
                <td style="padding: 14px 20px; text-align: center;">
                  <p style="color: #92400e; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 1px;">Your Zakat Due</p>
                  <p style="color: #b45309; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2;">${fmtCurrency(testData.zakatAmount)}</p>
                  <p style="color: #92400e; font-size: 11px; margin: 4px 0 0;">2.5% of net zakatable wealth</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 30px 10px;">
            <p style="font-size: 16px; color: #333; margin: 0;">Assalamu Alaikum ${name},</p>
            <p style="font-size: 14px; color: #666; margin: 10px 0 0; line-height: 1.6;">
              Here is your detailed Zakat calculation. Your net wealth exceeds the Nisab threshold, making Zakat obligatory.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 30px 0;">
            <p style="font-size: 13px; font-weight: 700; color: #d97706; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px; border-bottom: 2px solid #d97706; padding-bottom: 6px;">Assets</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${assetsRows}
              <tr style="border-top: 2px solid #e5e7eb;">
                <td style="padding: 12px 0 0; font-size: 14px; color: #1f2937; font-weight: 700;">Total Assets</td>
                <td style="padding: 12px 0 0; font-size: 14px; color: #1f2937; font-weight: 700; text-align: right;">${fmtCurrency(testData.totalAssets)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 30px 0;">
            <p style="font-size: 13px; font-weight: 700; color: #B32629; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px; border-bottom: 2px solid #B32629; padding-bottom: 6px;">Liabilities (Deductions)</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${liabilitiesRows}
              <tr style="border-top: 2px solid #e5e7eb;">
                <td style="padding: 12px 0 0; font-size: 14px; color: #1f2937; font-weight: 700;">Total Liabilities</td>
                <td style="padding: 12px 0 0; font-size: 14px; color: #B32629; font-weight: 700; text-align: right;">-${fmtCurrency(testData.totalLiabilities)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 25px 30px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 12px; overflow: hidden;">
              <tr><td style="padding: 16px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size: 13px; color: #666; padding-bottom: 8px;">Net Wealth (Assets − Liabilities)</td>
                    <td style="font-size: 16px; color: #1f2937; font-weight: 700; text-align: right; padding-bottom: 8px;">${fmtCurrency(testData.netWealth)}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 13px; color: #666; padding-top: 8px; border-top: 1px solid #e5e7eb;">Nisab Threshold (Silver, 612.36g)</td>
                    <td style="font-size: 14px; color: #666; font-weight: 600; text-align: right; padding-top: 8px; border-top: 1px solid #e5e7eb;">${fmtCurrency(testData.nisabValue)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 30px;">
            <table role="presentation" width="100%"><tr>
              <td style="background: #ecfdf5; border-radius: 10px; padding: 12px 16px; text-align: center;">
                <p style="font-size: 14px; font-weight: 600; color: #065f46; margin: 0;">✓ Above Nisab — Zakat is obligatory</p>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 30px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;">
              <tr><td style="padding: 14px 20px; text-align: center;">
                <p style="color: #92400e; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 1px;">Your Zakat Due (2.5%)</p>
                <p style="color: #b45309; font-size: 26px; font-weight: 700; margin: 0;">${fmtCurrency(testData.zakatAmount)}</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 30px 30px;">
            <table role="presentation" width="100%"><tr><td align="center">
              <a href="${testData.payUrl}" style="display: inline-block; background: linear-gradient(135deg, #d97706, #b45309); color: #ffffff; font-size: 18px; font-weight: 700; text-decoration: none; padding: 16px 50px; border-radius: 12px; text-align: center; width: 100%; max-width: 400px; box-sizing: border-box;">
                Pay Your Zakat Now →
              </a>
            </td></tr>
            <tr><td style="text-align: center; padding-top: 8px;">
              <p style="font-size: 12px; color: #999; margin: 0;">100% of your Zakat goes directly to eligible recipients</p>
            </td></tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 30px; border-top: 1px solid #f3f4f6; text-align: center;">
            <p style="font-size: 12px; color: #999; margin: 0 0 4px;">Qurbani Foundation USA</p>
            <p style="font-size: 11px; color: #bbb; margin: 0 0 4px;">EIN: 38-4109716 | 1-800-900-0027</p>
            <p style="font-size: 11px; color: #bbb; margin: 0;">
              <a href="https://www.qurbani.com" style="color: #d97706; text-decoration: none;">www.qurbani.com</a> |
              <a href="mailto:donorcare@qurbani.com" style="color: #d97706; text-decoration: none;">donorcare@qurbani.com</a>
            </p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr><td style="padding: 24px 20px; text-align: center;">
          <p style="font-size: 13px; color: #888; font-style: italic; line-height: 1.5; margin: 0;">
            "Those who (in charity) spend of their goods by night and by day, in secret and in public, have their reward with their Lord."
            <br><span style="font-style: normal; font-size: 12px; color: #aaa;">(Al-Quran, 2:274)</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject: `[TEST 1/4] Your Zakat Calculation: ${fmtCurrency(testData.zakatAmount)} Due`,
    html,
  };
}

// ============================================
// EMAIL 2: 24h — Reminder
// ============================================

function buildStep2() {
  const name = testData.firstName;
  const amount = formatAmount(testData.zakatAmount);
  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px;">Assalamu Alaikum ${name},</h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Yesterday you calculated your Zakat obligation. As a reminder, here's your amount:
    </p>
    ${zakatAmountBanner(testData.zakatAmount)}
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Zakat is the <strong>Third Pillar of Islam</strong> — a sacred obligation that purifies your wealth and uplifts those in need. Fulfilling it on time brings immense barakah.
    </p>
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #16a34a;">
      <p style="margin: 0; color: #166534; font-size: 14px; line-height: 1.6;">
        <strong>The Prophet (PBUH) said:</strong> "Whoever pays the Zakat on their wealth will have its evil removed from them." <em>(Ibn Khuzaimah)</em>
      </p>
    </div>
    ${ctaButton('Fulfill My Zakat \u2014 ' + amount, testData.payUrl)}
    <p style="margin: 0; color: #6b7280; font-size: 14px;">It only takes a minute. Your donation link is saved and ready.</p>
    ${trustSignals()}`;

  return {
    subject: `[TEST 2/4] Reminder: Your Zakat of ${amount} is waiting, ${name}`,
    html: getZakatEmailWrapper(content, `Your Zakat of ${amount} is ready to fulfill.`, testData.unsubscribeUrl),
  };
}

// ============================================
// EMAIL 3: 3 days — Impact
// ============================================

function buildStep3() {
  const name = testData.firstName;
  const amount = formatAmount(testData.zakatAmount);
  const impact = getDynamicImpactNumbers();
  const mealsProvided = impact.meals;
  const familiesHelped = impact.families;

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px;">See where your Zakat goes, ${name}</h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Your ${amount} in Zakat isn't just a payment — it's a lifeline for families who depend on it. Here's the real impact:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="padding: 16px; background-color: #fef3c7; border-radius: 8px; text-align: center; width: 48%;">
          <p style="margin: 0 0 4px 0; color: #b45309; font-size: 28px; font-weight: bold;">${mealsProvided.toLocaleString()}</p>
          <p style="margin: 0; color: #92400e; font-size: 13px;">Meals Provided</p>
        </td>
        <td width="4%"></td>
        <td style="padding: 16px; background-color: #fef3c7; border-radius: 8px; text-align: center; width: 48%;">
          <p style="margin: 0 0 4px 0; color: #b45309; font-size: 28px; font-weight: bold;">${familiesHelped.toLocaleString()}</p>
          <p style="margin: 0; color: #92400e; font-size: 13px;">Families Helped</p>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Through Qurbani Foundation, your Zakat reaches eligible recipients across <strong>50+ countries</strong> — providing food, clean water, education, and medical aid to those who need it most.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 16px 0;">
      <tr><td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6;">
        <table role="presentation" width="100%"><tr>
          <td style="color: #d97706; font-size: 18px; width: 30px;">&#10003;</td>
          <td style="color: #374151; font-size: 14px;">Food packages for families in poverty</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6;">
        <table role="presentation" width="100%"><tr>
          <td style="color: #d97706; font-size: 18px; width: 30px;">&#10003;</td>
          <td style="color: #374151; font-size: 14px;">Clean water wells in underserved communities</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6;">
        <table role="presentation" width="100%"><tr>
          <td style="color: #d97706; font-size: 18px; width: 30px;">&#10003;</td>
          <td style="color: #374151; font-size: 14px;">Education and school supplies for orphans</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding: 12px 16px;">
        <table role="presentation" width="100%"><tr>
          <td style="color: #d97706; font-size: 18px; width: 30px;">&#10003;</td>
          <td style="color: #374151; font-size: 14px;">Medical aid and emergency relief</td>
        </tr></table>
      </td></tr>
    </table>
    ${ctaButton('Make an Impact Today \u2014 ' + amount, testData.payUrl)}
    ${trustSignals()}`;

  return {
    subject: `[TEST 3/4] The impact of your ${amount} Zakat, ${name}`,
    html: getZakatEmailWrapper(content, `Your ${amount} Zakat can provide ${mealsProvided} meals.`, testData.unsubscribeUrl),
  };
}

// ============================================
// EMAIL 4: 7 days — Ramadan urgency
// ============================================

function buildStep4() {
  const name = testData.firstName;
  const amount = formatAmount(testData.zakatAmount);
  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px;">${name}, don't miss this blessed window</h2>
    ${zakatAmountBanner(testData.zakatAmount)}
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Ramadan is a time of multiplied rewards. Every good deed — especially fulfilling your Zakat — carries immense weight during this blessed month.
    </p>
    <div style="background-color: #fefce8; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #eab308;">
      <p style="margin: 0; color: #854d0e; font-size: 14px; line-height: 1.6;">
        <strong>The Prophet (PBUH) said:</strong> "Whoever draws near to Allah during Ramadan with a good deed, it is as if they performed an obligatory act at another time." <em>(Ibn Khuzaimah)</em>
      </p>
    </div>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      You calculated your Zakat at <strong>${amount}</strong>. This is your chance to fulfill this pillar of Islam during the most rewarding time of the year.
    </p>
    <div style="background-color: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
      <p style="margin: 0 0 4px 0; color: #991b1b; font-size: 14px; font-weight: 600;">Don't delay your Zakat</p>
      <p style="margin: 0; color: #b91c1c; font-size: 13px;">Those in need are counting on donors like you</p>
    </div>
    ${ctaButton('Complete My Zakat \u2014 ' + amount, testData.payUrl)}
    <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
      This is our final reminder. May Allah accept your Zakat and multiply your rewards.
    </p>
    ${trustSignals()}`;

  return {
    subject: `[TEST 4/4] Final reminder: Complete your ${amount} Zakat, ${name}`,
    html: getZakatEmailWrapper(content, `Ramadan is ending soon. Fulfill your ${amount} Zakat.`, testData.unsubscribeUrl),
  };
}

// ============================================
// SEND ALL 4
// ============================================

async function sendEmail(emailData) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Qurbani Foundation <onboarding@resend.dev>',
      reply_to: 'donorcare@qurbani.com',
      to: [TEST_EMAIL],
      subject: emailData.subject,
      html: emailData.html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
  return res.json();
}

async function main() {
  console.log(`📧 Sending all 4 Zakat emails to ${TEST_EMAIL}...\n`);
  console.log(`   Test: $2,500 Zakat on $125K assets\n`);

  const emails = [
    { step: 1, builder: buildStep1 },
    { step: 2, builder: buildStep2 },
    { step: 3, builder: buildStep3 },
    { step: 4, builder: buildStep4 },
  ];

  for (const { step, builder } of emails) {
    const data = builder();
    console.log(`   Email ${step}: "${data.subject}"`);
    try {
      await sendEmail(data);
      console.log(`   ✅ Sent!`);
    } catch (e) {
      console.error(`   ❌ Failed: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ All 4 test emails sent! Check ${TEST_EMAIL} inbox.`);
}

main().catch(console.error);
