/**
 * Fix campaign URL paths
 * Sets url_path = /{category}/{slug} for all campaigns missing url_path
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const sb = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Get all campaigns without url_path
  const { data: campaigns, error } = await sb
    .from('campaigns')
    .select('id, slug, category, url_path')
    .is('url_path', null);

  if (error) {
    console.error('Error fetching campaigns:', error);
    return;
  }

  console.log(`Found ${campaigns.length} campaigns without url_path\n`);

  let updated = 0;
  for (const c of campaigns) {
    if (!c.category) {
      console.log(`  SKIP: ${c.slug} (no category)`);
      continue;
    }

    const newUrlPath = `/${c.category}/${c.slug}`;
    console.log(`  SET: ${c.slug} -> ${newUrlPath}`);

    const { error: updateError } = await sb
      .from('campaigns')
      .update({ url_path: newUrlPath })
      .eq('id', c.id);

    if (updateError) {
      console.error(`  ERROR updating ${c.slug}:`, updateError.message);
    } else {
      updated++;
    }
  }

  console.log(`\nDone! Updated ${updated} campaigns.`);
}

run();
