/**
 * Fulfillment Engine
 *
 * Handles smart fulfillment scheduling for all campaign types:
 *
 * GENERAL/ZAKAT/SADAQAH:
 *   - Auto-fulfill 24 hours after payment
 *   - Email at 1:30 PM donor's local time
 *
 * QURBANI/AQEEQAH:
 *   - Before Eid: fulfill on Day 1 of Eid ul-Adha
 *   - Day 1 of Eid: fulfill on Day 2
 *   - Day 2 of Eid: fulfill on Day 3
 *   - Day 3 of Eid: fulfill on Day 4 (day after Eid)
 *   - After Eid: auto-fulfill 24 hours after payment
 *   - Email at 1:30 PM donor's local time
 */

import { supabaseAdmin } from './supabase';

// ============================================
// TIMEZONE DETECTION FROM ADDRESS
// ============================================

// US state → IANA timezone mapping
const US_STATE_TIMEZONES: Record<string, string> = {
  // Eastern
  CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York',
  FL: 'America/New_York', GA: 'America/New_York', IN: 'America/Indiana/Indianapolis',
  KY: 'America/New_York', ME: 'America/New_York', MD: 'America/New_York',
  MA: 'America/New_York', MI: 'America/Detroit', NH: 'America/New_York',
  NJ: 'America/New_York', NY: 'America/New_York', NC: 'America/New_York',
  OH: 'America/New_York', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', TN: 'America/New_York', VT: 'America/New_York',
  VA: 'America/New_York', WV: 'America/New_York',
  // Central
  AL: 'America/Chicago', AR: 'America/Chicago', IL: 'America/Chicago',
  IA: 'America/Chicago', KS: 'America/Chicago', LA: 'America/Chicago',
  MN: 'America/Chicago', MS: 'America/Chicago', MO: 'America/Chicago',
  NE: 'America/Chicago', ND: 'America/Chicago', OK: 'America/Chicago',
  SD: 'America/Chicago', TX: 'America/Chicago', WI: 'America/Chicago',
  // Mountain
  AZ: 'America/Phoenix', CO: 'America/Denver', ID: 'America/Boise',
  MT: 'America/Denver', NM: 'America/Denver', UT: 'America/Denver',
  WY: 'America/Denver',
  // Pacific
  CA: 'America/Los_Angeles', NV: 'America/Los_Angeles', OR: 'America/Los_Angeles',
  WA: 'America/Los_Angeles',
  // Others
  AK: 'America/Anchorage', HI: 'Pacific/Honolulu',
  PR: 'America/Puerto_Rico', VI: 'America/Virgin',
};

// Country → timezone (simplified, uses capital/major city timezone)
const COUNTRY_TIMEZONES: Record<string, string> = {
  US: 'America/New_York', CA: 'America/Toronto', GB: 'Europe/London',
  UK: 'Europe/London', AU: 'Australia/Sydney', NZ: 'Pacific/Auckland',
  PK: 'Asia/Karachi', IN: 'Asia/Kolkata', BD: 'Asia/Dhaka',
  AE: 'Asia/Dubai', SA: 'Asia/Riyadh', QA: 'Asia/Qatar',
  KW: 'Asia/Kuwait', BH: 'Asia/Bahrain', OM: 'Asia/Muscat',
  EG: 'Africa/Cairo', TR: 'Europe/Istanbul', MY: 'Asia/Kuala_Lumpur',
  SG: 'Asia/Singapore', ID: 'Asia/Jakarta', NG: 'Africa/Lagos',
  KE: 'Africa/Nairobi', ZA: 'Africa/Johannesburg', DE: 'Europe/Berlin',
  FR: 'Europe/Paris', IT: 'Europe/Rome', ES: 'Europe/Madrid',
};

/**
 * Detect timezone from donor's billing address
 * Falls back to America/New_York (Eastern) if unknown
 */
export function detectTimezone(address?: {
  state?: string;
  country?: string;
} | null): string {
  if (!address) return 'America/New_York';

  // For US addresses, use state
  const country = (address.country || '').toUpperCase().trim();
  if (country === 'US' || country === 'USA' || country === 'UNITED STATES') {
    const state = (address.state || '').toUpperCase().trim();
    return US_STATE_TIMEZONES[state] || 'America/New_York';
  }

  // For other countries, use country code
  const countryCode = country.length === 2 ? country : '';
  return COUNTRY_TIMEZONES[countryCode] || 'America/New_York';
}

// ============================================
// FULFILLMENT DATE CALCULATOR
// ============================================

/**
 * Calculate when a donation should be fulfilled
 */
export async function calculateFulfillmentDate(
  campaignType: string,
  donationDate: Date,
): Promise<{ fulfillmentDate: Date; mode: string }> {
  const isQurbaniType = ['qurbani', 'aqeeqah', 'aqiqah', 'udhiya'].includes(campaignType);

  if (!isQurbaniType) {
    // General/Zakat/Sadaqah: fulfill 24h after payment
    const fulfillmentDate = new Date(donationDate.getTime() + 24 * 60 * 60 * 1000);
    return { fulfillmentDate, mode: 'auto_24h' };
  }

  // Qurbani/Aqeeqah: check Eid dates
  const eidDates = await getEidDates();
  if (!eidDates) {
    // No Eid dates configured, fall back to 24h
    return {
      fulfillmentDate: new Date(donationDate.getTime() + 24 * 60 * 60 * 1000),
      mode: 'auto_24h',
    };
  }

  const { eidStart, eidEnd } = eidDates;
  const donationDay = stripTime(donationDate);
  const eidStartDay = stripTime(eidStart);
  const eidEndDay = stripTime(eidEnd);
  const dayAfterEid = new Date(eidEndDay.getTime() + 24 * 60 * 60 * 1000);

  // Before Eid: fulfill on Day 1 of Eid
  if (donationDay < eidStartDay) {
    return { fulfillmentDate: eidStart, mode: 'eid_scheduled' };
  }

  // During Eid: fulfill next day
  if (donationDay >= eidStartDay && donationDay <= eidEndDay) {
    const nextDay = new Date(donationDay.getTime() + 24 * 60 * 60 * 1000);
    return { fulfillmentDate: nextDay, mode: 'eid_next_day' };
  }

  // After Eid: 24h auto-fulfill
  return {
    fulfillmentDate: new Date(donationDate.getTime() + 24 * 60 * 60 * 1000),
    mode: 'auto_24h',
  };
}

/**
 * Calculate when the fulfillment EMAIL should be sent
 * Always at 1:30 PM in the donor's local timezone
 */
export function calculateEmailSendTime(
  fulfillmentDate: Date,
  donorTimezone: string,
): Date {
  // Get the fulfillment date as a date string in the donor's timezone
  const dateStr = fulfillmentDate.toLocaleDateString('en-CA', {
    timeZone: donorTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Create 1:30 PM in the donor's timezone
  // We need to find what UTC time corresponds to 1:30 PM in their timezone
  // on the fulfillment date
  const targetLocal = new Date(`${dateStr}T13:30:00`);

  // Get the offset for this timezone on this date
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: donorTimezone,
    timeZoneName: 'shortOffset',
  });

  // Parse offset from formatted string
  const parts = formatter.formatToParts(targetLocal);
  const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
  const offsetMatch = offsetPart.match(/GMT([+-]\d{1,2}(?::?\d{2})?)/);

  let offsetMinutes = 0;
  if (offsetMatch) {
    const offsetStr = offsetMatch[1];
    const sign = offsetStr.startsWith('-') ? -1 : 1;
    const cleaned = offsetStr.replace(/[+-]/, '');
    const colonParts = cleaned.split(':');
    const hours = parseInt(colonParts[0]) || 0;
    const mins = parseInt(colonParts[1] || '0');
    offsetMinutes = sign * (hours * 60 + mins);
  } else {
    // Default to Eastern (-5 or -4 DST)
    offsetMinutes = -5 * 60;
  }

  // Convert: UTC = local - offset
  const utcTime = new Date(targetLocal.getTime() - offsetMinutes * 60 * 1000);
  return utcTime;
}

// ============================================
// HELPERS
// ============================================

function stripTime(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getEidDates(): Promise<{ eidStart: Date; eidEnd: Date } | null> {
  try {
    const { data } = await supabaseAdmin
      .from('site_settings')
      .select('eid_ul_adha_start, eid_ul_adha_end')
      .single();

    if (!data?.eid_ul_adha_start || !data?.eid_ul_adha_end) return null;

    return {
      eidStart: new Date(data.eid_ul_adha_start),
      eidEnd: new Date(data.eid_ul_adha_end),
    };
  } catch {
    return null;
  }
}

/**
 * Get Eid dates (exported for admin page)
 */
export async function getEidSettings() {
  const { data } = await supabaseAdmin
    .from('site_settings')
    .select('eid_ul_adha_start, eid_ul_adha_end, qurbani_fulfillment_enabled')
    .single();
  return data;
}

/**
 * Update Eid dates (exported for admin API)
 */
export async function updateEidSettings(settings: {
  eidStart: string;
  eidEnd: string;
  enabled?: boolean;
}) {
  const { error } = await supabaseAdmin
    .from('site_settings')
    .update({
      eid_ul_adha_start: settings.eidStart,
      eid_ul_adha_end: settings.eidEnd,
      qurbani_fulfillment_enabled: settings.enabled ?? true,
    })
    .not('id', 'is', null); // Update all rows (single row table)

  if (error) throw error;
  return { success: true };
}
