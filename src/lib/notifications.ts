/**
 * Unified Notification System
 * Sends alerts via Email (Resend) + GoHighLevel
 */

import { supabaseAdmin } from './supabase';

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const ADMIN_EMAIL = import.meta.env.ADMIN_EMAIL || 'admin@qurbani.com';
const GHL_API_KEY = import.meta.env.GHL_API_KEY;
const GHL_LOCATION_ID = import.meta.env.GHL_LOCATION_ID;

// Notification types
export type NotificationType =
  | 'donation_received'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'subscription_paused'
  | 'subscription_resumed'
  | 'payment_failed'
  | 'refund_processed'
  | 'dispute_created'
  | 'dispute_closed';

interface NotificationData {
  type: NotificationType;
  title: string;
  message: string;
  amount?: number;
  donorName?: string;
  donorEmail?: string;
  metadata?: Record<string, any>;
  attribution?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    checkout_source?: string;
    journey?: any;
  };
  donorHistory?: {
    donation_count: number;
    lifetime_total: number;
    first_donation: string | null;
    last_donation: string | null;
  };
}

// Emoji and color mapping for notification types
const notificationConfig: Record<NotificationType, { emoji: string; severity: string; color: string }> = {
  donation_received: { emoji: '💰', severity: 'success', color: '#22c55e' },
  subscription_started: { emoji: '🔄', severity: 'success', color: '#3b82f6' },
  subscription_cancelled: { emoji: '❌', severity: 'warning', color: '#f59e0b' },
  subscription_paused: { emoji: '⏸️', severity: 'info', color: '#6b7280' },
  subscription_resumed: { emoji: '▶️', severity: 'success', color: '#22c55e' },
  payment_failed: { emoji: '⚠️', severity: 'error', color: '#ef4444' },
  refund_processed: { emoji: '↩️', severity: 'warning', color: '#f59e0b' },
  dispute_created: { emoji: '🚨', severity: 'critical', color: '#dc2626' },
  dispute_closed: { emoji: '✅', severity: 'info', color: '#6b7280' },
};

/**
 * Send notification through all channels:
 * 1. Database (admin dashboard)
 * 2. Admin email (Resend)
 * 3. GHL admin contact note
 */
export async function sendNotification(data: NotificationData): Promise<void> {
  const config = notificationConfig[data.type];

  // Run all notifications in parallel
  await Promise.allSettled([
    // 1. Save to database (for admin dashboard)
    saveToDatabase(data, config),

    // 2. Send admin email via Resend
    sendEmail(data, config),

    // 3. Add note to GHL admin contact
    sendToGHL(data, config),
  ]);
}

/**
 * Save notification to database
 */
async function saveToDatabase(data: NotificationData, config: { severity: string }): Promise<void> {
  try {
    await supabaseAdmin.from('admin_notifications').insert({
      type: data.type,
      title: data.title,
      message: data.message,
      severity: config.severity,
      metadata: {
        amount: data.amount,
        donor_name: data.donorName,
        donor_email: data.donorEmail,
        ...data.metadata,
      },
      read: false,
    });
  } catch (error) {
    console.error('Failed to save notification to database:', error);
  }
}

/**
 * Send email via Resend
 */
async function sendEmail(data: NotificationData, config: { emoji: string; color: string }): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log('Resend API key not configured, skipping email');
    return;
  }

  try {
    const amountDisplay = data.amount ? `$${data.amount.toFixed(2)}` : '';

    // Build items list for display
    const itemsList = data.metadata?.items || [];
    const campaignName = itemsList.length > 0
      ? itemsList.map((i: { name: string }) => i.name).join(', ')
      : (data.metadata?.campaign || 'General Donation');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f3ef; font-family: Georgia, 'Times New Roman', serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f3ef;">
          <tr>
            <td align="center" style="padding: 30px 15px;">
              <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%;">

                <!-- HEADER -->
                <tr>
                  <td style="padding-bottom: 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="left" valign="middle" style="width: 50%;">
                          <a href="https://www.qurbani.com" style="text-decoration: none;">
                            <img src="https://epsjdbnxhmeprjrgcbyw.supabase.co/storage/v1/object/public/media/1771815947323-nkje6c.png"
                                 alt="Qurbani Foundation" width="160" style="max-width: 160px; height: auto; display: inline-block;" />
                          </a>
                        </td>
                        <td align="right" valign="middle" style="width: 50%; font-family: Arial, Helvetica, sans-serif;">
                          <a href="https://www.qurbani.com/admin" style="display: inline-block; background-color: #ef7c01; color: #ffffff; text-decoration: none; padding: 8px 18px; font-size: 13px; font-weight: 700; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">ADMIN</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- BODY -->
                <tr>
                  <td style="background-color: #ffffff; padding: 36px 40px; border-radius: 6px;">

                    <!-- Title -->
                    <h1 style="margin: 0 0 24px; color: #ef7c01; font-size: 22px; line-height: 1.3; font-weight: 700;">
                      ${data.title}
                    </h1>

                    ${(() => {
                      // ══════════════════════════════════════════════════
                      // Shared helpers
                      // ══════════════════════════════════════════════════
                      const na = '<span style="color: #ccc;">N/A</span>';
                      const row = (label: string, value: string) => `<tr><td style="padding: 4px 0; color: #888; font-size: 13px; width: 150px; vertical-align: top; font-family: Arial, Helvetica, sans-serif;">${label}</td><td style="padding: 4px 0; color: #1a1a1a; font-size: 13px; font-family: Arial, Helvetica, sans-serif;">${value || na}</td></tr>`;
                      const mono = (v: string) => v ? `<span style="font-family: monospace; font-size: 12px; background: #f5f3ef; padding: 1px 6px; border-radius: 3px;">${v}</span>` : na;
                      const sectionHeader = (title: string) => `<div style="border-top: 1px solid #e8e5e0; margin: 20px 0 12px;"></div><p style="margin: 0 0 10px; color: #ef7c01; font-size: 14px; font-weight: 700; font-family: Arial, Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">${title}</p>`;
                      const subHeader = (title: string) => `<p style="margin: 0 0 6px; color: #374151; font-size: 12px; font-weight: 700; font-family: Arial, Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">${title}</p>`;

                      const checkoutLabel = data.attribution?.checkout_source === 'social-proof-popup' ? 'Social Proof Popup' :
                        data.attribution?.checkout_source === 'gg-one-step-checkout' ? 'One-Step Checkout' :
                        data.attribution?.checkout_source === 'three-step-checkout' ? 'Three-Step Checkout' :
                        data.attribution?.checkout_source === 'two-step-checkout' ? 'Two-Step Checkout' :
                        data.attribution?.checkout_source || na;

                      // Parse journey
                      const a = data.attribution || {};
                      const j = typeof a.journey === 'string' ? JSON.parse(a.journey) : (a.journey || {});
                      const ft = j?.first_touch || {};
                      const lt = j?.last_touch || {};
                      const ftUtm = ft.utm || {};
                      const ltUtm = lt.utm || {};
                      const checkout = j?.checkout || {};
                      const hasPages = j?.pages && j.pages.length > 0;

                      // Source label helper
                      function sourceLabel(touch: any, utm: any) {
                        if (touch?.gclid) return 'Google Ads';
                        if (touch?.fbclid) return 'Facebook Ads';
                        if (utm?.utm_source === 'email' || utm?.utm_source === 'ghl') return 'Email Campaign';
                        if (utm?.utm_source) return utm.utm_source.charAt(0).toUpperCase() + utm.utm_source.slice(1);
                        if (touch?.referrer && touch.referrer !== 'direct') {
                          try { return new URL(touch.referrer).hostname; } catch { return touch.referrer; }
                        }
                        return 'Direct';
                      }

                      const firstSource = sourceLabel(ft, ftUtm);
                      const lastSource = sourceLabel(lt, ltUtm);

                      // Deduplicated values
                      const ftCampaign = ft.campaignid || ftUtm.utm_campaign || '';
                      const ftKeyword = ft.keyword || ftUtm.utm_term || '';
                      const ltCampaign = lt.campaignid || ltUtm.utm_campaign || '';
                      const ltKeyword = lt.keyword || ltUtm.utm_term || '';

                      // Ad details — use whichever touch has Google Ads data
                      const adTouch = (ft.gclid || ft.matchtype || ft.network) ? ft : (lt.gclid || lt.matchtype || lt.network) ? lt : null;
                      const mapMatch = (m: string) => m === 'e' ? 'Exact' : m === 'p' ? 'Phrase' : m === 'b' ? 'Broad' : m;
                      const mapNetwork = (n: string) => n === 'g' ? 'Google Search' : n === 'd' ? 'Display Network' : n === 'y' ? 'YouTube' : n;
                      const mapDevice = (d: string) => d === 'm' ? 'Mobile' : d === 'c' ? 'Computer' : d === 't' ? 'Tablet' : d;

                      // Timing
                      const sessionStart = j?.session_started ? new Date(j.session_started).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
                      const donationStart = checkout.donation_started_at ? new Date(checkout.donation_started_at).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
                      const timeToDonateSec = (j?.session_started && checkout.donation_started_at) ? Math.round((checkout.donation_started_at - j.session_started) / 1000) : 0;
                      const timeToStr = timeToDonateSec > 0 ? (timeToDonateSec >= 60 ? Math.floor(timeToDonateSec / 60) + 'm ' + (timeToDonateSec % 60) + 's' : timeToDonateSec + 's') : '';

                      // Journey pages
                      const displayPages = hasPages ? j.pages.slice(-10) : [];
                      const pagePath = displayPages.map((pg: { p: string }) => pg.p).join(' → ');
                      const pageRows = displayPages.map((pg: { p: string; t: number }) => {
                        const time = new Date(pg.t).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
                        return `<tr><td style="padding: 2px 8px; color: #374151; font-size: 12px; font-family: monospace;">${pg.p}</td><td style="padding: 2px 8px; color: #9ca3af; font-size: 11px; white-space: nowrap; text-align: right;">${time}</td></tr>`;
                      }).join('');

                      // Donor history
                      const hist = data.donorHistory || { donation_count: 0, lifetime_total: 0, first_donation: null, last_donation: null };
                      const formatCurrency = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      const formatDate = (d: string | null) => d ? new Date(d).toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric' }) : na;
                      const isMajorDonor = (data.amount && data.amount >= 500) || (hist.lifetime_total >= 1000);
                      const isToday = (d: string | null) => {
                        if (!d) return false;
                        const dt = new Date(d);
                        const now = new Date();
                        return dt.toDateString() === now.toDateString();
                      };

                      return `
                      <!-- ════════════════════════════════════════ -->
                      <!-- SECTION 1: DONATION DETAILS             -->
                      <!-- ════════════════════════════════════════ -->
                      <table style="width: 100%; border-collapse: collapse; margin: 0 0 4px;">
                        ${row('Donor Name', data.donorName ? '<strong>' + data.donorName + '</strong>' : na)}
                        ${row('Email', data.donorEmail || na)}
                        ${row('Amount', amountDisplay ? '<strong style="font-size: 15px;">' + amountDisplay + '</strong>' : na)}
                        ${row('Campaign', campaignName)}
                        ${row('Type', data.metadata?.typeLabel || 'One-time')}
                        ${row('Checkout', checkoutLabel)}
                      </table>

                      <!-- ════════════════════════════════════════ -->
                      <!-- SECTION 2: ATTRIBUTION                  -->
                      <!-- ════════════════════════════════════════ -->
                      ${sectionHeader('Attribution')}

                      ${subHeader('First Touch')}
                      <table style="width: 100%; border-collapse: collapse; margin: 0 0 14px;">
                        ${row('Source', firstSource)}
                        ${row('Landing Page', ft.landing_page || na)}
                        ${row('Referrer', (ft.referrer && ft.referrer !== 'direct') ? ft.referrer : na)}
                        ${row('Campaign', ftCampaign ? mono(ftCampaign) : na)}
                        ${row('Keyword', ftKeyword ? '<strong>' + ftKeyword + '</strong>' : na)}
                      </table>

                      ${subHeader('Last Touch')}
                      <table style="width: 100%; border-collapse: collapse; margin: 0 0 4px;">
                        ${row('Source', lastSource)}
                        ${row('Conversion Page', lt.landing_page || na)}
                        ${row('Referrer', (lt.referrer && lt.referrer !== 'direct') ? lt.referrer : na)}
                        ${row('Campaign', ltCampaign ? mono(ltCampaign) : na)}
                        ${row('Keyword', ltKeyword ? '<strong>' + ltKeyword + '</strong>' : na)}
                      </table>

                      <!-- ════════════════════════════════════════ -->
                      <!-- SECTION 3: AD DETAILS                   -->
                      <!-- ════════════════════════════════════════ -->
                      ${sectionHeader('Ad Details')}
                      <table style="width: 100%; border-collapse: collapse; margin: 0 0 4px;">
                        ${row('Match Type', adTouch?.matchtype ? mapMatch(adTouch.matchtype) : na)}
                        ${row('Network', adTouch?.network ? mapNetwork(adTouch.network) : na)}
                        ${row('Device', adTouch?.device ? mapDevice(adTouch.device) : (j?.device ? j.device.charAt(0).toUpperCase() + j.device.slice(1) : na))}
                        ${row('OS / Platform', j?.os ? j.os : na)}
                        ${row('Browser', j?.browser ? j.browser : na)}
                        ${row('Google Click ID', adTouch?.gclid ? '<span style="font-family: monospace; font-size: 11px; color: #6b7280;">' + adTouch.gclid.substring(0, 28) + '...</span>' : na)}
                        ${row('Creative ID', adTouch?.creative ? mono(adTouch.creative) : na)}
                        ${row('Campaign ID', (adTouch?.campaignid || ft.campaignid || lt.campaignid) ? mono(adTouch?.campaignid || ft.campaignid || lt.campaignid) : na)}
                        ${row('Ad Group ID', (adTouch?.adgroupid || ft.adgroupid || lt.adgroupid) ? mono(adTouch?.adgroupid || ft.adgroupid || lt.adgroupid) : na)}
                        ${row('Location Interest ID', adTouch?.loc_interest ? mono(adTouch.loc_interest) : na)}
                        ${row('Physical Location ID', adTouch?.loc_physical ? mono(adTouch.loc_physical) : na)}
                      </table>

                      <!-- ════════════════════════════════════════ -->
                      <!-- SECTION 4: JOURNEY                      -->
                      <!-- ════════════════════════════════════════ -->
                      ${sectionHeader('Journey')}
                      ${hasPages ? `
                        <p style="margin: 0 0 8px; color: #374151; font-size: 13px; line-height: 1.6; font-family: Arial, Helvetica, sans-serif;">${pagePath}</p>
                        <div style="background: #f5f3ef; border-radius: 4px; padding: 8px; overflow-x: auto; margin: 0 0 8px;">
                          <table style="width: 100%; border-collapse: collapse;">
                            ${pageRows}
                          </table>
                        </div>
                        <table style="width: 100%; border-collapse: collapse;">
                          ${row('Pages Viewed', String(j.pages.length))}
                          ${row('Conversion Page', checkout.last_page_before_checkout || lt.landing_page || na)}
                          ${row('Session Started', sessionStart ? sessionStart + ' ET' : na)}
                          ${row('Checkout Started', donationStart ? donationStart + ' ET' : na)}
                          ${row('Time to Donate', timeToStr || na)}
                        </table>
                      ` : `
                        <table style="width: 100%; border-collapse: collapse;">
                          ${row('Pages Viewed', na)}
                          ${row('Session Started', na)}
                        </table>
                      `}

                      <!-- ════════════════════════════════════════ -->
                      <!-- SECTION 5: DONOR HISTORY                -->
                      <!-- ════════════════════════════════════════ -->
                      ${sectionHeader('Donor History')}
                      <table style="width: 100%; border-collapse: collapse; margin: 0 0 4px;">
                        ${row('Lifetime Donations', hist.donation_count > 0 ? '<strong>' + formatCurrency(hist.lifetime_total) + '</strong>' : na)}
                        ${row('Donation Count', hist.donation_count > 0 ? String(hist.donation_count) : na)}
                        ${row('First Donation', formatDate(hist.first_donation))}
                        ${row('Last Donation', hist.last_donation ? (isToday(hist.last_donation) ? 'Today' : formatDate(hist.last_donation)) : na)}
                        ${row('Major Donor', isMajorDonor
                          ? '<span style="display: inline-block; background: #ef7c01; color: #fff; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 700;">Yes</span>'
                          : 'No'
                        )}
                      </table>
                      `;
                    })()}
                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td style="padding: 24px 20px; text-align: center;">
                    <p style="margin: 0 0 4px; color: #999; font-size: 12px; font-family: Arial, sans-serif; line-height: 1.6;">
                      <strong>Qurbani Foundation USA</strong> &mdash; Admin Notification
                    </p>
                    <p style="margin: 0; color: #bbb; font-size: 11px; font-family: Arial, sans-serif; line-height: 1.6;">
                      ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET
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

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Qurbani USA <notifications@receipts.qurbani.com>',
        to: ADMIN_EMAIL,
        subject: `${config.emoji} ${data.title} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })}`,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend email failed:', error);
    } else {
      console.log('Admin notification email sent');
    }
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

/**
 * Send notification to GHL (add note to admin contact or trigger workflow)
 */
async function sendToGHL(data: NotificationData, config: { emoji: string }): Promise<void> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    console.log('GHL not configured, skipping');
    return;
  }

  try {
    // Find or create admin notification contact
    const adminEmail = 'admin-alerts@qurbani.com';

    // Search for admin contact
    const searchRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(adminEmail)}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28',
        },
      }
    );

    let contactId: string | null = null;

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      contactId = searchData.contact?.id;
    }

    // Create admin contact if doesn't exist
    if (!contactId) {
      const createRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: adminEmail,
          firstName: 'Admin',
          lastName: 'Notifications',
          locationId: GHL_LOCATION_ID,
          tags: ['system', 'admin-alerts'],
        }),
      });

      if (createRes.ok) {
        const createData = await createRes.json();
        contactId = createData.contact?.id;
      }
    }

    // Add note to admin contact
    if (contactId) {
      const amountStr = data.amount ? ` - $${data.amount.toFixed(2)}` : '';
      const noteBody = `${config.emoji} ${data.title}${amountStr}\n\n${data.message}\n\n${data.donorName ? `Donor: ${data.donorName}` : ''}${data.donorEmail ? ` (${data.donorEmail})` : ''}\n\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`;

      await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: noteBody }),
      });

      console.log('GHL notification note added');
    }
  } catch (error) {
    console.error('Failed to send GHL notification:', error);
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

export async function notifyDonationReceived(donation: {
  amount: number;
  donorName: string;
  donorEmail: string;
  items?: Array<{ name: string; amount?: number; quantity?: number; type?: string }>;
  type?: string;
  recurringAmount?: number;
  onetimeAmount?: number;
  attribution?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    checkout_source?: string;
    journey?: any;
  };
  donorHistory?: {
    donation_count: number;
    lifetime_total: number;
    first_donation: string | null;
    last_donation: string | null;
  };
}): Promise<void> {
  // Build per-item breakdown with frequency labels
  const itemDetails = donation.items?.map(i => {
    const t = (i.type || 'single').toLowerCase();
    const freqLabel = t === 'monthly' ? '/mo' : t === 'weekly' ? '/wk' : t === 'yearly' ? '/yr' : t === 'daily' ? '/day' : '';
    const itemTotal = (i.amount || 0) * (i.quantity || 1);
    return `${i.name} — $${itemTotal.toFixed(2)}${freqLabel}`;
  }).join(', ') || 'General Donation';

  const typeLabel = donation.type === 'mixed' ? 'Mixed (One-Time + Recurring)' : donation.type === 'monthly' ? 'Monthly' : donation.type === 'weekly' ? 'Jummah' : 'One-time';

  // Build breakdown message
  let amountBreakdown = `$${donation.amount.toFixed(2)}`;
  if (donation.recurringAmount && donation.onetimeAmount && donation.onetimeAmount > 0) {
    amountBreakdown += ` ($${donation.onetimeAmount.toFixed(2)} one-time + $${donation.recurringAmount.toFixed(2)} recurring)`;
  }

  await sendNotification({
    type: 'donation_received',
    title: 'New Donation Received',
    message: `${typeLabel} donation of ${amountBreakdown} received.\nItems: ${itemDetails}`,
    amount: donation.amount,
    donorName: donation.donorName,
    donorEmail: donation.donorEmail,
    attribution: donation.attribution,
    donorHistory: donation.donorHistory,
    metadata: {
      items: donation.items,
      typeLabel,
    },
  });
}

export async function notifySubscriptionStarted(subscription: {
  amount: number;
  donorName: string;
  donorEmail: string;
  interval: string;
}): Promise<void> {
  const intervalLabel = subscription.interval === 'weekly' ? 'Jummah (Weekly)' : 'Monthly';

  await sendNotification({
    type: 'subscription_started',
    title: 'New Recurring Donor!',
    message: `${subscription.donorName} started a ${intervalLabel} recurring donation of $${subscription.amount.toFixed(2)}`,
    amount: subscription.amount,
    donorName: subscription.donorName,
    donorEmail: subscription.donorEmail,
    metadata: { interval: subscription.interval },
  });
}

export async function notifySubscriptionCancelled(subscription: {
  amount: number;
  donorName: string;
  donorEmail: string;
}): Promise<void> {
  await sendNotification({
    type: 'subscription_cancelled',
    title: 'Subscription Cancelled',
    message: `${subscription.donorName} cancelled their recurring donation of $${subscription.amount.toFixed(2)}`,
    amount: subscription.amount,
    donorName: subscription.donorName,
    donorEmail: subscription.donorEmail,
  });
}

export async function notifyPaymentFailed(data: {
  amount: number;
  donorName: string;
  donorEmail: string;
  reason?: string;
}): Promise<void> {
  await sendNotification({
    type: 'payment_failed',
    title: 'Payment Failed',
    message: `Payment of $${data.amount.toFixed(2)} from ${data.donorName} failed.${data.reason ? ` Reason: ${data.reason}` : ''}`,
    amount: data.amount,
    donorName: data.donorName,
    donorEmail: data.donorEmail,
    metadata: { reason: data.reason },
  });
}

export async function notifyRefund(data: {
  amount: number;
  donorName?: string;
  donorEmail?: string;
  chargeId: string;
}): Promise<void> {
  await sendNotification({
    type: 'refund_processed',
    title: 'Refund Processed',
    message: `Refund of $${data.amount.toFixed(2)} processed${data.donorName ? ` for ${data.donorName}` : ''}.`,
    amount: data.amount,
    donorName: data.donorName,
    donorEmail: data.donorEmail,
    metadata: { charge_id: data.chargeId },
  });
}

export async function notifyDispute(data: {
  amount: number;
  donorName?: string;
  donorEmail?: string;
  reason: string;
  disputeId: string;
  evidenceDueBy?: string;
}): Promise<void> {
  await sendNotification({
    type: 'dispute_created',
    title: 'CHARGEBACK ALERT',
    message: `A dispute for $${data.amount.toFixed(2)} has been filed! Reason: ${data.reason}. ${data.evidenceDueBy ? `Evidence due by: ${data.evidenceDueBy}` : ''}`,
    amount: data.amount,
    donorName: data.donorName,
    donorEmail: data.donorEmail,
    metadata: {
      dispute_id: data.disputeId,
      reason: data.reason,
      evidence_due_by: data.evidenceDueBy,
    },
  });
}

export async function notifyDisputeClosed(data: {
  amount: number;
  won: boolean;
  disputeId: string;
}): Promise<void> {
  await sendNotification({
    type: 'dispute_closed',
    title: data.won ? 'Dispute Won!' : 'Dispute Lost',
    message: data.won
      ? `Great news! The dispute for $${data.amount.toFixed(2)} has been resolved in your favor. Funds retained.`
      : `The dispute for $${data.amount.toFixed(2)} was lost. Funds have been returned to the donor.`,
    amount: data.amount,
    metadata: { dispute_id: data.disputeId, won: data.won },
  });
}
