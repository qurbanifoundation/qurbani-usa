/**
 * Create zakat_email_queue table for Zakat drip email sequence.
 * Follows the same pattern as abandoned_checkouts for cart recovery.
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
-- Zakat email drip queue
-- Tracks which follow-up emails have been sent after a Zakat calculation
CREATE TABLE IF NOT EXISTS zakat_email_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  first_name text,
  last_name text,
  zakat_amount numeric NOT NULL DEFAULT 0,
  total_assets numeric DEFAULT 0,
  total_liabilities numeric DEFAULT 0,
  net_wealth numeric DEFAULT 0,
  nisab_type text DEFAULT 'silver',
  nisab_value numeric DEFAULT 0,
  assets_breakdown jsonb DEFAULT '[]'::jsonb,
  liabilities_breakdown jsonb DEFAULT '[]'::jsonb,
  pay_url text,
  unsubscribe_token uuid DEFAULT gen_random_uuid(),
  drip_step_last_sent int DEFAULT 1,
  drip_last_sent_at timestamptz DEFAULT now(),
  unsubscribed_at timestamptz,
  converted_at timestamptz,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zakat_queue_status ON zakat_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_zakat_queue_email ON zakat_email_queue(email);

ALTER TABLE zakat_email_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Service role full access" ON zakat_email_queue;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Service role full access" ON zakat_email_queue FOR ALL USING (auth.role() = 'service_role');
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

async function main() {
  console.log('🚀 Creating zakat_email_queue table...\n');

  if (await tryManagementApi()) {
    console.log('\n✅ zakat_email_queue table created successfully!');
    return;
  }

  if (await tryPostgresConnection()) {
    console.log('\n✅ zakat_email_queue table created successfully!');
    return;
  }

  // Fall back to manual execution
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

main().catch(console.error);
