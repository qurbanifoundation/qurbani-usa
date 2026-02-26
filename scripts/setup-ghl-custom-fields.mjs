/**
 * Setup GHL Custom Fields + Donations Pipeline
 * Creates all 32 custom fields needed for donation tracking
 * and creates the "Donations" pipeline with stages.
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

const CUSTOM_FIELDS = [
  // Donation Tracking
  { name: 'Total Lifetime Giving', fieldKey: 'total_lifetime_giving', dataType: 'MONETORY', placeholder: '0' },
  { name: 'Last Donation Amount', fieldKey: 'last_donation_amount', dataType: 'MONETORY', placeholder: '0' },
  { name: 'Last Donation Date', fieldKey: 'last_donation_date', dataType: 'DATE' },
  { name: 'First Donation Date', fieldKey: 'first_donation_date', dataType: 'DATE' },
  { name: 'Donation Count', fieldKey: 'donation_count', dataType: 'NUMERICAL', placeholder: '0' },
  { name: 'Donor Tier', fieldKey: 'donor_tier', dataType: 'SINGLE_OPTIONS', options: ['donor', 'regular', 'major', 'vip'] },
  { name: 'Donation Type', fieldKey: 'donation_type', dataType: 'SINGLE_OPTIONS', options: ['single', 'monthly', 'weekly'] },
  { name: 'Campaigns Donated', fieldKey: 'campaigns_donated', dataType: 'LARGE_TEXT', placeholder: 'Campaign slugs' },
  { name: 'Favorite Cause', fieldKey: 'favorite_cause', dataType: 'TEXT', placeholder: 'Most recent campaign' },

  // Lead / Engagement Tracking
  { name: 'Lead Stage', fieldKey: 'lead_stage', dataType: 'SINGLE_OPTIONS', options: ['visitor', 'engaged', 'prospect', 'qualified', 'donor', 'advocate'] },
  { name: 'Cart Abandoned', fieldKey: 'cart_abandoned', dataType: 'SINGLE_OPTIONS', options: ['yes', 'no'] },
  { name: 'Cart Value', fieldKey: 'cart_value', dataType: 'MONETORY', placeholder: '0' },
  { name: 'Engagement Score', fieldKey: 'engagement_score', dataType: 'NUMERICAL', placeholder: '0' },
  { name: 'Lead Score', fieldKey: 'lead_score', dataType: 'NUMERICAL', placeholder: '0' },
  { name: 'Lead Source', fieldKey: 'lead_source', dataType: 'TEXT', placeholder: 'Source' },

  // Recurring Donation Tracking
  { name: 'Is Recurring Donor', fieldKey: 'is_recurring_donor', dataType: 'SINGLE_OPTIONS', options: ['yes', 'no'] },
  { name: 'Is Monthly Donor', fieldKey: 'is_monthly_donor', dataType: 'SINGLE_OPTIONS', options: ['yes', 'no'] },
  { name: 'Is Weekly Donor', fieldKey: 'is_weekly_donor', dataType: 'SINGLE_OPTIONS', options: ['yes', 'no'] },
  { name: 'Recurring Type', fieldKey: 'recurring_type', dataType: 'SINGLE_OPTIONS', options: ['none', 'monthly', 'weekly'] },
  { name: 'Monthly Donation Amount', fieldKey: 'monthly_donation_amount', dataType: 'MONETORY', placeholder: '0' },
  { name: 'Monthly Start Date', fieldKey: 'monthly_start_date', dataType: 'DATE' },

  // Jummah Tracking
  { name: 'Is Jummah Donor', fieldKey: 'is_jummah_donor', dataType: 'SINGLE_OPTIONS', options: ['yes', 'no'] },
  { name: 'Jummah Donation Amount', fieldKey: 'jummah_donation_amount', dataType: 'MONETORY', placeholder: '0' },
  { name: 'Jummah Start Date', fieldKey: 'jummah_start_date', dataType: 'DATE' },

  // Zakat Tracking
  { name: 'Zakat Paid', fieldKey: 'zakat_paid', dataType: 'MONETORY', placeholder: '0' },
  { name: 'Zakat Remaining', fieldKey: 'zakat_remaining', dataType: 'MONETORY', placeholder: '0' },
  { name: 'Calculated Zakat', fieldKey: 'calculated_zakat', dataType: 'MONETORY', placeholder: '0' },
  { name: 'Total Zakatable Assets', fieldKey: 'total_zakatable_assets', dataType: 'MONETORY', placeholder: '0' },
  { name: 'Zakat Calculation Date', fieldKey: 'zakat_calculation_date', dataType: 'DATE' },

  // Pre-sale Tracking
  { name: 'Campaign Interests', fieldKey: 'campaign_interests', dataType: 'LARGE_TEXT', placeholder: 'Campaign slugs' },
  { name: 'Last Campaign Viewed', fieldKey: 'last_campaign_viewed', dataType: 'TEXT', placeholder: 'Campaign name' },
  { name: 'Pages Viewed', fieldKey: 'pages_viewed', dataType: 'NUMERICAL', placeholder: '0' },
];

// ============================================
// PIPELINE DEFINITION
// ============================================

const PIPELINE = {
  name: 'Donations',
  stages: [
    { name: 'New Donation' },
    { name: 'Fulfilled' },
  ],
};

// ============================================
// MAIN EXECUTION
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

  // For dropdown/options fields
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
    name: PIPELINE.name,
    stages: PIPELINE.stages,
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

async function main() {
  console.log('🔧 GHL Setup: Custom Fields + Donations Pipeline');
  console.log(`📍 Location: ${GHL_LOCATION_ID}`);
  console.log('');

  // ---- Step 1: Custom Fields ----
  console.log('━'.repeat(50));
  console.log('📋 STEP 1: Creating Custom Fields');
  console.log('━'.repeat(50));

  // Get existing fields to check for duplicates
  const existing = await getExistingCustomFields();
  const existingKeys = new Set(existing.map(f => f.fieldKey));
  console.log(`Found ${existing.length} existing custom fields`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const field of CUSTOM_FIELDS) {
    // Check if field already exists
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
  console.log('🔄 STEP 2: Creating Donations Pipeline');
  console.log('━'.repeat(50));

  const pipelines = await getExistingPipelines();
  const donationPipeline = pipelines.find(p => p.name.toLowerCase().includes('donation'));

  if (donationPipeline) {
    console.log(`  ⏭️  "Donations" pipeline already exists (ID: ${donationPipeline.id})`);
    console.log(`     Stages: ${donationPipeline.stages?.map(s => s.name).join(' → ')}`);
  } else {
    const result = await createPipeline();
    if (result.status === 'created') {
      const p = result.pipeline;
      console.log(`  ✅ "Donations" pipeline created (ID: ${p.id || 'N/A'})`);
      console.log(`     Stages: ${PIPELINE.stages.map(s => s.name).join(' → ')}`);
    } else {
      console.log(`  ❌ Failed to create pipeline: ${result.error}`);
    }
  }

  console.log('');
  console.log('━'.repeat(50));
  console.log('✅ GHL Setup Complete!');
  console.log('━'.repeat(50));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
