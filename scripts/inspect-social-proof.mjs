import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();

  // 1. Which campaigns are flagged for social proof?
  const flagged = await client.query(
    `SELECT slug, name, is_active, show_in_social_proof, social_proof_order,
            social_proof_title, social_proof_url, social_proof_action
       FROM campaigns
      WHERE is_active = true
      ORDER BY social_proof_order ASC NULLS LAST, name ASC`
  );
  console.log('\n=== All ACTIVE campaigns (ordered by social_proof_order) ===');
  for (const r of flagged.rows) {
    console.log(`[${r.show_in_social_proof ? 'ON ' : 'OFF'}] order=${r.social_proof_order ?? '∅'}  slug=${r.slug.padEnd(30)}  name=${r.name}`);
  }

  // 2. Any qurbani campaign details?
  const qurbani = await client.query(
    `SELECT slug, name, is_active, show_in_social_proof, social_proof_order,
            social_proof_title, social_proof_url, social_proof_action, url_path
       FROM campaigns
      WHERE slug ILIKE '%qurbani%' OR slug ILIKE '%udhiya%' OR name ILIKE '%qurbani%' OR name ILIKE '%udhiya%'`
  );
  console.log('\n=== Qurbani / Udhiya campaigns ===');
  console.log(qurbani.rows);

  // 3. Last 72h real donations grouped by campaign_slug
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const recent = await client.query(
    `SELECT campaign_slug, campaign_name, COUNT(*) as n, MAX(completed_at) as latest
       FROM donations
      WHERE status = 'completed'
        AND completed_at > $1
        AND donor_name IS NOT NULL
      GROUP BY campaign_slug, campaign_name
      ORDER BY n DESC`, [cutoff]
  );
  console.log('\n=== Real completed donations (last 72h) by campaign ===');
  console.log(recent.rows);

  await client.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
