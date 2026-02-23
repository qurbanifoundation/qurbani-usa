import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function check() {
  await client.connect();
  const result = await client.query("SELECT * FROM template_options ORDER BY template_type, sort_order");
  console.log('All Templates in DB:');
  console.log(JSON.stringify(result.rows, null, 2));
  await client.end();
}
check();
