-- Add Islamic Giving and Aqiqah categories to the mega menu

-- Add/Update Islamic Giving category (replacing old Qurbani category)
INSERT INTO categories (slug, label, color, icon, description, is_active, show_in_menu, sort_order)
VALUES (
  'islamic-giving',
  'Islamic Giving',
  '#01534d',
  'qurbani',
  'Qurbani, Aqiqah, and other Islamic giving',
  true,
  true,
  8
)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  show_in_menu = true,
  sort_order = 8;

-- Add Aqiqah category
INSERT INTO categories (slug, label, color, icon, description, is_active, show_in_menu, sort_order)
VALUES (
  'aqiqah',
  'Aqiqah',
  '#7c3aed',
  'aqiqah',
  'Aqiqah sacrifice to celebrate the birth of a child',
  true,
  true,
  9
)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  show_in_menu = true,
  sort_order = 9;

-- Update old qurbani category to hide from menu (if exists)
UPDATE categories
SET show_in_menu = false
WHERE slug = 'qurbani';

-- Verify
SELECT slug, label, show_in_menu, sort_order FROM categories ORDER BY sort_order;
