/**
 * Qurbani confirmation email helpers.
 *
 * Renders a single confirmation email per donation, with all qurbani items
 * (across countries/animals/quantities) listed in one email. Marks the donation
 * as confirmed in the DB to prevent double-sends.
 */

// Template is bundled at build time via Vite ?raw — works on Cloudflare Workers
// (where node:fs is not available).
import EMAIL_TEMPLATE from '../../emails/qurbani-confirmation.html?raw';
import { supabaseAdmin } from './supabase';
import { formatOrderNumber } from './order-number';

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;

// Hijri date for each day. Emails display ONLY the Islamic calendar date —
// no "Day 1 / Day 2 / Day 3" labels, no Arabic day names. Just the Hijri date.
export const HIJRI_DAY_INFO: Record<number, { hijri_date: string }> = {
  10: { hijri_date: '10 Dhul Hijjah, 1447 AH' },
  11: { hijri_date: '11 Dhul Hijjah, 1447 AH' },
  12: { hijri_date: '12 Dhul Hijjah, 1447 AH' },
};

interface QurbaniItemMeta {
  country?: string;
  service?: string;
  behalfOf?: string | null;
  quantity?: number;
  animalType?: string;
  animalLabel?: string;
  countryCode?: string;
}

interface DonationItem {
  id?: string;
  name?: string;
  label?: string;
  amount?: number;
  campaign?: string;
  metadata?: QurbaniItemMeta;
  quantity?: number;
}

interface Donation {
  id: string;
  donor_name: string | null;
  donor_email: string | null;
  amount: number;
  items: DonationItem[] | null;
  campaign_name: string | null;
  order_number: number | null;
  created_at: string;
  qurbani_confirmation_sent_at: string | null;
}

/**
 * Extract only the qurbani items from a donation. Some orders mix qurbani with
 * other items (e.g. an aqiqah add-on) — we want to only confirm the qurbani items.
 */
export function getQurbaniItems(donation: Donation): DonationItem[] {
  if (!Array.isArray(donation.items)) return [];
  return donation.items.filter(
    (it) =>
      it.campaign === 'qurbani' ||
      it.metadata?.service === 'qurbani' ||
      (it.name || '').toLowerCase().startsWith('qurbani')
  );
}

/**
 * Known typo domains that definitely won't deliver (no mail server).
 * If a donor's email ends in one of these, we don't even attempt to send —
 * the donor stays in the pending list with a "NEEDS FIX" flag.
 */
export const TYPO_EMAIL_DOMAINS = new Set([
  // gmail typos
  'gmail.vom', 'gmail.con', 'gmail.cm', 'gmail.co', 'gmail.om', 'gmail.coom',
  'gmal.com', 'gmial.com', 'gnail.com', 'gmaill.com', 'gmail.comm',
  // yahoo typos
  'yahoo.vom', 'yahoo.con', 'yahoo.cm', 'yahoo.co', 'yahoo.coom',
  'yhoo.com', 'yaho.com', 'yhaoo.com', 'yahooo.com',
  // hotmail typos
  'hotmail.vom', 'hotmail.con', 'hotmail.cm', 'hotmail.co',
  'hotmial.com', 'hotmal.com', 'homtail.com', 'hotmaill.com',
  // outlook typos
  'outlook.vom', 'outlook.con', 'outlook.cm', 'outloook.com',
  // icloud typos
  'icloud.vom', 'icloud.con', 'icloud.cm', 'icoud.com', 'iclould.com',
  // aol typos
  'aol.vom', 'aol.con', 'aol.cm',
]);

/**
 * Returns whether an email address looks deliverable.
 * Catches: missing @, no domain, no TLD, known typo domains, suspicious chars.
 * This is a pre-send guard — Resend itself does additional validation.
 */
export function isLikelyValidEmail(email: string | null | undefined): {
  valid: boolean;
  reason?: string;
} {
  if (!email) return { valid: false, reason: 'Missing email' };
  const trimmed = String(email).trim();
  if (trimmed.length < 5 || trimmed.length > 254) {
    return { valid: false, reason: 'Email length invalid' };
  }
  // Reject whitespace, multiple @, etc.
  if (/\s/.test(trimmed)) return { valid: false, reason: 'Email contains whitespace' };
  const at = trimmed.indexOf('@');
  if (at < 1 || at !== trimmed.lastIndexOf('@')) {
    return { valid: false, reason: 'Email missing or has multiple @' };
  }
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!domain || !domain.includes('.')) {
    return { valid: false, reason: 'Email domain missing TLD' };
  }
  // Format check
  const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!re.test(trimmed)) return { valid: false, reason: 'Email format invalid' };
  // Check against known typo domains
  if (TYPO_EMAIL_DOMAINS.has(domain)) {
    return { valid: false, reason: `Likely typo domain: ${domain}` };
  }
  return { valid: true };
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render the list of qurbani items as HTML rows for the confirmation card.
 */
export function renderQurbaniItemsHtml(items: DonationItem[]): string {
  if (!items.length) {
    return `<tr><td style="padding: 14px 16px; font-size: 14px; color: #6b7280;">No qurbani items in this order.</td></tr>`;
  }

  return items
    .map((it, idx) => {
      const qty = Math.max(1, Number(it.metadata?.quantity || it.quantity || 1));
      const animal = it.metadata?.animalLabel || extractAnimalFromName(it.name || '');
      const country = it.metadata?.country || extractCountryFromName(it.name || '');
      const behalfOf = (it.metadata?.behalfOf || '').trim();

      const borderTop = idx === 0 ? '' : 'border-top: 1px solid #f3e8d4;';
      const behalfHtml = behalfOf
        ? `<div style="margin-top: 4px; font-size: 12px; color: #ef7c01; font-style: italic;">On behalf of: ${escapeHtml(behalfOf)}</div>`
        : '';

      return `
        <tr>
          <td style="padding: 14px 16px; ${borderTop} vertical-align: top; width: 56px;">
            <span style="display: inline-block; min-width: 36px; padding: 4px 10px; background-color: #fef9ee; color: #ef7c01; font-weight: 700; font-size: 14px; border-radius: 6px; text-align: center;">${qty}&times;</span>
          </td>
          <td style="padding: 14px 16px 14px 0; ${borderTop} vertical-align: top;">
            <div style="font-size: 15px; color: #1a1a1a; font-weight: 700;">${escapeHtml(animal)}</div>
            <div style="margin-top: 2px; font-size: 13px; color: #6b7280;">${escapeHtml(country)}</div>
            ${behalfHtml}
          </td>
        </tr>
      `;
    })
    .join('');
}

function extractAnimalFromName(name: string): string {
  // "Qurbani Afghanistan - Sheep/Goat" → "Sheep/Goat"
  const m = name.match(/-\s*([^x]+?)(?:\s*x\d+)?$/);
  return m ? m[1].trim() : 'Qurbani';
}

function extractCountryFromName(name: string): string {
  // "Qurbani Afghanistan - Sheep/Goat" → "Afghanistan"
  const m = name.match(/^Qurbani\s+(.+?)\s*-/i);
  return m ? m[1].trim() : '';
}

/**
 * Decide the order-level "On Behalf Of" display value.
 * - If all items share the same non-empty behalfOf → use it.
 * - If items have differing behalfOf values → use a per-item annotation only.
 * - Otherwise fallback to the donor's full name (or "Your family" if name is missing).
 */
export function deriveOnBehalfOf(items: DonationItem[], donorName?: string | null): string {
  const values = items
    .map((it) => (it.metadata?.behalfOf || '').trim())
    .filter((v) => v.length > 0);
  if (!values.length) {
    return (donorName || '').trim() || 'Your family';
  }
  const unique = Array.from(new Set(values));
  if (unique.length === 1) return unique[0];
  return 'See items below';
}

/**
 * Render the email template with merge variables.
 */
export function renderConfirmationEmail(opts: {
  donor_first_name: string;
  order_number: string;
  hijri_day: 10 | 11 | 12;
  on_behalf_of: string;
  qurbani_items_html: string;
  country: string; // used only for the preheader text
}): string {
  const info = HIJRI_DAY_INFO[opts.hijri_day];
  const replacements: Record<string, string> = {
    donor_first_name: opts.donor_first_name,
    order_number: opts.order_number,
    on_behalf_of: opts.on_behalf_of,
    qurbani_items_html: opts.qurbani_items_html,
    country: opts.country,
    hijri_date: info.hijri_date,
    hijri_day: String(opts.hijri_day),
  };
  return EMAIL_TEMPLATE.replace(/\{\{(\w+)\}\}/g, (_, key) => replacements[key] ?? '');
}

/**
 * Send the Qurbani confirmation email for a specific donation.
 * Returns { sent: true } on success or { sent: false, reason } otherwise.
 */
export async function sendQurbaniConfirmation(
  donationId: string,
  hijriDay: 10 | 11 | 12,
  options: { force?: boolean } = {}
): Promise<{ sent: boolean; reason?: string; emailId?: string }> {
  let result: { sent: boolean; reason?: string; emailId?: string };
  try {
    result = await sendQurbaniConfirmationInner(donationId, hijriDay, options);
  } catch (e: any) {
    // Even if the inner function throws unexpectedly, log it and return a result.
    result = { sent: false, reason: `Inner threw: ${e?.message || e}` };
  }

  // Run logging in parallel via allSettled so neither path can block the other.
  // Critical: previously these were sequential awaits, and an issue in the first
  // could silently prevent the second from running. allSettled guarantees both
  // attempts fire regardless of what happens individually.
  await Promise.allSettled([
    recordAttempt(donationId, result),
    logSendOutcome(donationId, hijriDay, result),
  ]);

  return result;
}

/**
 * Append a row to qurbani_send_log capturing the per-row outcome.
 * Lets admin look up "which donor was skipped in this batch?" later.
 */
async function logSendOutcome(
  donationId: string,
  hijriDay: number,
  result: { sent: boolean; reason?: string; emailId?: string }
): Promise<void> {
  try {
    // Look up donor info for the log row (so we don't need a join to display).
    const { data: d } = await supabaseAdmin
      .from('donations')
      .select('order_number, donor_name, donor_email')
      .eq('id', donationId)
      .maybeSingle();

    let outcome: 'sent' | 'already_sent' | 'failed' | 'invalid';
    if (result.sent) outcome = 'sent';
    else if (/already (confirmed|claim)/i.test(result.reason || '')) outcome = 'already_sent';
    else if (/invalid email|missing|needs fix/i.test(result.reason || '')) outcome = 'invalid';
    else outcome = 'failed';

    await supabaseAdmin.from('qurbani_send_log').insert({
      donation_id: donationId,
      order_number: d?.order_number ?? null,
      donor_name: d?.donor_name ?? null,
      donor_email: d?.donor_email ?? null,
      hijri_day: hijriDay,
      outcome,
      reason: (result.reason || '').slice(0, 500) || null,
      email_id: result.emailId || null,
    });
  } catch (e) {
    // Never block a send because logging failed.
    console.error('[qurbani] logSendOutcome failed:', e);
  }
}

async function recordAttempt(
  donationId: string,
  result: { sent: boolean; reason?: string }
): Promise<void> {
  try {
    if (result.sent) {
      // On success, clear any prior failure reason.
      await supabaseAdmin
        .from('donations')
        .update({
          qurbani_confirmation_last_attempt_at: new Date().toISOString(),
          qurbani_confirmation_last_error: null,
        })
        .eq('id', donationId);
    } else {
      // Bump attempt count + record reason.
      const { data: current } = await supabaseAdmin
        .from('donations')
        .select('qurbani_confirmation_attempt_count')
        .eq('id', donationId)
        .maybeSingle();
      const nextCount = (current?.qurbani_confirmation_attempt_count || 0) + 1;
      await supabaseAdmin
        .from('donations')
        .update({
          qurbani_confirmation_last_attempt_at: new Date().toISOString(),
          qurbani_confirmation_last_error: (result.reason || 'Unknown error').slice(0, 500),
          qurbani_confirmation_attempt_count: nextCount,
        })
        .eq('id', donationId);
    }
  } catch (e) {
    // Never let a logging failure block the donor — just console it.
    console.error('[qurbani] recordAttempt failed:', e);
  }
}

async function sendQurbaniConfirmationInner(
  donationId: string,
  hijriDay: 10 | 11 | 12,
  options: { force?: boolean } = {}
): Promise<{ sent: boolean; reason?: string; emailId?: string }> {
  if (!RESEND_API_KEY) {
    return { sent: false, reason: 'Resend API key not configured' };
  }
  if (![10, 11, 12].includes(hijriDay)) {
    return { sent: false, reason: 'Invalid hijri_day (must be 10, 11, or 12)' };
  }

  // 1. Load donation
  const { data: donation, error } = await supabaseAdmin
    .from('donations')
    .select('id, donor_name, donor_email, amount, items, campaign_name, order_number, created_at, qurbani_confirmation_sent_at')
    .eq('id', donationId)
    .maybeSingle();

  if (error || !donation) {
    return { sent: false, reason: 'Donation not found' };
  }

  // 2. Skip if already confirmed (unless forced)
  if (donation.qurbani_confirmation_sent_at && !options.force) {
    return { sent: false, reason: 'Already confirmed' };
  }

  if (!donation.donor_email) {
    return { sent: false, reason: 'Donor email missing' };
  }

  // Pre-send email validation — never send to known-bad addresses.
  // Stays in pending list so admin can fix via Edit Email modal.
  const emailCheck = isLikelyValidEmail(donation.donor_email);
  if (!emailCheck.valid) {
    return { sent: false, reason: `Invalid email — needs fix: ${emailCheck.reason}` };
  }

  // 3. Extract qurbani items
  const qurbaniItems = getQurbaniItems(donation as any);
  if (!qurbaniItems.length) {
    return { sent: false, reason: 'No qurbani items in this donation' };
  }

  // 4. Build merge variables
  const donorFirstName = (donation.donor_name || 'Friend').split(' ')[0];
  const orderNumber = formatOrderNumber(donation.order_number, donation.created_at) || 'QF-Pending';
  const onBehalfOf = deriveOnBehalfOf(qurbaniItems, donation.donor_name);
  const itemsHtml = renderQurbaniItemsHtml(qurbaniItems);
  // Country used only for preheader — show the first one
  const country = qurbaniItems[0]?.metadata?.country || extractCountryFromName(qurbaniItems[0]?.name || '') || 'one of our partner countries';

  // 5. Render email
  const html = renderConfirmationEmail({
    donor_first_name: donorFirstName,
    order_number: orderNumber,
    hijri_day: hijriDay,
    on_behalf_of: onBehalfOf,
    qurbani_items_html: itemsHtml,
    country,
  });

  // 6. ATOMIC CLAIM — set sent_at NOW, but only if it's currently NULL.
  //    This is the critical anti-duplicate guard:
  //
  //    Old order: Resend send → DB UPDATE.  If anything between them failed
  //    (Workers timeout, network drop, Supabase hiccup), the row stayed NULL
  //    and the donor would get a 2nd email on retry. That's how duplicates
  //    happen in practice — NOT through Resend, through silent DB drops.
  //
  //    New order: DB claim → Resend send.  The claim either succeeds (we own
  //    the row, no other request can claim it) or fails (someone else got
  //    there first, we skip). Either way, no duplicate is possible.
  //
  //    If Resend then fails, we ROLL BACK the claim so admin can retry.
  const claimedAt = new Date().toISOString();
  const claimUpdate = options.force
    ? supabaseAdmin
        .from('donations')
        .update({
          qurbani_confirmation_sent_at: claimedAt,
          qurbani_confirmation_hijri_day: hijriDay,
        })
        .eq('id', donationId)
        .select('id')
    : supabaseAdmin
        .from('donations')
        .update({
          qurbani_confirmation_sent_at: claimedAt,
          qurbani_confirmation_hijri_day: hijriDay,
        })
        .eq('id', donationId)
        .is('qurbani_confirmation_sent_at', null)
        .select('id');

  const { data: claimed, error: claimError } = await claimUpdate;

  if (claimError) {
    return { sent: false, reason: `Could not claim row: ${claimError.message}` };
  }
  if (!claimed || claimed.length === 0) {
    // Another request already claimed it — most likely a duplicate click.
    return { sent: false, reason: 'Already confirmed (atomic claim already taken)' };
  }

  // 7. Send via Resend — we own the claim, so even if this fails or hangs,
  //    no other request can send for this row.
  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Qurbani Foundation <donorcare@receipts.qurbani.com>',
        to: donation.donor_email,
        reply_to: 'donorcare@qurbani.com',
        subject: 'Alhamdulillah — Your Qurbani Has Been Performed',
        html,
      }),
    });
  } catch (e: any) {
    // Network error reaching Resend — roll back the claim so admin can retry.
    await rollbackClaim(donationId, claimedAt);
    return { sent: false, reason: `Network error reaching Resend: ${e?.message || e}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Roll back so this row goes back to pending.
    await rollbackClaim(donationId, claimedAt);
    return { sent: false, reason: `Resend error ${res.status}: ${body.slice(0, 200)}` };
  }

  const data = await res.json().catch(() => ({}));
  const emailId = data?.id;

  return { sent: true, emailId };
}

/**
 * Roll back an atomic claim when Resend send fails. Only rolls back if the
 * sent_at matches the claim timestamp — never accidentally clear someone
 * else's successful send.
 */
async function rollbackClaim(donationId: string, claimedAt: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('donations')
      .update({
        qurbani_confirmation_sent_at: null,
        qurbani_confirmation_hijri_day: null,
      })
      .eq('id', donationId)
      .eq('qurbani_confirmation_sent_at', claimedAt);
  } catch (e) {
    console.error('[qurbani] rollbackClaim failed:', e);
  }
}
