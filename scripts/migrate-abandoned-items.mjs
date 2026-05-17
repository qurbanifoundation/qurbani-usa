import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase/migrations/20260508_abandoned_checkouts_items.sql'),
    'utf-8'
  );
  await client.query(sql);
  const r = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='abandoned_checkouts' AND column_name IN ('items','cart_metadata')"
  );
  console.log('Added columns:', r.rows);
  await client.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
