-- Add Orphan Sponsorship Template to template_options
-- This template is designed for high-converting orphan sponsorship pages
-- with country selection, quantity selector, and emotional storytelling

INSERT INTO template_options (template_type, template_key, template_label, description, is_active, sort_order)
VALUES (
  'page',
  'orphan-sponsorship',
  'Orphan Sponsorship',
  'High-converting orphan sponsorship page with country selection, quantity selector, and emotional storytelling. Inspired by Penny Appeal and Muslim Hands.',
  true,
  3
)
ON CONFLICT (template_type, template_key) DO UPDATE
SET template_label = EXCLUDED.template_label,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;
