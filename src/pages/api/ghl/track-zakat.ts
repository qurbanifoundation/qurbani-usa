/**
 * Track Zakat Calculator Results + Send Detailed Email
 *
 * HIGH-INTENT lead capture endpoint.
 * When someone calculates their Zakat and provides their email,
 * they're showing strong intent to fulfill their obligation.
 *
 * Now also sends a detailed Zakat calculation email with:
 * - Full asset/liability breakdown
 * - Nisab comparison
 * - Net wealth
 * - Zakat amount due
 * - "Pay Your Zakat" CTA button
 */
import type { APIRoute } from 'astro';
import { trackZakatCalculation } from '../../../lib/ghl-advanced';
import { supabaseAdmin } from '../../../lib/supabase';

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;

export const prerender = false;

// Format currency
function fmtCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Build the Zakat calculation email HTML
function buildZakatEmail(data: {
  firstName?: string;
  zakatAmount: number;
  totalAssets: number;
  totalLiabilities: number;
  netWealth: number;
  nisabType: string;
  nisabValue: number;
  assetsBreakdown: Array<{ label: string; amount: number }>;
  liabilitiesBreakdown: Array<{ label: string; amount: number }>;
}): string {
  const logoUrl = 'https://epsjdbnxhmeprjrgcbyw.supabase.co/storage/v1/object/public/media/1771815889576-drvcgb.png';
  const name = data.firstName || 'there';
  const zakatDue = data.zakatAmount > 0;
  const payUrl = `https://www.qurbani.com/zakat?amount=${data.zakatAmount.toFixed(2)}`;
  const nisabLabel = data.nisabType === 'gold' ? 'Gold' : 'Silver';
  const nisabGrams = data.nisabType === 'gold' ? '87.48' : '612.36';

  // Build assets rows
  let assetsRows = '';
  if (data.assetsBreakdown && data.assetsBreakdown.length > 0) {
    data.assetsBreakdown.forEach(item => {
      assetsRows += `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #555; border-bottom: 1px solid #f3f4f6;">${item.label}</td>
          <td style="padding: 8px 0; font-size: 14px; color: #1f2937; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${fmtCurrency(item.amount)}</td>
        </tr>`;
    });
  } else {
    assetsRows = `<tr><td colspan="2" style="padding: 8px 0; font-size: 14px; color: #999; font-style: italic;">No assets entered</td></tr>`;
  }

  // Build liabilities rows
  let liabilitiesRows = '';
  if (data.liabilitiesBreakdown && data.liabilitiesBreakdown.length > 0) {
    data.liabilitiesBreakdown.forEach(item => {
      liabilitiesRows += `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #555; border-bottom: 1px solid #f3f4f6;">${item.label}</td>
          <td style="padding: 8px 0; font-size: 14px; color: #1f2937; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${fmtCurrency(item.amount)}</td>
        </tr>`;
    });
  } else {
    liabilitiesRows = `<tr>
      <td style="padding: 8px 0; font-size: 14px; color: #999;">No liabilities</td>
      <td style="padding: 8px 0; font-size: 14px; color: #1f2937; font-weight: 600; text-align: right;">$0.00</td>
    </tr>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Zakat Calculation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
    <tr><td align="center" style="padding: 30px 15px;">

      <!-- Main Card -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

        <!-- Header with Logo -->
        <tr>
          <td style="background: linear-gradient(135deg, #e1861d 0%, #b45309 100%); padding: 30px 30px 20px; text-align: center;">
            <img src="${logoUrl}" alt="Qurbani Foundation" width="180" style="width: 180px; max-width: 100%; height: auto; display: inline-block;" />
            <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 8px 0 0; letter-spacing: 1px;">SERVING HUMANITY THROUGH FAITH</p>
          </td>
        </tr>

        <!-- Zakat Amount Banner -->
        <tr>
          <td style="padding: 24px 30px 0; text-align: center;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;">
              <tr>
                <td style="padding: 14px 20px; text-align: center;">
                  <p style="color: #92400e; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 1px;">${zakatDue ? 'Your Zakat Due' : 'Zakat Calculation'}</p>
                  <p style="color: #b45309; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2;">${fmtCurrency(data.zakatAmount)}</p>
                  <p style="color: #92400e; font-size: 11px; margin: 4px 0 0;">2.5% of net zakatable wealth</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding: 30px 30px 10px;">
            <p style="font-size: 16px; color: #333; margin: 0;">Assalamu Alaikum ${name},</p>
            <p style="font-size: 14px; color: #666; margin: 10px 0 0; line-height: 1.6;">
              ${zakatDue
                ? 'Here is your detailed Zakat calculation. Your net wealth exceeds the Nisab threshold, making Zakat obligatory.'
                : 'Here is your detailed Zakat calculation. Your net wealth is currently below the Nisab threshold.'}
            </p>
          </td>
        </tr>

        <!-- Assets Breakdown -->
        <tr>
          <td style="padding: 20px 30px 0;">
            <p style="font-size: 13px; font-weight: 700; color: #d97706; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px; border-bottom: 2px solid #d97706; padding-bottom: 6px;">Assets</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${assetsRows}
              <tr style="border-top: 2px solid #e5e7eb;">
                <td style="padding: 12px 0 0; font-size: 14px; color: #1f2937; font-weight: 700;">Total Assets</td>
                <td style="padding: 12px 0 0; font-size: 14px; color: #1f2937; font-weight: 700; text-align: right;">${fmtCurrency(data.totalAssets)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Liabilities Breakdown -->
        <tr>
          <td style="padding: 20px 30px 0;">
            <p style="font-size: 13px; font-weight: 700; color: #B32629; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px; border-bottom: 2px solid #B32629; padding-bottom: 6px;">Liabilities (Deductions)</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${liabilitiesRows}
              <tr style="border-top: 2px solid #e5e7eb;">
                <td style="padding: 12px 0 0; font-size: 14px; color: #1f2937; font-weight: 700;">Total Liabilities</td>
                <td style="padding: 12px 0 0; font-size: 14px; color: #B32629; font-weight: 700; text-align: right;">-${fmtCurrency(data.totalLiabilities)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Net Wealth + Nisab -->
        <tr>
          <td style="padding: 25px 30px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 12px; overflow: hidden;">
              <tr>
                <td style="padding: 16px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size: 13px; color: #666; padding-bottom: 8px;">Net Wealth (Assets − Liabilities)</td>
                      <td style="font-size: 16px; color: #1f2937; font-weight: 700; text-align: right; padding-bottom: 8px;">${fmtCurrency(data.netWealth)}</td>
                    </tr>
                    <tr>
                      <td style="font-size: 13px; color: #666; padding-top: 8px; border-top: 1px solid #e5e7eb;">Nisab Threshold (${nisabLabel}, ${nisabGrams}g)</td>
                      <td style="font-size: 14px; color: #666; font-weight: 600; text-align: right; padding-top: 8px; border-top: 1px solid #e5e7eb;">${fmtCurrency(data.nisabValue)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Status Badge -->
        <tr>
          <td style="padding: 16px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background: ${zakatDue ? '#ecfdf5' : '#fef3c7'}; border-radius: 10px; padding: 12px 16px; text-align: center;">
                  <p style="font-size: 14px; font-weight: 600; color: ${zakatDue ? '#065f46' : '#92400e'}; margin: 0;">
                    ${zakatDue ? '✓ Above Nisab — Zakat is obligatory' : '⚠ Below Nisab — Zakat is not yet obligatory'}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${zakatDue ? `
        <!-- Zakat Summary Box -->
        <tr>
          <td style="padding: 0 30px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;">
              <tr>
                <td style="padding: 14px 20px; text-align: center;">
                  <p style="color: #92400e; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 1px;">Your Zakat Due (2.5%)</p>
                  <p style="color: #b45309; font-size: 26px; font-weight: 700; margin: 0;">${fmtCurrency(data.zakatAmount)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Pay Zakat CTA Button -->
        <tr>
          <td style="padding: 0 30px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${payUrl}" style="display: inline-block; background: linear-gradient(135deg, #d97706, #b45309); color: #ffffff; font-size: 18px; font-weight: 700; text-decoration: none; padding: 16px 50px; border-radius: 12px; text-align: center; width: 100%; max-width: 400px; box-sizing: border-box;">
                    Pay Your Zakat Now →
                  </a>
                </td>
              </tr>
              <tr>
                <td style="text-align: center; padding-top: 8px;">
                  <p style="font-size: 12px; color: #999; margin: 0;">100% of your Zakat goes directly to eligible recipients</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ` : ''}

        <!-- Footer -->
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

      <!-- Quran Verse Footer -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr>
          <td style="padding: 24px 20px; text-align: center;">
            <p style="font-size: 13px; color: #888; font-style: italic; line-height: 1.5; margin: 0;">
              "Those who (in charity) spend of their goods by night and by day, in secret and in public, have their reward with their Lord."
              <br><span style="font-style: normal; font-size: 12px; color: #aaa;">(Al-Quran, 2:274)</span>
            </p>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      email,
      firstName,
      lastName,
      phone,
      zakatAmount,
      totalAssets,
      totalLiabilities,
      netWealth,
      nisabType,
      nisabValue,
      assetsBreakdown,
      liabilitiesBreakdown,
      wantsReminder
    } = body;

    // Validate required fields
    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (typeof zakatAmount !== 'number' || zakatAmount < 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Valid Zakat amount is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Track the Zakat calculation in GHL (with full breakdown)
    const result = await trackZakatCalculation({
      email,
      firstName,
      lastName,
      phone,
      zakatAmount,
      totalAssets: totalAssets || 0,
      totalLiabilities: totalLiabilities || 0,
      netWealth: netWealth || 0,
      nisabType: nisabType || 'silver',
      nisabValue: nisabValue || 0,
      assetsBreakdown: assetsBreakdown || [],
      liabilitiesBreakdown: liabilitiesBreakdown || [],
      wantsReminder: wantsReminder || false,
    });

    if (!result.success) {
      console.error('Track Zakat failed:', result.error);
    }

    // Send detailed email via Resend
    let emailSent = false;
    try {
      if (RESEND_API_KEY) {
        const emailHtml = buildZakatEmail({
          firstName: firstName || '',
          zakatAmount: zakatAmount || 0,
          totalAssets: totalAssets || 0,
          totalLiabilities: totalLiabilities || 0,
          netWealth: netWealth || 0,
          nisabType: nisabType || 'silver',
          nisabValue: nisabValue || 0,
          assetsBreakdown: assetsBreakdown || [],
          liabilitiesBreakdown: liabilitiesBreakdown || [],
        });

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Qurbani Foundation <donations@receipts.qurbani.com>',
            reply_to: 'donorcare@qurbani.com',
            to: [email],
            subject: zakatAmount > 0
              ? `Your Zakat Calculation: ${fmtCurrency(zakatAmount)} Due`
              : 'Your Zakat Calculation — Qurbani Foundation',
            html: emailHtml,
          }),
        });

        if (emailRes.ok) {
          emailSent = true;
          console.log(`[Zakat Email] Sent to ${email} — Zakat: ${fmtCurrency(zakatAmount)}`);
        } else {
          const errData = await emailRes.text();
          console.error('[Zakat Email] Failed:', errData);
        }
      } else {
        console.error('[Zakat Email] RESEND_API_KEY not configured');
      }
    } catch (emailErr: any) {
      console.error('[Zakat Email] Error:', emailErr.message);
    }

    // Queue follow-up drip emails (steps 2-4)
    try {
      const payUrl = `https://www.qurbani.com/zakat?amount=${zakatAmount.toFixed(2)}`;

      // Upsert: if they recalculate, update the data and reset the drip
      const { error: queueError } = await supabaseAdmin
        .from('zakat_email_queue')
        .upsert({
          email,
          first_name: firstName || null,
          last_name: lastName || null,
          zakat_amount: zakatAmount,
          total_assets: totalAssets || 0,
          total_liabilities: totalLiabilities || 0,
          net_wealth: netWealth || 0,
          nisab_type: nisabType || 'silver',
          nisab_value: nisabValue || 0,
          assets_breakdown: assetsBreakdown || [],
          liabilities_breakdown: liabilitiesBreakdown || [],
          pay_url: payUrl,
          drip_step_last_sent: 1,
          drip_last_sent_at: new Date().toISOString(),
          status: 'active',
          created_at: new Date().toISOString(),
        }, {
          onConflict: 'email',
          ignoreDuplicates: false,
        });

      if (queueError) {
        // If upsert fails due to no unique constraint on email, do insert
        // with manual dedup
        const { data: existing } = await supabaseAdmin
          .from('zakat_email_queue')
          .select('id')
          .eq('email', email)
          .eq('status', 'active')
          .limit(1)
          .single();

        if (existing) {
          await supabaseAdmin
            .from('zakat_email_queue')
            .update({
              first_name: firstName || null,
              last_name: lastName || null,
              zakat_amount: zakatAmount,
              total_assets: totalAssets || 0,
              total_liabilities: totalLiabilities || 0,
              net_wealth: netWealth || 0,
              nisab_type: nisabType || 'silver',
              nisab_value: nisabValue || 0,
              assets_breakdown: assetsBreakdown || [],
              liabilities_breakdown: liabilitiesBreakdown || [],
              pay_url: payUrl,
              drip_step_last_sent: 1,
              drip_last_sent_at: new Date().toISOString(),
              status: 'active',
              created_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabaseAdmin
            .from('zakat_email_queue')
            .insert({
              email,
              first_name: firstName || null,
              last_name: lastName || null,
              zakat_amount: zakatAmount,
              total_assets: totalAssets || 0,
              total_liabilities: totalLiabilities || 0,
              net_wealth: netWealth || 0,
              nisab_type: nisabType || 'silver',
              nisab_value: nisabValue || 0,
              assets_breakdown: assetsBreakdown || [],
              liabilities_breakdown: liabilitiesBreakdown || [],
              pay_url: payUrl,
              drip_step_last_sent: 1,
              drip_last_sent_at: new Date().toISOString(),
              status: 'active',
            });
        }
        console.log(`[Zakat Queue] Queued drip emails for ${email} (fallback method)`);
      } else {
        console.log(`[Zakat Queue] Queued drip emails for ${email}`);
      }
    } catch (queueErr: any) {
      // Non-fatal: don't fail the whole request if queue fails
      console.error('[Zakat Queue] Error:', queueErr.message);
    }

    return new Response(JSON.stringify({
      success: result.success,
      emailSent,
      leadScore: result.leadScore,
      error: result.error,
      message: result.success
        ? 'Your Zakat calculation has been saved and emailed.'
        : `Failed to save: ${result.error || 'Unknown error'}`
    }), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Track Zakat error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
