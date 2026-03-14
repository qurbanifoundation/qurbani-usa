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

const blogArticles = [
  {
    slug: '/blog/ramadan-food-distribution-impact',
    title: 'How Qurbani Foundation Distributes Millions of Meals During Ramadan',
    template: 'blog',
    status: 'published',
    featured_image: '/images/qurbani-foundation-food-distribution.webp',
    meta_title: 'Ramadan Food Distribution Impact | Qurbani Foundation',
    meta_description: 'Learn how Qurbani Foundation coordinates massive food distribution efforts during Ramadan, reaching vulnerable communities in over 40 countries.',
    content: {
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'How Qurbani Foundation Distributes Millions of Meals During Ramadan',
          subtitle: 'A behind-the-scenes look at the logistics, partnerships, and dedication that make large-scale food distribution possible.',
          backgroundImage: '/images/qurbani-foundation-food-distribution.webp'
        },
        {
          id: 'content-1',
          type: 'content',
          content: `<p>Every Ramadan, Qurbani Foundation mobilizes thousands of volunteers and partners across more than 40 countries to ensure that no family goes hungry during the blessed month. What started as a small community effort has grown into one of the largest faith-based food distribution programs in the world.</p>
<h2>The Scale of Our Operations</h2>
<p>During Ramadan 2025, Qurbani Foundation distributed over 2 million meals to families in need across Africa, South Asia, and the Middle East. Each meal package is carefully designed to provide nutritious iftar and suhoor meals for families of five, including staples like rice, flour, cooking oil, dates, and protein.</p>
<p>Our logistics team begins planning months in advance, working with local partner organizations to identify the most vulnerable communities. From refugee camps in Jordan to rural villages in Bangladesh, every package is delivered with dignity and care.</p>
<h2>Local Partnerships Make It Possible</h2>
<p>The key to our success is our network of trusted local partners. In each country, we work with established organizations who understand the unique needs of their communities. These partners handle last-mile distribution, ensuring packages reach families who need them most — including widows, orphans, the elderly, and displaced families.</p>
<p>In 2025, our partner network included over 200 organizations across 42 countries, enabling us to reach even the most remote and underserved areas.</p>`
        },
        {
          id: 'image-1',
          type: 'image',
          imageUrl: '/images/qurbani-foundation-food-distribution.webp',
          caption: 'Volunteers preparing food packages for distribution during Ramadan 2025.',
          alt: 'Qurbani Foundation food distribution during Ramadan'
        },
        {
          id: 'content-2',
          type: 'content',
          content: `<h2>Your Donations at Work</h2>
<p>Every dollar donated to our Ramadan food program goes directly to purchasing and distributing food. Our 100% donation policy means that all administrative costs are covered separately, so donors can trust that their contributions make maximum impact.</p>
<ul>
<li><strong>$50</strong> feeds a family of 5 for the entire month of Ramadan</li>
<li><strong>$150</strong> provides Ramadan food packages for 3 families</li>
<li><strong>$500</strong> feeds an entire village of 50 people</li>
</ul>
<h2>Looking Ahead to Ramadan 2026</h2>
<p>This year, we are expanding our reach to 50 countries with a goal of distributing 3 million meals. With the ongoing humanitarian crises in Gaza, Sudan, and Syria, the need has never been greater. Join us in making this Ramadan the most impactful yet.</p>`
        },
        {
          id: 'cta-1',
          type: 'cta',
          title: 'Join Our Ramadan Campaign',
          description: 'Help us reach our goal of 3 million meals this Ramadan. Every contribution makes a difference.',
          buttonText: 'Donate Now',
          buttonLink: '/ramadan'
        }
      ]
    }
  },
  {
    slug: '/blog/clean-water-initiative-south-asia',
    title: 'Clean Water Initiative Transforms Communities in South Asia',
    template: 'blog',
    status: 'published',
    featured_image: 'https://images.unsplash.com/photo-1541544181051-e46607bc22a4?w=800&q=80',
    meta_title: 'Clean Water Initiative in South Asia | Qurbani Foundation',
    meta_description: 'Discover how Qurbani Foundation\'s clean water projects are providing sustainable access to safe drinking water for thousands of families in South Asia.',
    content: {
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Clean Water Initiative Transforms Communities in South Asia',
          subtitle: 'How sustainable water projects are changing lives and building healthier communities across Bangladesh, Pakistan, and India.',
          backgroundImage: 'https://images.unsplash.com/photo-1541544181051-e46607bc22a4?w=1200&q=80'
        },
        {
          id: 'content-1',
          type: 'content',
          content: `<p>Access to clean water is a fundamental human right, yet millions of people in South Asia still lack this basic necessity. Contaminated water sources lead to waterborne diseases that disproportionately affect children under five, making clean water access a life-or-death issue for vulnerable communities.</p>
<h2>The Crisis in Numbers</h2>
<p>In Bangladesh alone, an estimated 20 million people still rely on arsenic-contaminated groundwater. In rural Pakistan, communities often walk hours to reach the nearest safe water source. These aren't just statistics — they represent families, children, and communities struggling to survive.</p>
<p>Qurbani Foundation's Clean Water Initiative was launched to address this crisis through sustainable, community-owned water solutions.</p>
<h2>Our Approach: Build, Train, Sustain</h2>
<p>Unlike temporary solutions, our water projects are designed to last. Each project follows a three-phase approach:</p>
<ol>
<li><strong>Assessment & Build:</strong> Our engineers survey communities to identify the best water solution — whether deep tube wells, filtration systems, or rainwater harvesting. Construction uses durable materials and follows international water safety standards.</li>
<li><strong>Community Training:</strong> Local water committees are formed and trained in maintenance, water quality testing, and hygiene practices. This ensures the community can sustain the project long after installation.</li>
<li><strong>Long-term Monitoring:</strong> Our team conducts quarterly water quality tests and maintenance checks for 5 years after installation, ensuring continued safe access.</li>
</ol>`
        },
        {
          id: 'image-1',
          type: 'image',
          imageUrl: 'https://images.unsplash.com/photo-1541544181051-e46607bc22a4?w=1200&q=80',
          caption: 'A newly installed clean water well serving a community of 300 families in rural Bangladesh.',
          alt: 'Clean water well installation in South Asia'
        },
        {
          id: 'content-2',
          type: 'content',
          content: `<h2>Impact So Far</h2>
<p>Since launching the Clean Water Initiative in 2020, Qurbani Foundation has:</p>
<ul>
<li>Installed <strong>850+ water wells and filtration systems</strong> across 3 countries</li>
<li>Provided clean water access to over <strong>500,000 people</strong></li>
<li>Reduced waterborne disease rates by <strong>60%</strong> in served communities</li>
<li>Trained <strong>1,200+ community water managers</strong></li>
</ul>
<h2>A New Partnership for Greater Reach</h2>
<p>In January 2026, Qurbani Foundation announced a new partnership with local government agencies in Bangladesh and Pakistan to scale our water projects. This collaboration will bring clean water to an additional 500,000 people over the next two years, with government co-funding and land allocation for new wells.</p>
<p>The partnership model ensures that water projects become part of the national infrastructure, guaranteeing long-term sustainability beyond our direct involvement.</p>`
        },
        {
          id: 'cta-1',
          type: 'cta',
          title: 'Fund a Water Well',
          description: 'A single water well can serve an entire village for decades. Your contribution creates lasting change.',
          buttonText: 'Support Clean Water',
          buttonLink: '/appeals'
        }
      ]
    }
  },
  {
    slug: '/blog/orphan-sponsorship-program-impact',
    title: 'Orphan Sponsorship Program: Changing Lives One Child at a Time',
    template: 'blog',
    status: 'published',
    featured_image: '/images/qurbani-foundation-orphan-sponsorship.webp',
    meta_title: 'Orphan Sponsorship Program Impact | Qurbani Foundation',
    meta_description: 'See how Qurbani Foundation\'s orphan sponsorship program provides education, healthcare, and emotional support to children who have lost their parents.',
    content: {
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Orphan Sponsorship Program: Changing Lives One Child at a Time',
          subtitle: 'How comprehensive care and education are giving orphaned children the foundation they need to build bright futures.',
          backgroundImage: '/images/qurbani-foundation-orphan-sponsorship.webp'
        },
        {
          id: 'content-1',
          type: 'content',
          content: `<p>There are an estimated 153 million orphaned children worldwide. Behind this staggering number are individual stories of loss, resilience, and hope. Qurbani Foundation's Orphan Sponsorship Program exists to ensure that losing a parent doesn't mean losing a future.</p>
<h2>More Than Financial Support</h2>
<p>Our orphan sponsorship model goes far beyond basic financial assistance. Each sponsored child receives a comprehensive package of support designed to address every aspect of their development:</p>
<ul>
<li><strong>Education:</strong> Full school tuition, books, uniforms, and school supplies. For older children, vocational training and career guidance.</li>
<li><strong>Healthcare:</strong> Regular medical checkups, dental care, vision screening, and emergency medical coverage.</li>
<li><strong>Nutrition:</strong> Monthly food packages and nutritional supplements to ensure healthy growth and development.</li>
<li><strong>Emotional Support:</strong> Access to trained counselors and mentors who provide guidance, encouragement, and a sense of belonging.</li>
<li><strong>Safe Housing:</strong> For children without family caregivers, support for safe group homes with trained house mothers.</li>
</ul>
<h2>The Power of Connection</h2>
<p>One of the most meaningful aspects of our program is the connection between sponsors and children. Sponsors receive regular updates including photos, school reports, and handwritten letters from their sponsored child. This personal connection motivates both parties — children feel valued and loved, while sponsors see the direct impact of their generosity.</p>`
        },
        {
          id: 'image-1',
          type: 'image',
          imageUrl: '/images/qurbani-foundation-orphan-sponsorship.webp',
          caption: 'Children in our orphan sponsorship program enjoying a day of educational activities.',
          alt: 'Qurbani Foundation orphan sponsorship program'
        },
        {
          id: 'content-2',
          type: 'content',
          content: `<h2>Success Stories</h2>
<p>Since its inception, the Orphan Sponsorship Program has supported over 15,000 children across 25 countries. Many of our early participants have gone on to complete university degrees, start businesses, and become leaders in their communities.</p>
<p>The ripple effect of sponsoring one child extends to their entire family and community. When a child receives education and support, they are equipped to break the cycle of poverty for generations to come.</p>
<h2>How Sponsorship Works</h2>
<p>For just <strong>$50 per month</strong>, you can sponsor an orphaned child and provide them with everything they need to thrive. Your sponsorship covers:</p>
<ul>
<li>Full educational expenses for the school year</li>
<li>Monthly food and nutrition packages</li>
<li>Comprehensive healthcare coverage</li>
<li>Counseling and mentorship programs</li>
<li>Quarterly progress reports and photo updates</li>
</ul>
<p>Every sponsored child is matched with a local case worker who monitors their progress and ensures they receive the support they need. Our 100% donation policy means your entire sponsorship amount goes directly to the child's care.</p>`
        },
        {
          id: 'cta-1',
          type: 'cta',
          title: 'Sponsor an Orphan Today',
          description: 'Give an orphaned child the gift of education, healthcare, and hope. Your monthly sponsorship can change a life forever.',
          buttonText: 'Sponsor a Child',
          buttonLink: '/appeals'
        }
      ]
    }
  }
];

async function seed() {
  console.log('🌱 Seeding blog articles into pages table...\n');

  for (const article of blogArticles) {
    console.log(`📝 Seeding: ${article.title}`);

    // Check if article already exists
    const { data: existing } = await supabase
      .from('pages')
      .select('id')
      .eq('slug', article.slug)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('pages')
        .update({
          ...article,
          content: article.content,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) {
        console.error(`   ❌ Failed to update: ${error.message}`);
      } else {
        console.log(`   ✅ Updated existing article`);
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('pages')
        .insert({
          ...article,
          content: article.content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error(`   ❌ Failed to insert: ${error.message}`);
      } else {
        console.log(`   ✅ Inserted new article`);
      }
    }
  }

  console.log('\n✨ Blog article seeding complete!');
}

seed().catch(console.error);
