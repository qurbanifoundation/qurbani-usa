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
 * Send notification through all channels
 */
export async function sendNotification(data: NotificationData): Promise<void> {
  const config = notificationConfig[data.type];

  // Run all notifications in parallel
  await Promise.allSettled([
    // 1. Save to database (for admin dashboard)
    saveToDatabase(data, config),

    // 2. Send email via Resend
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

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; padding: 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

          <!-- Header -->
          <div style="background: ${config.color}; padding: 24px; text-align: center;">
            <span style="font-size: 48px;">${config.emoji}</span>
            <h1 style="color: white; margin: 12px 0 0 0; font-size: 24px;">${data.title}</h1>
          </div>

          <!-- Body -->
          <div style="padding: 24px;">
            <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 16px 0;">
              ${data.message}
            </p>

            ${amountDisplay ? `
              <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">Amount</p>
                <p style="margin: 4px 0 0 0; color: #111827; font-size: 28px; font-weight: bold;">${amountDisplay}</p>
              </div>
            ` : ''}

            ${data.donorName ? `
              <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">Donor Information</p>
                <p style="margin: 8px 0 0 0; color: #111827; font-weight: 600;">${data.donorName}</p>
                ${data.donorEmail ? `<p style="margin: 4px 0 0 0; color: #6b7280;">${data.donorEmail}</p>` : ''}
              </div>
            ` : ''}
          </div>

          <!-- Footer -->
          <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
              Qurbani USA Admin Notification • ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET
            </p>
            <a href="https://www.qurbani.com/admin" style="display: inline-block; margin-top: 12px; color: #d97706; text-decoration: none; font-size: 14px; font-weight: 500;">
              View in Admin Dashboard →
            </a>
          </div>
        </div>
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
        from: 'Qurbani USA <notifications@qurbani.com>',
        to: ADMIN_EMAIL,
        subject: `${config.emoji} ${data.title}`,
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
  items?: Array<{ name: string }>;
  type?: string;
}): Promise<void> {
  const itemNames = donation.items?.map(i => i.name).join(', ') || 'General Donation';
  const typeLabel = donation.type === 'monthly' ? 'Monthly' : donation.type === 'weekly' ? 'Jummah' : 'One-time';

  await sendNotification({
    type: 'donation_received',
    title: 'New Donation Received!',
    message: `${typeLabel} donation of $${donation.amount.toFixed(2)} received for: ${itemNames}`,
    amount: donation.amount,
    donorName: donation.donorName,
    donorEmail: donation.donorEmail,
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
