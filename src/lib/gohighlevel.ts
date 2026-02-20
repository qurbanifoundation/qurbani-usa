/**
 * GoHighLevel API Integration
 * Handles contact syncing when users sign up or make donations
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

interface GHLContact {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

interface GHLOpportunity {
  id?: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  monetaryValue?: number;
  status?: 'open' | 'won' | 'lost' | 'abandoned';
}

/**
 * Create or update a contact in GoHighLevel
 */
export async function upsertContact(
  contact: {
    email: string;
    fullName: string;
    phone?: string;
    tags?: string[];
    customFields?: Record<string, any>;
  },
  apiKey: string,
  locationId: string
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  try {
    // First, search for existing contact by email
    const searchResponse = await fetch(
      `${GHL_API_BASE}/contacts/search/duplicate?locationId=${locationId}&email=${encodeURIComponent(contact.email)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        }
      }
    );

    let existingContactId: string | null = null;

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.contact?.id) {
        existingContactId = searchData.contact.id;
      }
    }

    // Parse name into first/last
    const nameParts = contact.fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const contactData: any = {
      email: contact.email,
      firstName,
      lastName,
      name: contact.fullName,
      locationId
    };

    if (contact.phone) {
      contactData.phone = contact.phone;
    }

    if (contact.tags && contact.tags.length > 0) {
      contactData.tags = contact.tags;
    }

    if (contact.customFields) {
      contactData.customFields = Object.entries(contact.customFields).map(([key, value]) => ({
        key,
        value
      }));
    }

    let response: Response;

    if (existingContactId) {
      // Update existing contact
      response = await fetch(
        `${GHL_API_BASE}/contacts/${existingContactId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(contactData)
        }
      );
    } else {
      // Create new contact
      response = await fetch(
        `${GHL_API_BASE}/contacts/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(contactData)
        }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GHL API error:', errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    const contactId = existingContactId || data.contact?.id;

    return { success: true, contactId };

  } catch (error: any) {
    console.error('GHL upsertContact error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add tags to a contact
 */
export async function addTagsToContact(
  contactId: string,
  tags: string[],
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${GHL_API_BASE}/contacts/${contactId}/tags`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tags })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    return { success: true };

  } catch (error: any) {
    console.error('GHL addTagsToContact error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create an opportunity for a donation
 */
export async function createOpportunity(
  opportunity: {
    contactId: string;
    name: string;
    value: number;
    pipelineId: string;
    stageId: string;
  },
  apiKey: string,
  locationId: string
): Promise<{ success: boolean; opportunityId?: string; error?: string }> {
  try {
    const response = await fetch(
      `${GHL_API_BASE}/opportunities/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pipelineId: opportunity.pipelineId,
          pipelineStageId: opportunity.stageId,
          locationId,
          contactId: opportunity.contactId,
          name: opportunity.name,
          monetaryValue: opportunity.value,
          status: 'won' // Donation completed
        })
      }
    );

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

/**
 * Sync a new signup to GoHighLevel
 */
export async function syncSignupToGHL(
  user: {
    email: string;
    fullName: string;
    phone?: string;
  },
  apiKey: string,
  locationId: string
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  return upsertContact(
    {
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      tags: ['Website Signup', 'Qurbani USA']
    },
    apiKey,
    locationId
  );
}

/**
 * Sync a paid order to GoHighLevel
 */
export async function syncOrderToGHL(
  order: {
    donorEmail: string;
    donorName: string;
    donorPhone?: string;
    totalAmount: number;
    orderNumber: string;
    campaignName?: string;
  },
  apiKey: string,
  locationId: string
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  // Build tags based on order
  const tags = ['Donor', 'Qurbani USA', 'Paid Order'];
  if (order.campaignName) {
    tags.push(order.campaignName);
  }

  // Build custom fields
  const customFields: Record<string, any> = {
    last_order_number: order.orderNumber,
    last_order_amount: order.totalAmount,
    last_order_date: new Date().toISOString().split('T')[0]
  };

  const result = await upsertContact(
    {
      email: order.donorEmail,
      fullName: order.donorName,
      phone: order.donorPhone,
      tags,
      customFields
    },
    apiKey,
    locationId
  );

  // Add donation-specific tags
  if (result.success && result.contactId) {
    const donationTags = ['2026 Qurbani Donor'];
    if (order.totalAmount >= 1000) {
      donationTags.push('Major Donor');
    }
    await addTagsToContact(result.contactId, donationTags, apiKey);
  }

  return result;
}
