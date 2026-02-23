import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const emergencyCampaigns = [
  {
    slug: 'palestine-emergency',
    name: 'Palestine Emergency Appeal',
    description: 'Join Qurbani Foundation in providing urgent humanitarian aid in Gaza including food, medical supplies, clean water, and shelter for displaced families.',
    long_description: `<p>The humanitarian crisis in Gaza has reached catastrophic levels, with millions of innocent civilians, including children, caught in devastating conditions. Qurbani Foundation is on the ground providing life-saving assistance.</p>
    <h3>How Your Donation Helps:</h3>
    <ul>
      <li><strong>$120</strong> - Provides hot meals for 12 displaced people</li>
      <li><strong>$220</strong> - Delivers maternal health services for one pregnant woman</li>
      <li><strong>$575</strong> - Supplies two trucks of water reaching 700 families</li>
    </ul>
    <h3>Our Impact Through Your Generosity:</h3>
    <ul>
      <li>Hundreds of thousands of Palestinians assisted</li>
      <li>Millions of medical supply items distributed</li>
      <li>Millions of ready-to-eat meals provided</li>
      <li>Thousands receiving psychosocial support</li>
      <li>Daily clean water distribution to families in need</li>
    </ul>
    <p>The people of Gaza are counting on your compassion. Every donation brings hope to families who have lost everything.</p>`,
    country: 'Palestine',
    category: 'emergencies',
    featured_image: 'https://ircprod16-18c01.kxcdn.com/web/image/2547752-3c15e86c/hero%20%5Bfinal%5D.png',
    goal_amount: 1000000,
    raised_amount: 450000,
    is_active: true,
    is_featured: true,
    is_zakat_eligible: true,
    page_template: 'emergency-appeal',
    donation_box_template: 'urgent-appeal',
    donation_options: [
      { amount: 120, label: 'Hot meals for 12 displaced people' },
      { amount: 220, label: 'Maternal health services' },
      { amount: 575, label: 'Water for 700 families' },
      { amount: 1000, label: 'Emergency medical supplies' }
    ],
    meta_title: 'Palestine Emergency Appeal - Qurbani Foundation',
    meta_description: 'Provide urgent humanitarian aid to families in Gaza. Your donation delivers food, water, medical supplies, and shelter through Qurbani Foundation.'
  },
  {
    slug: 'sudan-emergency',
    name: 'Sudan Crisis Appeal',
    description: 'Qurbani Foundation is responding to Sudan\'s devastating civil war. Over 14 million displaced and 30 million require urgent humanitarian assistance.',
    long_description: `<p>Sudan faces one of the world's most severe humanitarian emergencies. Civil war has displaced over 14 million people, with 30 million requiring urgent humanitarian assistance. Qurbani Foundation is committed to reaching those most in need.</p>
    <h3>Your Donation Makes a Difference:</h3>
    <ul>
      <li><strong>$150</strong> - Provides a food pack for a family in need</li>
      <li><strong>$250</strong> - Delivers medical aid and supplies to hospitals</li>
      <li><strong>$500</strong> - Provides cash assistance for essential needs</li>
    </ul>
    <h3>The Reality on the Ground:</h3>
    <ul>
      <li>Thousands of civilians killed in ongoing conflict</li>
      <li>25 million Sudanese experiencing severe hunger</li>
      <li>Millions of acutely malnourished children</li>
      <li>Majority of healthcare facilities shut down</li>
    </ul>
    <p>Sudanese families are depending on your generosity to survive another day.</p>`,
    country: 'Sudan',
    category: 'emergencies',
    featured_image: 'https://ircprod16-18c01.kxcdn.com/web/image/2547751-0ba6413f/Sudan-Emergency-header%20%282%29.jpg',
    goal_amount: 750000,
    raised_amount: 280000,
    is_active: true,
    is_featured: true,
    is_zakat_eligible: true,
    page_template: 'emergency-appeal',
    donation_box_template: 'urgent-appeal',
    donation_options: [
      { amount: 150, label: 'Food pack for a family' },
      { amount: 250, label: 'Medical aid & supplies' },
      { amount: 500, label: 'Cash assistance' },
      { amount: 1000, label: 'Emergency shelter' }
    ],
    meta_title: 'Sudan Crisis Appeal - Qurbani Foundation',
    meta_description: 'Help families affected by Sudan\'s crisis with food, medical aid, and emergency assistance through Qurbani Foundation.'
  },
  {
    slug: 'yemen-emergency',
    name: 'Yemen Emergency Appeal',
    description: 'Qurbani Foundation is delivering life-saving food, clean water and medical aid to 24 million people in desperate need across Yemen.',
    long_description: `<p>Yemen continues to face the world's worst humanitarian crisis. An overwhelming 24 million people - representing 80% of the entire population - desperately need humanitarian aid. Qurbani Foundation is working tirelessly to reach vulnerable families.</p>
    <h3>Your Generosity Provides:</h3>
    <ul>
      <li><strong>$150</strong> - Feeds a family for one full month</li>
      <li><strong>$250</strong> - Supplies living essentials for a struggling family</li>
      <li><strong>$500</strong> - Delivers urgent medical aid</li>
      <li><strong>$1,000</strong> - Provides comprehensive family support</li>
    </ul>
    <h3>A Crisis of Immense Proportions:</h3>
    <ul>
      <li>Millions of children facing starvation</li>
      <li>12 million children need food, water, shelter</li>
      <li>Nearly 20 million lack adequate healthcare</li>
      <li>6 million people on the brink of famine</li>
    </ul>
    <p>Together, we can bring hope to Yemeni families fighting to survive.</p>`,
    country: 'Yemen',
    category: 'emergencies',
    featured_image: 'https://ircprod16-18c01.kxcdn.com/web/image/2547758-0e365a75/Yemen%20Emergency.png',
    goal_amount: 800000,
    raised_amount: 320000,
    is_active: true,
    is_featured: true,
    is_zakat_eligible: true,
    page_template: 'emergency-appeal',
    donation_box_template: 'urgent-appeal',
    donation_options: [
      { amount: 150, label: 'Feed a family for one month' },
      { amount: 250, label: 'Living essentials' },
      { amount: 500, label: 'Urgent medical aid' },
      { amount: 1000, label: 'Comprehensive support' }
    ],
    meta_title: 'Yemen Emergency Appeal - Qurbani Foundation',
    meta_description: 'Provide life-saving food, water and medical aid to families in Yemen through Qurbani Foundation.'
  },
  {
    slug: 'afghanistan-emergency',
    name: 'Afghanistan Emergency Appeal',
    description: 'Support Qurbani Foundation\'s efforts to help earthquake victims and vulnerable Afghan families with emergency food, medical supplies, and shelter.',
    long_description: `<p>Afghanistan faces multiple overlapping crises - from devastating earthquakes to widespread economic collapse. Nearly 19 million people experience food insecurity across all provinces, with the vast majority at risk of falling into poverty. Qurbani Foundation is delivering critical aid.</p>
    <h3>Your Contribution Provides:</h3>
    <ul>
      <li><strong>$150</strong> - Emergency food pack for a family</li>
      <li><strong>$200</strong> - Medicines and medical supplies</li>
      <li><strong>$300</strong> - Tent and shelter for displaced family</li>
    </ul>
    <h3>The Scale of the Crisis:</h3>
    <ul>
      <li>Millions facing catastrophic famine conditions</li>
      <li>Nearly 19 million experiencing food insecurity</li>
      <li>3 million children under five face malnutrition</li>
      <li>Vast majority at risk of extreme poverty</li>
    </ul>
    <p>Afghan families need your compassion now more than ever.</p>`,
    country: 'Afghanistan',
    category: 'emergencies',
    featured_image: 'https://ircprod16-18c01.kxcdn.com/web/image/2547750-d2e5a990/IMG_8598.JPG',
    goal_amount: 500000,
    raised_amount: 185000,
    is_active: true,
    is_featured: true,
    is_zakat_eligible: true,
    page_template: 'emergency-appeal',
    donation_box_template: 'urgent-appeal',
    donation_options: [
      { amount: 150, label: 'Emergency food pack' },
      { amount: 200, label: 'Medical supplies' },
      { amount: 300, label: 'Tent & shelter' },
      { amount: 500, label: 'Family emergency kit' }
    ],
    meta_title: 'Afghanistan Emergency Appeal - Qurbani Foundation',
    meta_description: 'Help earthquake victims and vulnerable Afghan families with food, medical supplies, and shelter through Qurbani Foundation.'
  },
  {
    slug: 'pakistan-floods',
    name: 'Pakistan Floods Emergency',
    description: 'Qurbani Foundation is helping families devastated by floods in Pakistan with emergency food, clean water, shelter, and medical care.',
    long_description: `<p>Catastrophic flooding has devastated communities across Pakistan, affecting tens of millions of people. Entire villages have been submerged, leaving families homeless and vulnerable to waterborne diseases. Qurbani Foundation is providing immediate relief.</p>
    <h3>Your Support Delivers:</h3>
    <ul>
      <li><strong>$80</strong> - Hygiene and basic essentials</li>
      <li><strong>$150</strong> - Food for a family for one month</li>
      <li><strong>$250</strong> - Health and shelter support</li>
    </ul>
    <h3>Our Emergency Response:</h3>
    <ul>
      <li>Emergency food distribution to displaced families</li>
      <li>Clean drinking water to prevent disease outbreaks</li>
      <li>Medical care for waterborne illnesses</li>
      <li>Temporary shelter for those who lost their homes</li>
      <li>Long-term rebuilding support for affected communities</li>
    </ul>
    <p>Pakistani families have lost everything. Your generosity helps them rebuild.</p>`,
    country: 'Pakistan',
    category: 'emergencies',
    featured_image: 'https://ircprod16-18c01.kxcdn.com/web/image/2547757-0757379c/EMER-PKFloods-2022-Web.png',
    goal_amount: 400000,
    raised_amount: 145000,
    is_active: true,
    is_featured: false,
    is_zakat_eligible: true,
    page_template: 'emergency-appeal',
    donation_box_template: 'urgent-appeal',
    donation_options: [
      { amount: 80, label: 'Hygiene & essentials' },
      { amount: 150, label: 'Food for one month' },
      { amount: 250, label: 'Health & shelter' },
      { amount: 500, label: 'Family recovery kit' }
    ],
    meta_title: 'Pakistan Floods Emergency - Qurbani Foundation',
    meta_description: 'Help Pakistani families affected by devastating floods with food, water, shelter and medical care through Qurbani Foundation.'
  },
  {
    slug: 'east-africa-crisis',
    name: 'East Africa Crisis Appeal',
    description: 'Over 20 million people face starvation across East Africa. Qurbani Foundation is combating famine caused by conflict and drought.',
    long_description: `<p>Famine-like conditions are spreading across East Africa, threatening millions of lives. More than 23 million people lack reliable access to food and water across Sudan, Somalia, Kenya, South Sudan, and Ethiopia. Qurbani Foundation is responding with urgent relief.</p>
    <h3>Your Donation Provides:</h3>
    <ul>
      <li><strong>$40</strong> - Clean water for a family</li>
      <li><strong>$65</strong> - Hygiene kit with essentials</li>
      <li><strong>$130</strong> - Cash grant for basic needs</li>
      <li><strong>$150</strong> - Food pack for a family in need</li>
    </ul>
    <h3>A Region in Crisis:</h3>
    <ul>
      <li>23 million lack reliable food and water</li>
      <li>29 million face severe food insecurity</li>
      <li>Millions displaced from conflict zones</li>
      <li>Devastating hunger claiming lives daily</li>
    </ul>
    <p>Your compassion can help us save lives across East Africa.</p>`,
    country: 'East Africa',
    category: 'emergencies',
    featured_image: 'https://ircprod16-18c01.kxcdn.com/web/image/2547756-e6b45c1f/Feature%20image%20-%20Credit%20Islamic%20Relief.jpg',
    goal_amount: 600000,
    raised_amount: 210000,
    is_active: true,
    is_featured: false,
    is_zakat_eligible: true,
    page_template: 'emergency-appeal',
    donation_box_template: 'urgent-appeal',
    donation_options: [
      { amount: 40, label: 'Clean water' },
      { amount: 65, label: 'Hygiene kit' },
      { amount: 130, label: 'Cash grant' },
      { amount: 150, label: 'Family food pack' }
    ],
    meta_title: 'East Africa Crisis Appeal - Qurbani Foundation',
    meta_description: 'Help save lives across East Africa where millions face starvation due to conflict and drought. Donate through Qurbani Foundation.'
  },
  {
    slug: 'syria-emergency',
    name: 'Syria Emergency Appeal',
    description: 'Qurbani Foundation is supporting 14 million Syrians in need with emergency aid, healthcare, education, and rebuilding assistance.',
    long_description: `<p>After more than a decade of devastating conflict, 14 million Syrians still require humanitarian assistance. Millions remain displaced within Syria, while millions more have fled as refugees. Qurbani Foundation continues to deliver vital support.</p>
    <h3>Your Generosity Provides:</h3>
    <ul>
      <li><strong>$130</strong> - Cash grant for family essentials</li>
      <li><strong>$150</strong> - Food pack for displaced families</li>
      <li><strong>$275</strong> - Emergency shelter for two families</li>
      <li><strong>$500</strong> - Healthcare support</li>
    </ul>
    <h3>Making a Lasting Impact:</h3>
    <ul>
      <li>Hundreds of thousands receive food aid</li>
      <li>Over a million access healthcare services</li>
      <li>Dozens of health facilities receive medical supplies</li>
      <li>Education support for displaced children</li>
    </ul>
    <p>Syrian families deserve hope and dignity. Your support makes it possible.</p>`,
    country: 'Syria',
    category: 'emergencies',
    featured_image: 'https://ircprod16-18c01.kxcdn.com/web/image/2547762-3b76ae39/RS9131_IMG_7151.JPG',
    goal_amount: 700000,
    raised_amount: 275000,
    is_active: true,
    is_featured: true,
    is_zakat_eligible: true,
    page_template: 'emergency-appeal',
    donation_box_template: 'urgent-appeal',
    donation_options: [
      { amount: 130, label: 'Cash grant for essentials' },
      { amount: 150, label: 'Family food pack' },
      { amount: 275, label: 'Shelter for 2 families' },
      { amount: 500, label: 'Healthcare support' }
    ],
    meta_title: 'Syria Emergency Appeal - Qurbani Foundation',
    meta_description: 'Support Syrian families with emergency aid, healthcare, education and rebuilding assistance through Qurbani Foundation.'
  },
  {
    slug: 'hunger-crisis',
    name: 'Global Hunger Crisis Appeal',
    description: 'Qurbani Foundation is combating the global hunger crisis affecting millions with emergency food, nutrition programs, and sustainable solutions.',
    long_description: `<p>A devastating global hunger crisis is threatening communities worldwide. Climate change, conflict, and economic instability have pushed millions to the brink of starvation. Qurbani Foundation is working to provide immediate relief and long-term solutions.</p>
    <h3>Your Support Provides:</h3>
    <ul>
      <li><strong>$50</strong> - Emergency food supplies</li>
      <li><strong>$100</strong> - Nutrition support for children</li>
      <li><strong>$200</strong> - Family food security package</li>
      <li><strong>$500</strong> - Sustainable livelihood support</li>
    </ul>
    <h3>Regions in Desperate Need:</h3>
    <ul>
      <li>Yemen - facing the worst humanitarian crisis</li>
      <li>Somalia - devastated by severe drought</li>
      <li>Afghanistan - reeling from economic collapse</li>
      <li>Sudan - torn apart by conflict and displacement</li>
    </ul>
    <p>Together, we can fight hunger and restore hope to families worldwide.</p>`,
    country: 'Global',
    category: 'emergencies',
    featured_image: 'https://ircprod16-18c01.kxcdn.com/web/image/2547764-ffe33014/HC-HungerCrisis-Web-2.png',
    goal_amount: 500000,
    raised_amount: 180000,
    is_active: true,
    is_featured: false,
    is_zakat_eligible: true,
    page_template: 'emergency-appeal',
    donation_box_template: 'urgent-appeal',
    donation_options: [
      { amount: 50, label: 'Emergency food' },
      { amount: 100, label: 'Child nutrition' },
      { amount: 200, label: 'Family food security' },
      { amount: 500, label: 'Livelihood support' }
    ],
    meta_title: 'Global Hunger Crisis Appeal - Qurbani Foundation',
    meta_description: 'Combat the global hunger crisis. Provide emergency food and nutrition to families facing starvation through Qurbani Foundation.'
  },
  {
    slug: 'turkey-syria-earthquake',
    name: 'Türkiye-Syria Earthquake Appeal',
    description: 'Qurbani Foundation is helping earthquake survivors in Turkey and Syria with emergency shelter, food, medical aid, and rebuilding support.',
    long_description: `<p>The devastating earthquakes in Turkey and Syria caused unimaginable destruction, claiming thousands of lives and leaving millions homeless. Qurbani Foundation responded immediately and continues to support survivors.</p>
    <h3>Your Donation Provides:</h3>
    <ul>
      <li><strong>$100</strong> - Emergency food and water</li>
      <li><strong>$200</strong> - Warm clothing and blankets</li>
      <li><strong>$350</strong> - Temporary shelter</li>
      <li><strong>$500</strong> - Medical treatment for the injured</li>
    </ul>
    <h3>Our Comprehensive Response:</h3>
    <ul>
      <li>Emergency shelter for displaced families</li>
      <li>Food and clean water distribution</li>
      <li>Medical aid for the injured</li>
      <li>Warm clothing for harsh winter conditions</li>
      <li>Long-term rebuilding support</li>
    </ul>
    <p>Survivors are counting on us to help them rebuild their lives from the rubble.</p>`,
    country: 'Turkey/Syria',
    category: 'emergencies',
    featured_image: 'https://ircprod16-18c01.kxcdn.com/web/image/2547763-c8fbcf4a/DJI_0319.jpeg',
    goal_amount: 600000,
    raised_amount: 340000,
    is_active: true,
    is_featured: false,
    is_zakat_eligible: true,
    page_template: 'emergency-appeal',
    donation_box_template: 'urgent-appeal',
    donation_options: [
      { amount: 100, label: 'Emergency food & water' },
      { amount: 200, label: 'Warm clothing & blankets' },
      { amount: 350, label: 'Temporary shelter' },
      { amount: 500, label: 'Medical treatment' }
    ],
    meta_title: 'Türkiye-Syria Earthquake Appeal - Qurbani Foundation',
    meta_description: 'Help earthquake survivors with emergency shelter, food, medical aid and rebuilding support through Qurbani Foundation.'
  },
  {
    slug: 'bangladesh-floods',
    name: 'Bangladesh Floods Emergency',
    description: 'Qurbani Foundation is helping millions affected by severe monsoon flooding with food, clean water, hygiene kits, and shelter.',
    long_description: `<p>Severe monsoon flooding has impacted millions of people across Bangladesh. Tens of thousands of homes have been destroyed across multiple districts, leaving families stranded and desperate for help. Qurbani Foundation is providing emergency relief.</p>
    <h3>Your Support Delivers:</h3>
    <ul>
      <li><strong>$80</strong> - Hygiene and basic essentials</li>
      <li><strong>$150</strong> - Food for a family for one month</li>
      <li><strong>$250</strong> - Health and shelter assistance</li>
    </ul>
    <h3>Affected Communities Need Help:</h3>
    <ul>
      <li>Multiple districts severely affected</li>
      <li>Tens of thousands of homes destroyed</li>
      <li>Families stranded and seeking shelter</li>
      <li>Vulnerable populations at greatest risk</li>
    </ul>
    <p>With a significant portion of Bangladesh's population living below the poverty line, floods push vulnerable families deeper into crisis.</p>`,
    country: 'Bangladesh',
    category: 'emergencies',
    featured_image: 'https://ircprod16-18c01.kxcdn.com/web/image/2579658-45571ede/Emerg-BangladeshFloodsAppeal-2024-Web-1920x1280.png',
    goal_amount: 300000,
    raised_amount: 95000,
    is_active: true,
    is_featured: false,
    is_zakat_eligible: true,
    page_template: 'emergency-appeal',
    donation_box_template: 'urgent-appeal',
    donation_options: [
      { amount: 80, label: 'Hygiene & essentials' },
      { amount: 150, label: 'Food for one month' },
      { amount: 250, label: 'Health & shelter' },
      { amount: 400, label: 'Family emergency kit' }
    ],
    meta_title: 'Bangladesh Floods Emergency - Qurbani Foundation',
    meta_description: 'Help Bangladeshi families affected by severe flooding with food, water, hygiene kits and shelter through Qurbani Foundation.'
  },
  {
    slug: 'lebanon-emergency',
    name: 'Lebanon Emergency Appeal',
    description: 'Qurbani Foundation is supporting displaced Lebanese families with urgent medical supplies, food, hygiene kits, and shelter assistance.',
    long_description: `<p>Lebanon faces a devastating humanitarian crisis following conflict and economic collapse. Thousands have been killed and wounded, with over 100,000 remaining displaced. Qurbani Foundation is delivering critical assistance.</p>
    <h3>Your Donation Provides:</h3>
    <ul>
      <li><strong>$80</strong> - Hygiene and basic essentials</li>
      <li><strong>$150</strong> - Food for a family for one month</li>
      <li><strong>$250</strong> - Health and shelter support</li>
    </ul>
    <h3>Our Ongoing Response:</h3>
    <ul>
      <li>Food parcels distributed to families</li>
      <li>Hygiene kits provided to those in need</li>
      <li>Medical equipment and supplies delivered</li>
      <li>Blankets and mattresses for displaced families</li>
      <li>Psychosocial support for trauma victims</li>
    </ul>
    <p>Lebanese families need your compassion during this difficult time.</p>`,
    country: 'Lebanon',
    category: 'emergencies',
    featured_image: 'https://ircprod16-18c01.kxcdn.com/web/image/2602496-61221add/Emerg-LebanonAppeal-2024-WebHeader.png',
    goal_amount: 400000,
    raised_amount: 165000,
    is_active: true,
    is_featured: false,
    is_zakat_eligible: true,
    page_template: 'emergency-appeal',
    donation_box_template: 'urgent-appeal',
    donation_options: [
      { amount: 80, label: 'Hygiene & essentials' },
      { amount: 150, label: 'Food for one month' },
      { amount: 250, label: 'Health & shelter' },
      { amount: 500, label: 'Medical supplies' }
    ],
    meta_title: 'Lebanon Emergency Appeal - Qurbani Foundation',
    meta_description: 'Support displaced Lebanese families with food, medical supplies, hygiene kits and shelter through Qurbani Foundation.'
  }
];

async function seedCampaigns() {
  console.log('🚀 Starting Emergency Campaigns Seeding...\n');

  // First, ensure the required columns exist
  console.log('📋 Checking table structure...');

  for (const campaign of emergencyCampaigns) {
    console.log(`\n📌 Processing: ${campaign.name}`);

    // Check if campaign exists
    const { data: existing } = await supabase
      .from('campaigns')
      .select('id, slug')
      .eq('slug', campaign.slug)
      .single();

    if (existing) {
      // Update existing campaign
      const { error } = await supabase
        .from('campaigns')
        .update({
          name: campaign.name,
          description: campaign.description,
          long_description: campaign.long_description,
          country: campaign.country,
          category: campaign.category,
          featured_image: campaign.featured_image,
          goal_amount: campaign.goal_amount,
          raised_amount: campaign.raised_amount,
          is_active: campaign.is_active,
          is_featured: campaign.is_featured,
          is_zakat_eligible: campaign.is_zakat_eligible,
          page_template: campaign.page_template,
          donation_box_template: campaign.donation_box_template,
          donation_options: campaign.donation_options,
          meta_title: campaign.meta_title,
          meta_description: campaign.meta_description,
          updated_at: new Date().toISOString()
        })
        .eq('slug', campaign.slug);

      if (error) {
        console.log(`   ❌ Error updating: ${error.message}`);
      } else {
        console.log(`   ✅ Updated successfully`);
      }
    } else {
      // Insert new campaign
      const { error } = await supabase
        .from('campaigns')
        .insert({
          ...campaign,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.log(`   ❌ Error inserting: ${error.message}`);
      } else {
        console.log(`   ✅ Inserted successfully`);
      }
    }
  }

  // Verify results
  console.log('\n\n📊 Verification - Emergency Campaigns in Database:');
  const { data: allCampaigns, error } = await supabase
    .from('campaigns')
    .select('slug, name, category, is_active, is_featured')
    .eq('category', 'emergencies')
    .order('is_featured', { ascending: false })
    .order('name');

  if (error) {
    console.log('Error fetching campaigns:', error.message);
  } else {
    console.log('\n');
    allCampaigns.forEach((c, i) => {
      const featured = c.is_featured ? '⭐' : '  ';
      const active = c.is_active ? '✓' : '✗';
      console.log(`${featured} ${i + 1}. [${active}] ${c.name} (/${c.slug})`);
    });
    console.log(`\n✅ Total: ${allCampaigns.length} emergency campaigns`);
  }
}

seedCampaigns().catch(console.error);
