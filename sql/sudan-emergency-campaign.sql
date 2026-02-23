-- Sudan Emergency Campaign
-- Run this in your Supabase SQL editor

-- First, ensure the campaigns table has the required columns
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS content_sections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS donation_options JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS impact_stats JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_zakat_eligible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- Update title column to use name if title is null
UPDATE campaigns SET title = name WHERE title IS NULL;

-- Insert Sudan Emergency Campaign
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
  'sudan-emergency',
  'Sudan Emergency Relief',
  'Sudan Emergency Relief',
  'Millions of families in Sudan are caught in the midst of a devastating humanitarian catastrophe. Your urgent support can provide life-saving aid to those who have lost everything.',
  '<h2>A Nation in Crisis</h2>
<p>Sudan is experiencing one of the most severe humanitarian emergencies of our time. Since conflict erupted, millions of innocent civilians have been forced to flee their homes, leaving behind everything they know and love. Families are torn apart, children are orphaned, and entire communities are displaced.</p>

<p>The scale of suffering is immense. Over 14 million people have been displaced—more than a quarter of the country''s population. Half of those affected are children who have witnessed unimaginable trauma and now face an uncertain future.</p>

<h3>The Hunger Emergency</h3>
<p>Beyond the violence, a silent killer stalks the land. More than 25 million people—over half the population—face severe food insecurity. Famine conditions have been confirmed in multiple regions, with hundreds of thousands on the brink of starvation. Families who once provided for themselves now queue desperately for whatever aid reaches them.</p>

<h3>Healthcare in Collapse</h3>
<p>The healthcare system has crumbled. Nearly 40% of health facilities are non-functional, rising to over 70% in the hardest-hit areas. Cholera and other preventable diseases spread rapidly. Mothers give birth without medical care. Children die from treatable conditions simply because help cannot reach them.</p>

<h2>Your Donation Makes the Difference</h2>
<p>When you give to Sudan Emergency Relief, you become a lifeline for families who have nowhere else to turn. Our teams work tirelessly on the ground, navigating dangerous conditions to deliver aid where it''s needed most.</p>

<p>Every contribution, no matter the size, translates directly into hope for a family in despair. A single donation can mean the difference between survival and tragedy for children who deserve a chance at life.</p>',
  'Sudan',
  'East Africa',
  'Emergencies',
  'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=800&q=80',
  'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1600&q=80',
  500000,
  127350,
  true,
  true,
  true,
  'emergency-appeal',
  'list-style',
  'Sudan Emergency Relief - Urgent Humanitarian Aid',
  'Provide urgent humanitarian aid to families affected by the Sudan crisis. Your donation delivers food, medicine, and shelter to those who have lost everything.',
  '[
    {"value": "14M+", "label": "People Displaced"},
    {"value": "25M+", "label": "Need Urgent Aid"},
    {"value": "5M+", "label": "Children Affected"},
    {"value": "$50", "label": "Feeds a Family"}
  ]'::jsonb,
  '[
    {
      "title": "Emergency Food Distribution",
      "content": "<p>Our teams distribute emergency food packages to families who have fled violence with nothing but the clothes on their backs. Each package contains nutritious staples including rice, flour, cooking oil, and protein sources—enough to sustain a family for a month.</p><p>We prioritize the most vulnerable: families with young children, pregnant mothers, the elderly, and those with medical conditions requiring proper nutrition.</p>",
      "image": "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&q=80"
    },
    {
      "title": "Medical Aid & Healthcare",
      "content": "<p>With healthcare infrastructure in ruins, our mobile medical units bring care directly to displaced communities. We provide essential medicines, treat injuries and illnesses, and support mothers through safe childbirth.</p><p>Our teams also run vaccination campaigns to prevent disease outbreaks in crowded displacement camps where conditions can quickly become dangerous.</p>",
      "image": "https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&q=80"
    },
    {
      "title": "Clean Water & Sanitation",
      "content": "<p>Access to clean water is critical for survival. We install water purification systems, distribute hygiene kits, and construct sanitation facilities in displacement camps to prevent the spread of waterborne diseases.</p><p>A single water point can serve hundreds of families, dramatically reducing the risk of cholera and other deadly illnesses.</p>",
      "image": "https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=800&q=80"
    }
  ]'::jsonb,
  '[
    {"amount": 50, "label": "Emergency food pack"},
    {"amount": 100, "label": "Medical supplies"},
    {"amount": 250, "label": "Family relief kit"},
    {"amount": 500, "label": "Emergency shelter"},
    {"amount": 1000, "label": "Community aid"},
    {"amount": 2500, "label": "Major impact"}
  ]'::jsonb,
  '[
    "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&q=80",
    "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80",
    "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=600&q=80",
    "https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=600&q=80",
    "https://images.unsplash.com/photo-1584515933487-779824d29309?w=600&q=80",
    "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=600&q=80"
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
SELECT slug, name, page_template, is_active FROM campaigns WHERE slug = 'sudan-emergency';
