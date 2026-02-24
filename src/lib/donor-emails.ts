/**
 * Donor Email System
 * Sends professional emails via Resend + logs to GHL for tracking
 */

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const GHL_API_KEY = import.meta.env.GHL_API_KEY;
const GHL_LOCATION_ID = import.meta.env.GHL_LOCATION_ID;

// ============================================
// TYPES
// ============================================

interface DonationReceiptData {
  donorEmail: string;
  donorName: string;
  amount: number;
  items: Array<{ name: string; amount: number; quantity?: number }>;
  transactionId: string;
  donationType: 'single' | 'monthly' | 'weekly';
  date: Date;
  billingAddress?: {
    line1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
}

interface SubscriptionConfirmationData {
  donorEmail: string;
  donorName: string;
  amount: number;
  interval: 'monthly' | 'weekly';
  nextBillingDate: Date;
  items: Array<{ name: string; amount: number }>;
  managementUrl?: string;
}

interface PaymentFailedData {
  donorEmail: string;
  donorName: string;
  amount: number;
  reason?: string;
  updatePaymentUrl?: string;
}

// ============================================
// EMAIL SENDING + GHL LOGGING
// ============================================

async function sendEmailAndLogToGHL(params: {
  to: string;
  subject: string;
  html: string;
  plainText: string;
  emailType: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, subject, html, plainText, emailType } = params;

  // 1. Send email via Resend
  if (RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Qurbani Foundation <donations@qurbani.com>',
          to: to,
          subject: subject,
          html: html,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Resend error:', error);
        return { success: false, error };
      }

      console.log(`Email sent to ${to}: ${subject}`);
    } catch (error: any) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  } else {
    console.log('Resend not configured, skipping email send');
  }

  // 2. Log to GHL as a Conversation (shows in Conversations tab)
  if (GHL_API_KEY && GHL_LOCATION_ID) {
    try {
      // Find contact by email
      const searchRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(to)}`,
        {
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Version': '2021-07-28',
          },
        }
      );

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const contactId = searchData.contact?.id;

        if (contactId) {
          // Create outbound email message in GHL Conversations
          // This makes it appear in the Conversations tab like a real email
          const messageRes = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${GHL_API_KEY}`,
              'Version': '2021-07-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'Email',
              contactId: contactId,
              subject: subject,
              html: html,
              message: plainText,
              emailFrom: 'donations@qurbani.com',
              emailTo: to,
              direction: 'outbound',
              status: 'sent',
              dateAdded: new Date().toISOString(),
            }),
          });

          if (messageRes.ok) {
            console.log(`Email logged to GHL Conversations for contact ${contactId}`);
          } else {
            // Fallback to adding as a note if conversation API fails
            const errorText = await messageRes.text();
            console.log('Conversations API response:', messageRes.status, errorText);

            // Add as note as fallback
            await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${GHL_API_KEY}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                body: `📧 EMAIL SENT: ${emailType}\n${'━'.repeat(30)}\nTo: ${to}\nSubject: ${subject}\n\n${plainText}\n\nSent: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`,
              }),
            });
            console.log(`Email logged as note (fallback) for contact ${contactId}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to log email to GHL:', error);
    }
  }

  return { success: true };
}

// ============================================
// EMAIL TEMPLATES
// ============================================

function getEmailWrapper(content: string, preheader: string = ''): string {
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
                      EIN: XX-XXXXXXX
                    </p>
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                      <a href="https://www.qurbani.com" style="color: #d97706; text-decoration: none;">www.qurbani.com</a> |
                      <a href="mailto:donorcare@qurbani.com" style="color: #d97706; text-decoration: none;">donorcare@qurbani.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Legal Footer -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.5;">
                This email serves as your official donation receipt for tax purposes.<br>
                No goods or services were provided in exchange for this contribution.<br>
                Please retain this email for your records.
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
// DONOR EMAIL FUNCTIONS
// ============================================

/**
 * Send donation receipt email
 */
export async function sendDonationReceipt(data: DonationReceiptData): Promise<{ success: boolean }> {
  const { donorEmail, donorName, amount, items, transactionId, donationType, date, billingAddress } = data;

  const firstName = donorName.split(' ')[0];
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  });

  const typeLabel = donationType === 'monthly' ? 'Monthly Recurring' : donationType === 'weekly' ? 'Jummah (Weekly)' : 'One-Time';

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        <span style="color: #374151; font-weight: 500;">${item.name}</span>
        ${item.quantity && item.quantity > 1 ? `<span style="color: #6b7280;"> × ${item.quantity}</span>` : ''}
      </td>
      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #374151; font-weight: 600;">
        $${(item.amount * (item.quantity || 1)).toFixed(2)}
      </td>
    </tr>
  `).join('');

  const content = `
    <!-- Thank You Message -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="width: 64px; height: 64px; background-color: #dcfce7; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 32px;">✓</span>
      </div>
      <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 24px;">Thank You, ${firstName}!</h2>
      <p style="margin: 0; color: #6b7280; font-size: 16px;">Your generosity is making a real difference.</p>
    </div>

    <!-- Donation Summary Box -->
    <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td>
            <p style="margin: 0 0 4px 0; color: #92400e; font-size: 14px; font-weight: 500;">Total Donation</p>
            <p style="margin: 0; color: #78350f; font-size: 36px; font-weight: bold;">$${amount.toFixed(2)}</p>
            <p style="margin: 8px 0 0 0; color: #92400e; font-size: 14px;">${typeLabel} Donation</p>
          </td>
          <td style="text-align: right; vertical-align: top;">
            <p style="margin: 0; color: #92400e; font-size: 12px;">Transaction ID</p>
            <p style="margin: 4px 0 0 0; color: #78350f; font-size: 14px; font-family: monospace;">${transactionId.slice(-12).toUpperCase()}</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Items Detail -->
    <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 16px; font-weight: 600;">Donation Details</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
      ${itemsHtml}
      <tr>
        <td style="padding: 16px 0 0 0;">
          <span style="color: #111827; font-size: 18px; font-weight: bold;">Total</span>
        </td>
        <td style="padding: 16px 0 0 0; text-align: right;">
          <span style="color: #d97706; font-size: 24px; font-weight: bold;">$${amount.toFixed(2)}</span>
        </td>
      </tr>
    </table>

    <!-- Receipt Info -->
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Date:</td>
          <td style="color: #374151; font-size: 14px; padding: 4px 0; text-align: right;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Payment Method:</td>
          <td style="color: #374151; font-size: 14px; padding: 4px 0; text-align: right;">Credit Card</td>
        </tr>
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Donor:</td>
          <td style="color: #374151; font-size: 14px; padding: 4px 0; text-align: right;">${donorName}</td>
        </tr>
        ${billingAddress?.line1 ? `
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Address:</td>
          <td style="color: #374151; font-size: 14px; padding: 4px 0; text-align: right;">
            ${billingAddress.line1}<br>
            ${billingAddress.city}, ${billingAddress.state} ${billingAddress.postal_code}
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    ${donationType !== 'single' ? `
    <!-- Recurring Info -->
    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0; color: #1e40af; font-size: 14px;">
        <strong>🔄 Recurring Donation</strong><br>
        You will be automatically charged $${amount.toFixed(2)} ${donationType === 'weekly' ? 'every Friday' : 'each month'}.
        To manage your subscription, please contact us at <a href="mailto:donorcare@qurbani.com" style="color: #1e40af;">donorcare@qurbani.com</a>
      </p>
    </div>
    ` : ''}

    <!-- Impact Message -->
    <div style="text-align: center; padding: 24px 0; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">
        <em>"The believer's shade on the Day of Resurrection will be their charity."</em><br>
        <span style="color: #6b7280; font-size: 14px;">— Prophet Muhammad ﷺ</span>
      </p>
      <a href="https://www.qurbani.com" style="display: inline-block; background-color: #d97706; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        See Your Impact
      </a>
    </div>
  `;

  const html = getEmailWrapper(content, `Thank you for your $${amount.toFixed(2)} donation to Qurbani Foundation!`);

  const plainText = `Thank you, ${firstName}!

Your ${typeLabel} donation of $${amount.toFixed(2)} has been received.

DONATION DETAILS
${'-'.repeat(30)}
${items.map(i => `• ${i.name}: $${(i.amount * (i.quantity || 1)).toFixed(2)}`).join('\n')}

Total: $${amount.toFixed(2)}
Date: ${formattedDate}
Transaction ID: ${transactionId}

This email serves as your official donation receipt for tax purposes.
No goods or services were provided in exchange for this contribution.

Thank you for your generosity!

Qurbani Foundation
www.qurbani.com | donorcare@qurbani.com`;

  return sendEmailAndLogToGHL({
    to: donorEmail,
    subject: `Thank you for your $${amount.toFixed(2)} donation! 🤲`,
    html,
    plainText,
    emailType: 'Donation Receipt',
  });
}

/**
 * Send subscription confirmation email
 */
export async function sendSubscriptionConfirmation(data: SubscriptionConfirmationData): Promise<{ success: boolean }> {
  const { donorEmail, donorName, amount, interval, nextBillingDate, items } = data;

  const firstName = donorName.split(' ')[0];
  const intervalLabel = interval === 'weekly' ? 'Jummah (Every Friday)' : 'Monthly';
  const nextDateStr = nextBillingDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  });

  const content = `
    <!-- Welcome Message -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="width: 64px; height: 64px; background-color: #dbeafe; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 32px;">🔄</span>
      </div>
      <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 24px;">Welcome to Our Family, ${firstName}!</h2>
      <p style="margin: 0; color: #6b7280; font-size: 16px;">Your ${intervalLabel.toLowerCase()} donation is now active.</p>
    </div>

    <!-- Subscription Summary -->
    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td>
            <p style="margin: 0 0 4px 0; color: #1e40af; font-size: 14px; font-weight: 500;">${intervalLabel} Donation</p>
            <p style="margin: 0; color: #1e3a8a; font-size: 36px; font-weight: bold;">$${amount.toFixed(2)}</p>
          </td>
          <td style="text-align: right; vertical-align: top;">
            <p style="margin: 0; color: #1e40af; font-size: 12px;">Next Payment</p>
            <p style="margin: 4px 0 0 0; color: #1e3a8a; font-size: 14px; font-weight: 600;">${nextDateStr}</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- What This Means -->
    <div style="margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px; font-weight: 600;">What happens next?</h3>
      <ul style="margin: 0; padding: 0 0 0 20px; color: #374151; font-size: 14px; line-height: 1.8;">
        <li>You'll be charged <strong>$${amount.toFixed(2)}</strong> ${interval === 'weekly' ? 'every Friday' : 'on this date each month'}</li>
        <li>You'll receive a receipt email after each payment</li>
        <li>You can cancel or modify anytime by contacting us</li>
        <li>100% of your donation goes to those in need</li>
      </ul>
    </div>

    <!-- Impact -->
    <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0; color: #166534; font-size: 14px;">
        <strong>💚 Your Impact</strong><br>
        With your ${intervalLabel.toLowerCase()} support, you'll contribute <strong>$${(amount * (interval === 'weekly' ? 52 : 12)).toFixed(2)}</strong> this year to help those in need.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align: center; padding: 24px 0; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px;">
        Questions about your subscription? We're here to help!
      </p>
      <a href="mailto:donorcare@qurbani.com" style="display: inline-block; background-color: #d97706; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Contact Donor Care
      </a>
    </div>
  `;

  const html = getEmailWrapper(content, `Your ${intervalLabel} donation of $${amount.toFixed(2)} is now active!`);

  const plainText = `Welcome to Our Family, ${firstName}!

Your ${intervalLabel} recurring donation is now active.

SUBSCRIPTION DETAILS
${'-'.repeat(30)}
Amount: $${amount.toFixed(2)} ${interval === 'weekly' ? 'every Friday' : 'per month'}
Next Payment: ${nextDateStr}
Annual Impact: $${(amount * (interval === 'weekly' ? 52 : 12)).toFixed(2)}

What happens next:
• You'll be charged $${amount.toFixed(2)} ${interval === 'weekly' ? 'every Friday' : 'on this date each month'}
• You'll receive a receipt email after each payment
• You can cancel or modify anytime by contacting us

Thank you for your ongoing support!

Qurbani Foundation
www.qurbani.com | donorcare@qurbani.com`;

  return sendEmailAndLogToGHL({
    to: donorEmail,
    subject: `Your ${intervalLabel} donation is confirmed! 🤲`,
    html,
    plainText,
    emailType: 'Subscription Confirmation',
  });
}

/**
 * Send payment failed email to donor
 */
export async function sendPaymentFailedEmail(data: PaymentFailedData): Promise<{ success: boolean }> {
  const { donorEmail, donorName, amount, reason } = data;

  const firstName = donorName.split(' ')[0];

  const content = `
    <!-- Alert Message -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="width: 64px; height: 64px; background-color: #fee2e2; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 32px;">⚠️</span>
      </div>
      <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 24px;">Payment Issue, ${firstName}</h2>
      <p style="margin: 0; color: #6b7280; font-size: 16px;">We couldn't process your $${amount.toFixed(2)} donation.</p>
    </div>

    <!-- Details -->
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0; color: #991b1b; font-size: 14px;">
        <strong>What happened?</strong><br>
        ${reason || 'Your payment could not be processed. This is usually due to insufficient funds or an expired card.'}
      </p>
    </div>

    <!-- What to do -->
    <div style="margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px; font-weight: 600;">How to fix this:</h3>
      <ol style="margin: 0; padding: 0 0 0 20px; color: #374151; font-size: 14px; line-height: 1.8;">
        <li>Check that your card hasn't expired</li>
        <li>Ensure you have sufficient funds</li>
        <li>Contact your bank if the issue persists</li>
        <li>Update your payment method or try again</li>
      </ol>
    </div>

    <!-- CTA -->
    <div style="text-align: center; padding: 24px 0; border-top: 1px solid #e5e7eb;">
      <a href="https://www.qurbani.com" style="display: inline-block; background-color: #d97706; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 12px;">
        Try Again
      </a>
      <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 14px;">
        Need help? Contact us at <a href="mailto:donorcare@qurbani.com" style="color: #d97706;">donorcare@qurbani.com</a>
      </p>
    </div>
  `;

  const html = getEmailWrapper(content, `Action needed: Your $${amount.toFixed(2)} donation couldn't be processed.`);

  const plainText = `Payment Issue, ${firstName}

We couldn't process your $${amount.toFixed(2)} donation.

WHAT HAPPENED
${'-'.repeat(30)}
${reason || 'Your payment could not be processed. This is usually due to insufficient funds or an expired card.'}

HOW TO FIX THIS
1. Check that your card hasn't expired
2. Ensure you have sufficient funds
3. Contact your bank if the issue persists
4. Update your payment method or try again

Need help? Contact us at donorcare@qurbani.com

Qurbani Foundation
www.qurbani.com`;

  return sendEmailAndLogToGHL({
    to: donorEmail,
    subject: `Action needed: Payment issue with your donation`,
    html,
    plainText,
    emailType: 'Payment Failed Notice',
  });
}

/**
 * Send subscription cancelled confirmation
 */
export async function sendSubscriptionCancelledEmail(data: {
  donorEmail: string;
  donorName: string;
  amount: number;
}): Promise<{ success: boolean }> {
  const { donorEmail, donorName, amount } = data;
  const firstName = donorName.split(' ')[0];

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 24px;">We're Sorry to See You Go, ${firstName}</h2>
      <p style="margin: 0; color: #6b7280; font-size: 16px;">Your recurring donation has been cancelled.</p>
    </div>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0; color: #374151; font-size: 14px;">
        Your $${amount.toFixed(2)} recurring donation has been successfully cancelled. You won't be charged again.
      </p>
    </div>

    <div style="margin-bottom: 24px;">
      <p style="margin: 0 0 12px 0; color: #374151; font-size: 14px;">
        We'd love to know why you decided to cancel. Your feedback helps us serve our donors better.
      </p>
    </div>

    <div style="text-align: center; padding: 24px 0; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px;">
        Changed your mind? You can always start a new donation anytime.
      </p>
      <a href="https://www.qurbani.com" style="display: inline-block; background-color: #d97706; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Donate Again
      </a>
    </div>
  `;

  const html = getEmailWrapper(content, `Your recurring donation has been cancelled.`);

  const plainText = `We're Sorry to See You Go, ${firstName}

Your recurring donation has been cancelled.

Your $${amount.toFixed(2)} recurring donation has been successfully cancelled. You won't be charged again.

We'd love to know why you decided to cancel. Your feedback helps us serve our donors better.

Changed your mind? You can always start a new donation anytime at www.qurbani.com

Qurbani Foundation
www.qurbani.com | donorcare@qurbani.com`;

  return sendEmailAndLogToGHL({
    to: donorEmail,
    subject: `Your recurring donation has been cancelled`,
    html,
    plainText,
    emailType: 'Subscription Cancelled',
  });
}

/**
 * Send refund confirmation email
 */
export async function sendRefundEmail(data: {
  donorEmail: string;
  donorName: string;
  amount: number;
  originalTransactionId?: string;
}): Promise<{ success: boolean }> {
  const { donorEmail, donorName, amount } = data;
  const firstName = donorName.split(' ')[0];

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="width: 64px; height: 64px; background-color: #dbeafe; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 32px;">↩️</span>
      </div>
      <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 24px;">Refund Processed, ${firstName}</h2>
      <p style="margin: 0; color: #6b7280; font-size: 16px;">Your refund has been initiated.</p>
    </div>

    <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center;">
      <p style="margin: 0 0 4px 0; color: #166534; font-size: 14px;">Refund Amount</p>
      <p style="margin: 0; color: #14532d; font-size: 32px; font-weight: bold;">$${amount.toFixed(2)}</p>
    </div>

    <div style="margin-bottom: 24px;">
      <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
        Please allow 5-10 business days for the refund to appear on your statement, depending on your bank.
      </p>
    </div>

    <div style="text-align: center; padding: 24px 0; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        Questions? Contact us at <a href="mailto:donorcare@qurbani.com" style="color: #d97706;">donorcare@qurbani.com</a>
      </p>
    </div>
  `;

  const html = getEmailWrapper(content, `Your $${amount.toFixed(2)} refund has been processed.`);

  const plainText = `Refund Processed, ${firstName}

Your refund has been initiated.

REFUND DETAILS
${'-'.repeat(30)}
Refund Amount: $${amount.toFixed(2)}

Please allow 5-10 business days for the refund to appear on your statement, depending on your bank.

Questions? Contact us at donorcare@qurbani.com

Qurbani Foundation
www.qurbani.com`;

  return sendEmailAndLogToGHL({
    to: donorEmail,
    subject: `Your $${amount.toFixed(2)} refund has been processed`,
    html,
    plainText,
    emailType: 'Refund Confirmation',
  });
}
