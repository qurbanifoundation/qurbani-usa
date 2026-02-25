import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

const sql = `
-- Create mega_menus table for header navigation menus
CREATE TABLE IF NOT EXISTS mega_menus (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  color VARCHAR(20) DEFAULT '#01534d',
  icon VARCHAR(50) DEFAULT 'heart',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default menus
INSERT INTO mega_menus (id, name, sort_order, is_active, color, icon) VALUES
  ('our-work', 'Our Work', 1, true, '#D97718', 'heart'),
  ('zakat', 'Zakat', 2, true, '#0096D6', 'calculator'),
  ('ramadan', 'Ramadan', 3, true, '#16a34a', 'moon'),
  ('about', 'About', 4, true, '#01534d', 'info')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  color = EXCLUDED.color;

-- RLS policies
ALTER TABLE mega_menus ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read mega_menus" ON mega_menus;
  DROP POLICY IF EXISTS "Service role mega_menus" ON mega_menus;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Public read mega_menus" ON mega_menus FOR SELECT USING (true);
CREATE POLICY "Service role mega_menus" ON mega_menus FOR ALL USING (auth.role() = 'service_role');
`;

async function run() {
  console.log('🚀 Creating mega_menus table...\n');

  try {
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    console.log('✅ Connected to database');

    await client.query(sql);
    console.log('✅ mega_menus table created!');

    // Verify
    const result = await client.query('SELECT id, name, sort_order FROM mega_menus ORDER BY sort_order');
    console.log('\n📋 Header Menus:');
    result.rows.forEach(row => {
      console.log(`   ${row.sort_order}. ${row.name} (${row.id})`);
    });

    await client.end();
    console.log('\n✅ Done!');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

run();
