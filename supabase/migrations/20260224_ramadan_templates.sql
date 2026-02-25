-- Ramadan Page Templates
-- Allows storing different Ramadan campaign page designs

-- Add ramadan_page template type
INSERT INTO template_options (template_type, template_key, template_label, description, is_active, sort_order)
VALUES
  ('ramadan_page', 'pennyappeal', 'Ramadan template (pennyappeal)', 'Original 30 Days of Ramadan wizard with green theme, daily giving automation, multipliers, and Night 27 options', true, 1)
ON CONFLICT DO NOTHING;

-- Add column to site_settings for default ramadan template if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_settings' AND column_name = 'ramadan_page_template'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN ramadan_page_template TEXT DEFAULT 'pennyappeal';
  END IF;
END $$;
