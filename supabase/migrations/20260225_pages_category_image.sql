-- Add category_id and featured_image to pages table
-- This allows pages to be categorized and displayed in menus with thumbnails

-- Add category_id column (references categories table)
ALTER TABLE pages
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Add featured_image column for menu thumbnails
ALTER TABLE pages
ADD COLUMN IF NOT EXISTS featured_image TEXT;

-- Add index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_pages_category_id ON pages(category_id);
