/**
 * GHL Sync for Abandoned Checkout Recovery
 *
 * Uses the same findContactByEmail pattern as ghl-advanced.ts
 * to ensure NO DUPLICATE contacts are ever created.
 * Manages the "Donation Recovery" pipeline and custom fields.
 */

import { supabaseAdmin } from './supabase';
import { findContactByEmail } from './ghl-advanced';

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
  const res = await fetch(`${GHL_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Version': GHL_API_VERSION,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res;
}

// ============================================
// RECOVERY PIPELINE CACHE
// ============================================

let cachedRecoveryPipelineId: string | null = null;
let cachedRecoveryStages = new Map<string, string>();

async function loadRecoveryPipelineConfig(): Promise<boolean> {
  if (cachedRecoveryPipelineId && cachedRecoveryStages.size > 0) return true;

  cachedRecoveryPipelineId = null;
  cachedRecoveryStages = new Map();

  try {
    const { locationId } = getGHLCredentials();
    const pipelinesRes = await ghlFetch(`/opportunities/pipelines?locationId=${locationId}`);
    if (!pipelinesRes.ok) {
      console.error('[Recovery GHL] Pipeline config fetch failed:', pipelinesRes.status);
      return false;
    }

    const pipelinesData = await pipelinesRes.json();
    const recoveryPipeline = pipelinesData.pipelines?.find(
      (p: { name: string }) => p.name.toLowerCase().includes('donation recovery')
    );

    if (!recoveryPipeline) {
      console.error('[Recovery GHL] No "Donation Recovery" pipeline found — run scripts/setup-ghl-recovery-fields.mjs');
      return false;
    }

    cachedRecoveryPipelineId = recoveryPipeline.id;
    for (const stage of recoveryPipeline.stages || []) {
      cachedRecoveryStages.set(stage.name.toLowerCase(), stage.id);
    }

    console.log('[Recovery GHL] Pipeline loaded:', cachedRecoveryPipelineId, 'Stages:', [...cachedRecoveryStages.keys()].join(', '));
    return true;
  } catch (err) {
    console.error('[Recovery GHL] loadRecoveryPipelineConfig error:', err);
    return false;
  }
}

function getRecoveryStageId(stageName: string): string | undefined {
  const exact = cachedRecoveryStages.get(stageName.toLowerCase());
  if (exact) return exact;

  for (const [name, id] of cachedRecoveryStages) {
    if (name.includes(stageName.toLowerCase())) return id;
  }
  return undefined;
}

// Map recovery step number to pipeline stage name
const STEP_TO_STAGE: Record<number, string> = {
  0: 'checkout started',
  1: 'abandoned 1h',
  2: 'abandoned 24h',
  3: 'abandoned 72h',
  4: 'abandoned 5d',
  5: 'abandoned 7d',
};

// ============================================
// MAIN SYNC FUNCTION
// ============================================

export interface CheckoutSyncData {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status: 'started' | 'abandoned' | 'recovered' | 'expired';
  amount?: number | null;
  currency?: string | null;
  campaignType?: string | null;
  campaignSlug?: string | null;
  resumeUrl?: string | null;
  recoveryStep?: number;
  checkoutStartedAt?: string | null;
  abandonedAt?: string | null;
  recoveredAt?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  checkoutId?: string; // abandoned_checkouts.id for updating ghl_contact_id
}

/**
 * Sync checkout status to GHL contact.
 * NEVER creates duplicate contacts — always searches by email first.
 */
export async function syncCheckoutToGHL(data: CheckoutSyncData): Promise<{ success: boolean; contactId?: string }> {
  try {
    const { locationId } = getGHLCredentials();
    const existing = await findContactByEmail(data.email);

    // Build custom fields
    const customFields: Array<{ key: string; field_value: string }> = [
      { key: 'checkout_status', field_value: data.status },
    ];

    if (data.checkoutStartedAt) {
      customFields.push({ key: 'checkout_started_at', field_value: data.checkoutStartedAt });
    }
    if (data.abandonedAt) {
      customFields.push({ key: 'checkout_abandoned_at', field_value: data.abandonedAt });
    }
    if (data.recoveredAt) {
      customFields.push({ key: 'checkout_recovered_at', field_value: data.recoveredAt });
    }
    if (data.amount != null) {
      customFields.push({ key: 'intent_amount', field_value: data.amount.toString() });
    }
    if (data.currency) {
      customFields.push({ key: 'intent_currency', field_value: data.currency });
    }
    if (data.campaignType) {
      customFields.push({ key: 'intent_campaign_type', field_value: data.campaignType });
    }
    if (data.campaignSlug) {
      customFields.push({ key: 'intent_campaign_slug', field_value: data.campaignSlug });
    }
    if (data.resumeUrl) {
      customFields.push({ key: 'recovery_resume_url', field_value: data.resumeUrl });
    }
    if (data.recoveryStep != null) {
      customFields.push({ key: 'recovery_step_last_sent', field_value: data.recoveryStep.toString() });
    }
    if (data.utmSource) {
      customFields.push({ key: 'checkout_utm_source', field_value: data.utmSource });
    }
    if (data.utmMedium) {
      customFields.push({ key: 'checkout_utm_medium', field_value: data.utmMedium });
    }
    if (data.utmCampaign) {
      customFields.push({ key: 'checkout_utm_campaign', field_value: data.utmCampaign });
    }
    if (data.utmTerm) {
      customFields.push({ key: 'checkout_utm_term', field_value: data.utmTerm });
    }

    // Build tags
    const tags: string[] = ['website'];
    if (data.status === 'started') {
      tags.push('checkout-started');
    } else if (data.status === 'abandoned') {
      tags.push('checkout-abandoned', 'recovery-target');
    } else if (data.status === 'recovered') {
      tags.push('checkout-recovered', 'donor');
    }

    let contactId: string | undefined;

    if (existing?.id) {
      // UPDATE existing contact
      contactId = existing.id as string;
      await ghlFetch(`/contacts/${contactId}`, {
        method: 'PUT',
        body: JSON.stringify({ customFields, tags }),
      });
      console.log(`[Recovery GHL] Updated contact ${contactId} (${data.email}) — status: ${data.status}`);
    } else {
      // CREATE new contact (only if not found)
      const contactBody: Record<string, unknown> = {
        email: data.email,
        locationId,
        source: 'Checkout Recovery',
        customFields,
        tags,
      };
      if (data.firstName) contactBody.firstName = data.firstName;
      if (data.lastName) contactBody.lastName = data.lastName;

      const res = await ghlFetch('/contacts/', {
        method: 'POST',
        body: JSON.stringify(contactBody),
      });

      if (res.ok) {
        const result = await res.json();
        contactId = result.contact?.id;
        console.log(`[Recovery GHL] Created contact ${contactId} (${data.email})`);
      } else {
        const errText = await res.text();
        console.error(`[Recovery GHL] Failed to create contact: ${res.status} ${errText}`);
        return { success: false };
      }
    }

    // Store ghl_contact_id back to Supabase
    if (contactId && data.checkoutId) {
      await supabaseAdmin
        .from('abandoned_checkouts')
        .update({ ghl_contact_id: contactId })
        .eq('id', data.checkoutId);
    }

    // Pipeline: create or move opportunity
    await manageRecoveryOpportunity(contactId, data);

    return { success: true, contactId };
  } catch (err) {
    console.error('[Recovery GHL] syncCheckoutToGHL error:', err);
    return { success: false };
  }
}

// ============================================
// PIPELINE MANAGEMENT
// ============================================

async function manageRecoveryOpportunity(
  contactId: string | undefined,
  data: CheckoutSyncData,
) {
  if (!contactId) return;

  const loaded = await loadRecoveryPipelineConfig();
  if (!loaded || !cachedRecoveryPipelineId) return;

  const { locationId } = getGHLCredentials();

  // Determine target stage
  let targetStageName: string;
  if (data.status === 'recovered') {
    targetStageName = 'recovered';
  } else if (data.status === 'expired') {
    targetStageName = 'closed lost';
  } else if (data.status === 'abandoned') {
    targetStageName = STEP_TO_STAGE[data.recoveryStep || 1] || 'abandoned 1h';
  } else {
    targetStageName = 'checkout started';
  }

  const stageId = getRecoveryStageId(targetStageName);
  if (!stageId) {
    console.log(`[Recovery GHL] Stage "${targetStageName}" not found in pipeline`);
    return;
  }

  // Search for existing opportunity in the recovery pipeline
  try {
    const searchRes = await ghlFetch(
      `/opportunities/search?location_id=${locationId}&pipeline_id=${cachedRecoveryPipelineId}&contact_id=${contactId}&status=open`
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const opportunities = searchData.opportunities || [];

      if (opportunities.length > 0) {
        // Move existing opportunity
        const opp = opportunities[0];
        const oppStatus = (data.status === 'recovered') ? 'won'
          : (data.status === 'expired') ? 'lost'
          : 'open';

        await ghlFetch(`/opportunities/${opp.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            pipelineStageId: stageId,
            pipelineId: cachedRecoveryPipelineId,
            status: oppStatus,
          }),
        });
        console.log(`[Recovery GHL] Opportunity ${opp.id} moved to "${targetStageName}" (${oppStatus})`);
        return;
      }
    }
  } catch (err) {
    console.error('[Recovery GHL] Opportunity search error:', err);
  }

  // No existing opportunity — create one
  const oppName = `$${data.amount || 0} - ${data.campaignSlug || 'Donation'} (Recovery)`;

  try {
    await ghlFetch('/opportunities/', {
      method: 'POST',
      body: JSON.stringify({
        pipelineId: cachedRecoveryPipelineId,
        locationId,
        name: oppName,
        pipelineStageId: stageId,
        status: 'open',
        contactId,
        monetaryValue: data.amount || 0,
        source: 'Checkout Recovery',
      }),
    });
    console.log(`[Recovery GHL] Created opportunity "${oppName}" in "${targetStageName}"`);
  } catch (err) {
    console.error('[Recovery GHL] Create opportunity error:', err);
  }
}
