import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { getSettings } from '../../lib/settings';

export const prerender = false;

// ─── Country Code → Flag + Name ───
const COUNTRIES: Record<string, { flag: string; name: string }> = {
  US: { flag: '🇺🇸', name: 'United States' },
  CA: { flag: '🇨🇦', name: 'Canada' },
  GB: { flag: '🇬🇧', name: 'United Kingdom' },
  AE: { flag: '🇦🇪', name: 'UAE' },
  SA: { flag: '🇸🇦', name: 'Saudi Arabia' },
  AU: { flag: '🇦🇺', name: 'Australia' },
  DE: { flag: '🇩🇪', name: 'Germany' },
  FR: { flag: '🇫🇷', name: 'France' },
  PK: { flag: '🇵🇰', name: 'Pakistan' },
  IN: { flag: '🇮🇳', name: 'India' },
  BD: { flag: '🇧🇩', name: 'Bangladesh' },
  MY: { flag: '🇲🇾', name: 'Malaysia' },
  SG: { flag: '🇸🇬', name: 'Singapore' },
  KW: { flag: '🇰🇼', name: 'Kuwait' },
  QA: { flag: '🇶🇦', name: 'Qatar' },
  BH: { flag: '🇧🇭', name: 'Bahrain' },
  OM: { flag: '🇴🇲', name: 'Oman' },
  TR: { flag: '🇹🇷', name: 'Turkey' },
  EG: { flag: '🇪🇬', name: 'Egypt' },
  JO: { flag: '🇯🇴', name: 'Jordan' },
  NL: { flag: '🇳🇱', name: 'Netherlands' },
  SE: { flag: '🇸🇪', name: 'Sweden' },
  NO: { flag: '🇳🇴', name: 'Norway' },
  NZ: { flag: '🇳🇿', name: 'New Zealand' },
  ZA: { flag: '🇿🇦', name: 'South Africa' },
  NG: { flag: '🇳🇬', name: 'Nigeria' },
  KE: { flag: '🇰🇪', name: 'Kenya' },
};

// ─── Fabricated Data Pools ───
const FAKE_NAMES = [
  'Ahmed K.', 'Fatima S.', 'Omar R.', 'Aisha M.', 'Yusuf H.',
  'Maryam T.', 'Ibrahim A.', 'Sarah L.', 'Muhammad Z.', 'Khadijah N.',
  'Ali B.', 'Zainab D.', 'Hassan J.', 'Noor P.', 'Bilal C.',
  'Amina W.', 'Tariq F.', 'Halima R.', 'Idris M.', 'Sumaya K.',
  'Layla A.', 'Hamza R.', 'Asma B.', 'Usman T.', 'Safiya M.',
  'Zayd K.', 'Hana D.', 'Kareem S.', 'Ruqayyah J.', 'Sulaiman N.',
  'Mariam H.', 'Jamal W.', 'Iman F.', 'Rashid A.', 'Yasmin L.',
  'Adnan G.', 'Naima C.', 'Farhan Z.', 'Samira P.', 'Khalid R.',
  'Ayesha B.', 'Zubair M.', 'Hafsa T.', 'Taha R.', 'Rabia K.',
  'Imran S.', 'Sana A.', 'Danish H.', 'Hira N.', 'Junaid W.',
  'Mehreen L.', 'Faisal D.', 'Lubna J.', 'Naveed G.', 'Saadia F.',
  'Kamran P.', 'Nazia R.', 'Waqas A.', 'Bushra M.', 'Arif T.',
  'Tahira S.', 'Anwar K.', 'Humera B.', 'Qasim N.', 'Sadia H.',
  'Rizwan C.', 'Uzma D.', 'Shahid L.', 'Nasreen W.', 'Aziz J.',
];

// US-only cities grouped by region — visitors see their nearby cities first
const US_CITIES_BY_REGION: Record<string, string[]> = {
  TX: ['Dallas, TX', 'Houston, TX', 'Plano, TX', 'Irving, TX', 'Austin, TX', 'San Antonio, TX', 'Sugar Land, TX', 'Richardson, TX'],
  NY: ['New York, NY', 'Brooklyn, NY', 'Queens, NY', 'Long Island, NY', 'Albany, NY'],
  NJ: ['Jersey City, NJ', 'Edison, NJ', 'Paterson, NJ', 'Newark, NJ'],
  IL: ['Chicago, IL', 'Naperville, IL', 'Schaumburg, IL'],
  CA: ['Los Angeles, CA', 'San Jose, CA', 'Anaheim, CA', 'Irvine, CA', 'San Diego, CA', 'Sacramento, CA'],
  MI: ['Detroit, MI', 'Dearborn, MI', 'Troy, MI', 'Ann Arbor, MI'],
  FL: ['Miami, FL', 'Orlando, FL', 'Tampa, FL', 'Jacksonville, FL'],
  VA: ['Fairfax, VA', 'Herndon, VA', 'Sterling, VA', 'Richmond, VA'],
  MD: ['Baltimore, MD', 'Rockville, MD', 'Silver Spring, MD'],
  GA: ['Atlanta, GA', 'Alpharetta, GA', 'Duluth, GA'],
  PA: ['Philadelphia, PA', 'Pittsburgh, PA'],
  OH: ['Columbus, OH', 'Cleveland, OH'],
  MN: ['Minneapolis, MN', 'St. Paul, MN'],
  WA: ['Seattle, WA', 'Bellevue, WA'],
  MA: ['Boston, MA', 'Cambridge, MA'],
  CT: ['Stamford, CT', 'Hartford, CT'],
};

// Default US mix — used when visitor region is unknown
const DEFAULT_US_CITIES = [
  'Dallas, TX', 'Houston, TX', 'New York, NY', 'Chicago, IL', 'Los Angeles, CA',
  'Detroit, MI', 'Jersey City, NJ', 'Plano, TX', 'Dearborn, MI', 'Irving, TX',
  'Philadelphia, PA', 'Atlanta, GA', 'Miami, FL', 'Fairfax, VA', 'San Jose, CA',
];

// Fallback campaigns — only used when no active campaigns exist in the DB
const FALLBACK_CAMPAIGNS = [
  { name: 'Zakat 2026', slug: 'zakat', image: '/images/qurbani-foundation-food-distribution.webp', url: '/zakat' },
  { name: 'Where Most Needed', slug: 'where-most-needed', image: '/images/qurbani-foundation-food-distribution.webp', url: '/appeals/where-most-needed' },
  { name: 'Orphan Sponsorship', slug: 'sponsor-an-orphan', image: '/images/qurbani-foundation-food-distribution.webp', url: '/orphans/sponsor-an-orphan' },
  { name: 'Emergency Relief', slug: 'emergency-relief', image: '/images/qurbani-foundation-food-distribution.webp', url: '/appeals/emergency-relief' },
];

// Campaign-specific realistic amounts (must match actual page pricing)
const AMOUNTS_BY_SLUG: Record<string, number[]> = {
  // Zakat: one-time presets $250, $500, $1000, $2500
  'zakat':                [250, 250, 500, 500, 1000, 1000, 2500],
  // Zakat ul-Fitr: $10/person — multiples of 10
  'zakat-ul-fitr-2026':   [10, 20, 30, 40, 40, 50, 60, 80],
  // Kaffarah: $180/day — 1, 2, 5, 10 days (matches page presets)
  'kaffarah':             [180, 180, 360, 360, 900, 1800],
  'kaffarah-2026':        [180, 180, 360, 360, 900, 1800],
  // Fidya: $10/day — common: 1, 5, 10, 30 days
  'fidya':                [10, 50, 50, 100, 100, 300],
  'fidya-2026':           [10, 50, 50, 100, 100, 300],
  // Where Most Needed: CW box $50, $100, $150, $200
  'where-most-needed':    [50, 50, 100, 100, 150, 200],
  // Orphan Sponsorship: $45/mo per child (1–3 children typical)
  'sponsor-an-orphan':    [45, 45, 90, 90, 135, 225],
  // Gaza Emergency: CW box $50, $100, $150, $200
  'gaza-emergency':       [50, 50, 100, 100, 150, 200],
  // Syria Relief: CW box $50, $100, $150, $200
  'syria-relief':         [50, 50, 100, 100, 150, 200],
  // Palestine Emergency: CW box $50, $100, $150, $200
  'palestine-emergency':  [50, 50, 100, 100, 150, 200],
  // Pakistan Floods: CW box $50, $100, $150, $200
  'pakistan-floods':       [50, 50, 100, 100, 150, 200],
  // Sudan Crisis: CW box $50, $100, $150, $200
  'sudan-crisis-response':[50, 50, 100, 100, 150, 200],
  // Ramadan Food Packs: $50, $100, $200, $500
  'ramadan-food-pack':    [50, 100, 100, 200, 200, 500],
  'feed-the-fasting':     [50, 100, 100, 200, 200, 500],
  // Iftar Meals: $5/meal — 5, 25, 50, 150 presets
  'iftar-meals':          [5, 25, 25, 50, 50, 150, 150],
  // My Ten Nights: per-night × 10 nights = $50, $100, $250, $500
  'mytennights':          [50, 100, 100, 250, 250, 500],
  // Aqiqah: $150 (girl), $300 (boy)
  'aqiqah':               [150, 150, 300, 300, 300],
  // Water Well: $50, $100, $250, $500
  'build-a-water-well':   [50, 100, 100, 250, 300, 500],
  // Emergency Relief: CW box $50, $100, $150, $200
  'emergency-relief':     [50, 50, 100, 100, 150, 200],
  // Zakat Fund → remapped to Zakat, but keep amounts in case
  'zakat-fund':           [250, 250, 500, 500, 1000, 2500],
};
// Default fallback for any campaign not in the map
const DEFAULT_AMOUNTS = [50, 50, 100, 100, 150, 250, 500];

// Featured high-value Zakat donations — always included in rotation
const FEATURED_ZAKAT_DONATIONS: Array<{
  name: string; amount: number; city: string; countryCode: string;
}> = [
  { name: 'Tariq M.', amount: 500, city: 'Plano, TX', countryCode: 'US' },
  { name: 'Nadia A.', amount: 1000, city: 'Houston, TX', countryCode: 'US' },
  { name: 'Irfan K.', amount: 1000, city: 'Chicago, IL', countryCode: 'US' },
  { name: 'Sameer R.', amount: 2500, city: 'Dallas, TX', countryCode: 'US' },
  { name: 'Rabia H.', amount: 2500, city: 'New York, NY', countryCode: 'US' },
  { name: 'Khalid S.', amount: 2500, city: 'Los Angeles, CA', countryCode: 'US' },
  { name: 'Amira B.', amount: 1000, city: 'Dearborn, MI', countryCode: 'US' },
  { name: 'Osman F.', amount: 500, city: 'Jersey City, NJ', countryCode: 'US' },
];

// ─── Seeded Random (consistent for ~15 minutes) ───
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function anonymizeName(fullName: string | null | undefined): string {
  if (!fullName || fullName.trim() === '') return 'Anonymous';
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0];
  if (parts.length > 1) {
    return `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
  }
  return first;
}

interface SocialProofNotification {
  name: string;
  amount: number;
  campaign: string;
  slug: string;
  image: string;
  url: string;
  city: string;
  country: string;
  flag: string;
  action?: string; // 'popup' | 'redirect'
  __source?: 'real' | 'fabricated' | 'featured'; // internal — stripped before response
}

// ─── In-memory cache (60s TTL) ───
// Short TTL so admin toggles in /admin/social-proof propagate within a minute.
// Previously 5 min, which made disable/enable changes feel laggy.
let cachedNotifications: SocialProofNotification[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds

export const GET: APIRoute = async ({ request }) => {
  try {
    // Visitor country from Cloudflare
    const visitorCountry = request.headers.get('cf-ipcountry') || null;
    const now = Date.now();

    // Return cached if fresh
    if (cachedNotifications && (now - cacheTimestamp) < CACHE_TTL) {
      return new Response(JSON.stringify({
        notifications: cachedNotifications,
        visitorCountry,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    // Get min amount from admin settings
    const siteSettings = await getSettings();
    const minAmount = (siteSettings as any).social_proof_min_amount ?? 10;

    // Fetch real completed donations from last 72 hours
    const cutoff = new Date(now - 72 * 60 * 60 * 1000).toISOString();
    const { data: realDonations } = await supabaseAdmin
      .from('donations')
      .select('donor_name, amount, items, campaign_name, campaign_slug, metadata, completed_at')
      .eq('status', 'completed')
      .gt('completed_at', cutoff)
      .not('donor_name', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(15);

    // Fetch campaigns flagged for social proof (admin-controlled)
    // Falls back to all active campaigns if none are explicitly flagged
    let { data: activeCampaigns } = await supabaseAdmin
      .from('campaigns')
      .select('name, slug, featured_image, url_path, social_proof_action, social_proof_url, social_proof_title, social_proof_order')
      .eq('is_active', true)
      .eq('show_in_social_proof', true)
      .order('social_proof_order', { ascending: true })
      .limit(20);

    // If no campaigns flagged, fall back to all active campaigns
    if (!activeCampaigns || activeCampaigns.length === 0) {
      const { data: allActive } = await supabaseAdmin
        .from('campaigns')
        .select('name, slug, featured_image, url_path, social_proof_action, social_proof_url, social_proof_title, social_proof_order')
        .eq('is_active', true)
        .order('social_proof_order', { ascending: true })
        .limit(20);
      activeCampaigns = allActive;
    }

    const campaignList: Array<{ name: string; slug: string; featured_image: string | null; url_path: string | null; social_proof_action: string | null; social_proof_url: string | null; social_proof_title: string | null; social_proof_order: number | null }> = activeCampaigns || [];

    // Build a slug→campaign lookup for enriching real donations
    const campaignBySlug = new Map<string, typeof campaignList[0]>();
    for (const c of campaignList) {
      campaignBySlug.set(c.slug, c);
    }

    // Generic slugs that need name-based fallback matching
    const GENERIC_SLUGS = new Set(['general', 'where-needed', 'where-most-needed', 'donation']);

    // Fuzzy match campaign by donation name when slug lookup fails
    function matchCampaignByName(donationCampaignName: string): typeof campaignList[0] | null {
      if (!donationCampaignName || campaignList.length === 0) return null;
      const lower = donationCampaignName.toLowerCase();

      // 1. Exact name match
      for (const c of campaignList) {
        if (c.name.toLowerCase() === lower) return c;
      }

      // 2. Campaign name starts with donation name or vice versa (handles "Ramadan Food Pack - Small Pack" → "Ramadan Food Pack")
      for (const c of campaignList) {
        const cLower = c.name.toLowerCase();
        if (lower.startsWith(cLower) || cLower.startsWith(lower)) return c;
      }

      // 3. Significant word overlap (at least 2 meaningful words match)
      const stopWords = new Set(['the', 'a', 'an', 'for', 'to', 'of', 'in', 'and', 'or', '-', '–']);
      const donationWords = lower.split(/[\s\-–]+/).filter(w => w.length > 2 && !stopWords.has(w));
      let bestMatch: typeof campaignList[0] | null = null;
      let bestScore = 0;

      for (const c of campaignList) {
        const campWords = c.name.toLowerCase().split(/[\s\-–]+/).filter(w => w.length > 2 && !stopWords.has(w));
        let score = 0;
        for (const dw of donationWords) {
          for (const cw of campWords) {
            if (dw === cw || dw.startsWith(cw) || cw.startsWith(dw)) { score++; break; }
          }
        }
        if (score >= 2 && score > bestScore) {
          bestScore = score;
          bestMatch = c;
        }
      }

      return bestMatch;
    }

    // For fabricated data, only use real DB campaigns (or fallbacks)
    const fabricationPool = campaignList.length > 0
      ? campaignList.map(c => ({
          name: c.social_proof_title || c.name,
          slug: c.slug,
          image: c.featured_image || '/images/qurbani-foundation-food-distribution.webp',
          url: c.social_proof_url || c.url_path || '/appeals/' + c.slug,
          action: c.social_proof_action || 'redirect',
        }))
      : FALLBACK_CAMPAIGNS;

    // Build real notifications
    const notifications: SocialProofNotification[] = [];

    if (realDonations) {
      for (const d of realDonations) {
        const name = anonymizeName(d.donor_name);
        if (name === 'Anonymous') continue;

        const amount = Math.round(parseFloat(d.amount) || 0);
        if (amount < minAmount) continue; // Skip donations below admin-set minimum

        // Campaign name
        let campaign = d.campaign_name || '';
        if (!campaign) {
          const items = typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || []);
          if (items.length > 0) {
            campaign = items[0].name || items[0].label || '';
            if (!campaign && items[0].campaign) {
              campaign = items[0].campaign.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            }
          }
        }
        if (!campaign) campaign = 'Where Most Needed';

        // Location from billing address — skip donations with no location data
        const meta = d.metadata || {};
        const addr = meta.billing_address || {};
        const city = addr.city || '';
        const countryCode = (addr.country || '').toUpperCase();

        // If no city AND no country, skip this donation entirely (looks bad as "Unknown, Unknown")
        if (!city && !countryCode && !addr.state) continue;

        const countryInfo = COUNTRIES[countryCode] || { flag: '🇺🇸', name: 'United States' };

        // Build city + state display
        let cityDisplay = city;
        if (addr.state && city) {
          cityDisplay = `${city}, ${addr.state}`;
        } else if (!city && addr.state) {
          cityDisplay = addr.state;
        }

        // Derive slug from DB field or campaign name
        const rawSlug = d.campaign_slug || campaign.toLowerCase().replace(/\s+/g, '-');

        // Look up campaign from DB for image + url
        // If slug is generic (e.g. "general"), try fuzzy name matching instead
        let matchedCamp = campaignBySlug.get(rawSlug);
        if (!matchedCamp && GENERIC_SLUGS.has(rawSlug)) {
          matchedCamp = matchCampaignByName(campaign);
        }
        // If still no match, try name-based matching for any unrecognized slug
        if (!matchedCamp && !campaignBySlug.has(rawSlug)) {
          matchedCamp = matchCampaignByName(campaign);
        }

        const slug = matchedCamp?.slug || rawSlug;
        const image = matchedCamp?.featured_image || '/images/qurbani-foundation-food-distribution.webp';
        const url = matchedCamp?.social_proof_url || matchedCamp?.url_path || '/appeals/' + slug;
        const action = matchedCamp?.social_proof_action || 'redirect';

        notifications.push({
          name,
          amount,
          campaign: campaign.length > 30 ? campaign.substring(0, 27) + '...' : campaign,
          slug,
          image,
          url,
          city: cityDisplay || countryInfo.name,
          country: countryInfo.name,
          flag: countryInfo.flag,
          action,
          __source: 'real',
        });
      }
    }

    // Deduplicate real notifications.
    // For slugs with abundant real donations (e.g. Qurbani has dozens of
    // sub-campaigns: Pakistan, Bangladesh, Mali, Kashmir...), dedup by
    // sub-campaign NAME so multiple distinct entries survive — that way
    // the popup rotation shows several real Qurbani sub-campaigns instead
    // of a single collapsed entry. For sparse slugs, dedup by slug as
    // before so we keep the highest-amount one.
    const ABUNDANT_REAL_THRESHOLD = 3;   // ≥3 real donations → keep distinct sub-campaigns
    const PER_SLUG_MAX = 5;              // safety cap so one slug can't dominate

    // Count real donations per slug
    const realCountPerSlug = new Map<string, number>();
    for (const n of notifications) {
      realCountPerSlug.set(n.slug, (realCountPerSlug.get(n.slug) || 0) + 1);
    }

    const seenKeys = new Map<string, number>();
    const perSlugCount = new Map<string, number>();
    const deduped: typeof notifications = [];
    for (const n of notifications) {
      const abundant = (realCountPerSlug.get(n.slug) || 0) >= ABUNDANT_REAL_THRESHOLD;
      // Dedup key: by sub-campaign name when abundant, by slug otherwise
      const key = abundant ? `${n.slug}::${n.campaign}` : n.slug;
      const existingIdx = seenKeys.get(key);

      if (existingIdx === undefined) {
        if ((perSlugCount.get(n.slug) || 0) >= PER_SLUG_MAX) continue;
        seenKeys.set(key, deduped.length);
        perSlugCount.set(n.slug, (perSlugCount.get(n.slug) || 0) + 1);
        deduped.push(n);
      } else if (n.amount > deduped[existingIdx].amount) {
        deduped[existingIdx] = n; // Replace with higher amount
      }
    }
    notifications.length = 0;
    notifications.push(...deduped);

    // Slugs with enough real donations to cover the rotation on their own
    // (e.g. Qurbani). Excluded from the fabricated pool so we never invent
    // donations for a campaign that already has plenty of real ones.
    const abundantRealSlugs = new Set<string>();
    for (const [slug, count] of realCountPerSlug.entries()) {
      if (count >= ABUNDANT_REAL_THRESHOLD) abundantRealSlugs.add(slug);
    }

    // Pad with fabricated notifications — generate enough for variety (min 16 total)
    // With 4 campaigns, this gives ~4 unique donors per campaign before wrapping
    const MIN_TOTAL = 16;
    // Fabrication pool excludes abundant-real slugs (Qurbani et al.)
    const fabricationPoolFiltered = fabricationPool.filter(c => !abundantRealSlugs.has(c.slug));
    const effectiveFabricationPool = fabricationPoolFiltered.length > 0 ? fabricationPoolFiltered : fabricationPool;

    if (notifications.length < MIN_TOTAL) {
      // Changes every 15 minutes (not hourly) for more variety between visits
      const quarterHourSeed = Math.floor(now / (15 * 60 * 1000));
      const rand = seededRandom(quarterHourSeed);
      const needed = MIN_TOTAL - notifications.length;

      // Build flat US city pool from all regions
      const allUSCities: string[] = [];
      for (const cities of Object.values(US_CITIES_BY_REGION)) {
        allUSCities.push(...cities);
      }

      // Track used names to avoid duplicate names in same batch
      const usedNames = new Set<string>();
      for (const n of notifications) usedNames.add(n.name);

      // Distribute campaigns evenly — round-robin through pool
      let campRoundRobin = 0;

      for (let i = 0; i < needed; i++) {
        // Pick unique name (avoid repeats in same batch)
        let nameIdx = Math.floor(rand() * FAKE_NAMES.length);
        let attempts = 0;
        while (usedNames.has(FAKE_NAMES[nameIdx]) && attempts < FAKE_NAMES.length) {
          nameIdx = (nameIdx + 1) % FAKE_NAMES.length;
          attempts++;
        }
        const pickedName = FAKE_NAMES[nameIdx];
        usedNames.add(pickedName);

        const pickedCity = allUSCities[Math.floor(rand() * allUSCities.length)];

        // Round-robin through campaigns — each campaign gets multiple donors.
        // Uses the filtered pool (abundant-real slugs excluded) so we never
        // fabricate entries for campaigns that already have many real ones.
        const camp = effectiveFabricationPool[campRoundRobin % effectiveFabricationPool.length];
        campRoundRobin++;

        // Pick amount from campaign-specific list (or default), respecting min amount
        const allCampAmounts = AMOUNTS_BY_SLUG[camp.slug] || DEFAULT_AMOUNTS;
        const campAmounts = allCampAmounts.filter(a => a >= minAmount);
        if (campAmounts.length === 0) continue; // All amounts below min — skip this campaign
        const amountIdx = Math.floor(rand() * campAmounts.length);

        notifications.push({
          name: pickedName,
          amount: campAmounts[amountIdx],
          campaign: camp.name,
          slug: camp.slug,
          image: camp.image,
          url: camp.url,
          city: pickedCity,
          country: 'United States',
          flag: '🇺🇸',
          action: (camp as any).action || 'redirect',
          __source: 'fabricated',
        });
      }
    }

    // Inject featured high-value Zakat donations — ONLY when zakat is enabled
    // in admin. Previously these always fired and crowded out higher-priority
    // campaigns (like Qurbani at order=1). Now we only inject 1-2 and only
    // when zakat is explicitly enabled for social proof.
    const zakatCamp = fabricationPool.find(c => c.slug === 'zakat')
      || fabricationPool.find(c => c.slug === 'zakat-2026')
      || fabricationPool.find(c => c.name === 'Zakat 2026');

    if (zakatCamp) {
      // Pick a rotating subset (seeded by quarter-hour) so they vary between visits
      const featuredSeed = Math.floor(now / (15 * 60 * 1000));
      const featuredRand = seededRandom(featuredSeed + 999);
      const shuffledFeatured = [...FEATURED_ZAKAT_DONATIONS].sort(() => featuredRand() - 0.5);
      // Cap at 1-2 entries so Zakat doesn't dominate the rotation
      const featuredCount = 1 + Math.floor(featuredRand() * 2); // 1 or 2

      for (let i = 0; i < featuredCount && i < shuffledFeatured.length; i++) {
        const fd = shuffledFeatured[i];
        const countryInfo = COUNTRIES[fd.countryCode] || { flag: '🇺🇸', name: 'United States' };
        notifications.push({
          name: fd.name,
          amount: fd.amount,
          campaign: zakatCamp.name,
          slug: zakatCamp.slug,
          image: zakatCamp.image,
          url: zakatCamp.url,
          city: fd.city,
          country: countryInfo.name,
          flag: countryInfo.flag,
          action: (zakatCamp as any).action || 'redirect',
          __source: 'featured',
        });
      }
    }

    // Remap Zakat sub-campaigns (e.g. "Zakat Fund") to main "Zakat" campaign
    // This runs AFTER fabrication so both real and fabricated zakat-fund entries get remapped
    const zakatMainCamp = fabricationPool.find(c => c.slug === 'zakat');
    if (zakatMainCamp) {
      for (const n of notifications) {
        if (n.slug === 'zakat-fund') {
          n.campaign = zakatMainCamp.name;
          n.slug = zakatMainCamp.slug;
          n.image = zakatMainCamp.image;
          n.url = zakatMainCamp.url;
          n.action = (zakatMainCamp as any).action || 'redirect';
        }
      }
    }

    // ─── Order by social_proof_order from DB ───
    // Build slug → order lookup from the admin-controlled campaigns table.
    // Unknown slugs (e.g. legacy real donations whose slug isn't in the
    // enabled campaign list) get pushed to the bottom.
    const slugOrderMap = new Map<string, number>();
    for (const c of campaignList) {
      slugOrderMap.set(c.slug, c.social_proof_order ?? 50);
    }
    const orderFor = (slug: string): number => slugOrderMap.get(slug) ?? 999;

    // Stable seeded tiebreaker so within-same-order entries vary between
    // 15-minute windows but stay consistent during the cache lifetime.
    const orderSeed = Math.floor(now / (15 * 60 * 1000));
    const orderRand = seededRandom(orderSeed + 7);
    const tieBreakers = new Map<number, number>();
    for (let i = 0; i < notifications.length; i++) {
      tieBreakers.set(i, orderRand());
    }

    // Preserve original indices for tiebreaking, then sort by:
    //   1. campaign social_proof_order ASC (DB-controlled — order=1 first)
    //   2. real donations before fabricated within same order (higher trust)
    //   3. seeded random tiebreaker (varies between 15-min cache windows)
    const sourceRank: Record<string, number> = { real: 0, fabricated: 1, featured: 2 };
    const indexed = notifications.map((n, idx) => ({
      n,
      idx,
      order: orderFor(n.slug),
      sourceRank: sourceRank[n.__source ?? 'fabricated'] ?? 1,
    }));

    indexed.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      // Larger donations first within the same campaign-order — bigger
      // amounts look more impressive ($2500 Zakat before $150, $680
      // Qurbani Pakistan before $77 Mali). This intentionally outranks
      // real-vs-fabricated source so a $2500 featured donation appears
      // before a $100 real one within the same campaign tier.
      if (a.n.amount !== b.n.amount) return b.n.amount - a.n.amount;
      if (a.sourceRank !== b.sourceRank) return a.sourceRank - b.sourceRank;
      return (tieBreakers.get(a.idx) ?? 0) - (tieBreakers.get(b.idx) ?? 0);
    });

    notifications.length = 0;
    for (const item of indexed) notifications.push(item.n);

    // Avoid two consecutive notifications from the same campaign so the
    // popup feels varied — swap with next different-slug entry when needed.
    // Same logic as before; only the initial order changed.
    for (let i = 1; i < notifications.length; i++) {
      if (notifications[i].slug === notifications[i - 1].slug) {
        for (let j = i + 1; j < notifications.length; j++) {
          if (notifications[j].slug !== notifications[i - 1].slug) {
            [notifications[i], notifications[j]] = [notifications[j], notifications[i]];
            break;
          }
        }
      }
    }

    // Strip internal __source tag before responding / caching — keep the
    // public payload clean for the client component.
    const publicNotifications: SocialProofNotification[] = notifications.map((n) => {
      const { __source, ...rest } = n;
      return rest;
    });

    // Cache
    cachedNotifications = publicNotifications;
    cacheTimestamp = now;

    return new Response(JSON.stringify({
      notifications: publicNotifications,
      visitorCountry,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error: any) {
    console.error('[Social Proof] Error:', error.message);
    return new Response(JSON.stringify({ notifications: [], visitorCountry: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
