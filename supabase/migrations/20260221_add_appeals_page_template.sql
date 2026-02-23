-- Add appeals page template column to site_settings
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS default_appeals_page_template TEXT DEFAULT 'green';

-- Add appeals_page template type to template_options
INSERT INTO template_options (template_type, template_key, template_label, description, is_active, sort_order)
VALUES
  ('appeals_page', 'green', 'Green (Teal)', 'Teal/blue color scheme with orange accents', true, 1),
  ('appeals_page', 'orange', 'Orange', 'Orange color scheme - warm and inviting', true, 2)
ON CONFLICT DO NOTHING;
