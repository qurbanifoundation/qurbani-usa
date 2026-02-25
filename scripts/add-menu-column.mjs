import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addMenuColumn() {
  console.log('🚀 Checking menu column...\n');

  // Get a category ID to test
  const { data: cats } = await supabase.from('categories').select('id').limit(1);

  if (!cats || cats.length === 0) {
    console.log('❌ No categories found');
    return;
  }

  const testId = cats[0].id;

  // Try updating with menu field
  const { data, error: updateError } = await supabase
    .from('categories')
    .update({ menu: 'our-work' })
    .eq('id', testId)
    .select();

  if (updateError) {
    console.log('⚠️  Menu column does not exist.');
    console.log('   Error:', updateError.message);
    console.log('\n   Please run this SQL in Supabase Dashboard:');
    console.log('   ALTER TABLE categories ADD COLUMN menu VARCHAR(50) DEFAULT \'our-work\';');
    return;
  }

  console.log('✅ Menu column exists!');
  console.log('   Setting all categories to "our-work" menu...\n');

  // Update all categories without a menu
  const { error: bulkError, count } = await supabase
    .from('categories')
    .update({ menu: 'our-work' })
    .is('menu', null)
    .select('id', { count: 'exact' });

  if (bulkError) {
    console.log('   Bulk update note:', bulkError.message);
  }

  // Verify
  const { data: allCats } = await supabase
    .from('categories')
    .select('label, menu')
    .order('sort_order');

  console.log('📋 Current category menu assignments:');
  allCats?.forEach(c => {
    console.log(`   • ${c.label} → ${c.menu || 'our-work'}`);
  });

  console.log('\n✅ Done!');
}

addMenuColumn();
