-- Template Settings Migration
-- Run this in your Supabase SQL editor

-- Add default template settings to site_settings
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS default_donation_box_template VARCHAR(50) DEFAULT 'teal-yellow',
ADD COLUMN IF NOT EXISTS default_campaign_page_template VARCHAR(50) DEFAULT 'green-with-yellow';

-- Add template selection fields to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS donation_box_template VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS page_template VARCHAR(50) DEFAULT NULL;

-- Template options reference:
-- Donation Box Templates: 'teal-yellow', 'dark-teal', 'white', 'compact', 'list-style'
-- Campaign Page Templates: 'green-with-yellow' (Sticky Sidebar), 'emergency-appeal'
--   - green-with-yellow: Sticky Sidebar - campaign page with sticky donation box on the right
--   - emergency-appeal: Dramatic emergency appeal page with red accents, progress bar, urgent styling

-- If NULL, the campaign uses the default from site_settings

-- Create template_options table for admin UI dropdown options
CREATE TABLE IF NOT EXISTS template_options (
  id SERIAL PRIMARY KEY,
  template_type VARCHAR(50) NOT NULL, -- 'page' or 'donation_box'
  template_key VARCHAR(50) NOT NULL,
  template_label VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_type, template_key)
);

-- Insert page template options
INSERT INTO template_options (template_type, template_key, template_label, description, sort_order)
VALUES
  ('page', 'green-with-yellow', 'Sticky Sidebar', 'Standard campaign page with sticky donation box on the right', 1),
  ('page', 'emergency-appeal', 'Urgent Appeal', 'Dramatic emergency page with red accents, progress bar, and urgent styling', 2)
ON CONFLICT (template_type, template_key) DO NOTHING;

-- Insert donation box template options
INSERT INTO template_options (template_type, template_key, template_label, description, sort_order)
VALUES
  ('donation_box', 'teal-yellow', 'Teal Yellow', 'Teal background with yellow accents', 1),
  ('donation_box', 'dark-teal', 'Dark Teal', 'Dark teal background with red accents', 2),
  ('donation_box', 'white', 'White', 'White background with teal accents', 3),
  ('donation_box', 'compact', 'Compact', 'Compact teal box without labels', 4),
  ('donation_box', 'list-style', 'List Style', 'Light background with orange accents and trust message', 5)
ON CONFLICT (template_type, template_key) DO NOTHING;
