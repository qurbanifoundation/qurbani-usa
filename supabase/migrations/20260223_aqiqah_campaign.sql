-- Aqiqah Campaign and Template Migration
-- High-converting Aqiqah service page for newborn blessings

-- Step 1: Add Aqiqah template to template_options
INSERT INTO template_options (template_type, template_key, template_label, description, is_active, sort_order)
VALUES (
  'page',
  'aqiqah',
  'Aqiqah',
  'High-converting Aqiqah page with package selection (boy/girl/twins), child name input, certificate preview, and emotional storytelling. Designed for maximum conversions.',
  true,
  5
)
ON CONFLICT (template_type, template_key) DO UPDATE
SET template_label = EXCLUDED.template_label,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- Step 2: Create the Aqiqah Campaign
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
  goal_amount,
  raised_amount,
  is_active,
  is_featured,
  is_zakat_eligible,
  page_template,
  donation_box_template,
  meta_title,
  meta_description,
  impact_stats,
  content_sections,
  donation_options,
  gallery_images
) VALUES (
  'aqiqah',
  'Aqiqah',
  'Aqiqah - Welcome Your Child with Blessings',
  'Celebrate your child''s arrival the Islamic way. Perform Aqiqah to show gratitude to Allah and provide meat to those in need. We handle everything - you focus on your blessing.',
  '<h2>What is Aqiqah?</h2>
<p>Aqiqah is the Islamic tradition of sacrificing an animal on behalf of a newborn child, typically performed on the 7th day after birth. This blessed Sunnah of Prophet Muhammad (PBUH) is a way to express gratitude to Allah for the gift of a child and to share your joy with others.</p>

<h3>The Sunnah Practice</h3>
<p>According to Islamic tradition, the Prophet Muhammad (PBUH) said: "Every child is held in pledge for his Aqiqah which is sacrificed for him on his seventh day, and he is named on it, and his head is shaved." (Abu Dawud)</p>

<p>The tradition calls for:</p>
<ul>
  <li>Two sheep/goats for a boy</li>
  <li>One sheep/goat for a girl</li>
  <li>Sharing the meat with family, friends, and those in need</li>
</ul>

<h3>Why Perform Aqiqah?</h3>
<p>Aqiqah serves multiple spiritual and social purposes:</p>
<ul>
  <li><strong>Gratitude to Allah:</strong> Thanking Allah for the blessing of a child</li>
  <li><strong>Protection:</strong> Following the Sunnah as a means of seeking Allah''s protection for your child</li>
  <li><strong>Charity:</strong> Feeding the poor and sharing your blessing with the community</li>
  <li><strong>Celebration:</strong> Announcing the arrival of your child in a blessed manner</li>
</ul>

<h2>How We Help</h2>
<p>We make performing Aqiqah simple, authentic, and meaningful. Our process ensures your Aqiqah is performed according to Islamic guidelines while feeding families in need around the world.</p>

<p>When you order Aqiqah through us:</p>
<ul>
  <li>Animals are sourced locally in the country of distribution</li>
  <li>Slaughter is performed by certified halal butchers</li>
  <li>Fresh meat is distributed to families in need within 24 hours</li>
  <li>You receive a beautiful certificate with your child''s name</li>
</ul>',
  'Global',
  'Worldwide',
  'islamic-services',
  'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?w=800&q=80',
  'https://images.unsplash.com/photo-1566598458431-c0d5b79a6c29?w=1600&q=80',
  100000,
  45250,
  true,
  true,
  false,
  'aqiqah',
  'teal-yellow',
  'Aqiqah Service - Welcome Your Child with Islamic Blessings | Qurbani USA',
  'Perform Aqiqah for your newborn according to Sunnah. We handle the sacrifice and distribute meat to families in need. Beautiful certificate included.',
  '[
    {"value": "10,000+", "label": "Aqiqah Performed"},
    {"value": "50,000+", "label": "Families Fed"},
    {"value": "100%", "label": "Halal Certified"},
    {"value": "24hrs", "label": "Distribution Time"}
  ]'::jsonb,
  '[
    {
      "title": "Performed According to Sunnah",
      "content": "<p>Every Aqiqah we perform follows the authentic Sunnah of Prophet Muhammad (PBUH). Our scholars ensure that all Islamic requirements are met, from the selection of healthy animals to the proper method of slaughter.</p><p>We use only healthy, well-fed animals that meet the requirements for Qurbani/Udhiyah, ensuring your Aqiqah is valid and accepted.</p>",
      "image": "https://images.unsplash.com/photo-1545167496-5a24ed2d68b4?w=800&q=80"
    },
    {
      "title": "Feeding Those in Need",
      "content": "<p>The meat from your child''s Aqiqah feeds families who rarely have access to fresh protein. In many communities we serve, meat is a luxury reserved for special occasions.</p><p>Your Aqiqah becomes a source of celebration for multiple families, multiplying your blessings and spreading joy to others.</p>",
      "image": "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&q=80"
    },
    {
      "title": "Beautiful Certificate",
      "content": "<p>Commemorate this blessed occasion with a beautiful digital certificate featuring your child''s name and the date of their Aqiqah. A keepsake to treasure forever and share with your child when they grow up.</p><p>The certificate is sent via email within 48 hours of your Aqiqah being performed.</p>",
      "image": "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&q=80"
    }
  ]'::jsonb,
  '[
    {"amount": 150, "label": "Baby Girl (1 sheep)"},
    {"amount": 300, "label": "Baby Boy (2 sheep)"},
    {"amount": 100, "label": "Sadaqah"}
  ]'::jsonb,
  '[
    "https://images.unsplash.com/photo-1544928147-79a2dbc1f389?w=600&q=80",
    "https://images.unsplash.com/photo-1566598458431-c0d5b79a6c29?w=600&q=80",
    "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80",
    "https://images.unsplash.com/photo-1545167496-5a24ed2d68b4?w=600&q=80"
  ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  country = EXCLUDED.country,
  region = EXCLUDED.region,
  category = EXCLUDED.category,
  image_url = EXCLUDED.image_url,
  hero_image_url = EXCLUDED.hero_image_url,
  goal_amount = EXCLUDED.goal_amount,
  is_active = EXCLUDED.is_active,
  is_featured = EXCLUDED.is_featured,
  is_zakat_eligible = EXCLUDED.is_zakat_eligible,
  page_template = EXCLUDED.page_template,
  donation_box_template = EXCLUDED.donation_box_template,
  meta_title = EXCLUDED.meta_title,
  meta_description = EXCLUDED.meta_description,
  impact_stats = EXCLUDED.impact_stats,
  content_sections = EXCLUDED.content_sections,
  donation_options = EXCLUDED.donation_options,
  gallery_images = EXCLUDED.gallery_images,
  updated_at = NOW();

-- Verify the campaign was created
SELECT slug, name, page_template, is_active FROM campaigns WHERE slug = 'aqiqah';
