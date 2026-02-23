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

const initialCategories = [
  { slug: 'emergencies', label: 'Emergencies', color: '#c41e3a', icon: 'emergency', sort_order: 1, is_active: true, show_in_menu: true },
  { slug: 'water-for-life', label: 'Water for Life', color: '#0891b2', icon: 'water', sort_order: 2, is_active: true, show_in_menu: true },
  { slug: 'food-aid', label: 'Food Aid', color: '#16a34a', icon: 'food', sort_order: 3, is_active: true, show_in_menu: true },
  { slug: 'orphan-sponsorship', label: 'Orphan Sponsorship', color: '#be123c', icon: 'orphan', sort_order: 4, is_active: true, show_in_menu: true },
  { slug: 'education', label: 'Education', color: '#ca8a04', icon: 'education', sort_order: 5, is_active: true, show_in_menu: true },
  { slug: 'healthcare', label: 'Healthcare', color: '#0b5d3a', icon: 'healthcare', sort_order: 6, is_active: true, show_in_menu: true },
  { slug: 'sadaqah-jariyah', label: 'Sadaqah Jariyah', color: '#2563eb', icon: 'sadaqah', sort_order: 7, is_active: true, show_in_menu: true },
  { slug: 'qurbani', label: 'Qurbani', color: '#525252', icon: 'qurbani', sort_order: 8, is_active: true, show_in_menu: true },
];

async function createTableViaRest() {
  const sql = `
    CREATE TABLE IF NOT EXISTS categories (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      slug VARCHAR(100) UNIQUE NOT NULL,
      label VARCHAR(100) NOT NULL,
      color VARCHAR(20) DEFAULT '#01534d',
      icon VARCHAR(50) DEFAULT 'heart',
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      show_in_menu BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  // Use Supabase REST API to execute SQL
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  return response.ok;
}

async function setup() {
  console.log('🚀 Setting up categories...\n');

  // Try to create table via direct insert (if table exists, this will work)
  // If table doesn't exist, we'll create it

  // First, let's try inserting directly - if table doesn't exist, Supabase will tell us
  let tableExists = false;

  try {
    const { error } = await supabase
      .from('categories')
      .select('id')
      .limit(1);

    if (!error) {
      tableExists = true;
      console.log('✅ Categories table exists');
    }
  } catch (e) {
    console.log('Table check failed, will try to create');
  }

  if (!tableExists) {
    console.log('⚠️  Categories table does not exist.');
    console.log('   Please run this SQL in your Supabase Dashboard > SQL Editor:\n');
    console.log('─'.repeat(60));
    console.log(`
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#01534d',
  icon VARCHAR(50) DEFAULT 'heart',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  show_in_menu BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_categories_sort ON categories(sort_order, label);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON categories FOR SELECT USING (true);
CREATE POLICY "Service role full access" ON categories FOR ALL USING (auth.role() = 'service_role');

-- Insert initial categories
INSERT INTO categories (slug, label, color, icon, sort_order) VALUES
  ('emergencies', 'Emergencies', '#c41e3a', 'emergency', 1),
  ('water-for-life', 'Water for Life', '#0891b2', 'water', 2),
  ('food-aid', 'Food Aid', '#16a34a', 'food', 3),
  ('orphan-sponsorship', 'Orphan Sponsorship', '#be123c', 'orphan', 4),
  ('education', 'Education', '#ca8a04', 'education', 5),
  ('healthcare', 'Healthcare', '#0b5d3a', 'healthcare', 6),
  ('sadaqah-jariyah', 'Sadaqah Jariyah', '#2563eb', 'sadaqah', 7),
  ('qurbani', 'Qurbani', '#525252', 'qurbani', 8);
`);
    console.log('─'.repeat(60));
    console.log('\n   After running the SQL, the categories will be ready to use.');
    return;
  }

  // Table exists, seed/update data
  console.log('📝 Upserting categories...\n');

  for (const cat of initialCategories) {
    const { error } = await supabase
      .from('categories')
      .upsert(cat, { onConflict: 'slug' });

    if (error) {
      console.log(`❌ ${cat.label}: ${error.message}`);
    } else {
      console.log(`✅ ${cat.label}`);
    }
  }

  // Verify
  const { data: allCats } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  console.log('\n📋 Active categories in database:');
  allCats?.forEach((c, i) => {
    console.log(`  ${c.sort_order}. ${c.label} (${c.slug})`);
  });

  console.log('\n✅ Setup complete!');
}

setup();
