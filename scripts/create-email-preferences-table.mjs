/**
 * Email Preferences Table Creation Script
 * Creates the email_preferences table for managing subscriber preferences
 * Uses Supabase Management API or PostgreSQL direct connection
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

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

const sql = `
-- Email Preferences Table
CREATE TABLE IF NOT EXISTS email_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  preference_token VARCHAR(64) NOT NULL,

  -- Category toggles (all default ON for maximum retention)
  pref_ramadan BOOLEAN DEFAULT true,
  pref_zakat BOOLEAN DEFAULT true,
  pref_orphan BOOLEAN DEFAULT true,
  pref_emergency BOOLEAN DEFAULT true,
  pref_newsletter BOOLEAN DEFAULT true,
  pref_eid_greetings BOOLEAN DEFAULT true,
  pref_qurbani BOOLEAN DEFAULT true,
  pref_water BOOLEAN DEFAULT true,

  -- Frequency: 'all' | 'weekly_digest' | 'important_only'
  frequency VARCHAR(20) DEFAULT 'all',

  -- Global unsubscribe
  unsubscribed_all BOOLEAN DEFAULT false,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  unsubscribe_reason TEXT,

  -- GHL sync tracking
  ghl_contact_id VARCHAR(100),
  ghl_synced_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  source VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_prefs_email ON email_preferences(email);
CREATE INDEX IF NOT EXISTS idx_email_prefs_token ON email_preferences(preference_token);

-- Row Level Security
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Service role full access" ON email_preferences;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Service role full access" ON email_preferences FOR ALL USING (auth.role() = 'service_role');
`;

async function tryManagementApi() {
  console.log('\n🔄 Attempting Supabase Management API...');

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (response.ok) {
      console.log('✅ Table created via Management API!');
      return true;
    }

    const errorText = await response.text();
    console.log(`❌ Management API failed (${response.status}): ${errorText.substring(0, 200)}`);
    return false;
  } catch (e) {
    console.log(`❌ Management API error: ${e.message}`);
    return false;
  }
}

async function tryPostgresConnection() {
  console.log('\n🔄 Attempting direct PostgreSQL connection...');

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (databaseUrl) {
    try {
      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      await client.query(sql);
      await client.end();
      console.log('✅ Table created via direct PostgreSQL connection!');
      return true;
    } catch (e) {
      console.log(`❌ PostgreSQL error: ${e.message}`);
      return false;
    }
  }

  console.log('   ⚠️  DATABASE_URL not found in environment variables.');
  return false;
}

async function outputSqlForManualExecution() {
  console.log('\n' + '═'.repeat(70));
  console.log('📋 MANUAL EXECUTION REQUIRED');
  console.log('═'.repeat(70));
  console.log('\nRun this SQL in your Supabase Dashboard > SQL Editor:\n');
  console.log('─'.repeat(70));
  console.log(sql);
  console.log('─'.repeat(70));
  console.log('\nDashboard URL: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
  console.log('═'.repeat(70));
}

async function main() {
  console.log('🚀 Creating email_preferences table...\n');

  if (await tryManagementApi()) {
    console.log('\n✅ email_preferences table created successfully!');
    return;
  }

  if (await tryPostgresConnection()) {
    console.log('\n✅ email_preferences table created successfully!');
    return;
  }

  await outputSqlForManualExecution();
}

main();
