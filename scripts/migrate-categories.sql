-- Create categories table for mega menu
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

-- Create index for sorting
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order, label);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Public read access" ON categories;
DROP POLICY IF EXISTS "Service role full access" ON categories;

-- Create policies
CREATE POLICY "Public read access" ON categories FOR SELECT USING (true);
CREATE POLICY "Service role full access" ON categories FOR ALL USING (auth.role() = 'service_role');

-- Insert initial categories (upsert to avoid duplicates)
INSERT INTO categories (slug, label, color, icon, sort_order) VALUES
  ('emergencies', 'Emergencies', '#c41e3a', 'emergency', 1),
  ('water-for-life', 'Water for Life', '#0891b2', 'water', 2),
  ('food-aid', 'Food Aid', '#16a34a', 'food', 3),
  ('orphan-sponsorship', 'Orphan Sponsorship', '#be123c', 'orphan', 4),
  ('education', 'Education', '#ca8a04', 'education', 5),
  ('healthcare', 'Healthcare', '#0b5d3a', 'healthcare', 6),
  ('sadaqah-jariyah', 'Sadaqah Jariyah', '#2563eb', 'sadaqah', 7),
  ('qurbani', 'Qurbani', '#525252', 'qurbani', 8)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;
