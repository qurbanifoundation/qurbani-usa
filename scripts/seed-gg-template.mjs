import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const client = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Check if gg-one-step already exists in template_options
  const { data: existing } = await client
    .from('template_options')
    .select('*')
    .eq('template_key', 'gg-one-step')
    .eq('template_type', 'checkout');

  console.log('Existing gg-one-step entries:', existing?.length || 0);

  if (!existing || existing.length === 0) {
    const { error } = await client.from('template_options').insert({
      template_type: 'checkout',
      template_key: 'gg-one-step',
      template_label: '1-Step GG Checkout',
      description: 'GlobalGiving-style 2-column layout: order summary left, form right',
      is_active: true,
      sort_order: 3
    });
    if (error) {
      console.error('Insert error:', error);
    } else {
      console.log('✅ Inserted gg-one-step template option');
    }
  } else {
    console.log('Already exists, skipping insert');
  }

  // Reset checkout_template back to two-step so user can switch from admin
  const { error: resetErr } = await client
    .from('site_settings')
    .update({ checkout_template: 'two-step' })
    .eq('id', 'main');

  if (resetErr) {
    console.error('Reset error:', resetErr);
  } else {
    console.log('✅ Reset checkout_template back to two-step (user can switch from admin)');
  }
}

main().catch(console.error);
