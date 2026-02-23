-- Mega Menu Campaigns Setup
-- Run this in your Supabase SQL editor to create all campaigns needed for the mega menu
-- This ensures all links in the navigation work properly

-- First, add category column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'category') THEN
    ALTER TABLE campaigns ADD COLUMN category VARCHAR(100);
  END IF;
END $$;

-- =====================================================
-- EMERGENCY APPEALS
-- =====================================================

-- Gaza Emergency Appeal
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  image_url, hero_image_url, featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible, meta_title, meta_description
) VALUES (
  'gaza-emergency',
  'Gaza Emergency Appeal',
  'Provide urgent humanitarian aid to families in Gaza affected by the ongoing crisis.',
  '<p>The humanitarian situation in Gaza is catastrophic. Families are facing severe shortages of food, clean water, medical supplies, and shelter. Children are among the most vulnerable, with many having lost their homes and access to education.</p>
  <p>Your donation provides:</p>
  <ul>
    <li>Emergency food packages for families</li>
    <li>Clean drinking water</li>
    <li>Medical supplies and healthcare</li>
    <li>Shelter materials and warm clothing</li>
    <li>Psychological support for children</li>
  </ul>
  <p>Every dollar makes a difference. Together, we can provide hope to those who have lost everything.</p>',
  'Palestine',
  'emergencies',
  'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?w=800',
  'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?w=1600',
  'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?w=1200',
  500000,
  125000,
  true,
  true,
  true,
  'Gaza Emergency Appeal - Urgent Humanitarian Aid',
  'Provide urgent humanitarian aid to families in Gaza. Your donation delivers food, water, medical supplies, and shelter to those in need.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true,
  is_featured = true;

-- Syria Emergency Appeal
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  image_url, hero_image_url, featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible, meta_title, meta_description
) VALUES (
  'syria-emergency',
  'Syria Emergency Appeal',
  'Support families affected by years of conflict and displacement in Syria.',
  '<p>After years of devastating conflict, millions of Syrians remain displaced and in desperate need of assistance. Many families are living in makeshift shelters with limited access to basic necessities.</p>
  <p>Your support provides:</p>
  <ul>
    <li>Warm winter supplies for families</li>
    <li>Food and nutrition programs</li>
    <li>Healthcare and medical support</li>
    <li>Education for displaced children</li>
    <li>Livelihood support for families</li>
  </ul>',
  'Syria',
  'emergencies',
  'https://images.unsplash.com/photo-1580087433295-ab2600c1030e?w=800',
  'https://images.unsplash.com/photo-1580087433295-ab2600c1030e?w=1600',
  'https://images.unsplash.com/photo-1580087433295-ab2600c1030e?w=1200',
  300000,
  85000,
  true,
  true,
  true,
  'Syria Emergency Appeal - Help Syrian Families',
  'Support Syrian families affected by conflict. Provide food, shelter, healthcare, and education to those in need.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true;

-- Yemen Emergency Appeal
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  image_url, hero_image_url, featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible, meta_title, meta_description
) VALUES (
  'yemen-emergency',
  'Yemen Emergency Appeal',
  'Help provide food, water, and medical supplies to families in Yemen facing the world''s worst humanitarian crisis.',
  '<p>Yemen is facing the world''s worst humanitarian crisis. Millions of people are on the brink of famine, with children being the most affected. Access to clean water, healthcare, and education has been severely limited.</p>
  <p>Your donation helps provide:</p>
  <ul>
    <li>Emergency food packages to prevent starvation</li>
    <li>Clean water and sanitation facilities</li>
    <li>Critical medical supplies and treatment</li>
    <li>Nutrition programs for malnourished children</li>
    <li>Support for displaced families</li>
  </ul>',
  'Yemen',
  'emergencies',
  'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
  'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1600',
  'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200',
  400000,
  110000,
  true,
  true,
  true,
  'Yemen Emergency Appeal - Combat Hunger and Crisis',
  'Help combat the humanitarian crisis in Yemen. Provide food, water, and medical supplies to families in desperate need.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true;

-- Sudan Emergency Appeal
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  image_url, hero_image_url, featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible, meta_title, meta_description
) VALUES (
  'sudan-emergency',
  'Sudan Emergency Appeal',
  'Support displaced families and children affected by conflict in Sudan.',
  '<p>The conflict in Sudan has displaced millions and created an urgent humanitarian crisis. Families have been forced to flee their homes with nothing but the clothes on their backs.</p>
  <p>Your support provides:</p>
  <ul>
    <li>Emergency shelter and supplies</li>
    <li>Food and clean water</li>
    <li>Medical care and medicine</li>
    <li>Protection for vulnerable women and children</li>
    <li>Education for displaced children</li>
  </ul>',
  'Sudan',
  'emergencies',
  'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=800',
  'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=1600',
  'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=1200',
  250000,
  67000,
  true,
  true,
  true,
  'Sudan Emergency Appeal - Help Displaced Families',
  'Support families displaced by conflict in Sudan. Provide shelter, food, water, and medical care.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true;

-- Pakistan Floods Emergency
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  image_url, hero_image_url, featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible, meta_title, meta_description
) VALUES (
  'pakistan-floods',
  'Pakistan Floods Emergency',
  'Help families affected by devastating floods in Pakistan rebuild their lives.',
  '<p>Devastating floods have affected millions of people in Pakistan, destroying homes, crops, and livelihoods. Many communities are still recovering and need ongoing support.</p>
  <p>Your donation provides:</p>
  <ul>
    <li>Emergency shelter and housing support</li>
    <li>Food packages for affected families</li>
    <li>Clean drinking water</li>
    <li>Healthcare and medical supplies</li>
    <li>Livelihood recovery assistance</li>
  </ul>',
  'Pakistan',
  'emergencies',
  'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800',
  'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=1600',
  'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=1200',
  200000,
  54000,
  true,
  false,
  true,
  'Pakistan Floods Emergency - Flood Relief',
  'Support families affected by floods in Pakistan. Help provide shelter, food, water, and recovery assistance.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true;

-- =====================================================
-- WATER FOR LIFE
-- =====================================================

-- Water Well Campaign
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  image_url, hero_image_url, featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible, meta_title, meta_description
) VALUES (
  'water-well',
  'Build a Water Well',
  'Provide clean drinking water to communities in need by building a water well.',
  '<p>Access to clean water is a basic human right, yet millions of people around the world lack access to safe drinking water. Building a water well can transform an entire community.</p>
  <p>Your donation can provide:</p>
  <ul>
    <li>Hand pump wells serving 200+ people</li>
    <li>Electric tube wells for larger communities</li>
    <li>Solar-powered water systems</li>
    <li>Water filtration systems</li>
    <li>Community water tanks</li>
  </ul>
  <p>A water well is a form of Sadaqah Jariyah - ongoing charity that continues to benefit others for years to come.</p>',
  'Global',
  'water-for-life',
  'https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=800',
  'https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=1600',
  'https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=1200',
  150000,
  42000,
  true,
  true,
  false,
  'Build a Water Well - Clean Water for Communities',
  'Build a water well and provide clean drinking water to entire communities. A lasting gift of Sadaqah Jariyah.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true;

-- =====================================================
-- FOOD AID
-- =====================================================

-- Food Pack Distribution
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  image_url, hero_image_url, featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible, meta_title, meta_description
) VALUES (
  'food-packs',
  'Food Aid Distribution',
  'Distribute essential food packages to families facing hunger and food insecurity.',
  '<p>Millions of families around the world go to bed hungry every night. Our food aid program provides essential nutrition to vulnerable families.</p>
  <p>Each food pack includes:</p>
  <ul>
    <li>Rice, flour, and grains</li>
    <li>Cooking oil</li>
    <li>Lentils and beans</li>
    <li>Sugar and salt</li>
    <li>Tea and spices</li>
  </ul>
  <p>One food pack can feed a family of 5-6 people for an entire month.</p>',
  'Global',
  'food-aid',
  'https://images.unsplash.com/photo-1593113598332-cd59a0c3a9a4?w=800',
  'https://images.unsplash.com/photo-1593113598332-cd59a0c3a9a4?w=1600',
  'https://images.unsplash.com/photo-1593113598332-cd59a0c3a9a4?w=1200',
  100000,
  28000,
  true,
  true,
  true,
  'Food Aid Distribution - Feed Hungry Families',
  'Provide essential food packages to families facing hunger. One pack feeds a family for a month.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true;

-- =====================================================
-- ORPHAN SPONSORSHIP
-- =====================================================

-- Orphan Sponsorship Program
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  image_url, hero_image_url, featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible, meta_title, meta_description
) VALUES (
  'orphan-sponsorship',
  'Orphan Sponsorship Program',
  'Sponsor an orphan and provide education, food, and shelter for a child in need.',
  '<p>There are over 140 million orphans worldwide who have lost one or both parents. These children are among the most vulnerable in society.</p>
  <p>Your sponsorship provides:</p>
  <ul>
    <li>Quality education and school supplies</li>
    <li>Nutritious meals daily</li>
    <li>Safe housing and shelter</li>
    <li>Healthcare and medical support</li>
    <li>Emotional and psychological support</li>
    <li>Skills training for older orphans</li>
  </ul>
  <p>The Prophet Muhammad (PBUH) said: "I and the one who sponsors an orphan will be like this in Paradise" - and he gestured with his two fingers.</p>',
  'Global',
  'orphan-sponsorship',
  'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
  'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1600',
  'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200',
  200000,
  85000,
  true,
  true,
  true,
  'Orphan Sponsorship Program - Support a Child',
  'Sponsor an orphan and transform their life. Provide education, food, shelter, and care to a child in need.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true;

-- =====================================================
-- EDUCATION
-- =====================================================

-- Education Support Campaign
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  image_url, hero_image_url, featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible, meta_title, meta_description
) VALUES (
  'education-support',
  'Education for All',
  'Support educational programs that empower children and communities with knowledge.',
  '<p>Education is the most powerful tool to break the cycle of poverty. Millions of children around the world lack access to quality education.</p>
  <p>Your donation provides:</p>
  <ul>
    <li>School construction and renovation</li>
    <li>Books, supplies, and uniforms</li>
    <li>Teacher training programs</li>
    <li>Scholarships for students</li>
    <li>Computer and technology labs</li>
    <li>Vocational training for youth</li>
  </ul>',
  'Global',
  'education',
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800',
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1600',
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200',
  120000,
  34000,
  true,
  false,
  true,
  'Education for All - Support Learning',
  'Support educational programs for children. Help build schools, provide supplies, and fund scholarships.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true;

-- =====================================================
-- SADAQAH JARIYAH
-- =====================================================

-- Masjid Construction
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  image_url, hero_image_url, featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible, meta_title, meta_description
) VALUES (
  'masjid-construction',
  'Build a Masjid',
  'Contribute to building a masjid and earn ongoing rewards as a Sadaqah Jariyah.',
  '<p>Building a masjid is one of the greatest forms of Sadaqah Jariyah. The Prophet Muhammad (PBUH) said: "Whoever builds a mosque for Allah, Allah will build for him a house in Paradise."</p>
  <p>Your contribution helps:</p>
  <ul>
    <li>Construct new masjids in underserved areas</li>
    <li>Renovate existing prayer facilities</li>
    <li>Build wudu (ablution) facilities</li>
    <li>Install air conditioning and heating</li>
    <li>Provide prayer mats and Qurans</li>
  </ul>
  <p>Every prayer performed in the masjid you help build brings you ongoing rewards.</p>',
  'Global',
  'sadaqah-jariyah',
  'https://images.unsplash.com/photo-1545991842-96f49dc781a3?w=800',
  'https://images.unsplash.com/photo-1545991842-96f49dc781a3?w=1600',
  'https://images.unsplash.com/photo-1545991842-96f49dc781a3?w=1200',
  250000,
  78000,
  true,
  true,
  false,
  'Build a Masjid - Sadaqah Jariyah',
  'Build a masjid and earn ongoing rewards. Every prayer performed brings you continuous blessings.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true;

-- =====================================================
-- HEALTHCARE / SIGHT RESTORATION
-- =====================================================

-- Sight Restoration
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  image_url, hero_image_url, featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible, meta_title, meta_description
) VALUES (
  'sight-restoration',
  'Sight Restoration Programme',
  'Help restore sight to those suffering from preventable blindness.',
  '<p>Millions of people suffer from preventable blindness, unable to see their loved ones or work to support their families. A simple cataract surgery can restore sight in just 15 minutes.</p>
  <p>Your donation provides:</p>
  <ul>
    <li>Cataract surgeries ($50 per surgery)</li>
    <li>Eye screenings and check-ups</li>
    <li>Prescription glasses</li>
    <li>Treatment for eye infections</li>
    <li>Training for local eye care professionals</li>
  </ul>
  <p>For just $50, you can give someone the gift of sight.</p>',
  'Global',
  'healthcare',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1600',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200',
  100000,
  42000,
  true,
  true,
  true,
  'Sight Restoration - Give the Gift of Sight',
  'Help restore sight to those with preventable blindness. A $50 cataract surgery can change a life.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true;

-- =====================================================
-- Update existing campaigns to have categories
-- =====================================================

-- Update Sudan Emergency if it exists without category
UPDATE campaigns
SET category = 'emergencies'
WHERE slug = 'sudan-emergency' AND (category IS NULL OR category = '');

-- Update any Qurbani campaigns
UPDATE campaigns
SET category = 'qurbani'
WHERE slug LIKE '%qurbani%' AND (category IS NULL OR category = '');

-- Verify all campaigns have categories
SELECT slug, name, category, is_active FROM campaigns ORDER BY category, name;
