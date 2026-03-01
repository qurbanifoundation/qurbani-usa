/**
 * Setup GHL Custom Fields + Donation Recovery Pipeline
 * Creates custom fields for abandoned checkout tracking
 * and a "Donation Recovery" pipeline with stages.
 *
 * Run: node scripts/setup-ghl-recovery-fields.mjs
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Try worktree .env first, fall back to main repo .env
dotenv.config({ path: join(__dirname, '..', '.env') });
if (!process.env.GHL_API_KEY) {
  dotenv.config({ path: '/Users/macbookpro/Developer/qurbani-usa/.env' });
}

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

if (!GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error('❌ Missing GHL_API_KEY or GHL_LOCATION_ID in .env');
  process.exit(1);
}

async function ghlFetch(endpoint, options = {}) {
  const res = await fetch(`${GHL_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Version': GHL_API_VERSION,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res;
}

// ============================================
// CUSTOM FIELDS DEFINITION
// ============================================

const RECOVERY_CUSTOM_FIELDS = [
  // Checkout status tracking
  { name: 'Checkout Status', fieldKey: 'checkout_status', dataType: 'SINGLE_OPTIONS',
    options: ['started', 'abandoned', 'recovered', 'expired'] },
  { name: 'Checkout Started At', fieldKey: 'checkout_started_at', dataType: 'DATE' },
  { name: 'Checkout Abandoned At', fieldKey: 'checkout_abandoned_at', dataType: 'DATE' },
  { name: 'Checkout Recovered At', fieldKey: 'checkout_recovered_at', dataType: 'DATE' },

  // Donation intent
  { name: 'Intent Amount', fieldKey: 'intent_amount', dataType: 'MONETORY', placeholder: '0' },
  { name: 'Intent Currency', fieldKey: 'intent_currency', dataType: 'TEXT', placeholder: 'USD' },
  { name: 'Intent Campaign Type', fieldKey: 'intent_campaign_type', dataType: 'TEXT' },
  { name: 'Intent Campaign Slug', fieldKey: 'intent_campaign_slug', dataType: 'TEXT' },

  // UTM tracking (prefixed to avoid collision with future general UTM fields)
  { name: 'Checkout UTM Source', fieldKey: 'checkout_utm_source', dataType: 'TEXT' },
  { name: 'Checkout UTM Medium', fieldKey: 'checkout_utm_medium', dataType: 'TEXT' },
  { name: 'Checkout UTM Campaign', fieldKey: 'checkout_utm_campaign', dataType: 'TEXT' },
  { name: 'Checkout UTM Term', fieldKey: 'checkout_utm_term', dataType: 'TEXT' },

  // Recovery tracking
  { name: 'Recovery Step Last Sent', fieldKey: 'recovery_step_last_sent', dataType: 'NUMERICAL', placeholder: '0' },
  { name: 'Recovery Resume URL', fieldKey: 'recovery_resume_url', dataType: 'TEXT' },
];

// ============================================
// PIPELINE DEFINITION
// ============================================

const RECOVERY_PIPELINE = {
  name: 'Donation Recovery',
  stages: [
    { name: 'Checkout Started' },
    { name: 'Abandoned 1h' },
    { name: 'Abandoned 24h' },
    { name: 'Abandoned 72h' },
    { name: 'Abandoned 5d' },
    { name: 'Abandoned 7d' },
    { name: 'Recovered' },
    { name: 'Closed Lost' },
  ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getExistingCustomFields() {
  const res = await ghlFetch(`/locations/${GHL_LOCATION_ID}/customFields`);
  if (!res.ok) {
    const text = await res.text();
    console.error('❌ Failed to fetch existing custom fields:', res.status, text);
    return [];
  }
  const data = await res.json();
  return data.customFields || [];
}

async function createCustomField(field) {
  const body = {
    name: field.name,
    fieldKey: field.fieldKey,
    dataType: field.dataType,
    position: 0,
    model: 'contact',
  };

  if (field.placeholder) body.placeholder = field.placeholder;
  if (field.options && field.dataType === 'SINGLE_OPTIONS') {
    body.options = field.options;
  }

  const res = await ghlFetch(`/locations/${GHL_LOCATION_ID}/customFields`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const result = await res.json();

  if (!res.ok) {
    if (result.message?.includes('already exists') || result.msg?.includes('already exists')) {
      return { status: 'exists', field: field.name };
    }
    return { status: 'error', field: field.name, error: result.message || result.msg || JSON.stringify(result) };
  }

  return { status: 'created', field: field.name, id: result.customField?.id };
}

async function getExistingPipelines() {
  const res = await ghlFetch(`/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.pipelines || [];
}

async function createPipeline() {
  const body = {
    name: RECOVERY_PIPELINE.name,
    stages: RECOVERY_PIPELINE.stages,
    locationId: GHL_LOCATION_ID,
    showInFunnel: true,
  };

  const res = await ghlFetch('/opportunities/pipelines', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const result = await res.json();

  if (!res.ok) {
    return { status: 'error', error: result.message || result.msg || JSON.stringify(result) };
  }

  return { status: 'created', pipeline: result };
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('🔧 GHL Setup: Recovery Custom Fields + Donation Recovery Pipeline');
  console.log(`📍 Location: ${GHL_LOCATION_ID}`);
  console.log('');

  // ---- Step 1: Custom Fields ----
  console.log('━'.repeat(50));
  console.log('📋 STEP 1: Creating Recovery Custom Fields');
  console.log('━'.repeat(50));

  const existing = await getExistingCustomFields();
  const existingKeys = new Set(existing.map(f => f.fieldKey));
  console.log(`Found ${existing.length} existing custom fields`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const field of RECOVERY_CUSTOM_FIELDS) {
    if (existingKeys.has(`contact.${field.fieldKey}`) || existingKeys.has(field.fieldKey)) {
      console.log(`  ⏭️  ${field.name} (${field.fieldKey}) - already exists`);
      skipped++;
      continue;
    }

    const result = await createCustomField(field);

    if (result.status === 'created') {
      console.log(`  ✅ ${field.name} (${field.fieldKey}) - created`);
      created++;
    } else if (result.status === 'exists') {
      console.log(`  ⏭️  ${field.name} (${field.fieldKey}) - already exists`);
      skipped++;
    } else {
      console.log(`  ❌ ${field.name} (${field.fieldKey}) - ERROR: ${result.error}`);
      errors++;
    }

    // Rate limit: small delay between requests
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('');
  console.log(`Custom Fields Summary: ${created} created, ${skipped} skipped, ${errors} errors`);
  console.log('');

  // ---- Step 2: Pipeline ----
  console.log('━'.repeat(50));
  console.log('🔄 STEP 2: Creating Donation Recovery Pipeline');
  console.log('━'.repeat(50));

  const pipelines = await getExistingPipelines();
  const recoveryPipeline = pipelines.find(p => p.name.toLowerCase().includes('donation recovery'));

  if (recoveryPipeline) {
    console.log(`  ⏭️  "Donation Recovery" pipeline already exists (ID: ${recoveryPipeline.id})`);
    console.log(`     Stages: ${recoveryPipeline.stages?.map(s => s.name).join(' → ')}`);
  } else {
    const result = await createPipeline();
    if (result.status === 'created') {
      const p = result.pipeline;
      console.log(`  ✅ "Donation Recovery" pipeline created (ID: ${p.id || p.pipeline?.id || 'N/A'})`);
      console.log(`     Stages: ${RECOVERY_PIPELINE.stages.map(s => s.name).join(' → ')}`);
    } else {
      console.log(`  ❌ Failed to create pipeline: ${result.error}`);
    }
  }

  console.log('');
  console.log('━'.repeat(50));
  console.log('✅ GHL Recovery Setup Complete!');
  console.log('━'.repeat(50));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
