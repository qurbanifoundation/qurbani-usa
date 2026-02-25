import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const initialMenus = [
  { name: 'Our Work', slug: 'our-work', sort_order: 1, is_active: true, color: '#D97718', icon: 'heart', description: 'Appeals, campaigns and charitable projects' },
  { name: 'Zakat', slug: 'zakat', sort_order: 2, is_active: true, color: '#0096D6', icon: 'calculator', description: 'Zakat payment and resources' },
  { name: 'Ramadan', slug: 'ramadan', sort_order: 3, is_active: true, color: '#16a34a', icon: 'moon', description: 'Ramadan giving and resources' },
  { name: 'About', slug: 'about', sort_order: 4, is_active: true, color: '#01534d', icon: 'info', description: 'About the organization' },
];

async function setup() {
  console.log('🚀 Setting up mega menus...\n');

  // Check if mega_menus table exists
  const { error: checkError } = await supabase
    .from('mega_menus')
    .select('id')
    .limit(1);

  if (checkError && checkError.code === '42P01') {
    console.log('⚠️  mega_menus table does not exist.');
    console.log('   Please run this SQL in your Supabase Dashboard > SQL Editor:\n');
    console.log('─'.repeat(70));
    console.log(`
-- Create mega_menus table
CREATE TABLE mega_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  show_in_header BOOLEAN DEFAULT true,
  color VARCHAR(20) DEFAULT '#01534d',
  icon VARCHAR(50) DEFAULT 'heart',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add mega_menu_id column to categories
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS mega_menu_id UUID REFERENCES mega_menus(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_categories_mega_menu ON categories(mega_menu_id);

-- RLS policies
ALTER TABLE mega_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON mega_menus FOR SELECT USING (true);
CREATE POLICY "Service role full access" ON mega_menus FOR ALL USING (auth.role() = 'service_role');

-- Insert default menus
INSERT INTO mega_menus (name, slug, sort_order, is_active, color, icon, description) VALUES
  ('Our Work', 'our-work', 1, true, '#D97718', 'heart', 'Appeals, campaigns and charitable projects'),
  ('Zakat', 'zakat', 2, true, '#0096D6', 'calculator', 'Zakat payment and resources'),
  ('Ramadan', 'ramadan', 3, true, '#16a34a', 'moon', 'Ramadan giving and resources'),
  ('About', 'about', 4, true, '#01534d', 'info', 'About the organization');

-- Assign existing categories to "Our Work" menu
UPDATE categories
SET mega_menu_id = (SELECT id FROM mega_menus WHERE slug = 'our-work')
WHERE mega_menu_id IS NULL;
`);
    console.log('─'.repeat(70));
    console.log('\n   After running the SQL, run this script again to verify.\n');
    return;
  }

  console.log('✅ mega_menus table exists\n');

  // Upsert menus
  console.log('📝 Upserting mega menus...\n');

  for (const menu of initialMenus) {
    const { error } = await supabase
      .from('mega_menus')
      .upsert(menu, { onConflict: 'slug' });

    if (error) {
      console.log(`❌ ${menu.name}: ${error.message}`);
    } else {
      console.log(`✅ ${menu.name}`);
    }
  }

  // Check if categories have mega_menu_id column
  const { data: cats, error: catError } = await supabase
    .from('categories')
    .select('id, mega_menu_id')
    .limit(1);

  if (catError) {
    console.log('\n⚠️  Categories table needs mega_menu_id column.');
    console.log('   Run this SQL:\n');
    console.log('   ALTER TABLE categories ADD COLUMN IF NOT EXISTS mega_menu_id UUID REFERENCES mega_menus(id) ON DELETE SET NULL;');
    return;
  }

  // Assign unassigned categories to "Our Work"
  const { data: ourWorkMenu } = await supabase
    .from('mega_menus')
    .select('id')
    .eq('slug', 'our-work')
    .single();

  if (ourWorkMenu) {
    const { count } = await supabase
      .from('categories')
      .update({ mega_menu_id: ourWorkMenu.id })
      .is('mega_menu_id', null)
      .select('id', { count: 'exact' });

    console.log(`\n📋 Assigned ${count || 0} unassigned categories to "Our Work" menu`);
  }

  // Display current state
  const { data: menus } = await supabase
    .from('mega_menus')
    .select('*, categories(id, label)')
    .eq('is_active', true)
    .order('sort_order');

  console.log('\n📋 Current mega menus:\n');
  menus?.forEach(menu => {
    console.log(`  ${menu.sort_order}. ${menu.name} (${menu.slug})`);
    if (menu.categories?.length > 0) {
      menu.categories.forEach(cat => {
        console.log(`      └─ ${cat.label}`);
      });
    } else {
      console.log(`      └─ (no categories assigned)`);
    }
  });

  console.log('\n✅ Setup complete!');
}

setup();
