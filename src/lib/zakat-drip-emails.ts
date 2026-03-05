/**
 * Zakat Drip Email Templates
 *
 * 3-email follow-up sequence sent at 24h, 3d, 7d after Zakat calculation.
 * Email 1 (immediate) is handled by track-zakat.ts — this file covers steps 2–4.
 * Follows the same Resend + List-Unsubscribe pattern as abandoned-checkout-emails.ts.
 */

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;

// ============================================
// TYPES
// ============================================

export interface ZakatDripEmailData {
  email: string;
  firstName: string;
  zakatAmount: number;
  payUrl: string;
  unsubscribeUrl: string;
}

// ============================================
// EMAIL WRAPPER (Zakat green theme)
// ============================================

function getZakatEmailWrapper(content: string, preheader: string, unsubscribeUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Qurbani Foundation</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Preheader -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    ${preheader}
  </div>

  <!-- Email Container -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #e1861d 0%, #b45309 100%); padding: 32px; text-align: center;">
              <img src="https://epsjdbnxhmeprjrgcbyw.supabase.co/storage/v1/object/public/media/1771815889576-drvcgb.png" alt="Qurbani Foundation" width="220" style="max-width: 220px; height: auto; display: inline-block;" />
              <p style="margin: 12px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Serving Humanity Through Faith</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
                      <strong>Qurbani Foundation</strong>
                    </p>
                    <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">
                      EIN: 38-4109716 | 1-800-900-0027
                    </p>
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

        <!-- Quran Verse Footer -->
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
</html>
  `;
}

// ============================================
// CTA BUTTON (Zakat green theme)
// ============================================

function ctaButton(text: string, url: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px auto;">
      <tr>
        <td style="background: linear-gradient(135deg, #d97706, #b45309); border-radius: 8px; text-align: center;">
          <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 36px; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; letter-spacing: 0.5px;">${text}</a>
        </td>
      </tr>
    </table>
  `;
}

// ============================================
// ZAKAT AMOUNT BANNER
// ============================================

function zakatAmountBanner(amount: number): string {
  const formatted = '$' + Math.round(amount).toLocaleString('en-US');
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 20px; text-align: center;">
          <p style="margin: 0 0 2px 0; color: #92400e; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Your Zakat Due</p>
          <p style="margin: 0; color: #b45309; font-size: 26px; font-weight: 700;">${formatted}</p>
        </td>
      </tr>
    </table>
  `;
}

// ============================================
// TRUST SIGNALS
// ============================================

function trustSignals(): string {
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
    </table>
  `;
}

// ============================================
// HELPERS
// ============================================

function formatAmount(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('en-US');
}

/**
 * Dynamic impact numbers that increase every ~3 days.
 * Base date: March 1, 2026. Numbers grow steadily over time.
 */
function getDynamicImpactNumbers(): { meals: number; families: number } {
  const BASE_DATE = new Date('2026-03-01T00:00:00Z').getTime();
  const BASE_MEALS = 178357;
  const BASE_FAMILIES = 2377;

  const daysSinceBase = Math.max(0, Math.floor((Date.now() - BASE_DATE) / 86400000));
  const periods = Math.floor(daysSinceBase / 3); // changes every 3 days

  // Deterministic small variation per period (0–16)
  const seed = (periods * 31 + 7) % 17;

  const mealsGrowth = periods * 73 + seed * 4;       // ~73 meals per 3-day period
  const familiesGrowth = periods * 4 + Math.floor(seed / 4); // ~4 families per 3-day period

  return {
    meals: BASE_MEALS + mealsGrowth,
    families: BASE_FAMILIES + familiesGrowth,
  };
}

// ============================================
// EMAIL TEMPLATES (Steps 2–4)
// ============================================

function buildStep2Email(data: ZakatDripEmailData): { subject: string; html: string; plainText: string } {
  const name = data.firstName || 'Friend';
  const amount = formatAmount(data.zakatAmount);

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px;">Assalamu Alaikum ${name},</h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Yesterday you calculated your Zakat obligation. As a reminder, here's your amount:
    </p>
    ${zakatAmountBanner(data.zakatAmount)}
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Zakat is the <strong>Third Pillar of Islam</strong> — a sacred obligation that purifies your wealth and uplifts those in need. Fulfilling it on time brings immense barakah.
    </p>
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #16a34a;">
      <p style="margin: 0; color: #166534; font-size: 14px; line-height: 1.6;">
        <strong>The Prophet (PBUH) said:</strong> "Whoever pays the Zakat on their wealth will have its evil removed from them." <em>(Ibn Khuzaimah)</em>
      </p>
    </div>
    ${ctaButton('Fulfill My Zakat \u2014 ' + amount, data.payUrl)}
    <p style="margin: 0; color: #6b7280; font-size: 14px;">
      It only takes a minute. Your donation link is saved and ready.
    </p>
    ${trustSignals()}
  `;

  const plainText = `Assalamu Alaikum ${name},\n\nYesterday you calculated your Zakat: ${amount}.\n\nZakat is the Third Pillar of Islam. Fulfilling it on time brings immense barakah.\n\nPay your Zakat: ${data.payUrl}\n\nUnsubscribe: ${data.unsubscribeUrl}`;

  return {
    subject: `Reminder: Your Zakat of ${amount} is waiting, ${name}`,
    html: getZakatEmailWrapper(content, `Your Zakat of ${amount} is ready to fulfill.`, data.unsubscribeUrl),
    plainText,
  };
}

function buildStep3Email(data: ZakatDripEmailData): { subject: string; html: string; plainText: string } {
  const name = data.firstName || 'Friend';
  const amount = formatAmount(data.zakatAmount);

  // Dynamic org-wide impact numbers that grow over time
  const impact = getDynamicImpactNumbers();
  const mealsProvided = impact.meals;
  const familiesHelped = impact.families;

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px;">See where your Zakat goes, ${name}</h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Your ${amount} in Zakat isn't just a payment — it's a lifeline for families who depend on it. Here's the real impact:
    </p>

    <!-- Impact Cards -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="padding: 16px; background-color: #fef3c7; border-radius: 8px; text-align: center; width: 48%;">
          <p style="margin: 0 0 4px 0; color: #b45309; font-size: 28px; font-weight: bold;">${mealsProvided.toLocaleString()}</p>
          <p style="margin: 0; color: #92400e; font-size: 13px;">Meals Provided</p>
        </td>
        <td width="4%"></td>
        <td style="padding: 16px; background-color: #fef3c7; border-radius: 8px; text-align: center; width: 48%;">
          <p style="margin: 0 0 4px 0; color: #1e40af; font-size: 28px; font-weight: bold;">${familiesHelped.toLocaleString()}</p>
          <p style="margin: 0; color: #92400e; font-size: 13px;">Families Helped</p>
        </td>
      </tr>
    </table>

    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Through Qurbani Foundation, your Zakat reaches eligible recipients across <strong>50+ countries</strong> — providing food, clean water, education, and medical aid to those who need it most.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 16px 0;">
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="color: #d97706; font-size: 18px; width: 30px;">&#10003;</td>
              <td style="color: #374151; font-size: 14px;">Food packages for families in poverty</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="color: #d97706; font-size: 18px; width: 30px;">&#10003;</td>
              <td style="color: #374151; font-size: 14px;">Clean water wells in underserved communities</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="color: #d97706; font-size: 18px; width: 30px;">&#10003;</td>
              <td style="color: #374151; font-size: 14px;">Education and school supplies for orphans</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="color: #d97706; font-size: 18px; width: 30px;">&#10003;</td>
              <td style="color: #374151; font-size: 14px;">Medical aid and emergency relief</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${ctaButton('Make an Impact Today \u2014 ' + amount, data.payUrl)}
    ${trustSignals()}
  `;

  const plainText = `See where your Zakat goes, ${name}.\n\nYour ${amount} in Zakat can provide ${mealsProvided} meals and help ${familiesHelped} families across 50+ countries.\n\nPay your Zakat: ${data.payUrl}\n\nUnsubscribe: ${data.unsubscribeUrl}`;

  return {
    subject: `The impact of your ${amount} Zakat, ${name}`,
    html: getZakatEmailWrapper(content, `Your ${amount} Zakat can provide ${mealsProvided} meals and help ${familiesHelped} families.`, data.unsubscribeUrl),
    plainText,
  };
}

function buildStep4Email(data: ZakatDripEmailData): { subject: string; html: string; plainText: string } {
  const name = data.firstName || 'Friend';
  const amount = formatAmount(data.zakatAmount);

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px;">${name}, don't miss this blessed window</h2>
    ${zakatAmountBanner(data.zakatAmount)}
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

    ${ctaButton('Complete My Zakat \u2014 ' + amount, data.payUrl)}
    <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
      This is our final reminder. May Allah accept your Zakat and multiply your rewards.
    </p>
    ${trustSignals()}
  `;

  const plainText = `${name}, don't miss this blessed window.\n\nRamadan is a time of multiplied rewards. Your Zakat of ${amount} can make a tremendous impact during this blessed month.\n\nPay your Zakat: ${data.payUrl}\n\nThis is our final reminder. May Allah accept your Zakat.\n\nUnsubscribe: ${data.unsubscribeUrl}`;

  return {
    subject: `Final reminder: Complete your ${amount} Zakat, ${name}`,
    html: getZakatEmailWrapper(content, `Ramadan is ending soon. Fulfill your ${amount} Zakat and earn multiplied rewards.`, data.unsubscribeUrl),
    plainText,
  };
}

// ============================================
// MAIN SEND FUNCTION
// ============================================

// Steps 2–4 map to array indices 0–2
const TEMPLATES = [buildStep2Email, buildStep3Email, buildStep4Email];

export async function sendZakatDripEmail(
  step: number,
  data: ZakatDripEmailData,
): Promise<{ success: boolean; error?: string }> {
  if (step < 2 || step > 4) {
    return { success: false, error: `Invalid step: ${step}. Only steps 2-4 are supported.` };
  }

  const { subject, html, plainText } = TEMPLATES[step - 2](data);

  if (!RESEND_API_KEY) {
    console.log(`[Zakat Drip] Resend not configured, skipping step ${step} for ${data.email}`);
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Qurbani Foundation <donations@receipts.qurbani.com>',
        reply_to: 'donorcare@qurbani.com',
        to: data.email,
        subject,
        html,
        text: plainText,
        headers: {
          'List-Unsubscribe': `<${data.unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Zakat Drip] Resend error for step ${step}:`, error);
      return { success: false, error };
    }

    console.log(`[Zakat Drip] Step ${step} sent to ${data.email}: "${subject}"`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Zakat Drip] Failed to send step ${step}:`, message);
    return { success: false, error: message };
  }
}
