/**
 * Direct SQL Table Creation Script
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

// Extract project ref from URL
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
console.log(`📍 Project: ${projectRef}`);

const sql = `
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#01534d',
  icon VARCHAR(50) DEFAULT 'heart',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  show_in_menu BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order, label);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read access" ON categories;
  DROP POLICY IF EXISTS "Service role full access" ON categories;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Public read access" ON categories FOR SELECT USING (true);
CREATE POLICY "Service role full access" ON categories FOR ALL USING (auth.role() = 'service_role');

INSERT INTO categories (slug, label, color, icon, sort_order) VALUES
  ('emergencies', 'Emergencies', '#c41e3a', 'emergency', 1),
  ('water-for-life', 'Water for Life', '#0891b2', 'water', 2),
  ('food-aid', 'Food Aid', '#16a34a', 'food', 3),
  ('orphan-sponsorship', 'Orphan Sponsorship', '#be123c', 'orphan', 4),
  ('education', 'Education', '#ca8a04', 'education', 5),
  ('healthcare', 'Healthcare', '#0b5d3a', 'healthcare', 6),
  ('sadaqah-jariyah', 'Sadaqah Jariyah', '#2563eb', 'sadaqah', 7),
  ('qurbani', 'Qurbani', '#525252', 'qurbani', 8)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;
`;

async function tryManagementApi() {
  console.log('\n🔄 Attempting Supabase Management API...');

  try {
    // The management API endpoint
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
    console.log(`❌ Management API failed (${response.status}): ${errorText.substring(0, 100)}`);
    return false;
  } catch (e) {
    console.log(`❌ Management API error: ${e.message}`);
    return false;
  }
}

async function tryPostgresConnection() {
  console.log('\n🔄 Attempting direct PostgreSQL connection...');

  // Try common Supabase password patterns or check for DATABASE_URL
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

  // Try constructing the connection string
  // Standard Supabase connection format
  const host = `db.${projectRef}.supabase.co`;
  const port = 5432;
  const database = 'postgres';
  const user = 'postgres';

  console.log(`   Attempting connection to ${host}...`);
  console.log('   ⚠️  Database password not found in environment variables.');
  console.log('   Add DATABASE_URL to .env for direct connection support.');

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
  console.log('🚀 Creating categories table...\n');

  // Try Management API first
  if (await tryManagementApi()) {
    console.log('\n✅ Categories table created and seeded successfully!');
    return;
  }

  // Try direct PostgreSQL
  if (await tryPostgresConnection()) {
    console.log('\n✅ Categories table created and seeded successfully!');
    return;
  }

  // Fall back to manual execution
  await outputSqlForManualExecution();
}

main();
