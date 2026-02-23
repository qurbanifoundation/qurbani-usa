-- Add orphan sponsorship template with dedicated template_type
INSERT INTO template_options (template_type, template_key, template_label, description, is_active, sort_order)
VALUES (
  'orphan_sponsorship',
  'orphan-sponsorship',
  'Orphan Sponsorship (Default)',
  'High-converting page with country selection, quantity picker, and emotional storytelling.',
  true,
  1
)
ON CONFLICT (template_type, template_key) DO UPDATE
SET template_label = EXCLUDED.template_label,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;
