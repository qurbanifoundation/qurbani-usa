import type { APIRoute } from 'astro';
import { buildPreferencesUrl, getOrCreatePreferences } from '../../../lib/email-preferences';

export const prerender = false;

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;

/**
 * POST /api/email-preferences/send-link
 *
 * Sends a secure preferences link to the subscriber's email.
 * This verifies email ownership before allowing preference changes.
 *
 * Body: { email: string }
 * Returns: { success: boolean }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!RESEND_API_KEY) {
      console.error('[Email Preferences] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Capture the email in our database immediately (even before they click the link)
    getOrCreatePreferences(normalizedEmail).catch((err: Error) =>
      console.error('[Email Preferences] Failed to capture email:', err.message)
    );

    // Generate the tokenized preferences URL (use request origin so it works on preview + production)
    const origin = new URL(request.url).origin;
    const preferencesUrl = await buildPreferencesUrl(normalizedEmail, undefined, origin);

    // Send the magic link email
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Qurbani Foundation <donations@receipts.qurbani.com>',
        reply_to: 'donorcare@us.qurbani.com',
        to: normalizedEmail,
        subject: 'Manage Your Email Preferences',
        html: buildLinkEmail(preferencesUrl),
        text: `Manage your email preferences: ${preferencesUrl}\n\nThis link will take you to your Qurbani Foundation email preferences page where you can choose which emails you receive.\n\nIf you didn't request this, you can safely ignore this email.\n\nQurbani Foundation USA\n4245 N Central Expy, Dallas, TX 75205\n1-800-900-0027`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Email Preferences] Resend error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send email. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Email Preferences] Magic link sent to ${normalizedEmail}`);
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Email Preferences] Send link error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

function buildLinkEmail(preferencesUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Preferences</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #01534d 0%, #016d5b 100%); padding: 32px; text-align: center;">
              <img src="https://epsjdbnxhmeprjrgcbyw.supabase.co/storage/v1/object/public/media/1771815889576-drvcgb.png" alt="Qurbani Foundation" width="220" style="max-width: 220px; height: auto; display: inline-block;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 16px 0; color: #111827; font-size: 24px; font-weight: bold;">
                Manage Your Email Preferences
              </h1>
              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Click the button below to manage which emails you receive from Qurbani Foundation. You can choose specific categories, adjust frequency, or unsubscribe.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 24px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #01534d, #016d5b); border-radius: 8px; text-align: center;">
                    <a href="${preferencesUrl}" target="_blank" style="display: inline-block; padding: 14px 36px; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; letter-spacing: 0.5px;">
                      Update My Preferences
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
                If you didn't request this email, you can safely ignore it. Your current preferences won't change.
              </p>
            </td>
          </tr>

          <!-- Footer -->
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
                      1-800-900-0027 &middot; +1 989-QURBANI (787-2265)
                    </p>
                    <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                      Please do not reply to this email. Contact <a href="mailto:donorcare@us.qurbani.com" style="color: #d97706; text-decoration: none;">donorcare@us.qurbani.com</a> for any inquiries.
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
