-- Add Amanah template option for Ramadan page
INSERT INTO template_options (template_type, template_key, template_label, description, is_active, sort_order)
VALUES
  ('ramadan_page', 'amanah', 'Amanah Style', 'Modern mobile-first 6-step wizard with cloud background, amplify options, and streamlined checkout', true, 2)
ON CONFLICT (template_type, template_key) DO UPDATE SET
  template_label = EXCLUDED.template_label,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- Update the default Ramadan page template to amanah
UPDATE site_settings SET ramadan_page_template = 'amanah' WHERE id = 'main';
