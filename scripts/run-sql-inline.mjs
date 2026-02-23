import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  const sql = fs.readFileSync('/tmp/add-tilestack-template.sql', 'utf-8');
  await client.query(sql);
  console.log('✅ TileStack Sponsorship template added');
  await client.end();
}
run();
