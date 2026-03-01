/**
 * Recovery Email Templates for Abandoned Checkout
 *
 * 5-email sequence sent at 1h, 24h, 72h, 5d, 7d after abandonment.
 * Follows the same Resend + GHL logging pattern as donor-emails.ts.
 * All emails include List-Unsubscribe headers for compliance.
 */

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;

// ============================================
// TYPES
// ============================================

export interface RecoveryEmailData {
  email: string;
  firstName: string;
  amount: number | null;
  campaignSlug: string | null;
  campaignType: string | null;
  resumeUrl: string;
  unsubscribeUrl: string;
}

// ============================================
// EMAIL WRAPPER (recovery-specific footer with unsubscribe)
// ============================================

function getRecoveryEmailWrapper(content: string, preheader: string, unsubscribeUrl: string): string {
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
            <td style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Qurbani Foundation</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Serving Humanity Through Faith</p>
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
                      <strong>Qurbani Foundation</strong><br>
                      A 501(c)(3) Tax-Exempt Organization
                    </p>
                    <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">
                      1-800-900-0027 | <a href="mailto:donorcare@qurbani.com" style="color: #d97706; text-decoration: none;">donorcare@qurbani.com</a>
                    </p>
                    <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">
                      <a href="https://www.qurbani.com" style="color: #d97706; text-decoration: none;">www.qurbani.com</a>
                    </p>
                    <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                      This is a transactional email related to your recent checkout activity.<br>
                      <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe from reminders</a>
                    </p>
                  </td>
                </tr>
              </table>
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
// CTA BUTTON HELPER
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
// TRUST SIGNALS
// ============================================

function trustSignals(): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      <tr>
        <td style="text-align: center;">
          <p style="margin: 0 0 4px 0; color: #059669; font-size: 13px; font-weight: 600;">Your donation is safe and secure</p>
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            501(c)(3) Tax-Deductible &bull; 256-bit SSL Encryption &bull; 100% of your donation goes to those in need
          </p>
        </td>
      </tr>
    </table>
  `;
}

// ============================================
// EMAIL TEMPLATES (1-5)
// ============================================

function formatAmount(amount: number | null): string {
  if (!amount) return 'your donation';
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCampaign(slug: string | null): string {
  if (!slug || slug === 'general') return 'donation';
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildStep1Email(data: RecoveryEmailData): { subject: string; html: string; plainText: string } {
  const name = data.firstName || 'Friend';
  const amountText = formatAmount(data.amount);
  const campaign = formatCampaign(data.campaignSlug);

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px;">Assalamu Alaikum ${name},</h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      It looks like you started a ${campaign} checkout for ${amountText} but didn't complete it. No worries — your cart is saved and waiting for you.
    </p>
    <p style="margin: 0 0 8px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      You can pick up right where you left off with a single click:
    </p>
    ${ctaButton('Complete Your Donation', data.resumeUrl)}
    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
      If you had any trouble during checkout, please don't hesitate to reach out — we're happy to help.
    </p>
    ${trustSignals()}
  `;

  const plainText = `Assalamu Alaikum ${name},\n\nIt looks like you started a ${campaign} checkout for ${amountText} but didn't complete it.\n\nComplete your donation: ${data.resumeUrl}\n\nIf you need help, contact us at donorcare@qurbani.com\n\nUnsubscribe: ${data.unsubscribeUrl}`;

  return {
    subject: `${name}, you left something behind`,
    html: getRecoveryEmailWrapper(content, `Your ${campaign} donation is waiting for you.`, data.unsubscribeUrl),
    plainText,
  };
}

function buildStep2Email(data: RecoveryEmailData): { subject: string; html: string; plainText: string } {
  const name = data.firstName || 'Friend';
  const amountText = formatAmount(data.amount);
  const campaign = formatCampaign(data.campaignSlug);

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px;">Your generosity can change lives, ${name}</h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Yesterday you began a ${amountText} ${campaign} donation. Your intention matters, and completing it could make a real difference.
    </p>
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #16a34a;">
      <p style="margin: 0; color: #166534; font-size: 14px; line-height: 1.6;">
        <strong>Did you know?</strong> Qurbani Foundation ensures 100% of your donation reaches those in need. We're a registered 501(c)(3) organization, and your contribution is fully tax-deductible.
      </p>
    </div>
    ${ctaButton('Complete Your Donation', data.resumeUrl)}
    <p style="margin: 0; color: #6b7280; font-size: 14px;">
      Your checkout is saved — it only takes a moment to finish.
    </p>
    ${trustSignals()}
  `;

  const plainText = `Your generosity can change lives, ${name}.\n\nYesterday you began a ${amountText} ${campaign} donation. Complete it now to make a real difference.\n\nComplete your donation: ${data.resumeUrl}\n\nUnsubscribe: ${data.unsubscribeUrl}`;

  return {
    subject: `Your ${campaign} donation is still waiting`,
    html: getRecoveryEmailWrapper(content, `Complete your ${amountText} donation and change lives.`, data.unsubscribeUrl),
    plainText,
  };
}

function buildStep3Email(data: RecoveryEmailData): { subject: string; html: string; plainText: string } {
  const name = data.firstName || 'Friend';
  const amountText = formatAmount(data.amount);
  const campaign = formatCampaign(data.campaignSlug);

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px;">Still thinking about it, ${name}?</h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      We understand — giving is a personal decision. Here's what donors like you have helped us achieve:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 16px 0;">
      <tr>
        <td style="padding: 12px; background-color: #fef3c7; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 4px 0; color: #92400e; font-size: 24px; font-weight: bold;">Thousands</p>
          <p style="margin: 0; color: #92400e; font-size: 13px;">of families fed through our food programs</p>
        </td>
        <td width="12"></td>
        <td style="padding: 12px; background-color: #dbeafe; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 4px 0; color: #1e40af; font-size: 24px; font-weight: bold;">Clean Water</p>
          <p style="margin: 0; color: #1e40af; font-size: 13px;">wells built in underserved communities</p>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Your ${amountText} ${campaign} donation can be part of this impact.
    </p>
    ${ctaButton('Yes, I Want to Help', data.resumeUrl)}
    ${trustSignals()}
  `;

  const plainText = `Still thinking about it, ${name}?\n\nDonors like you have helped feed thousands of families and build clean water wells. Your ${amountText} ${campaign} donation can be part of this impact.\n\nComplete your donation: ${data.resumeUrl}\n\nUnsubscribe: ${data.unsubscribeUrl}`;

  return {
    subject: `Still thinking about it, ${name}?`,
    html: getRecoveryEmailWrapper(content, `See the impact donors like you are making.`, data.unsubscribeUrl),
    plainText,
  };
}

function buildStep4Email(data: RecoveryEmailData): { subject: string; html: string; plainText: string } {
  const name = data.firstName || 'Friend';
  const amountText = formatAmount(data.amount);
  const campaign = formatCampaign(data.campaignSlug);

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px;">Don't let this opportunity pass, ${name}</h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      A few days ago, you took the first step toward making a difference with a ${amountText} ${campaign} donation. That intention is powerful.
    </p>
    <div style="background-color: #fefce8; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #eab308;">
      <p style="margin: 0; color: #854d0e; font-size: 14px; line-height: 1.6;">
        <strong>The Prophet (PBUH) said:</strong> "The believer's shade on the Day of Resurrection will be their charity." <em>(Al-Tirmidhi)</em>
      </p>
    </div>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Your saved checkout is still waiting — it takes less than a minute to complete.
    </p>
    ${ctaButton('Complete My Donation', data.resumeUrl)}
    ${trustSignals()}
  `;

  const plainText = `Don't let this opportunity pass, ${name}.\n\nYour ${amountText} ${campaign} donation checkout is still saved.\n\nComplete your donation: ${data.resumeUrl}\n\nUnsubscribe: ${data.unsubscribeUrl}`;

  return {
    subject: `Last chance to make an impact, ${name}`,
    html: getRecoveryEmailWrapper(content, `Your saved checkout expires soon.`, data.unsubscribeUrl),
    plainText,
  };
}

function buildStep5Email(data: RecoveryEmailData): { subject: string; html: string; plainText: string } {
  const name = data.firstName || 'Friend';
  const amountText = formatAmount(data.amount);
  const campaign = formatCampaign(data.campaignSlug);

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px;">We'd hate to see you go, ${name}</h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      This is our last reminder about your ${amountText} ${campaign} donation. After today, your saved checkout will expire.
    </p>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      If now isn't the right time, we completely understand. But if you'd still like to help, here's your last chance:
    </p>
    ${ctaButton('Complete My Donation', data.resumeUrl)}
    <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Whatever you decide, thank you for considering us. May Allah bless you and your family.
    </p>
    ${trustSignals()}
  `;

  const plainText = `We'd hate to see you go, ${name}.\n\nThis is our last reminder about your ${amountText} ${campaign} donation. Your saved checkout will expire after today.\n\nComplete your donation: ${data.resumeUrl}\n\nThank you for considering us. May Allah bless you.\n\nUnsubscribe: ${data.unsubscribeUrl}`;

  return {
    subject: `We'd hate to see you go, ${name}`,
    html: getRecoveryEmailWrapper(content, `Last chance to complete your donation.`, data.unsubscribeUrl),
    plainText,
  };
}

// ============================================
// MAIN SEND FUNCTION
// ============================================

const TEMPLATES = [buildStep1Email, buildStep2Email, buildStep3Email, buildStep4Email, buildStep5Email];

export async function sendRecoveryEmail(
  step: number,
  data: RecoveryEmailData,
): Promise<{ success: boolean; error?: string }> {
  if (step < 1 || step > 5) {
    return { success: false, error: `Invalid step: ${step}` };
  }

  const { subject, html, plainText } = TEMPLATES[step - 1](data);

  if (!RESEND_API_KEY) {
    console.log(`[Recovery Email] Resend not configured, skipping step ${step} for ${data.email}`);
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
      console.error(`[Recovery Email] Resend error for step ${step}:`, error);
      return { success: false, error };
    }

    console.log(`[Recovery Email] Step ${step} sent to ${data.email}: "${subject}"`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Recovery Email] Failed to send step ${step}:`, message);
    return { success: false, error: message };
  }
}
