/**
 * Fix mega menu widgets that still reference orphan-sponsorship slug
 * and /appeals/sponsor-an-orphan URLs
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixWidgets() {
  const { data: widgets, error } = await supabase
    .from('menu_widgets')
    .select('id, config, widget_type, menu_id, title');

  if (error) {
    console.error('Failed to fetch widgets:', error.message);
    return;
  }

  let fixed = 0;
  for (const w of widgets) {
    if (!w.config) continue;
    let configStr = JSON.stringify(w.config);
    let changed = false;

    // Fix category-tabs widgets: orphan-sponsorship → orphans
    if (configStr.includes('"orphan-sponsorship"')) {
      configStr = configStr.replaceAll('"orphan-sponsorship"', '"orphans"');
      changed = true;
    }

    // Fix promo-card and any other widget href/url: /appeals/sponsor-an-orphan → /orphans/sponsor-an-orphan
    if (configStr.includes('/appeals/sponsor-an-orphan')) {
      configStr = configStr.replaceAll('/appeals/sponsor-an-orphan', '/orphans/sponsor-an-orphan');
      changed = true;
    }

    // Also fix any other /orphan-sponsorship/ URLs
    if (configStr.includes('/orphan-sponsorship/')) {
      configStr = configStr.replaceAll('/orphan-sponsorship/', '/orphans/');
      changed = true;
    }

    if (changed) {
      const updatedConfig = JSON.parse(configStr);
      const { error: updateErr } = await supabase
        .from('menu_widgets')
        .update({ config: updatedConfig })
        .eq('id', w.id);

      if (updateErr) {
        console.log(`  ✗ Widget ${w.id} (${w.widget_type}, menu: ${w.menu_id}): ${updateErr.message}`);
      } else {
        fixed++;
        console.log(`  ✓ Widget ${w.id} (${w.widget_type}, menu: ${w.menu_id}): fixed`);
      }
    }
  }

  console.log(`\n✅ Fixed ${fixed} widgets`);
}

fixWidgets().catch(console.error);
