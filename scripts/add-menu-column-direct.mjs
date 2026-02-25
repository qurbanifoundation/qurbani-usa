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
-- Add menu column to categories if it doesn't exist
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS menu VARCHAR(50) DEFAULT 'our-work';

-- Update existing categories to have our-work as default menu
UPDATE categories SET menu = 'our-work' WHERE menu IS NULL;
`;

async function run() {
  console.log('🚀 Adding menu column to categories...\n');

  try {
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    console.log('✅ Connected to database');

    await client.query(sql);
    console.log('✅ Menu column added successfully!');

    // Verify
    const result = await client.query('SELECT label, menu FROM categories ORDER BY sort_order');
    console.log('\n📋 Categories with menu assignments:');
    result.rows.forEach(row => {
      console.log(`   • ${row.label} → ${row.menu}`);
    });

    await client.end();
    console.log('\n✅ Done!');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

run();
