/**
 * GoHighLevel Integration Library
 *
 * Handles all GHL API interactions:
 * - Contact creation/updates
 * - Opportunity tracking
 * - Tag management
 * - Webhook processing
 *
 * SECURITY: All API keys come from environment variables, never hardcoded.
 */

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

// Get credentials from environment (server-side only)
function getGHLCredentials() {
  const apiKey = import.meta.env.GHL_API_KEY;
  const locationId = import.meta.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    throw new Error('GHL credentials not configured. Set GHL_API_KEY and GHL_LOCATION_ID in .env');
  }

  return { apiKey, locationId };
}

// Export for use in other modules
export function getLocationId(): string {
  return getGHLCredentials().locationId;
}

// ============================================
// TYPES
// ============================================

export interface GHLContact {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  tags?: string[];
  customFields?: Record<string, string>;
  source?: string;
}

export interface GHLOpportunity {
  name: string;
  pipelineId: string;
  stageId: string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  monetaryValue?: number;
  contactId: string;
}

export interface GHLContactResponse {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  tags?: string[];
  customFields?: Array<{
    id?: string;
    key?: string;
    value?: string;
    field_value?: string;
  }>;
}

export interface GHLWebhookPayload {
  type: string;
  locationId: string;
  id?: string;
  contact?: GHLContactResponse;
  [key: string]: any;
}

// ============================================
// API HELPERS
// ============================================

async function ghlFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const { apiKey } = getGHLCredentials();

  const headers: HeadersInit = {
    'Authorization': `Bearer ${apiKey}`,
    'Version': GHL_API_VERSION,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  return fetch(`${GHL_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
}

// ============================================
// CONTACT OPERATIONS
// ============================================

/**
 * Search for an existing contact by email
 * Returns full contact details including custom fields
 */
export async function findContactByEmail(email: string): Promise<GHLContactResponse | null> {
  try {
    const { locationId } = getGHLCredentials();

    // First, find the contact ID via duplicate search
    const searchResponse = await ghlFetch(
      `/contacts/search/duplicate?locationId=${locationId}&email=${encodeURIComponent(email)}`
    );

    if (!searchResponse.ok) {
      return null;
    }

    const searchData = await searchResponse.json();
    const contactId = searchData.contact?.id;

    if (!contactId) {
      return null;
    }

    // Then fetch full contact details including custom fields
    const contactResponse = await ghlFetch(`/contacts/${contactId}`);

    if (contactResponse.ok) {
      const contactData = await contactResponse.json();
      return contactData.contact || null;
    }

    // Fall back to search result if full fetch fails
    return searchData.contact || null;
  } catch (error) {
    console.error('GHL findContactByEmail error:', error);
    return null;
  }
}

/**
 * Create or update a contact in GHL
 */
export async function upsertContact(
  contact: GHLContact
): Promise<{ success: boolean; contactId?: string; isNew?: boolean; error?: string }> {
  try {
    const { locationId } = getGHLCredentials();

    // Check for existing contact
    const existingContact = await findContactByEmail(contact.email);

    const contactData: any = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      tags: contact.tags || ['website'],
      source: contact.source || 'Qurbani USA Website',
      locationId,
    };

    if (contact.customFields) {
      contactData.customFields = Object.entries(contact.customFields).map(([key, value]) => ({
        key,
        field_value: value,
      }));
    }

    let response: Response;
    let isNew = false;

    if (existingContact?.id) {
      // Update existing contact
      response = await ghlFetch(`/contacts/${existingContact.id}`, {
        method: 'PUT',
        body: JSON.stringify(contactData),
      });
    } else {
      // Create new contact
      isNew = true;
      response = await ghlFetch('/contacts/', {
        method: 'POST',
        body: JSON.stringify(contactData),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GHL contact error:', errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    const contactId = existingContact?.id || data.contact?.id;

    return { success: true, contactId, isNew };
  } catch (error: any) {
    console.error('GHL upsertContact error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add tags to an existing contact
 */
export async function addTagsToContact(
  contactId: string,
  tags: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await ghlFetch(`/contacts/${contactId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tags }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error: any) {
    console.error('GHL addTags error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove tags from a contact
 */
export async function removeTagsFromContact(
  contactId: string,
  tags: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await ghlFetch(`/contacts/${contactId}/tags`, {
      method: 'DELETE',
      body: JSON.stringify({ tags }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error: any) {
    console.error('GHL removeTags error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add a note to a contact
 */
export async function addNoteToContact(
  contactId: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await ghlFetch(`/contacts/${contactId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error: any) {
    console.error('GHL addNote error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update contact status (custom field)
 */
export async function updateContactStatus(
  contactId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await ghlFetch(`/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify({
        customFields: [{ key: 'status', field_value: status }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error: any) {
    console.error('GHL updateStatus error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// OPPORTUNITY OPERATIONS
// ============================================

/**
 * Create an opportunity (for tracking donations as deals)
 */
export async function createOpportunity(
  opportunity: {
    contactId: string;
    name: string;
    monetaryValue: number;
    pipelineId: string;
    stageId: string;
    status?: 'open' | 'won' | 'lost' | 'abandoned';
  }
): Promise<{ success: boolean; opportunityId?: string; error?: string }> {
  try {
    const { locationId } = getGHLCredentials();

    const response = await ghlFetch('/opportunities/', {
      method: 'POST',
      body: JSON.stringify({
        locationId,
        pipelineId: opportunity.pipelineId,
        pipelineStageId: opportunity.stageId,
        contactId: opportunity.contactId,
        name: opportunity.name,
        status: opportunity.status || 'won',
        monetaryValue: opportunity.monetaryValue,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const data = await response.json();
    return { success: true, opportunityId: data.opportunity?.id };
  } catch (error: any) {
    console.error('GHL createOpportunity error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// HIGH-LEVEL SYNC FUNCTIONS
// ============================================

/**
 * Sync a contact form submission to GHL
 */
export async function syncContactFormToGHL(data: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  subject?: string;
  message?: string;
  newsletter?: boolean;
}): Promise<{ success: boolean; contactId?: string; error?: string }> {
  // Build tags
  const tags = ['website', 'contact-form'];
  if (data.newsletter) {
    tags.push('newsletter');
  }
  if (data.subject) {
    tags.push(`inquiry-${data.subject.toLowerCase().replace(/\s+/g, '-')}`);
  }

  // Create/update contact
  const result = await upsertContact({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    tags,
    source: 'Contact Form',
  });

  // Add note with message if contact created successfully
  if (result.success && result.contactId && data.message) {
    const note = `
Contact Form Submission
-----------------------
Subject: ${data.subject || 'General Inquiry'}
Message: ${data.message}
Date: ${new Date().toLocaleDateString()}
Newsletter: ${data.newsletter ? 'Yes' : 'No'}
    `.trim();

    await addNoteToContact(result.contactId, note);
  }

  return result;
}

/**
 * Sync a newsletter signup to GHL
 */
export async function syncNewsletterSignupToGHL(data: {
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ success: boolean; contactId?: string; error?: string }> {
  return upsertContact({
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email,
    tags: ['website', 'newsletter'],
    source: 'Newsletter Signup',
  });
}

/**
 * Sync a donation to GHL with Custom Fields for Lifetime Tracking
 *
 * Custom Fields used (create these in GHL):
 * - total_lifetime_giving (Currency)
 * - last_donation_amount (Currency)
 * - last_donation_date (Date)
 * - donation_count (Number)
 * - donor_tier (Text: prospect, donor, regular, major, vip)
 * - first_donation_date (Date)
 */
export async function syncDonationToGHL(data: {
  donorEmail: string;
  donorName: string;
  donorPhone?: string;
  amount: number;
  campaignName?: string;
  donationType: 'single' | 'monthly';
  items?: Array<{ name: string; amount: number }>;
  pipelineId?: string;
  stageId?: string;
}): Promise<{ success: boolean; contactId?: string; error?: string }> {
  // Parse name
  const nameParts = data.donorName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Check for existing contact to get lifetime data
  const existingContact = await findContactByEmail(data.donorEmail);

  // Calculate lifetime giving
  let currentLifetimeGiving = 0;
  let currentDonationCount = 0;
  let firstDonationDate = new Date().toISOString().split('T')[0];

  if (existingContact) {
    // Try to get existing custom field values
    const customFields = existingContact.customFields || [];
    for (const field of customFields as any[]) {
      if (field.key === 'total_lifetime_giving' || field.id === 'total_lifetime_giving') {
        currentLifetimeGiving = parseFloat(field.value || field.field_value || '0') || 0;
      }
      if (field.key === 'donation_count' || field.id === 'donation_count') {
        currentDonationCount = parseInt(field.value || field.field_value || '0') || 0;
      }
      if (field.key === 'first_donation_date' || field.id === 'first_donation_date') {
        firstDonationDate = field.value || field.field_value || firstDonationDate;
      }
    }
  }

  // Calculate new totals
  const newLifetimeGiving = currentLifetimeGiving + data.amount;
  const newDonationCount = currentDonationCount + 1;
  const today = new Date().toISOString().split('T')[0];

  // Determine donor tier based on LIFETIME giving (not single donation)
  let donorTier = 'donor';
  if (newLifetimeGiving >= 10000) {
    donorTier = 'vip';
  } else if (newLifetimeGiving >= 5000) {
    donorTier = 'major';
  } else if (newLifetimeGiving >= 1000) {
    donorTier = 'regular';
  }

  // Build tags - organized by category
  const tags = [
    // Source tags
    'donor',
    'website',
    // Donation type tags
    data.donationType === 'monthly' ? 'monthly-donor' : 'one-time-donor',
  ];

  // Campaign/cause tags (what they care about)
  if (data.campaignName) {
    tags.push(data.campaignName.toLowerCase().replace(/\s+/g, '-'));
  }

  // Tier tags (based on lifetime, not single donation)
  if (newLifetimeGiving >= 1000) {
    tags.push('major-donor');
  }
  if (newLifetimeGiving >= 5000) {
    tags.push('vip-donor');
  }

  // Year tag for cohort tracking
  tags.push(`donor-${new Date().getFullYear()}`);

  // Create/update contact with custom fields
  const result = await upsertContact({
    firstName,
    lastName,
    email: data.donorEmail,
    phone: data.donorPhone,
    tags,
    source: 'Donation',
    customFields: {
      total_lifetime_giving: newLifetimeGiving.toFixed(2),
      last_donation_amount: data.amount.toFixed(2),
      last_donation_date: today,
      donation_count: newDonationCount.toString(),
      donor_tier: donorTier,
      first_donation_date: existingContact ? firstDonationDate : today,
      donation_type: data.donationType,
    },
  });

  if (!result.success || !result.contactId) {
    return result;
  }

  // Add donation note with full details
  const itemsList = data.items?.map(i => `${i.name}: $${i.amount}`).join(', ') || data.campaignName || 'General Donation';
  const note = `
💰 Donation Received
━━━━━━━━━━━━━━━━━━━━
Amount: $${data.amount.toFixed(2)}
Type: ${data.donationType === 'monthly' ? 'Monthly Recurring' : 'One-time'}
Campaign: ${data.campaignName || 'General'}
Items: ${itemsList}
Date: ${new Date().toLocaleDateString()}

📊 Donor Stats Updated:
• Lifetime Giving: $${newLifetimeGiving.toFixed(2)}
• Total Donations: ${newDonationCount}
• Tier: ${donorTier.toUpperCase()}
  `.trim();

  await addNoteToContact(result.contactId, note);

  // Create opportunity if pipeline configured
  if (data.pipelineId && data.stageId) {
    await createOpportunity({
      contactId: result.contactId,
      name: `Donation - $${data.amount.toFixed(2)}`,
      monetaryValue: data.amount,
      pipelineId: data.pipelineId,
      stageId: data.stageId,
      status: 'won',
    });
  }

  return result;
}

/**
 * Sync a Zakat calculation to GHL
 *
 * Custom Fields used (create these in GHL):
 * - calculated_zakat (Currency) - Their Zakat obligation
 * - zakat_calculation_date (Date) - When they calculated
 * - total_zakatable_assets (Currency) - Their total assets
 * - lead_score (Number) - Higher = more likely to donate
 */
export async function syncZakatCalculationToGHL(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  zakatAmount: number;
  totalAssets?: number;
  wantsReminder?: boolean;
}): Promise<{ success: boolean; contactId?: string; error?: string }> {
  // Build tags based on behavior
  const tags = ['website', 'zakat-calculator', `zakat-${new Date().getFullYear()}`];

  // High-value prospect tagging
  if (data.zakatAmount >= 5000) {
    tags.push('high-value-prospect');
  } else if (data.zakatAmount >= 1000) {
    tags.push('qualified-prospect');
  }

  // Ramadan timing tag (if during Ramadan season - roughly March/April)
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) {
    tags.push('ramadan-prospect');
  }

  if (data.wantsReminder) {
    tags.push('nisab-alert');
  }

  // Calculate lead score based on Zakat amount
  let leadScore = 0;
  if (data.zakatAmount > 0) leadScore += 20;
  if (data.zakatAmount >= 100) leadScore += 20;
  if (data.zakatAmount >= 500) leadScore += 20;
  if (data.zakatAmount >= 1000) leadScore += 20;
  if (data.zakatAmount >= 5000) leadScore += 20;

  return upsertContact({
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email,
    tags,
    source: 'Zakat Calculator',
    customFields: {
      calculated_zakat: data.zakatAmount.toFixed(2),
      zakat_calculation_date: new Date().toISOString().split('T')[0],
      total_zakatable_assets: (data.totalAssets || 0).toFixed(2),
      lead_score: leadScore.toString(),
      lead_source: 'Zakat Calculator',
    },
  });
}
