-- Emergency Campaigns Setup
-- Run this in your Supabase SQL editor to create all emergency campaigns
-- Source: Islamic Relief Canada Active Appeals

-- First, ensure category column exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'category') THEN
    ALTER TABLE campaigns ADD COLUMN category VARCHAR(100);
  END IF;

  -- Add donation_options column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'donation_options') THEN
    ALTER TABLE campaigns ADD COLUMN donation_options JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Add impact_stats column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'impact_stats') THEN
    ALTER TABLE campaigns ADD COLUMN impact_stats JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Add page_template column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'page_template') THEN
    ALTER TABLE campaigns ADD COLUMN page_template VARCHAR(100);
  END IF;

  -- Add donation_box_template column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'donation_box_template') THEN
    ALTER TABLE campaigns ADD COLUMN donation_box_template VARCHAR(100);
  END IF;

  -- Add featured_image column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'featured_image') THEN
    ALTER TABLE campaigns ADD COLUMN featured_image TEXT;
  END IF;

  -- Add is_zakat_eligible column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'is_zakat_eligible') THEN
    ALTER TABLE campaigns ADD COLUMN is_zakat_eligible BOOLEAN DEFAULT false;
  END IF;
END $$;

-- =====================================================
-- 1. PALESTINE EMERGENCY APPEAL
-- =====================================================
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible,
  page_template, donation_box_template,
  donation_options,
  meta_title, meta_description
) VALUES (
  'palestine-emergency',
  'Palestine Emergency Appeal',
  'Provide urgent humanitarian aid in Gaza including food, medical supplies, clean water, and shelter for displaced families.',
  '<p>The humanitarian crisis in Gaza has reached catastrophic levels, with over 70,000 Palestinians killed - including 20,000 children - and 1.9 million people displaced.</p>
  <h3>Your Donation Provides:</h3>
  <ul>
    <li><strong>$120</strong> - Hot meals for 12 displaced people</li>
    <li><strong>$220</strong> - Maternal health services for one pregnant woman</li>
    <li><strong>$575</strong> - Two trucks of water reaching 700 families</li>
  </ul>
  <h3>Our Impact So Far:</h3>
  <ul>
    <li>600,000+ Palestinians assisted</li>
    <li>2.2 million medical supply items distributed</li>
    <li>71 million ready-to-eat meals provided</li>
    <li>101,000 people received psychosocial support</li>
    <li>110,000 people receive clean water daily</li>
  </ul>
  <p>The people of Gaza need your help now more than ever.</p>',
  'Palestine',
  'emergencies',
  'https://ircprod16-18c01.kxcdn.com/web/image/2547752-3c15e86c/hero%20%5Bfinal%5D.png',
  1000000,
  450000,
  true,
  true,
  true,
  'emergency-appeal',
  'urgent-appeal',
  '[{"amount": 120, "label": "Hot meals for 12 displaced people"}, {"amount": 220, "label": "Maternal health services"}, {"amount": 575, "label": "Water for 700 families"}, {"amount": 1000, "label": "Emergency medical supplies"}]'::jsonb,
  'Palestine Emergency Appeal - Urgent Gaza Aid',
  'Provide urgent humanitarian aid to families in Gaza. Your donation delivers food, water, medical supplies, and shelter.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  featured_image = EXCLUDED.featured_image,
  category = EXCLUDED.category,
  donation_options = EXCLUDED.donation_options,
  page_template = EXCLUDED.page_template,
  donation_box_template = EXCLUDED.donation_box_template,
  is_active = true,
  is_featured = true,
  is_zakat_eligible = true;

-- =====================================================
-- 2. SUDAN CRISIS APPEAL
-- =====================================================
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible,
  page_template, donation_box_template,
  donation_options,
  meta_title, meta_description
) VALUES (
  'sudan-emergency',
  'Sudan Crisis Appeal',
  'Help families affected by Sudan''s civil war. Over 14 million people displaced and 30 million require humanitarian assistance.',
  '<p>Sudan is facing one of the world''s worst humanitarian crises. Civil war has displaced over 14 million people, with 30 million requiring urgent humanitarian assistance. Thousands are being massacred and starved.</p>
  <h3>Your Donation Provides:</h3>
  <ul>
    <li><strong>$150</strong> - Food pack for a family in need</li>
    <li><strong>$250</strong> - Medical aid and supplies to hospitals</li>
    <li><strong>$500</strong> - Cash assistance for essential needs</li>
  </ul>
  <h3>Crisis Statistics:</h3>
  <ul>
    <li>18,000+ civilians killed</li>
    <li>25 million Sudanese experiencing hunger</li>
    <li>3.6 million acutely malnourished children</li>
    <li>70% of healthcare facilities shut down</li>
  </ul>
  <p>Sudanese families are depending on your generosity to survive.</p>',
  'Sudan',
  'emergencies',
  'https://ircprod16-18c01.kxcdn.com/web/image/2547751-0ba6413f/Sudan-Emergency-header%20%282%29.jpg',
  750000,
  280000,
  true,
  true,
  true,
  'emergency-appeal',
  'urgent-appeal',
  '[{"amount": 150, "label": "Food pack for a family"}, {"amount": 250, "label": "Medical aid & supplies"}, {"amount": 500, "label": "Cash assistance"}, {"amount": 1000, "label": "Emergency shelter"}]'::jsonb,
  'Sudan Crisis Appeal - Emergency Relief',
  'Help families affected by Sudan''s crisis with food, medical aid, and emergency assistance.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  featured_image = EXCLUDED.featured_image,
  category = EXCLUDED.category,
  donation_options = EXCLUDED.donation_options,
  page_template = EXCLUDED.page_template,
  donation_box_template = EXCLUDED.donation_box_template,
  is_active = true,
  is_featured = true,
  is_zakat_eligible = true;

-- =====================================================
-- 3. YEMEN EMERGENCY APPEAL
-- =====================================================
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible,
  page_template, donation_box_template,
  donation_options,
  meta_title, meta_description
) VALUES (
  'yemen-emergency',
  'Yemen Emergency Appeal',
  'Provide life-saving food, clean water and medical aid to 24 million people in desperate need - 80% of Yemen''s population.',
  '<p>Yemen faces the world''s worst humanitarian crisis. 24 million people - 80% of the population - need humanitarian aid. The suspension of UN food distributions will leave 9.5 million people without food.</p>
  <h3>Your Donation Provides:</h3>
  <ul>
    <li><strong>$150</strong> - Feed a family for one month</li>
    <li><strong>$250</strong> - Living essentials for a family</li>
    <li><strong>$500</strong> - Urgent medical aid</li>
    <li><strong>$1,000</strong> - Comprehensive family support</li>
  </ul>
  <h3>Crisis Statistics:</h3>
  <ul>
    <li>2.3 million children facing starvation</li>
    <li>12 million children need food, water, shelter</li>
    <li>19.7 million lack adequate healthcare</li>
    <li>6 million people on the brink of famine</li>
  </ul>',
  'Yemen',
  'emergencies',
  'https://ircprod16-18c01.kxcdn.com/web/image/2547758-0e365a75/Yemen%20Emergency.png',
  800000,
  320000,
  true,
  true,
  true,
  'emergency-appeal',
  'urgent-appeal',
  '[{"amount": 150, "label": "Feed a family for one month"}, {"amount": 250, "label": "Living essentials"}, {"amount": 500, "label": "Urgent medical aid"}, {"amount": 1000, "label": "Comprehensive support"}]'::jsonb,
  'Yemen Emergency Appeal - Save Lives',
  'Provide life-saving food, water and medical aid to families in Yemen facing the world''s worst humanitarian crisis.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  featured_image = EXCLUDED.featured_image,
  category = EXCLUDED.category,
  donation_options = EXCLUDED.donation_options,
  page_template = EXCLUDED.page_template,
  donation_box_template = EXCLUDED.donation_box_template,
  is_active = true,
  is_featured = true,
  is_zakat_eligible = true;

-- =====================================================
-- 4. AFGHANISTAN EMERGENCY APPEAL
-- =====================================================
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible,
  page_template, donation_box_template,
  donation_options,
  meta_title, meta_description
) VALUES (
  'afghanistan-emergency',
  'Afghanistan Emergency Appeal',
  'Help earthquake victims and vulnerable families in Afghanistan with emergency food, medical supplies, and shelter.',
  '<p>Afghanistan faces multiple crises - recent earthquakes have devastated communities, while 18.8 million people experience food insecurity across all 34 provinces. 97% of Afghans are at risk of poverty.</p>
  <h3>Your Donation Provides:</h3>
  <ul>
    <li><strong>$150</strong> - Emergency food pack for a family</li>
    <li><strong>$200</strong> - Medicines and medical supplies</li>
    <li><strong>$300</strong> - Tent and shelter for displaced family</li>
  </ul>
  <h3>Crisis Statistics:</h3>
  <ul>
    <li>2.8 million Afghans facing catastrophic famine</li>
    <li>18.8 million experiencing food insecurity</li>
    <li>3 million children under five face malnutrition</li>
    <li>97% at risk of falling into poverty</li>
  </ul>',
  'Afghanistan',
  'emergencies',
  'https://ircprod16-18c01.kxcdn.com/web/image/2547750-d2e5a990/IMG_8598.JPG',
  500000,
  185000,
  true,
  true,
  true,
  'emergency-appeal',
  'urgent-appeal',
  '[{"amount": 150, "label": "Emergency food pack"}, {"amount": 200, "label": "Medical supplies"}, {"amount": 300, "label": "Tent & shelter"}, {"amount": 500, "label": "Family emergency kit"}]'::jsonb,
  'Afghanistan Emergency Appeal - Humanitarian Aid',
  'Help earthquake victims and vulnerable Afghan families with food, medical supplies, and shelter.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  featured_image = EXCLUDED.featured_image,
  category = EXCLUDED.category,
  donation_options = EXCLUDED.donation_options,
  page_template = EXCLUDED.page_template,
  donation_box_template = EXCLUDED.donation_box_template,
  is_active = true,
  is_featured = true,
  is_zakat_eligible = true;

-- =====================================================
-- 5. PAKISTAN FLOODS APPEAL
-- =====================================================
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible,
  page_template, donation_box_template,
  donation_options,
  meta_title, meta_description
) VALUES (
  'pakistan-floods',
  'Pakistan Floods Emergency',
  'Help families affected by devastating floods in Pakistan with emergency food, clean water, shelter, and medical care.',
  '<p>Catastrophic floods have devastated Pakistan, affecting over 33 million people. Entire villages have been submerged, leaving families homeless and vulnerable to waterborne diseases.</p>
  <h3>Your Donation Provides:</h3>
  <ul>
    <li><strong>$80</strong> - Hygiene and basic essentials</li>
    <li><strong>$150</strong> - Food for a family for one month</li>
    <li><strong>$250</strong> - Health and shelter support</li>
  </ul>
  <h3>Our Response:</h3>
  <ul>
    <li>Emergency food distribution</li>
    <li>Clean drinking water</li>
    <li>Medical care for waterborne diseases</li>
    <li>Temporary shelter for displaced families</li>
    <li>Rebuilding support for affected communities</li>
  </ul>',
  'Pakistan',
  'emergencies',
  'https://ircprod16-18c01.kxcdn.com/web/image/2547757-0757379c/EMER-PKFloods-2022-Web.png',
  400000,
  145000,
  true,
  false,
  true,
  'emergency-appeal',
  'urgent-appeal',
  '[{"amount": 80, "label": "Hygiene & essentials"}, {"amount": 150, "label": "Food for one month"}, {"amount": 250, "label": "Health & shelter"}, {"amount": 500, "label": "Family recovery kit"}]'::jsonb,
  'Pakistan Floods Emergency - Flood Relief',
  'Help Pakistani families affected by devastating floods with food, water, shelter and medical care.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  featured_image = EXCLUDED.featured_image,
  category = EXCLUDED.category,
  donation_options = EXCLUDED.donation_options,
  page_template = EXCLUDED.page_template,
  donation_box_template = EXCLUDED.donation_box_template,
  is_active = true,
  is_zakat_eligible = true;

-- =====================================================
-- 6. EAST AFRICA CRISIS APPEAL
-- =====================================================
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible,
  page_template, donation_box_template,
  donation_options,
  meta_title, meta_description
) VALUES (
  'east-africa-crisis',
  'East Africa Crisis Appeal',
  'Over 20 million people face starvation across Sudan, Somalia, Kenya, South Sudan, and Ethiopia due to conflict and drought.',
  '<p>Famine-like conditions are spreading across East Africa. More than 23 million people lack reliable access to food and water. One person dies from hunger every 28 seconds in this region.</p>
  <h3>Your Donation Provides:</h3>
  <ul>
    <li><strong>$40</strong> - Clean water for a family</li>
    <li><strong>$65</strong> - Hygiene kit with essentials</li>
    <li><strong>$130</strong> - Cash grant for basic needs</li>
    <li><strong>$150</strong> - Food pack for a family in need</li>
  </ul>
  <h3>Crisis Statistics:</h3>
  <ul>
    <li>23 million lack reliable food and water</li>
    <li>29 million face severe food insecurity</li>
    <li>1.4 million displaced from Sudan alone</li>
    <li>One person dies from hunger every 28 seconds</li>
  </ul>',
  'East Africa',
  'emergencies',
  'https://ircprod16-18c01.kxcdn.com/web/image/2547756-e6b45c1f/Feature%20image%20-%20Credit%20Islamic%20Relief.jpg',
  600000,
  210000,
  true,
  false,
  true,
  'emergency-appeal',
  'urgent-appeal',
  '[{"amount": 40, "label": "Clean water"}, {"amount": 65, "label": "Hygiene kit"}, {"amount": 130, "label": "Cash grant"}, {"amount": 150, "label": "Family food pack"}]'::jsonb,
  'East Africa Crisis Appeal - Famine Relief',
  'Help save lives across East Africa where millions face starvation due to conflict and drought.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  featured_image = EXCLUDED.featured_image,
  category = EXCLUDED.category,
  donation_options = EXCLUDED.donation_options,
  page_template = EXCLUDED.page_template,
  donation_box_template = EXCLUDED.donation_box_template,
  is_active = true,
  is_zakat_eligible = true;

-- =====================================================
-- 7. SYRIA APPEAL
-- =====================================================
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible,
  page_template, donation_box_template,
  donation_options,
  meta_title, meta_description
) VALUES (
  'syria-emergency',
  'Syria Emergency Appeal',
  'Support 14 million Syrians in need with emergency aid, healthcare, education, and rebuilding after 13 years of crisis.',
  '<p>After 13 years of devastating conflict, 14 million Syrians still need humanitarian assistance. 6.7 million remain displaced within Syria, while 5.6 million are refugees abroad.</p>
  <h3>Your Donation Provides:</h3>
  <ul>
    <li><strong>$130</strong> - Cash grant for family essentials</li>
    <li><strong>$150</strong> - Food pack for displaced families</li>
    <li><strong>$275</strong> - Emergency shelter for two families</li>
    <li><strong>$500</strong> - Healthcare support</li>
  </ul>
  <h3>Our Impact:</h3>
  <ul>
    <li>770,000+ people received food aid</li>
    <li>1.2 million accessed healthcare</li>
    <li>84 health facilities received medical supplies</li>
  </ul>',
  'Syria',
  'emergencies',
  'https://ircprod16-18c01.kxcdn.com/web/image/2547762-3b76ae39/RS9131_IMG_7151.JPG',
  700000,
  275000,
  true,
  true,
  true,
  'emergency-appeal',
  'urgent-appeal',
  '[{"amount": 130, "label": "Cash grant for essentials"}, {"amount": 150, "label": "Family food pack"}, {"amount": 275, "label": "Shelter for 2 families"}, {"amount": 500, "label": "Healthcare support"}]'::jsonb,
  'Syria Emergency Appeal - Humanitarian Aid',
  'Support Syrian families with emergency aid, healthcare, education and rebuilding assistance.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  featured_image = EXCLUDED.featured_image,
  category = EXCLUDED.category,
  donation_options = EXCLUDED.donation_options,
  page_template = EXCLUDED.page_template,
  donation_box_template = EXCLUDED.donation_box_template,
  is_active = true,
  is_featured = true,
  is_zakat_eligible = true;

-- =====================================================
-- 8. HUNGER CRISIS APPEAL
-- =====================================================
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible,
  page_template, donation_box_template,
  donation_options,
  meta_title, meta_description
) VALUES (
  'hunger-crisis',
  'Global Hunger Crisis Appeal',
  'Combat the global hunger crisis affecting millions. Provide emergency food, nutrition programs, and sustainable solutions.',
  '<p>A global hunger crisis is devastating communities worldwide. Climate change, conflict, and economic instability have pushed millions to the brink of starvation.</p>
  <h3>Your Donation Provides:</h3>
  <ul>
    <li><strong>$50</strong> - Emergency food supplies</li>
    <li><strong>$100</strong> - Nutrition support for children</li>
    <li><strong>$200</strong> - Family food security package</li>
    <li><strong>$500</strong> - Sustainable livelihood support</li>
  </ul>
  <h3>Where Help Is Needed:</h3>
  <ul>
    <li>Yemen - worst humanitarian crisis</li>
    <li>Somalia - severe drought</li>
    <li>Afghanistan - economic collapse</li>
    <li>Sudan - conflict and displacement</li>
  </ul>',
  'Global',
  'emergencies',
  'https://ircprod16-18c01.kxcdn.com/web/image/2547764-ffe33014/HC-HungerCrisis-Web-2.png',
  500000,
  180000,
  true,
  false,
  true,
  'emergency-appeal',
  'urgent-appeal',
  '[{"amount": 50, "label": "Emergency food"}, {"amount": 100, "label": "Child nutrition"}, {"amount": 200, "label": "Family food security"}, {"amount": 500, "label": "Livelihood support"}]'::jsonb,
  'Global Hunger Crisis Appeal - Fight Hunger',
  'Combat the global hunger crisis. Provide emergency food and nutrition to families facing starvation.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  featured_image = EXCLUDED.featured_image,
  category = EXCLUDED.category,
  donation_options = EXCLUDED.donation_options,
  page_template = EXCLUDED.page_template,
  donation_box_template = EXCLUDED.donation_box_template,
  is_active = true,
  is_zakat_eligible = true;

-- =====================================================
-- 9. TURKEY-SYRIA EARTHQUAKE APPEAL
-- =====================================================
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible,
  page_template, donation_box_template,
  donation_options,
  meta_title, meta_description
) VALUES (
  'turkey-syria-earthquake',
  'Türkiye-Syria Earthquake Appeal',
  'Help earthquake survivors in Turkey and Syria with emergency shelter, food, medical aid, and rebuilding support.',
  '<p>The devastating earthquakes in Turkey and Syria caused unimaginable destruction. Thousands lost their lives, and millions lost their homes in one of the deadliest natural disasters in the region''s history.</p>
  <h3>Your Donation Provides:</h3>
  <ul>
    <li><strong>$100</strong> - Emergency food and water</li>
    <li><strong>$200</strong> - Warm clothing and blankets</li>
    <li><strong>$350</strong> - Temporary shelter</li>
    <li><strong>$500</strong> - Medical treatment for the injured</li>
  </ul>
  <h3>Our Response:</h3>
  <ul>
    <li>Emergency shelter for displaced families</li>
    <li>Food and clean water distribution</li>
    <li>Medical aid for the injured</li>
    <li>Warm clothing for harsh winter conditions</li>
    <li>Long-term rebuilding support</li>
  </ul>',
  'Turkey/Syria',
  'emergencies',
  'https://ircprod16-18c01.kxcdn.com/web/image/2547763-c8fbcf4a/DJI_0319.jpeg',
  600000,
  340000,
  true,
  false,
  true,
  'emergency-appeal',
  'urgent-appeal',
  '[{"amount": 100, "label": "Emergency food & water"}, {"amount": 200, "label": "Warm clothing & blankets"}, {"amount": 350, "label": "Temporary shelter"}, {"amount": 500, "label": "Medical treatment"}]'::jsonb,
  'Türkiye-Syria Earthquake Appeal - Emergency Relief',
  'Help earthquake survivors with emergency shelter, food, medical aid and rebuilding support.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  featured_image = EXCLUDED.featured_image,
  category = EXCLUDED.category,
  donation_options = EXCLUDED.donation_options,
  page_template = EXCLUDED.page_template,
  donation_box_template = EXCLUDED.donation_box_template,
  is_active = true,
  is_zakat_eligible = true;

-- =====================================================
-- 10. BANGLADESH FLOODS EMERGENCY
-- =====================================================
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible,
  page_template, donation_box_template,
  donation_options,
  meta_title, meta_description
) VALUES (
  'bangladesh-floods',
  'Bangladesh Floods Emergency',
  'Help 3 million people affected by severe monsoon flooding. Provide food, clean water, hygiene kits, and shelter.',
  '<p>Severe monsoon flooding has impacted approximately 3 million people in Bangladesh. Over 33,000 homes have been destroyed across eight districts, leaving families stranded and desperate for help.</p>
  <h3>Your Donation Provides:</h3>
  <ul>
    <li><strong>$80</strong> - Hygiene and basic essentials</li>
    <li><strong>$150</strong> - Food for a family for one month</li>
    <li><strong>$250</strong> - Health and shelter assistance</li>
  </ul>
  <h3>Affected Areas:</h3>
  <ul>
    <li>Sunamganj, Moulvibazar, Habiganj</li>
    <li>Feni, Chittagong, Noakhali</li>
    <li>Comilla, Khagrachari</li>
  </ul>
  <p>31.5% of Bangladesh''s 171 million population live below the poverty line - floods push vulnerable families deeper into crisis.</p>',
  'Bangladesh',
  'emergencies',
  'https://ircprod16-18c01.kxcdn.com/web/image/2579658-45571ede/Emerg-BangladeshFloodsAppeal-2024-Web-1920x1280.png',
  300000,
  95000,
  true,
  false,
  true,
  'emergency-appeal',
  'urgent-appeal',
  '[{"amount": 80, "label": "Hygiene & essentials"}, {"amount": 150, "label": "Food for one month"}, {"amount": 250, "label": "Health & shelter"}, {"amount": 400, "label": "Family emergency kit"}]'::jsonb,
  'Bangladesh Floods Emergency - Flood Relief',
  'Help Bangladeshi families affected by severe flooding with food, water, hygiene kits and shelter.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  featured_image = EXCLUDED.featured_image,
  category = EXCLUDED.category,
  donation_options = EXCLUDED.donation_options,
  page_template = EXCLUDED.page_template,
  donation_box_template = EXCLUDED.donation_box_template,
  is_active = true,
  is_zakat_eligible = true;

-- =====================================================
-- 11. LEBANON EMERGENCY APPEAL
-- =====================================================
INSERT INTO campaigns (
  slug, name, description, long_description, country, category,
  featured_image, goal_amount, raised_amount,
  is_active, is_featured, is_zakat_eligible,
  page_template, donation_box_template,
  donation_options,
  meta_title, meta_description
) VALUES (
  'lebanon-emergency',
  'Lebanon Emergency Appeal',
  'Support displaced Lebanese families with urgent medical supplies, food, hygiene kits, and shelter assistance.',
  '<p>Lebanon faces a devastating humanitarian crisis following conflict and economic collapse. Over 4,000 people have been killed and 16,500+ wounded. More than 100,000 remain displaced.</p>
  <h3>Your Donation Provides:</h3>
  <ul>
    <li><strong>$80</strong> - Hygiene and basic essentials</li>
    <li><strong>$150</strong> - Food for a family for one month</li>
    <li><strong>$250</strong> - Health and shelter support</li>
  </ul>
  <h3>Our Response:</h3>
  <ul>
    <li>37,481 food parcels distributed</li>
    <li>11,921 hygiene kits provided</li>
    <li>24,981 medical equipment/supplies delivered</li>
    <li>4,781 blankets and 1,335 mattresses distributed</li>
    <li>Psychosocial support for trauma victims</li>
  </ul>',
  'Lebanon',
  'emergencies',
  'https://ircprod16-18c01.kxcdn.com/web/image/2602496-61221add/Emerg-LebanonAppeal-2024-WebHeader.png',
  400000,
  165000,
  true,
  false,
  true,
  'emergency-appeal',
  'urgent-appeal',
  '[{"amount": 80, "label": "Hygiene & essentials"}, {"amount": 150, "label": "Food for one month"}, {"amount": 250, "label": "Health & shelter"}, {"amount": 500, "label": "Medical supplies"}]'::jsonb,
  'Lebanon Emergency Appeal - Crisis Relief',
  'Support displaced Lebanese families with food, medical supplies, hygiene kits and shelter.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  featured_image = EXCLUDED.featured_image,
  category = EXCLUDED.category,
  donation_options = EXCLUDED.donation_options,
  page_template = EXCLUDED.page_template,
  donation_box_template = EXCLUDED.donation_box_template,
  is_active = true,
  is_zakat_eligible = true;

-- =====================================================
-- Verify all campaigns were created
-- =====================================================
SELECT
  slug,
  name,
  category,
  is_active,
  is_featured,
  is_zakat_eligible,
  page_template
FROM campaigns
WHERE category = 'emergencies'
ORDER BY is_featured DESC, name;
