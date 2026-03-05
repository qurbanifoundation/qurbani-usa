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

/**
 * Seed the Zakat campaign record.
 * This creates a campaign with page_template='zakat-hub' so the
 * ZakatHubTemplate renders it. All content is stored in template_config,
 * content_sections, gallery_images, and impact_stats — editable via
 * /admin/campaigns/[id].
 */
async function seedZakatCampaign() {
  console.log('🕌 Seeding Zakat campaign...\n');

  // ── 1. Check if a zakat campaign already exists ────────────────────
  const { data: existing } = await supabase
    .from('campaigns')
    .select('id, slug')
    .eq('slug', 'zakat')
    .maybeSingle();

  if (existing) {
    console.log(`⚠️  Campaign "zakat" already exists (id: ${existing.id}). Updating...`);
  }

  // ── 2. Build campaign record ───────────────────────────────────────
  const campaign = {
    slug: 'zakat',
    name: 'Zakat 2026',
    title: 'Zakat 2026',
    hero_title: 'Fulfill Your *Zakat* Today',
    subtitle: 'Fulfill your obligation and purify your wealth. 100% of your Zakat reaches those in need through our verified distribution channels across 50+ countries.',
    subtitle2: 'THIRD PILLAR OF ISLAM',
    url_path: '/zakat',
    page_template: 'zakat-hub',
    donation_box_template: 'cw-donation',
    is_active: true,
    is_featured: false,
    is_zakat_eligible: true,
    featured_image: '/images/qurbani-foundation-food-distribution.png',
    meta_title: 'Pay Your Zakat | Qurbani USA - 100% Zakat Policy',
    meta_description: 'Fulfill your Zakat obligation through Qurbani Foundation USA. 100% Zakat policy, Shariah compliant, tax deductible. Serving 50+ countries worldwide.',

    // Gallery images — first image used as "Why Give" section image
    gallery_images: ['/images/qurbani-foundation-zakat.png'],

    // Impact stats — first entry used as stat badge
    impact_stats: [
      { value: '50+', label: 'Countries Served' },
    ],

    // Content sections — rendered as "Why Give" benefit items
    content_sections: [
      {
        title: '100% Zakat Policy',
        content: 'Every single cent of your Zakat reaches those in need. Our operational costs are covered by separate funds.',
      },
      {
        title: 'Shariah Compliant',
        content: 'Our Zakat distribution is overseen by qualified Islamic scholars to ensure compliance with Islamic principles.',
      },
      {
        title: 'Global Reach',
        content: 'We distribute Zakat in over 50 countries, reaching the most vulnerable communities worldwide.',
      },
      {
        title: 'Full Transparency',
        content: 'We provide detailed reports on how your Zakat is distributed and the impact it creates.',
      },
    ],

    // Template config — holds donation box, page content, and zakat-specific settings
    template_config: {
      // ── CW Donation Box config ─────────────────────────────────
      cwDonation: {
        donationBoxHeading: 'Pay Your Zakat',
        tabEmoji: '🤲',
        skipUpsell: true,
        frequencies: [
          {
            key: 'single',
            label: 'GIVE ONCE',
            type: 'single',
            stripeInterval: null,
            suffix: 'USD',
            buttonText: 'GIVE',
            amounts: [50, 100, 150, 200],
            impactTexts: {
              50: '100% Zakat Policy • Shariah Compliant • Tax Deductible',
              100: '100% Zakat Policy • Shariah Compliant • Tax Deductible',
              150: '100% Zakat Policy • Shariah Compliant • Tax Deductible',
              200: '100% Zakat Policy • Shariah Compliant • Tax Deductible',
            },
            defaultAmountIndex: 1,
            fallbackImpactText: '',
          },
          {
            key: 'yearly',
            label: 'YEARLY',
            type: 'recurring',
            stripeInterval: 'year',
            suffix: 'USD/yr',
            buttonText: 'GIVE YEARLY',
            amounts: [100, 250, 500, 1000],
            impactTexts: {
              100: '100% Zakat Policy • Shariah Compliant • Tax Deductible',
              250: '100% Zakat Policy • Shariah Compliant • Tax Deductible',
              500: '100% Zakat Policy • Shariah Compliant • Tax Deductible',
              1000: '100% Zakat Policy • Shariah Compliant • Tax Deductible',
            },
            defaultAmountIndex: 1,
            fallbackImpactText: 'Your yearly gift makes a lasting impact',
          },
        ],
      },

      // ── Page Content (editable via admin Page Content sections) ─
      pageContent: {
        theCrisis: {
          heading: 'Where Your Zakat Goes',
          content: 'Your Zakat is distributed according to the eight categories mentioned in the Quran, ensuring it reaches those most deserving.',
        },
        howDonationHelps: {
          heading: 'Where Your Zakat Goes',
          items: [
            { amount: 'The Poor (Al-Fuqara)', label: 'Those who do not have enough to meet their basic needs.' },
            { amount: 'The Needy (Al-Masakin)', label: 'Those who have some income but not enough to meet their needs.' },
            { amount: 'Orphan Support', label: 'Providing care, education, and support for orphaned children.' },
            { amount: 'Education', label: 'Building schools and providing education to underprivileged communities.' },
          ],
        },
        midCta: {
          heading: 'Not Sure How Much Zakat You Owe?',
          subtext: 'Use our easy Zakat Calculator to determine your obligation in minutes.',
          primaryButtonText: 'Calculate Your Zakat',
          secondaryButtonText: '/zakat/calculator',
        },
        whyMonthly: {
          heading: 'Why Give Your Zakat Through Us?',
          benefits: [],
          footerText: '',
        },
        faq: {
          heading: 'Frequently Asked Questions',
          items: [],
        },
        finalCta: {},
      },

      // ── Zakat-specific settings (in template_config) ───────────
      heroBadges: ['100% Zakat Policy', 'Shariah Compliant', 'Tax Deductible'],
      heroCta: {
        text: 'Calculate My Zakat',
        link: '/zakat/calculator',
      },
      imageOverlay: 40,
      quickLinksHeading: 'Learn More About Zakat',
      quickLinks: [
        {
          title: 'What is Zakat?',
          description: 'Learn about the importance and significance of Zakat in Islam.',
          url: '/what-is-zakat',
          color: '#D97706',
          icon: '<path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"></path>',
        },
        {
          title: 'Zakat FAQ',
          description: 'Get answers to commonly asked questions about Zakat.',
          url: '/zakat-faq',
          color: '#7c3aed',
          icon: '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path>',
        },
        {
          title: 'Zakat on Gold & Silver',
          description: 'Understand how to calculate Zakat on precious metals.',
          url: '/zakat-on-gold',
          color: '#eab308',
          icon: '<path fill-rule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clip-rule="evenodd"></path>',
        },
      ],
    },
  };

  // ── 3. Upsert campaign ─────────────────────────────────────────────
  const { data, error } = await supabase
    .from('campaigns')
    .upsert(campaign, { onConflict: 'slug' })
    .select()
    .single();

  if (error) {
    console.error('❌ Error upserting zakat campaign:', error.message);
    process.exit(1);
  }

  console.log(`✅ Zakat campaign upserted: id=${data.id}, slug=${data.slug}`);
  console.log(`   URL: ${data.url_path}`);
  console.log(`   Template: ${data.page_template}`);

  // ── 4. Add template option to template_options table ───────────────
  const { error: templateError } = await supabase
    .from('template_options')
    .upsert(
      {
        template_type: 'page',
        template_key: 'zakat-hub',
        template_label: 'Zakat Hub',
        description: 'Custom Zakat page with hero, category cards, benefits, and quick links',
        is_active: true,
        sort_order: 6,
      },
      { onConflict: 'template_type,template_key' }
    );

  if (templateError) {
    console.warn('⚠️  Could not upsert template option (non-fatal):', templateError.message);
    console.log('   You may need to manually add it to template_options table.');
  } else {
    console.log('✅ Template option "zakat-hub" added to template_options table');
  }

  console.log('\n🎉 Done! Visit /admin/campaigns to edit the Zakat page.');
  console.log('   Frontend: /zakat');
}

seedZakatCampaign().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
