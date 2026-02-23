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
  { slug: 'emergencies', label: 'Emergencies', color: '#c41e3a', icon: 'emergency', sort_order: 1 },
  { slug: 'water-for-life', label: 'Water for Life', color: '#0891b2', icon: 'water', sort_order: 2 },
  { slug: 'food-aid', label: 'Food Aid', color: '#16a34a', icon: 'food', sort_order: 3 },
  { slug: 'orphan-sponsorship', label: 'Orphan Sponsorship', color: '#be123c', icon: 'orphan', sort_order: 4 },
  { slug: 'education', label: 'Education', color: '#ca8a04', icon: 'education', sort_order: 5 },
  { slug: 'healthcare', label: 'Healthcare', color: '#0b5d3a', icon: 'healthcare', sort_order: 6 },
  { slug: 'sadaqah-jariyah', label: 'Sadaqah Jariyah', color: '#2563eb', icon: 'sadaqah', sort_order: 7 },
  { slug: 'qurbani', label: 'Qurbani', color: '#525252', icon: 'qurbani', sort_order: 8 },
];

async function setup() {
  console.log('🚀 Setting up categories table...\n');

  // Check if table exists by trying to select from it
  const { data: existing, error: checkError } = await supabase
    .from('categories')
    .select('id')
    .limit(1);

  if (checkError && checkError.message.includes('does not exist')) {
    console.log('📋 Table does not exist. Please create it in Supabase dashboard with this SQL:\n');
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

-- Create index for sorting
CREATE INDEX idx_categories_sort ON categories(sort_order, label);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON categories
  FOR SELECT USING (true);

-- Allow authenticated full access (for admin)
CREATE POLICY "Allow service role full access" ON categories
  FOR ALL USING (true);
`);
    console.log('\n⚠️  After creating the table, run this script again to seed the data.');
    return;
  }

  // Table exists, seed data
  console.log('✅ Table exists. Seeding categories...\n');

  for (const cat of initialCategories) {
    const { data, error } = await supabase
      .from('categories')
      .upsert(cat, { onConflict: 'slug' })
      .select();

    if (error) {
      console.log(`❌ Error inserting ${cat.label}:`, error.message);
    } else {
      console.log(`✅ ${cat.label}`);
    }
  }

  console.log('\n🎉 Categories setup complete!');

  // Verify
  const { data: allCats } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order');

  console.log('\n📋 Current categories:');
  allCats?.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.label} (${c.slug}) - ${c.is_active ? 'Active' : 'Inactive'}`);
  });
}

setup();
