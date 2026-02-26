/**
 * Fix mega menu widget URLs
 * Updates hardcoded URLs in link-list widgets to match campaign_pages url_path
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
  // Get all campaign_pages with their url_path (the source of truth)
  const { data: pages } = await sb
    .from('campaign_pages')
    .select('slug, url_path, name');

  // Build a slug -> url_path map
  const urlMap = {};
  for (const p of pages || []) {
    if (p.url_path) {
      // Map the slug to url_path for quick lookup
      urlMap[p.slug] = p.url_path;
      // Also map the old-style paths
      urlMap[`/${p.slug}`] = p.url_path;
    }
  }

  // Also get campaigns
  const { data: campaigns } = await sb
    .from('campaigns')
    .select('slug, url_path, name');

  for (const c of campaigns || []) {
    if (c.url_path) {
      urlMap[`/${c.slug}`] = c.url_path;
      urlMap[c.slug] = c.url_path;
    }
  }

  console.log('URL map built with', Object.keys(urlMap).length, 'entries\n');

  // Get all link-list widgets
  const { data: widgets } = await sb
    .from('menu_widgets')
    .select('id, menu_id, widget_type, config')
    .eq('widget_type', 'link-list');

  let totalFixed = 0;

  for (const widget of widgets || []) {
    const links = widget.config?.links || [];
    let changed = false;

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const href = link.href;

      // Check if this href has a better url_path
      // Strip leading slash for slug-based lookup
      const slug = href.replace(/^\//, '');

      if (urlMap[href] && urlMap[href] !== href) {
        console.log(`  [${widget.menu_id}] ${link.label}: ${href} -> ${urlMap[href]}`);
        links[i].href = urlMap[href];
        changed = true;
        totalFixed++;
      } else if (urlMap[slug] && urlMap[slug] !== href) {
        console.log(`  [${widget.menu_id}] ${link.label}: ${href} -> ${urlMap[slug]}`);
        links[i].href = urlMap[slug];
        changed = true;
        totalFixed++;
      }
    }

    if (changed) {
      const { error } = await sb
        .from('menu_widgets')
        .update({ config: { ...widget.config, links } })
        .eq('id', widget.id);

      if (error) console.error('Error updating widget:', error);
      else console.log(`  -> Widget ${widget.id} updated`);
    }
  }

  console.log(`\nDone! Fixed ${totalFixed} URLs across menu widgets.`);
}

run();
