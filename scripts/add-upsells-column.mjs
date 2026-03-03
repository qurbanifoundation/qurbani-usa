/**
 * Add checkout_upsells JSONB column to site_settings
 * and seed with existing hardcoded upsells
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
console.log(`📍 Project: ${projectRef}`);

const defaultUpsells = [
  { id: 'prophetic-qurbani', title: 'Prophetic Qurbani', description: 'Follow the Sunnah of the Prophet ﷺ', amount: 50, enabled: true, sort_order: 1 },
  { id: 'feed-family', title: 'Feed a Family', description: 'Provide meals for a family in need', amount: 25, enabled: true, sort_order: 2 },
];

async function runSQL(sql) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  return response;
}

async function main() {
  // Step 1: Add column using REST API direct query
  console.log('📦 Adding checkout_upsells column...');

  // Use the Supabase REST API to update the row directly
  // First check if column exists by trying to read it
  const checkRes = await fetch(`${supabaseUrl}/rest/v1/site_settings?select=checkout_upsells&limit=1`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
  });

  if (checkRes.ok) {
    const checkData = await checkRes.json();
    if (checkData.length > 0 && checkData[0].checkout_upsells !== undefined) {
      console.log('✅ Column already exists, checking if seeded...');
      if (checkData[0].checkout_upsells && checkData[0].checkout_upsells.length > 0) {
        console.log('✅ Already seeded with', checkData[0].checkout_upsells.length, 'upsells');
        return;
      }
    }
  }

  // Try adding column via Management API
  const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      query: `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS checkout_upsells jsonb DEFAULT '[]'::jsonb;`,
    }),
  });

  if (!mgmtRes.ok) {
    // Fallback: try using pg directly
    console.log('⚠️  Management API failed, trying direct update...');
  } else {
    console.log('✅ Column added');
  }

  // Step 2: Seed with default upsells
  console.log('🌱 Seeding default upsells...');

  const seedRes = await fetch(`${supabaseUrl}/rest/v1/site_settings?id=eq.main`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ checkout_upsells: defaultUpsells }),
  });

  if (seedRes.ok) {
    console.log('✅ Seeded with', defaultUpsells.length, 'upsells');
  } else {
    const errText = await seedRes.text();
    console.error('❌ Seed failed:', seedRes.status, errText);
    console.log('💡 You may need to add the column manually:');
    console.log('   ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS checkout_upsells jsonb DEFAULT \'[]\'::jsonb;');
  }
}

main().catch(console.error);
