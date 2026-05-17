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
    path.join(__dirname, '..', 'supabase/migrations/20260506_abandoned_checkouts_admin_charge_link.sql'),
    'utf-8'
  );
  await client.query(sql);
  const r = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='abandoned_checkouts' AND column_name LIKE 'admin_charge%'"
  );
  console.log('admin_charge_* columns:', r.rows);
  await client.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
