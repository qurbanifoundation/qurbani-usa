/**
 * One-time fix: Cascade the orphan-sponsorship → orphans slug change
 * that happened before the cascade logic was added to the categories API.
 *
 * This updates:
 * 1. campaigns.category from 'orphan-sponsorship' to 'orphans'
 * 2. campaigns.url_path from /orphan-sponsorship/... to /orphans/...
 * 3. campaign_pages.url_path for pages linked to the orphans category
 * 4. mega_menu widget URLs containing /orphan-sponsorship/
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OLD_SLUG = 'orphan-sponsorship';
const NEW_SLUG = 'orphans';
const CATEGORY_ID = 'c3ca6a93-bbe1-415a-9f62-510850e3329f';

async function fixCascade() {
  console.log(`\nCascading slug change: "${OLD_SLUG}" → "${NEW_SLUG}"\n`);

  // 1. Fix campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, slug, category, url_path')
    .eq('category', OLD_SLUG);

  if (campaigns && campaigns.length > 0) {
    console.log(`Found ${campaigns.length} campaigns with old category "${OLD_SLUG}":`);
    for (const c of campaigns) {
      const newUrlPath = `/${NEW_SLUG}/${c.slug}`;
      const { error } = await supabase
        .from('campaigns')
        .update({
          category: NEW_SLUG,
          url_path: newUrlPath,
          updated_at: new Date().toISOString()
        })
        .eq('id', c.id);

      if (error) {
        console.log(`  ✗ ${c.slug}: ${error.message}`);
      } else {
        console.log(`  ✓ ${c.slug}: ${c.url_path} → ${newUrlPath}`);
      }
    }
  } else {
    console.log('No campaigns found with old category slug.');
  }

  // 2. Fix campaign_pages
  const { data: pages } = await supabase
    .from('campaign_pages')
    .select('id, slug, url_path, category_id')
    .eq('category_id', CATEGORY_ID);

  if (pages && pages.length > 0) {
    console.log(`\nFound ${pages.length} campaign pages linked to orphans category:`);
    for (const p of pages) {
      if (p.url_path && p.url_path.includes(`/${OLD_SLUG}/`)) {
        const newUrlPath = p.url_path.replace(`/${OLD_SLUG}/`, `/${NEW_SLUG}/`);
        const { error } = await supabase
          .from('campaign_pages')
          .update({
            url_path: newUrlPath,
            updated_at: new Date().toISOString()
          })
          .eq('id', p.id);

        if (error) {
          console.log(`  ✗ ${p.slug}: ${error.message}`);
        } else {
          console.log(`  ✓ ${p.slug}: ${p.url_path} → ${newUrlPath}`);
        }
      } else {
        console.log(`  - ${p.slug}: url_path "${p.url_path}" doesn't contain old slug, skipping`);
      }
    }
  } else {
    console.log('\nNo campaign pages linked to orphans category.');
  }

  // 3. Fix mega menu widgets
  const { data: widgets } = await supabase
    .from('menu_widgets')
    .select('id, config, widget_type, title');

  let widgetFixed = 0;
  if (widgets) {
    for (const w of widgets) {
      if (!w.config) continue;
      const configStr = JSON.stringify(w.config);
      if (configStr.includes(`/${OLD_SLUG}/`)) {
        const updatedStr = configStr.replaceAll(`/${OLD_SLUG}/`, `/${NEW_SLUG}/`);
        const updatedConfig = JSON.parse(updatedStr);
        const { error } = await supabase
          .from('menu_widgets')
          .update({ config: updatedConfig })
          .eq('id', w.id);

        if (error) {
          console.log(`  ✗ Widget "${w.title}": ${error.message}`);
        } else {
          widgetFixed++;
          console.log(`  ✓ Widget "${w.title}": URLs updated`);
        }
      }
    }
  }
  if (widgetFixed === 0) {
    console.log('\nNo mega menu widgets had URLs with old slug.');
  }

  console.log('\n✅ Cascade complete!');
}

fixCascade().catch(console.error);
