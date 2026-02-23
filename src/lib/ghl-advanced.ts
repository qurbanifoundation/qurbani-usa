/**
 * Advanced GoHighLevel Integration
 *
 * Captures leads at EVERY touchpoint - before, during, and after donation
 * Uses Custom Fields for proper tracking (not tags)
 */

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

function getGHLCredentials() {
  const apiKey = import.meta.env.GHL_API_KEY;
  const locationId = import.meta.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    throw new Error('GHL credentials not configured');
  }
  return { apiKey, locationId };
}

async function ghlFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const { apiKey } = getGHLCredentials();
  return fetch(`${GHL_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Version': GHL_API_VERSION,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// ============================================
// LEAD CAPTURE FUNCTIONS (Pre-Sale)
// ============================================

/**
 * Track when someone views a campaign page
 * Call this when: User lands on /appeals/{slug}
 */
export async function trackCampaignView(data: {
  email?: string;
  visitorId?: string;  // Anonymous tracking
  campaignSlug: string;
  campaignName: string;
}) {
  if (!data.email) return { success: false, error: 'No email' };

  const { locationId } = getGHLCredentials();

  // Find or create contact
  const existing = await findContactByEmail(data.email);

  // Get current interests
  let currentInterests = '';
  let pagesViewed = 0;

  if (existing?.customFields) {
    for (const f of existing.customFields as any[]) {
      if (f.key === 'campaign_interests') currentInterests = f.value || '';
      if (f.key === 'pages_viewed') pagesViewed = parseInt(f.value || '0');
    }
  }

  // Add new campaign to interests (avoid duplicates)
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
    });
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
    });
    const result = await res.json();
    return { success: true, contactId: result.contact?.id };
  }
}

/**
 * Track cart abandonment
 * Call this when: User adds to cart but doesn't complete checkout
 */
export async function trackCartAbandonment(data: {
  email: string;
  cartItems: Array<{ name: string; amount: number; campaignSlug: string }>;
  cartTotal: number;
}) {
  const { locationId } = getGHLCredentials();
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
    });

    // Add note about abandoned cart
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
 * Call this when: User completes Zakat calculator
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

  // Calculate lead score based on Zakat amount
  let leadScore = 50; // Base score for using calculator
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
    // Use upsert endpoint - creates if not exists, updates if exists
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
    });
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

    // Add note
    await ghlFetch(`/contacts/${contactId}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        body: `📊 ZAKAT CALCULATED\n\nTotal Assets: $${data.totalAssets.toLocaleString()}\nZakat Due: $${data.zakatAmount.toLocaleString()}\nLead Score: ${leadScore}/100\nNisab Alert: ${data.wantsReminder ? 'Yes' : 'No'}\n\n→ High intent lead - follow up!`
      }),
    });

    // Email is now handled by GHL Workflow (triggered by "zakat-calculator" tag)
    // Workflow: "Zakat Calculator – Results & Follow-up"
    // - Sends immediate email with calculation results
    // - Waits 2 days → SMS reminder if not donated
    // - Waits 5 more days → Email reminder if not donated
    // - Adds "zakat-nurture-complete" tag

    return { success: true, contactId, leadScore };
  } catch (error: any) {
    console.error('GHL trackZakatCalculation error:', error);
    return { success: false, error: error.message || 'Unknown error', leadScore };
  }
}

// ============================================
// DONATION TRACKING (Post-Sale)
// ============================================

/**
 * Track completed donation with full campaign attribution
 * Call this when: Stripe webhook confirms payment
 */
export async function trackDonation(data: {
  email: string;
  name: string;
  phone?: string;
  amount: number;
  campaignSlug: string;
  campaignName: string;
  donationType: 'single' | 'monthly';
  items?: Array<{ name: string; amount: number }>;
}) {
  const { locationId } = getGHLCredentials();
  const existing = await findContactByEmail(data.email);
  const today = new Date().toISOString().split('T')[0];

  // Get existing donation data
  let lifetimeGiving = 0;
  let donationCount = 0;
  let campaignsDonated = '';
  let zakatRemaining = 0;
  let firstDonationDate = today;

  if (existing?.customFields) {
    for (const f of existing.customFields as any[]) {
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

  // Add campaign to donated list
  const campaignsArray = campaignsDonated ? campaignsDonated.split(', ') : [];
  if (!campaignsArray.includes(data.campaignSlug)) {
    campaignsArray.push(data.campaignSlug);
  }

  // Determine favorite cause (most donated to)
  const favoriteCause = campaignsArray[campaignsArray.length - 1]; // Simple: last one

  // Calculate donor tier
  let donorTier = 'donor';
  if (newLifetime >= 10000) donorTier = 'vip';
  else if (newLifetime >= 5000) donorTier = 'major';
  else if (newLifetime >= 1000) donorTier = 'regular';

  // Update Zakat tracking if it's a Zakat donation
  let newZakatRemaining = zakatRemaining;
  let zakatPaid = 0;
  if (data.campaignSlug.includes('zakat') || data.campaignName.toLowerCase().includes('zakat')) {
    zakatPaid = data.amount;
    newZakatRemaining = Math.max(0, zakatRemaining - data.amount);
  }

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
  ];

  if (zakatPaid > 0) {
    customFields.push({ key: 'zakat_paid', field_value: zakatPaid.toString() });
    customFields.push({ key: 'zakat_remaining', field_value: newZakatRemaining.toString() });
  }

  // Build tags
  const tags = ['donor', 'website', `donor-${new Date().getFullYear()}`];
  if (data.donationType === 'monthly') tags.push('monthly-donor');
  if (newLifetime >= 1000) tags.push('major-donor');
  if (newLifetime >= 5000) tags.push('vip-donor');
  if (newCount > 1) tags.push('repeat-donor');

  const nameParts = data.name.split(' ');
  const contactData: any = {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    email: data.email,
    phone: data.phone,
    locationId,
    source: 'Donation',
    tags,
    customFields,
  };

  let contactId: string;

  if (existing?.id) {
    await ghlFetch(`/contacts/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify(contactData),
    });
    contactId = existing.id;
  } else {
    const res = await ghlFetch('/contacts/', {
      method: 'POST',
      body: JSON.stringify(contactData),
    });
    const result = await res.json();
    contactId = result.contact?.id;
  }

  // Add detailed note
  if (contactId) {
    const itemsList = data.items?.map(i => `  • ${i.name}: $${i.amount}`).join('\n') || `  • ${data.campaignName}: $${data.amount}`;

    await ghlFetch(`/contacts/${contactId}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        body: `💰 DONATION RECEIVED\n${'━'.repeat(30)}\nAmount: $${data.amount.toLocaleString()}\nType: ${data.donationType === 'monthly' ? '🔄 Monthly Recurring' : 'One-time'}\nCampaign: ${data.campaignName}\n\nItems:\n${itemsList}\n\n📊 DONOR STATS\n${'━'.repeat(30)}\nLifetime Giving: $${newLifetime.toLocaleString()}\nTotal Donations: ${newCount}\nTier: ${donorTier.toUpperCase()}\nCampaigns Supported: ${campaignsArray.length}\n${zakatPaid > 0 ? `\n🕌 ZAKAT: Paid $${zakatPaid}, Remaining $${newZakatRemaining}` : ''}`
      }),
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
// HELPER FUNCTIONS
// ============================================

async function findContactByEmail(email: string): Promise<any> {
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

// Export for use
export { findContactByEmail };
