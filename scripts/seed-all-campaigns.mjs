/**
 * Seed campaigns for all categories
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const campaigns = [
  // EMERGENCIES
  { name: 'Gaza Emergency Relief', slug: 'gaza-emergency-relief', category: 'emergencies', country: 'Palestine', description: 'Provide urgent humanitarian aid to families in Gaza affected by the ongoing crisis.', featured_image: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800', goal_amount: 500000, raised_amount: 325000, is_featured: true, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 50, label: 'Emergency food pack' }, { amount: 100, label: 'Clean water supplies' }, { amount: 250, label: 'Shelter kit' }, { amount: 500, label: 'Full relief package' }] },
  { name: 'Sudan Crisis Response', slug: 'sudan-crisis-response', category: 'emergencies', country: 'Sudan', description: 'Help families fleeing conflict in Sudan with emergency supplies.', featured_image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800', goal_amount: 300000, raised_amount: 180000, is_featured: true, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 35, label: 'Emergency food' }, { amount: 75, label: 'Medical aid' }, { amount: 150, label: 'Survival kit' }] },
  { name: 'Syria Winter Emergency', slug: 'syria-winter-emergency', category: 'emergencies', country: 'Syria', description: 'Protect Syrian families from harsh winter conditions.', featured_image: 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=800', goal_amount: 200000, raised_amount: 95000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 50, label: 'Winter clothing' }, { amount: 100, label: 'Heating fuel' }, { amount: 200, label: 'Winter kit' }] },
  { name: 'Yemen Famine Relief', slug: 'yemen-famine-relief', category: 'emergencies', country: 'Yemen', description: 'Combat the worst famine in decades with food aid.', featured_image: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=800', goal_amount: 400000, raised_amount: 220000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 40, label: 'Weekly food pack' }, { amount: 100, label: 'Monthly food' }, { amount: 250, label: 'Family food security' }] },
  
  // WATER FOR LIFE
  { name: 'Build a Water Well', slug: 'build-water-well', category: 'water-for-life', country: 'Multiple', description: 'Provide a community with clean water for generations.', featured_image: 'https://images.unsplash.com/photo-1541544537156-7627a7a4aa1c?w=800', goal_amount: 150000, raised_amount: 89000, is_featured: true, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 300, label: 'Hand pump well' }, { amount: 1500, label: 'Tube well' }, { amount: 3500, label: 'Deep water well' }] },
  { name: 'Water for Pakistan', slug: 'water-for-pakistan', category: 'water-for-life', country: 'Pakistan', description: 'Bring clean water to rural communities in Pakistan.', featured_image: 'https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=800', goal_amount: 100000, raised_amount: 45000, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 50, label: 'Water filter' }, { amount: 150, label: 'Hand pump' }, { amount: 500, label: 'Water point' }] },
  { name: 'Africa Water Project', slug: 'africa-water-project', category: 'water-for-life', country: 'East Africa', description: 'Install water systems across drought-affected regions.', featured_image: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800', goal_amount: 250000, raised_amount: 125000, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 100, label: 'Water tank' }, { amount: 500, label: 'Borehole' }, { amount: 2500, label: 'Village system' }] },
  
  // FOOD AID
  { name: 'Feed the Fasting', slug: 'feed-the-fasting', category: 'food-aid', country: 'Multiple', description: 'Provide iftar meals during Ramadan.', featured_image: 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800', goal_amount: 100000, raised_amount: 67000, is_featured: true, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 5, label: 'One iftar meal' }, { amount: 30, label: 'Family for a day' }, { amount: 150, label: 'Family for Ramadan' }] },
  { name: 'Monthly Food Parcels', slug: 'monthly-food-parcels', category: 'food-aid', country: 'Multiple', description: 'Deliver monthly food parcels to struggling families.', featured_image: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800', goal_amount: 80000, raised_amount: 42000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 50, label: 'One family' }, { amount: 150, label: '3 months support' }] },
  { name: 'School Meals Program', slug: 'school-meals-program', category: 'food-aid', country: 'Bangladesh', description: 'Ensure children receive nutritious meals at school.', featured_image: 'https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=800', goal_amount: 60000, raised_amount: 28000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 25, label: 'One month meals' }, { amount: 100, label: 'Full term' }] },
  
  // ORPHAN SPONSORSHIP
  { name: 'Sponsor an Orphan', slug: 'sponsor-an-orphan', category: 'orphan-sponsorship', country: 'Multiple', description: 'Provide comprehensive care for an orphan.', featured_image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800', goal_amount: 200000, raised_amount: 156000, is_featured: true, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 50, label: 'Monthly sponsorship' }, { amount: 150, label: 'Quarterly' }, { amount: 600, label: 'Annual' }] },
  { name: 'Orphan Education Fund', slug: 'orphan-education-fund', category: 'orphan-sponsorship', country: 'Pakistan', description: 'Fund education for orphans.', featured_image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800', goal_amount: 100000, raised_amount: 65000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 75, label: 'School supplies' }, { amount: 200, label: 'Year tuition' }] },
  { name: 'Orphan Healthcare', slug: 'orphan-healthcare', category: 'orphan-sponsorship', country: 'Somalia', description: 'Ensure orphans receive proper medical care.', featured_image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800', goal_amount: 75000, raised_amount: 38000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 30, label: 'Check-up' }, { amount: 100, label: 'Vaccination' }] },
  
  // EDUCATION
  { name: 'Build a School', slug: 'build-a-school', category: 'education', country: 'Afghanistan', description: 'Construct schools in underserved communities.', featured_image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800', goal_amount: 500000, raised_amount: 285000, is_featured: true, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 100, label: 'Classroom supplies' }, { amount: 500, label: 'Furnish classroom' }, { amount: 2500, label: 'Build classroom' }] },
  { name: 'Girls Education Initiative', slug: 'girls-education-initiative', category: 'education', country: 'Pakistan', description: 'Empower girls through education.', featured_image: 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=800', goal_amount: 150000, raised_amount: 92000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 50, label: 'Monthly support' }, { amount: 200, label: 'Year scholarship' }] },
  { name: 'Quran Education Program', slug: 'quran-education-program', category: 'education', country: 'Multiple', description: 'Support Quran memorization programs.', featured_image: 'https://images.unsplash.com/photo-1585036156171-384164a8c675?w=800', goal_amount: 80000, raised_amount: 45000, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 30, label: 'Study materials' }, { amount: 100, label: 'Hifz sponsorship' }] },
  
  // HEALTHCARE
  { name: 'Mobile Medical Clinics', slug: 'mobile-medical-clinics', category: 'healthcare', country: 'Bangladesh', description: 'Bring healthcare to remote communities.', featured_image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800', goal_amount: 300000, raised_amount: 175000, is_featured: true, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 25, label: 'Consultation' }, { amount: 75, label: 'Treatment' }, { amount: 200, label: 'Surgery fund' }] },
  { name: 'Eye Care Campaign', slug: 'eye-care-campaign', category: 'healthcare', country: 'Pakistan', description: 'Restore sight to those with preventable blindness.', featured_image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800', goal_amount: 100000, raised_amount: 68000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 30, label: 'Eye exam' }, { amount: 50, label: 'Glasses' }, { amount: 150, label: 'Cataract surgery' }] },
  { name: 'Mother & Child Health', slug: 'mother-child-health', category: 'healthcare', country: 'Somalia', description: 'Support maternal and child health programs.', featured_image: 'https://images.unsplash.com/photo-1531983412531-1f49a365ffed?w=800', goal_amount: 120000, raised_amount: 72000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 50, label: 'Prenatal care' }, { amount: 150, label: 'Safe delivery' }] },
  
  // SADAQAH JARIYAH
  { name: 'Build a Mosque', slug: 'build-a-mosque', category: 'sadaqah-jariyah', country: 'Multiple', description: 'Contribute to building a house of Allah.', featured_image: 'https://images.unsplash.com/photo-1545167496-c1e092d383a2?w=800', goal_amount: 250000, raised_amount: 145000, is_featured: true, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 100, label: 'Brick contribution' }, { amount: 500, label: 'Prayer space' }, { amount: 2500, label: 'Room sponsorship' }] },
  { name: 'Plant Olive Trees', slug: 'plant-olive-trees', category: 'sadaqah-jariyah', country: 'Palestine', description: 'Plant blessed olive trees as ongoing charity.', featured_image: 'https://images.unsplash.com/photo-1445294211564-3ca59d999abd?w=800', goal_amount: 50000, raised_amount: 32000, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 25, label: 'One tree' }, { amount: 100, label: 'Grove (5 trees)' }] },
  { name: 'Distribute Qurans', slug: 'distribute-qurans', category: 'sadaqah-jariyah', country: 'Multiple', description: 'Spread the word of Allah by distributing Qurans.', featured_image: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=800', goal_amount: 30000, raised_amount: 18000, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 10, label: 'One Quran' }, { amount: 50, label: '5 Qurans' }] },
  
  // QURBANI
  { name: 'Qurbani 2026', slug: 'qurbani-2026', category: 'qurbani', country: 'Multiple', description: 'Fulfill your Qurbani obligation during Eid ul-Adha.', featured_image: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=800', goal_amount: 400000, raised_amount: 0, is_featured: true, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 99, label: 'Sheep share' }, { amount: 250, label: 'Full sheep' }, { amount: 350, label: 'Cow share' }] },
  { name: 'Prophetic Qurbani', slug: 'prophetic-qurbani', category: 'qurbani', country: 'Multiple', description: 'Give additional Qurbani on behalf of the Ummah.', featured_image: 'https://images.unsplash.com/photo-1604849329181-aef1e89c3bc5?w=800', goal_amount: 100000, raised_amount: 0, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 99, label: 'Prophetic sheep' }, { amount: 350, label: 'Prophetic cow share' }] },

  // ZAKAT
  { name: 'Zakat Fund', slug: 'zakat-fund', category: 'zakat', country: 'Multiple', description: 'Your Zakat reaches those most in need - the poor, indebted, and those striving in the way of Allah.', featured_image: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800', goal_amount: 1000000, raised_amount: 650000, is_featured: true, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 100, label: 'Basic Zakat' }, { amount: 500, label: 'Family support' }, { amount: 1000, label: 'Multiple families' }] },
  { name: 'Zakat for Education', slug: 'zakat-for-education', category: 'zakat', country: 'Pakistan', description: 'Fund education for children from Zakat-eligible families.', featured_image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800', goal_amount: 200000, raised_amount: 125000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 50, label: 'Monthly support' }, { amount: 200, label: 'Full year' }] },
  { name: 'Zakat for Medical Aid', slug: 'zakat-for-medical-aid', category: 'zakat', country: 'Multiple', description: 'Provide life-saving medical treatment to those who cannot afford it.', featured_image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800', goal_amount: 300000, raised_amount: 185000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 75, label: 'Medical checkup' }, { amount: 250, label: 'Surgery fund' }, { amount: 500, label: 'Full treatment' }] },
  { name: 'Zakat for Widows & Orphans', slug: 'zakat-for-widows-orphans', category: 'zakat', country: 'Multiple', description: 'Support widows and orphans with essential needs and sustainable livelihoods.', featured_image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800', goal_amount: 250000, raised_amount: 140000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 50, label: 'Monthly care' }, { amount: 150, label: 'Quarterly support' }, { amount: 600, label: 'Annual sponsorship' }] },

  // RAMADAN
  { name: 'Ramadan Food Pack', slug: 'ramadan-food-pack', category: 'ramadan', country: 'Multiple', description: 'Provide a family with food for the entire month of Ramadan.', featured_image: 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800', goal_amount: 500000, raised_amount: 320000, is_featured: true, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 75, label: 'Family food pack' }, { amount: 150, label: '2 families' }, { amount: 300, label: '4 families' }] },
  { name: 'Iftar Meals', slug: 'iftar-meals', category: 'ramadan', country: 'Multiple', description: 'Feed fasting Muslims with daily iftar meals.', featured_image: 'https://images.unsplash.com/photo-1564671165093-20688ff1fffa?w=800', goal_amount: 200000, raised_amount: 145000, is_active: true, is_zakat_eligible: true, donation_options: [{ amount: 5, label: 'One meal' }, { amount: 30, label: 'Week of meals' }, { amount: 150, label: 'Full Ramadan' }] },
  { name: 'Fidya 2026', slug: 'fidya-2026', category: 'ramadan', country: 'Multiple', description: 'Pay Fidya for missed fasts - $10 per day feeds a person in need.', featured_image: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800', goal_amount: 100000, raised_amount: 45000, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 10, label: 'One day' }, { amount: 70, label: 'One week' }, { amount: 300, label: 'Full month' }] },
  { name: 'Kaffarah 2026', slug: 'kaffarah-2026', category: 'ramadan', country: 'Multiple', description: 'Pay Kaffarah for deliberately broken fasts - feed 60 people per fast.', featured_image: 'https://images.unsplash.com/photo-1559526324-593bc073d938?w=800', goal_amount: 80000, raised_amount: 32000, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 600, label: '1 Kaffarah (60 people)' }, { amount: 1200, label: '2 Kaffarah' }] },
  { name: 'Zakat ul-Fitr 2026', slug: 'zakat-ul-fitr-2026', category: 'ramadan', country: 'Multiple', description: 'Purify your fast with Zakat ul-Fitr - ensure the poor can celebrate Eid.', featured_image: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=800', goal_amount: 150000, raised_amount: 85000, is_active: true, is_zakat_eligible: false, donation_options: [{ amount: 15, label: 'Per person' }, { amount: 60, label: 'Family of 4' }, { amount: 105, label: 'Family of 7' }] }
];

async function seedCampaigns() {
  console.log('🚀 Seeding campaigns for all categories...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const campaign of campaigns) {
    const { error } = await supabase
      .from('campaigns')
      .upsert({
        ...campaign,
        impact_stats: [],
        content_sections: [],
        gallery_images: [],
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'slug' });

    if (error) {
      console.log(`❌ ${campaign.name}: ${error.message}`);
      errorCount++;
    } else {
      console.log(`✅ ${campaign.name} (${campaign.category})`);
      successCount++;
    }
  }

  console.log(`\n📊 Summary: ${successCount} created, ${errorCount} errors`);
}

seedCampaigns();
