-- Template Colors Migration
-- Run this in your Supabase SQL editor

-- Create template_colors table
CREATE TABLE IF NOT EXISTS template_colors (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(50) UNIQUE NOT NULL,
  template_label VARCHAR(100), -- Display name for custom templates
  -- Colors
  bg_color VARCHAR(50) DEFAULT '#004139',
  header_bg_color VARCHAR(50) DEFAULT NULL, -- For urgent-appeal template header
  text_color VARCHAR(50) DEFAULT '#ffffff',
  text_muted_color VARCHAR(50) DEFAULT '#d4c4a8',
  accent_color VARCHAR(50) DEFAULT '#c41e3a',
  accent_text_color VARCHAR(50) DEFAULT '#ffffff',
  border_color VARCHAR(50) DEFAULT '#108D70',
  active_bg_color VARCHAR(50) DEFAULT '#ECF0EE',
  active_text_color VARCHAR(50) DEFAULT '#004139',
  inactive_btn_bg VARCHAR(50) DEFAULT '#005A4C',
  toggle_active_color VARCHAR(50) DEFAULT '#108D70',
  -- Text Labels (use {campaign} placeholder to show campaign name)
  title_text VARCHAR(100) DEFAULT '{campaign}',
  subtitle_text VARCHAR(100) DEFAULT '100% reaches those in need',
  button_text VARCHAR(100) DEFAULT 'Donate Now',
  single_text VARCHAR(100) DEFAULT 'Single',
  monthly_text VARCHAR(100) DEFAULT 'Monthly',
  custom_amount_placeholder VARCHAR(100) DEFAULT 'Any Amount',
  -- Trust Message (for list-style template)
  trust_message_text VARCHAR(255) DEFAULT 'Donating through Qurbani Foundation is safe, secure, and easy with many payment options to choose from.',
  trust_link_text VARCHAR(100) DEFAULT 'View other ways to donate',
  trust_link_url VARCHAR(255) DEFAULT '/donate',
  -- Default donation amounts (JSON array)
  default_amounts JSONB DEFAULT '[{"amount":30,"label":"Feed a family"},{"amount":50,"label":"Provide essentials"},{"amount":80,"label":"Emergency aid"},{"amount":100,"label":"Medical supplies"},{"amount":250,"label":"Transform lives"},{"amount":1000,"label":"Major impact"}]',
  -- Font Sizes
  subtitle_size VARCHAR(20) DEFAULT 'text-sm',
  title_size VARCHAR(20) DEFAULT 'text-xl',
  button_size VARCHAR(20) DEFAULT 'text-lg',
  amount_size VARCHAR(20) DEFAULT 'text-sm',
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns if table already exists (for migrations)
DO $$
BEGIN
  -- Template label for custom templates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'template_label') THEN
    ALTER TABLE template_colors ADD COLUMN template_label VARCHAR(100);
  END IF;
  -- Text columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'title_text') THEN
    ALTER TABLE template_colors ADD COLUMN title_text VARCHAR(100) DEFAULT '{campaign}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'subtitle_text') THEN
    ALTER TABLE template_colors ADD COLUMN subtitle_text VARCHAR(100) DEFAULT '100% reaches those in need';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'button_text') THEN
    ALTER TABLE template_colors ADD COLUMN button_text VARCHAR(100) DEFAULT 'Donate Now';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'single_text') THEN
    ALTER TABLE template_colors ADD COLUMN single_text VARCHAR(100) DEFAULT 'Single';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'monthly_text') THEN
    ALTER TABLE template_colors ADD COLUMN monthly_text VARCHAR(100) DEFAULT 'Monthly';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'custom_amount_placeholder') THEN
    ALTER TABLE template_colors ADD COLUMN custom_amount_placeholder VARCHAR(100) DEFAULT 'Any Amount';
  END IF;
  -- Size columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'subtitle_size') THEN
    ALTER TABLE template_colors ADD COLUMN subtitle_size VARCHAR(20) DEFAULT 'text-sm';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'title_size') THEN
    ALTER TABLE template_colors ADD COLUMN title_size VARCHAR(20) DEFAULT 'text-xl';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'button_size') THEN
    ALTER TABLE template_colors ADD COLUMN button_size VARCHAR(20) DEFAULT 'text-lg';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'amount_size') THEN
    ALTER TABLE template_colors ADD COLUMN amount_size VARCHAR(20) DEFAULT 'text-sm';
  END IF;
  -- Trust message columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'trust_message_text') THEN
    ALTER TABLE template_colors ADD COLUMN trust_message_text VARCHAR(255) DEFAULT 'Donating through Qurbani Foundation is safe, secure, and easy with many payment options to choose from.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'trust_link_text') THEN
    ALTER TABLE template_colors ADD COLUMN trust_link_text VARCHAR(100) DEFAULT 'View other ways to donate';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'trust_link_url') THEN
    ALTER TABLE template_colors ADD COLUMN trust_link_url VARCHAR(255) DEFAULT '/donate';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'default_amounts') THEN
    ALTER TABLE template_colors ADD COLUMN default_amounts JSONB DEFAULT '[{"amount":30,"label":"Feed a family"},{"amount":50,"label":"Provide essentials"},{"amount":80,"label":"Emergency aid"},{"amount":100,"label":"Medical supplies"},{"amount":250,"label":"Transform lives"},{"amount":1000,"label":"Major impact"}]';
  END IF;
  -- Header background color for urgent-appeal template
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_colors' AND column_name = 'header_bg_color') THEN
    ALTER TABLE template_colors ADD COLUMN header_bg_color VARCHAR(50) DEFAULT NULL;
  END IF;
END $$;

-- Insert default color schemes for each template
INSERT INTO template_colors (template_name, bg_color, text_color, text_muted_color, accent_color, accent_text_color, border_color, active_bg_color, active_text_color, inactive_btn_bg, toggle_active_color, header_bg_color)
VALUES
  ('teal-yellow', '#255764', '#ffffff', 'rgba(255,255,255,0.7)', '#fdc448', '#61470e', 'rgba(255,255,255,0.3)', 'rgba(253,196,72,0.2)', '#ffffff', 'transparent', 'rgba(255,255,255,0.2)', NULL),
  ('dark-teal', '#004139', '#ffffff', '#d4c4a8', '#c41e3a', '#ffffff', '#108D70', '#ECF0EE', '#004139', '#005A4C', '#108D70', NULL),
  ('white', '#ffffff', '#1f2937', '#6b7280', '#01534d', '#ffffff', '#01534d', '#01534d', '#ffffff', 'transparent', '#01534d', NULL),
  ('compact', '#1a4a55', '#ffffff', 'rgba(255,255,255,0.7)', '#fdc448', '#61470e', 'rgba(255,255,255,0.3)', 'rgba(253,196,72,0.2)', '#ffffff', 'transparent', 'rgba(255,255,255,0.2)', NULL),
  ('list-style', '#f5f5f5', '#374151', '#6b7280', '#D97706', '#ffffff', '#e5e7eb', '#D97706', '#ffffff', '#ffffff', '#D97706', NULL),
  ('urgent-appeal', '#ffffff', '#1f2937', '#6b7280', '#c41e3a', '#ffffff', '#e5e7eb', 'rgba(196,30,58,0.1)', '#1f2937', '#ffffff', '#c41e3a', '#c41e3a')
ON CONFLICT (template_name) DO NOTHING;
