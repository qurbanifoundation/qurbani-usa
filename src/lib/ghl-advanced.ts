/**
 * Advanced GoHighLevel Integration
 *
 * Enterprise-grade CRM sync with:
 * - Campaign-specific tags
 * - Stripe Payment ID tracking
 * - Fulfillment status tracking
 * - Refund handling
 * - Retry logic with persistent logging
 * - Major donor task creation
 * - Pipeline opportunity management
 */

import { supabaseAdmin } from './supabase';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function getGHLCredentials() {
  const apiKey = import.meta.env.GHL_API_KEY;
  const locationId = import.meta.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    throw new Error('GHL credentials not configured');
  }
  return { apiKey, locationId };
}

// ============================================
// GHL FETCH WITH RETRY + LOGGING
// ============================================

async function ghlFetch(
  endpoint: string,
  options: RequestInit = {},
  context?: { action?: string; email?: string; donationId?: string }
): Promise<Response> {
  const { apiKey } = getGHLCredentials();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${GHL_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': GHL_API_VERSION,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Log to database on final response
      if (context?.action) {
        const responseBody = res.ok ? { status: res.status } : await res.clone().json().catch(() => ({ status: res.status }));
        await logGHLSync({
          action: context.action,
          contactEmail: context.email,
          status: res.ok ? 'success' : 'error',
          requestPayload: options.body ? JSON.parse(options.body as string) : null,
          responsePayload: responseBody,
          errorMessage: res.ok ? null : `HTTP ${res.status}`,
          retryCount: attempt - 1,
          donationId: context.donationId,
        });
      }

      // Retry on 429 (rate limit) or 5xx
      if (res.status === 429 || res.status >= 500) {
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * attempt;
          console.warn(`GHL API ${res.status} on attempt ${attempt}, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      return res;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`GHL fetch attempt ${attempt} failed:`, lastError.message);

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
      }
    }
  }

  // Log final failure
  if (context?.action) {
    await logGHLSync({
      action: context.action,
      contactEmail: context.email,
      status: 'failed',
      requestPayload: options.body ? JSON.parse(options.body as string) : null,
      errorMessage: lastError?.message || 'Max retries exceeded',
      retryCount: MAX_RETRIES,
      donationId: context.donationId,
    });
  }

  throw lastError || new Error('GHL API request failed after retries');
}

// ============================================
// PERSISTENT SYNC LOGGING
// ============================================

async function logGHLSync(data: {
  action: string;
  contactEmail?: string;
  ghlContactId?: string;
  status: string;
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  errorMessage?: string | null;
  retryCount?: number;
  donationId?: string;
  stripePaymentId?: string;
}) {
  try {
    await supabaseAdmin.from('ghl_sync_logs').insert({
      action: data.action,
      contact_email: data.contactEmail || null,
      ghl_contact_id: data.ghlContactId || null,
      request_payload: data.requestPayload || null,
      response_payload: data.responsePayload || null,
      status: data.status,
      error_message: data.errorMessage || null,
      retry_count: data.retryCount || 0,
      donation_id: data.donationId || null,
      stripe_payment_id: data.stripePaymentId || null,
    });
  } catch (err) {
    // Never let logging failures break the main flow
    console.error('Failed to log GHL sync:', err);
  }
}

// ============================================
// LEAD CAPTURE FUNCTIONS (Pre-Sale)
// ============================================

/**
 * Track when someone views a campaign page
 */
export async function trackCampaignView(data: {
  email?: string;
  visitorId?: string;
  campaignSlug: string;
  campaignName: string;
}) {
  if (!data.email) return { success: false, error: 'No email' };

  const { locationId } = getGHLCredentials();
  const existing = await findContactByEmail(data.email);

  let currentInterests = '';
  let pagesViewed = 0;

  if (existing?.customFields) {
    for (const f of existing.customFields as { key: string; value: string }[]) {
      if (f.key === 'campaign_interests') currentInterests = f.value || '';
      if (f.key === 'pages_viewed') pagesViewed = parseInt(f.value || '0');
    }
  }

  const interestsArray = currentInterests ? currentInterests.split(', ') : [];
  if (!interestsArray.includes(data.campaignSlug)) {
    interestsArray.push(data.campaignSlug);
  }

  const customFields = [
    { key: 'campaign_interests', field_value: interestsArray.join(', ') },
    { key: 'last_campaign_viewed', field_value: data.campaignName },
    { key: 'pages_viewed', field_value: (pagesViewed + 1).toString() },
    { key: 'lead_stage', field_value: existing ? 'engaged' : 'visitor' },
  ];

  if (existing?.id) {
    await ghlFetch(`/contacts/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({ customFields }),
    }, { action: 'campaign_view', email: data.email });
    return { success: true, contactId: existing.id };
  } else {
    const res = await ghlFetch('/contacts/', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        locationId,
        source: 'Campaign Page View',
        tags: ['website', 'prospect'],
        customFields,
      }),
    }, { action: 'campaign_view_create', email: data.email });
    const result = await res.json();
    return { success: true, contactId: result.contact?.id };
  }
}

/**
 * Track cart abandonment
 */
export async function trackCartAbandonment(data: {
  email: string;
  cartItems: Array<{ name: string; amount: number; campaignSlug: string }>;
  cartTotal: number;
}) {
  const existing = await findContactByEmail(data.email);

  const campaigns = data.cartItems.map(i => i.campaignSlug).join(', ');
  const itemsList = data.cartItems.map(i => `${i.name}: $${i.amount}`).join(', ');

  const customFields = [
    { key: 'cart_abandoned', field_value: 'yes' },
    { key: 'cart_value', field_value: data.cartTotal.toString() },
    { key: 'campaign_interests', field_value: campaigns },
    { key: 'lead_stage', field_value: 'prospect' },
  ];

  const tags = ['website', 'cart-abandoned', 'hot-lead'];

  if (existing?.id) {
    await ghlFetch(`/contacts/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({ customFields, tags }),
    }, { action: 'cart_abandonment', email: data.email });

    await ghlFetch(`/contacts/${existing.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        body: `🛒 CART ABANDONED\n\nItems: ${itemsList}\nTotal: $${data.cartTotal}\nDate: ${new Date().toLocaleDateString()}\n\n→ Follow up within 2 hours!`
      }),
    });

    return { success: true, contactId: existing.id };
  }

  return { success: false, error: 'Contact not found' };
}

/**
 * Track Zakat calculation (high-intent lead)
 */
export async function trackZakatCalculation(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  zakatAmount: number;
  totalAssets: number;
  wantsReminder?: boolean;
  phone?: string;
}) {
  const { locationId } = getGHLCredentials();
  const existing = await findContactByEmail(data.email);

  let leadScore = 50;
  if (data.zakatAmount >= 100) leadScore += 10;
  if (data.zakatAmount >= 500) leadScore += 10;
  if (data.zakatAmount >= 1000) leadScore += 15;
  if (data.zakatAmount >= 5000) leadScore += 15;
  if (data.wantsReminder) leadScore += 10;

  const customFields = [
    { key: 'calculated_zakat', field_value: data.zakatAmount.toString() },
    { key: 'total_zakatable_assets', field_value: data.totalAssets.toString() },
    { key: 'zakat_calculation_date', field_value: new Date().toISOString().split('T')[0] },
    { key: 'zakat_remaining', field_value: data.zakatAmount.toString() },
    { key: 'lead_score', field_value: leadScore.toString() },
    { key: 'lead_stage', field_value: 'qualified' },
    { key: 'lead_source', field_value: 'Zakat Calculator' },
  ];

  const tags = ['website', 'zakat-calculator', 'qualified-lead'];
  if (data.zakatAmount >= 1000) tags.push('high-value-prospect');
  if (data.wantsReminder) tags.push('nisab-alert');

  let contactId: string | undefined;

  try {
    const upsertData = {
      email: data.email,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      phone: data.phone,
      locationId,
      source: 'Zakat Calculator',
      tags,
      customFields,
    };

    const res = await ghlFetch('/contacts/upsert', {
      method: 'POST',
      body: JSON.stringify(upsertData),
    }, { action: 'zakat_calculation', email: data.email });

    const result = await res.json();

    if (!res.ok) {
      console.error('GHL upsert contact error:', res.status, result);
      return { success: false, error: `Failed to save contact: ${result.message || res.status}`, leadScore };
    }

    contactId = result.contact?.id;
    if (!contactId) {
      console.error('GHL upsert - no ID returned:', result);
      return { success: false, error: 'Contact saved but no ID returned', leadScore };
    }

    await ghlFetch(`/contacts/${contactId}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        body: `📊 ZAKAT CALCULATED\n\nTotal Assets: $${data.totalAssets.toLocaleString()}\nZakat Due: $${data.zakatAmount.toLocaleString()}\nLead Score: ${leadScore}/100\nNisab Alert: ${data.wantsReminder ? 'Yes' : 'No'}\n\n→ High intent lead - follow up!`
      }),
    });

    return { success: true, contactId, leadScore };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('GHL trackZakatCalculation error:', error);
    return { success: false, error: errMsg, leadScore };
  }
}

// ============================================
// DONATION TRACKING (Post-Sale)
// ============================================

/**
 * Track completed donation with full campaign attribution
 * Now includes: Stripe ID, campaign-specific tags, fulfillment status,
 * receipt tracking, retry logic, and persistent logging
 */
export async function trackDonation(data: {
  email: string;
  name: string;
  phone?: string | null;
  amount: number;
  campaignSlug: string;
  campaignName: string;
  donationType: 'single' | 'monthly' | 'weekly';
  items?: Array<{ name: string; amount: number }>;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
  // New enterprise fields
  stripePaymentId?: string;
  donationId?: string;
  currency?: string;
}) {
  const { locationId } = getGHLCredentials();
  const existing = await findContactByEmail(data.email);
  const today = new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();

  const isRecurring = data.donationType === 'monthly' || data.donationType === 'weekly';
  const isMonthly = data.donationType === 'monthly';
  const isWeekly = data.donationType === 'weekly';

  // Get existing donation data
  let lifetimeGiving = 0;
  let donationCount = 0;
  let campaignsDonated = '';
  let zakatRemaining = 0;
  let firstDonationDate = today;

  if (existing?.customFields) {
    for (const f of existing.customFields as { key: string; value: string }[]) {
      if (f.key === 'total_lifetime_giving') lifetimeGiving = parseFloat(f.value || '0');
      if (f.key === 'donation_count') donationCount = parseInt(f.value || '0');
      if (f.key === 'campaigns_donated') campaignsDonated = f.value || '';
      if (f.key === 'zakat_remaining') zakatRemaining = parseFloat(f.value || '0');
      if (f.key === 'first_donation_date' && f.value) firstDonationDate = f.value;
    }
  }

  // Update totals
  const newLifetime = lifetimeGiving + data.amount;
  const newCount = donationCount + 1;

  // Campaign tracking
  const campaignsArray = campaignsDonated ? campaignsDonated.split(', ') : [];
  if (!campaignsArray.includes(data.campaignSlug)) {
    campaignsArray.push(data.campaignSlug);
  }
  const favoriteCause = campaignsArray[campaignsArray.length - 1];

  // Donor tier
  let donorTier = 'donor';
  if (newLifetime >= 10000) donorTier = 'vip';
  else if (newLifetime >= 5000) donorTier = 'major';
  else if (newLifetime >= 1000) donorTier = 'regular';

  // Zakat tracking
  let newZakatRemaining = zakatRemaining;
  let zakatPaid = 0;
  if (data.campaignSlug.includes('zakat') || data.campaignName.toLowerCase().includes('zakat')) {
    zakatPaid = data.amount;
    newZakatRemaining = Math.max(0, zakatRemaining - data.amount);
  }

  let recurringTypeLabel = 'none';
  if (isMonthly) recurringTypeLabel = 'monthly';
  if (isWeekly) recurringTypeLabel = 'weekly';

  // ---- CUSTOM FIELDS ----
  const customFields = [
    { key: 'total_lifetime_giving', field_value: newLifetime.toString() },
    { key: 'last_donation_amount', field_value: data.amount.toString() },
    { key: 'last_donation_date', field_value: today },
    { key: 'first_donation_date', field_value: firstDonationDate },
    { key: 'donation_count', field_value: newCount.toString() },
    { key: 'donor_tier', field_value: donorTier },
    { key: 'donation_type', field_value: data.donationType },
    { key: 'campaigns_donated', field_value: campaignsArray.join(', ') },
    { key: 'favorite_cause', field_value: favoriteCause },
    { key: 'lead_stage', field_value: newCount > 1 ? 'advocate' : 'donor' },
    { key: 'cart_abandoned', field_value: 'no' },
    { key: 'engagement_score', field_value: Math.min(100, 50 + newCount * 10).toString() },
    // Recurring
    { key: 'is_recurring_donor', field_value: isRecurring ? 'yes' : 'no' },
    { key: 'is_monthly_donor', field_value: isMonthly ? 'yes' : 'no' },
    { key: 'is_weekly_donor', field_value: isWeekly ? 'yes' : 'no' },
    { key: 'recurring_type', field_value: recurringTypeLabel },
    // Enterprise fields
    { key: 'stripe_payment_id', field_value: data.stripePaymentId || '' },
    { key: 'fulfillment_status', field_value: isRecurring ? 'not_applicable' : 'pending' },
    { key: 'receipt_sent', field_value: 'no' },
    { key: 'currency', field_value: data.currency || 'USD' },
  ];

  // Jummah-specific
  if (isWeekly) {
    customFields.push({ key: 'is_jummah_donor', field_value: 'yes' });
    customFields.push({ key: 'jummah_donation_amount', field_value: data.amount.toString() });
    customFields.push({ key: 'jummah_start_date', field_value: today });
  }

  // Monthly-specific
  if (isMonthly) {
    customFields.push({ key: 'monthly_donation_amount', field_value: data.amount.toString() });
    customFields.push({ key: 'monthly_start_date', field_value: today });
  }

  if (zakatPaid > 0) {
    customFields.push({ key: 'zakat_paid', field_value: zakatPaid.toString() });
    customFields.push({ key: 'zakat_remaining', field_value: newZakatRemaining.toString() });
  }

  // ---- CAMPAIGN-SPECIFIC TAGS ----
  const tags = ['donor', 'website', `donor-${year}`];

  // Campaign tag: campaign_slug_year (e.g., campaign_gaza_emergency_2026)
  const campaignTag = `campaign_${data.campaignSlug.replace(/-/g, '_')}_${year}`;
  tags.push(campaignTag);

  // Also check if campaign has a custom ghl_tag in database
  try {
    const { data: campaignRecord } = await supabaseAdmin
      .from('campaigns')
      .select('ghl_tag')
      .eq('slug', data.campaignSlug)
      .single();
    if (campaignRecord?.ghl_tag) {
      tags.push(campaignRecord.ghl_tag);
    }
  } catch {
    // Campaign not found, skip custom tag
  }

  // Donation type tags
  if (!isRecurring) tags.push('one-time-donor');
  if (isRecurring) tags.push('recurring-donor');
  if (isMonthly) tags.push('monthly-donor');
  if (isWeekly) {
    tags.push('weekly-donor');
    tags.push('jummah-donor');
  }

  // Tier tags
  if (newLifetime >= 1000) tags.push('major-donor');
  if (newLifetime >= 5000) tags.push('vip-donor');
  if (newCount > 1) tags.push('repeat-donor');

  // Zakat tag
  if (data.campaignSlug.includes('zakat') || data.campaignName.toLowerCase().includes('zakat')) {
    tags.push('zakat-donor');
  }

  // ---- CONTACT DATA ----
  const nameParts = data.name.split(' ');
  const contactData: Record<string, unknown> = {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    email: data.email,
    phone: data.phone || undefined,
    locationId,
    source: 'Donation',
    tags,
    customFields,
  };

  if (data.address) {
    if (data.address.line1) contactData.address1 = data.address.line1;
    if (data.address.city) contactData.city = data.address.city;
    if (data.address.state) contactData.state = data.address.state;
    if (data.address.postal_code) contactData.postalCode = data.address.postal_code;
    if (data.address.country) contactData.country = data.address.country;
  }

  // ---- CREATE/UPDATE CONTACT ----
  let contactId: string;
  const syncContext = { action: 'track_donation', email: data.email, donationId: data.donationId };

  if (existing?.id) {
    await ghlFetch(`/contacts/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify(contactData),
    }, syncContext);
    contactId = existing.id;
  } else {
    const res = await ghlFetch('/contacts/', {
      method: 'POST',
      body: JSON.stringify(contactData),
    }, syncContext);
    const result = await res.json();
    contactId = result.contact?.id;
  }

  if (contactId) {
    // ---- DETAILED NOTE ----
    const itemsList = data.items?.map(i => `  • ${i.name}: $${i.amount}`).join('\n') || `  • ${data.campaignName}: $${data.amount}`;

    let donationTypeLabel = 'One-time';
    if (isMonthly) donationTypeLabel = '🔄 Monthly Recurring';
    if (isWeekly) donationTypeLabel = '🕌 Jummah (Every Friday)';

    await ghlFetch(`/contacts/${contactId}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        body: `💰 DONATION RECEIVED\n${'━'.repeat(30)}\nAmount: $${data.amount.toLocaleString()}\nType: ${donationTypeLabel}\nCampaign: ${data.campaignName}${data.stripePaymentId ? `\nStripe ID: ${data.stripePaymentId}` : ''}\n\nItems:\n${itemsList}\n\n📊 DONOR STATS\n${'━'.repeat(30)}\nLifetime Giving: $${newLifetime.toLocaleString()}\nTotal Donations: ${newCount}\nTier: ${donorTier.toUpperCase()}\nCampaigns Supported: ${campaignsArray.length}${isRecurring ? `\n\n🔄 RECURRING: ${isWeekly ? 'Every Friday (Jummah)' : 'Monthly'}` : ''}${zakatPaid > 0 ? `\n🕌 ZAKAT: Paid $${zakatPaid}, Remaining $${newZakatRemaining}` : ''}`
      }),
    });

    // ---- PIPELINE OPPORTUNITY ----
    await createDonationOpportunity(contactId, data, donationTypeLabel);

    // ---- MAJOR DONOR TASK ----
    if (data.amount >= 5000 || newLifetime >= 10000) {
      await createMajorDonorTask(contactId, data.name, data.amount, newLifetime, donorTier);
    }

    // Log success
    await logGHLSync({
      action: 'track_donation_complete',
      contactEmail: data.email,
      ghlContactId: contactId,
      status: 'success',
      stripePaymentId: data.stripePaymentId,
      donationId: data.donationId,
    });
  }

  return {
    success: true,
    contactId,
    lifetimeGiving: newLifetime,
    donationCount: newCount,
    donorTier
  };
}

// ============================================
// REFUND HANDLING
// ============================================

/**
 * Sync refund to GHL: update custom fields, add tag, move pipeline stage, add note
 */
export async function trackRefund(data: {
  email: string;
  name: string;
  refundAmount: number;
  originalAmount: number;
  stripeChargeId: string;
  stripePaymentId?: string;
  campaignName?: string;
}) {
  const existing = await findContactByEmail(data.email);
  if (!existing?.id) {
    console.error('GHL trackRefund: Contact not found for', data.email);
    return { success: false, error: 'Contact not found' };
  }

  const contactId = existing.id;

  // Recalculate lifetime giving
  let lifetimeGiving = 0;
  let donationCount = 0;
  if (existing.customFields) {
    for (const f of existing.customFields as { key: string; value: string }[]) {
      if (f.key === 'total_lifetime_giving') lifetimeGiving = parseFloat(f.value || '0');
      if (f.key === 'donation_count') donationCount = parseInt(f.value || '0');
    }
  }

  const adjustedLifetime = Math.max(0, lifetimeGiving - data.refundAmount);

  // Recalculate tier after refund
  let donorTier = 'donor';
  if (adjustedLifetime >= 10000) donorTier = 'vip';
  else if (adjustedLifetime >= 5000) donorTier = 'major';
  else if (adjustedLifetime >= 1000) donorTier = 'regular';

  const customFields = [
    { key: 'total_lifetime_giving', field_value: adjustedLifetime.toString() },
    { key: 'fulfillment_status', field_value: 'refunded' },
    { key: 'donor_tier', field_value: donorTier },
  ];

  const tags = ['donation-refunded'];

  try {
    // Update contact
    await ghlFetch(`/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify({ customFields, tags }),
    }, { action: 'track_refund', email: data.email });

    // Add refund note
    await ghlFetch(`/contacts/${contactId}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        body: `🔴 REFUND PROCESSED\n${'━'.repeat(30)}\nRefund Amount: $${data.refundAmount.toLocaleString()}\nOriginal Amount: $${data.originalAmount.toLocaleString()}\nCampaign: ${data.campaignName || 'N/A'}\nStripe Charge: ${data.stripeChargeId}\nDate: ${new Date().toLocaleDateString()}\n\n📊 ADJUSTED STATS\n${'━'.repeat(30)}\nAdjusted Lifetime: $${adjustedLifetime.toLocaleString()}\nTier: ${donorTier.toUpperCase()}`
      }),
    });

    // Move opportunity to refunded stage if pipeline supports it
    await moveOpportunityToRefunded(contactId);

    // Log
    await logGHLSync({
      action: 'track_refund_complete',
      contactEmail: data.email,
      ghlContactId: contactId,
      status: 'success',
      stripePaymentId: data.stripePaymentId,
    });

    return { success: true, contactId, adjustedLifetime, donorTier };
  } catch (error) {
    console.error('GHL trackRefund error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// RECEIPT TRACKING
// ============================================

/**
 * Update GHL contact when receipt is sent
 */
export async function markReceiptSent(email: string) {
  const existing = await findContactByEmail(email);
  if (!existing?.id) return;

  await ghlFetch(`/contacts/${existing.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      customFields: [
        { key: 'receipt_sent', field_value: 'yes' },
      ],
    }),
  }, { action: 'mark_receipt_sent', email });
}

// ============================================
// PIPELINE / OPPORTUNITY FUNCTIONS
// ============================================

// Cache pipeline ID and stage IDs (NOTE: resets on cold start in serverless)
let cachedPipelineId: string | null = null;
let cachedStages: Map<string, string> = new Map();

async function loadPipelineConfig(): Promise<boolean> {
  if (cachedPipelineId && cachedStages.size > 0) return true;

  // Reset in case of partial load
  cachedPipelineId = null;
  cachedStages = new Map();

  try {
    const { locationId } = getGHLCredentials();
    const pipelinesRes = await ghlFetch(`/opportunities/pipelines?locationId=${locationId}`);
    if (!pipelinesRes.ok) {
      console.error('GHL pipeline config fetch failed:', pipelinesRes.status);
      return false;
    }

    const pipelinesData = await pipelinesRes.json();
    const donationPipeline = pipelinesData.pipelines?.find(
      (p: { name: string }) => p.name.toLowerCase().includes('donation')
    );

    if (!donationPipeline) {
      console.error('No donation pipeline found in GHL — check pipeline name contains "donation"');
      return false;
    }

    cachedPipelineId = donationPipeline.id;

    // Cache all stages by name (lowercase)
    for (const stage of donationPipeline.stages || []) {
      cachedStages.set(stage.name.toLowerCase(), stage.id);
    }

    console.log('GHL Pipeline loaded:', cachedPipelineId, 'Stages:', [...cachedStages.keys()].join(', '));
    return true;
  } catch (err) {
    console.error('GHL loadPipelineConfig error:', err);
    return false;
  }
}

function getStageId(stageName: string): string | undefined {
  // Try exact match first, then partial match
  const exact = cachedStages.get(stageName.toLowerCase());
  if (exact) return exact;

  for (const [name, id] of cachedStages) {
    if (name.includes(stageName.toLowerCase())) return id;
  }

  // Fallback to first stage
  const firstStage = cachedStages.values().next().value;
  return firstStage;
}

async function createDonationOpportunity(
  contactId: string,
  data: { email: string; name: string; amount: number; campaignName: string; items?: Array<{ name: string; amount: number }> },
  donationTypeLabel: string,
) {
  try {
    const { locationId } = getGHLCredentials();
    const loaded = await loadPipelineConfig();

    if (!loaded || !cachedPipelineId) {
      console.error('GHL: Cannot create opportunity — pipeline config not loaded');
      return;
    }

    const firstStageId = getStageId('new donation') || getStageId('donations');
    if (!firstStageId) {
      console.error('GHL: Cannot create opportunity — no stage found for "new donation"');
      return;
    }

    const itemNames = data.items?.map(i => i.name).join(', ') || data.campaignName;

    const oppRes = await ghlFetch('/opportunities/', {
      method: 'POST',
      body: JSON.stringify({
        pipelineId: cachedPipelineId,
        locationId,
        name: `$${data.amount} - ${itemNames} (${donationTypeLabel})`,
        pipelineStageId: firstStageId,
        status: 'open',
        contactId,
        monetaryValue: data.amount,
        source: 'Website Donation',
      }),
    }, { action: 'create_opportunity', email: data.email });

    if (!oppRes.ok) {
      const errBody = await oppRes.text();
      console.error('GHL opportunity creation failed:', oppRes.status, errBody);
    } else {
      console.log('GHL opportunity created for', data.email);
    }
  } catch (err) {
    console.error('GHL opportunity creation error:', err);
  }
}

/**
 * Move a donor's latest opportunity to a specific pipeline stage
 * Called by the fulfillment processor and webhook handlers
 */
export async function moveDonationThroughPipeline(email: string, targetStage: string) {
  const existing = await findContactByEmail(email);
  if (!existing?.id) return;

  await loadPipelineConfig();
  if (!cachedPipelineId) return;

  const { locationId } = getGHLCredentials();
  const stageId = getStageId(targetStage);
  if (!stageId) {
    console.log(`GHL: Stage "${targetStage}" not found in pipeline`);
    return;
  }

  // Find open opportunities for this contact
  const searchRes = await ghlFetch(
    `/opportunities/search?location_id=${locationId}&pipeline_id=${cachedPipelineId}&contact_id=${existing.id}&status=open`
  );

  if (!searchRes.ok) return;
  const searchData = await searchRes.json();
  const opportunities = searchData.opportunities || [];

  // Move the most recent opportunity to the target stage
  if (opportunities.length > 0) {
    const latestOpp = opportunities[0];
    await ghlFetch(`/opportunities/${latestOpp.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        pipelineStageId: stageId,
        pipelineId: cachedPipelineId,
        locationId,
      }),
    }, { action: `pipeline_move_${targetStage}`, email });

    console.log(`GHL opportunity moved to "${targetStage}" for ${email}`);
  }
}

/**
 * Mark a contact as fulfilled in GHL custom fields
 */
export async function markFulfilled(email: string) {
  const existing = await findContactByEmail(email);
  if (!existing?.id) return;

  await ghlFetch(`/contacts/${existing.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      customFields: [
        { key: 'fulfillment_status', field_value: 'fulfilled' },
      ],
    }),
  }, { action: 'mark_fulfilled', email });
}

async function moveOpportunityToRefunded(contactId: string) {
  try {
    await loadPipelineConfig();
    if (!cachedPipelineId) return;

    // Look for a "refunded" stage — if it doesn't exist, we just close the opportunity
    const { locationId } = getGHLCredentials();

    // Find open opportunities for this contact
    const searchRes = await ghlFetch(
      `/opportunities/search?location_id=${locationId}&pipeline_id=${cachedPipelineId}&contact_id=${contactId}&status=open`
    );

    if (!searchRes.ok) return;
    const searchData = await searchRes.json();
    const opportunities = searchData.opportunities || [];

    for (const opp of opportunities) {
      // Close the opportunity as lost (refunded)
      await ghlFetch(`/opportunities/${opp.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'lost',
          pipelineId: cachedPipelineId,
          locationId,
        }),
      });
      console.log('GHL opportunity closed (refunded):', opp.id);
    }
  } catch (err) {
    console.error('GHL moveOpportunityToRefunded error:', err);
  }
}

// ============================================
// MAJOR DONOR TASK CREATION
// ============================================

async function createMajorDonorTask(
  contactId: string,
  donorName: string,
  donationAmount: number,
  lifetimeGiving: number,
  donorTier: string,
) {
  try {
    const { locationId } = getGHLCredentials();

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Due tomorrow

    await ghlFetch('/contacts/' + contactId + '/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: `🎯 Follow up: ${donorName} - $${donationAmount.toLocaleString()} donation`,
        body: `Major donation received!\n\nDonor: ${donorName}\nAmount: $${donationAmount.toLocaleString()}\nLifetime Giving: $${lifetimeGiving.toLocaleString()}\nTier: ${donorTier.toUpperCase()}\n\nAction: Personal thank you call + relationship manager assignment`,
        dueDate: dueDate.toISOString(),
        completed: false,
      }),
    }, { action: 'major_donor_task', email: donorName });

    console.log('GHL major donor task created for', donorName);
  } catch (err) {
    console.error('GHL major donor task creation error:', err);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function findContactByEmail(email: string): Promise<Record<string, unknown> | null> {
  try {
    const { locationId } = getGHLCredentials();
    const searchRes = await ghlFetch(
      `/contacts/search/duplicate?locationId=${locationId}&email=${encodeURIComponent(email)}`
    );

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const contactId = searchData.contact?.id;

    if (!contactId) return null;

    // Get full contact with custom fields
    const contactRes = await ghlFetch(`/contacts/${contactId}`);
    if (contactRes.ok) {
      const data = await contactRes.json();
      return data.contact || null;
    }

    return searchData.contact || null;
  } catch (error) {
    console.error('GHL findContactByEmail error:', error);
    return null;
  }
}

export { findContactByEmail };
