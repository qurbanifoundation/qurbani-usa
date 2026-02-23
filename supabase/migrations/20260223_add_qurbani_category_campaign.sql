-- Add Qurbani Category and Campaign

-- Step 1: Add Qurbani category (if not exists)
INSERT INTO categories (slug, label, color, icon, description, is_active, show_in_menu, sort_order)
VALUES (
  'qurbani',
  'Qurbani',
  '#01534d',
  'qurbani',
  'Qurbani/Udhiyah sacrifice for Eid al-Adha',
  true,
  true,
  8
)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  show_in_menu = EXCLUDED.show_in_menu;

-- Step 2: Add Qurbani Campaign
INSERT INTO campaigns (
  slug,
  name,
  title,
  description,
  long_description,
  country,
  region,
  category,
  image_url,
  hero_image_url,
  featured_image,
  goal_amount,
  raised_amount,
  is_active,
  is_featured,
  is_zakat_eligible,
  page_template,
  meta_title,
  meta_description,
  impact_stats,
  donation_options
) VALUES (
  'qurbani',
  'Global Qurbani',
  'Give Your Qurbani Where It''s Needed Most',
  'Fulfill your Qurbani obligation with 100% Shariah-compliant sacrifice. Fresh meat delivered to families in 70+ countries within 24 hours.',
  '<h2>What is Qurbani?</h2>
<p>Qurbani (also known as Udhiyah) is the sacrifice of an animal during Eid al-Adha to commemorate Prophet Ibrahim''s (AS) willingness to sacrifice his son for Allah. It is obligatory for every Muslim who meets the Nisab threshold.</p>

<h3>Our Qurbani Service</h3>
<p>We perform Qurbani in over 70 countries, ensuring fresh meat reaches families in need within 24 hours of sacrifice. All our Qurbani is 100% Shariah-compliant.</p>

<ul>
  <li>Choose from 40+ countries</li>
  <li>Sheep, goat, or cow share options</li>
  <li>Give on behalf of loved ones</li>
  <li>100% Shariah compliant</li>
</ul>',
  'Global',
  'Worldwide',
  'qurbani',
  '/images/qurbani-hero.png',
  '/images/qurbani-hero.png',
  '/images/qurbani-hero.png',
  500000,
  245000,
  true,
  true,
  false,
  'custom',
  'Global Qurbani Service - Qurbani Foundation USA',
  'Give your Qurbani where it''s needed most. 100% Shariah-compliant sacrifice in 70+ countries. Fresh meat delivered within 24 hours.',
  '[
    {"value": "2M+", "label": "People Fed"},
    {"value": "70+", "label": "Countries"},
    {"value": "100%", "label": "Shariah Compliant"},
    {"value": "27+", "label": "Years of Service"}
  ]'::jsonb,
  '[
    {"amount": 50, "label": "Cow Share (India)"},
    {"amount": 75, "label": "Sheep/Goat (India)"},
    {"amount": 150, "label": "Sheep/Goat (Pakistan)"},
    {"amount": 425, "label": "Sheep (Palestine Gaza)"}
  ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  image_url = EXCLUDED.image_url,
  hero_image_url = EXCLUDED.hero_image_url,
  featured_image = EXCLUDED.featured_image,
  is_active = EXCLUDED.is_active,
  is_featured = EXCLUDED.is_featured,
  impact_stats = EXCLUDED.impact_stats,
  donation_options = EXCLUDED.donation_options,
  updated_at = NOW();

-- Verify
SELECT slug, name, category, is_active FROM campaigns WHERE category = 'qurbani';
SELECT slug, label, is_active, show_in_menu FROM categories WHERE slug = 'qurbani';
