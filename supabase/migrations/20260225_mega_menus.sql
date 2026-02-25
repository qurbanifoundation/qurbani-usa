-- Create mega_menus table to store configurable navigation menus
CREATE TABLE IF NOT EXISTS mega_menus (
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

-- Add mega_menu_id to categories table
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS mega_menu_id UUID REFERENCES mega_menus(id) ON DELETE SET NULL;

-- Insert default mega menus based on current navigation
INSERT INTO mega_menus (name, slug, sort_order, is_active, color, icon, description) VALUES
  ('Our Work', 'our-work', 1, true, '#D97718', 'heart', 'Appeals, campaigns and charitable projects'),
  ('Zakat', 'zakat', 2, true, '#0096D6', 'calculator', 'Zakat payment and resources'),
  ('Ramadan', 'ramadan', 3, true, '#16a34a', 'moon', 'Ramadan giving and resources'),
  ('About', 'about', 4, true, '#01534d', 'info', 'About the organization')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  color = EXCLUDED.color;

-- Assign existing categories to "Our Work" mega menu by default
UPDATE categories
SET mega_menu_id = (SELECT id FROM mega_menus WHERE slug = 'our-work')
WHERE mega_menu_id IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_categories_mega_menu ON categories(mega_menu_id);
