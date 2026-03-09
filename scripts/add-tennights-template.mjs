import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // 1. Try to set default value on site_settings (column may need to be added)
  const { error: updateErr } = await supabase
    .from('site_settings')
    .update({ ramadan_tennights_template: 'amanah' })
    .eq('id', 'main');

  if (updateErr) {
    console.log('Column may not exist yet. Error:', updateErr.message);
    console.log('Please run this SQL in Supabase:');
    console.log("ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS ramadan_tennights_template TEXT DEFAULT 'amanah';");
    console.log("UPDATE site_settings SET ramadan_tennights_template = 'amanah' WHERE id = 'main';");
  } else {
    console.log('✅ site_settings.ramadan_tennights_template set to amanah');
  }

  // 2. Add template_options rows for ramadan_tennights type
  const { data: existing } = await supabase
    .from('template_options')
    .select('*')
    .eq('template_type', 'ramadan_tennights');

  console.log('Existing tennights templates:', existing?.length || 0);

  if (!existing || existing.length === 0) {
    const { error: insertErr } = await supabase.from('template_options').insert([
      {
        template_type: 'ramadan_tennights',
        template_key: 'pennyappeal',
        template_label: 'PennyAppeal Style',
        description: 'Original 30 Days of Ramadan wizard with green theme, daily giving automation, multipliers, and Night 27 options',
        is_active: true,
        sort_order: 1
      },
      {
        template_type: 'ramadan_tennights',
        template_key: 'amanah',
        template_label: 'Amanah Style',
        description: 'Modern mobile-first 6-step wizard with cloud background, amplify options, and streamlined checkout',
        is_active: true,
        sort_order: 2
      }
    ]);
    if (insertErr) {
      console.log('❌ Error inserting template_options:', insertErr.message);
    } else {
      console.log('✅ template_options rows inserted for ramadan_tennights');
    }
  } else {
    console.log('✅ Template options already exist, skipping insert');
  }
}

run();
