import type { APIRoute } from 'astro';
import { getAllCategories } from '../../../lib/categories';

export const prerender = false;

interface ScrapeRequest {
  url: string;
  replacements?: { find: string; replace: string }[];
  spinContent?: boolean;
  useStockImages?: boolean;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body: ScrapeRequest = await request.json();
    const { url, replacements = [], spinContent = true, useStockImages = false } = body;

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch categories from database for auto-detection
    const categories = await getAllCategories();

    // Fetch the page content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch URL: ${response.status}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const html = await response.text();

    // Extract campaign data from HTML
    const campaignData = extractCampaignData(html, url, categories);

    // Apply custom replacements
    const customReplacements = [
      // Default replacements - organization names
      { find: 'Muslim Charity', replace: 'Qurbani Foundation' },
      { find: 'Muslim Hands', replace: 'Qurbani Foundation' },
      { find: 'Islamic Relief', replace: 'Qurbani Foundation' },
      { find: 'Penny Appeal', replace: 'Qurbani Foundation' },
      { find: 'Human Appeal', replace: 'Qurbani Foundation' },
      { find: 'Al Mustafa Trust', replace: 'Qurbani Foundation' },
      { find: 'LaunchGood', replace: 'Qurbani Foundation' },
      { find: 'Muslim Aid', replace: 'Qurbani Foundation' },
      { find: 'Helping Hand', replace: 'Qurbani Foundation' },
      { find: 'ICNA Relief', replace: 'Qurbani Foundation' },
      { find: 'Zakat Foundation', replace: 'Qurbani Foundation' },
      { find: 'our charity', replace: 'Qurbani Foundation' },
      { find: 'the charity', replace: 'Qurbani Foundation' },
      // Add user-provided replacements
      ...replacements
    ];

    // Rewrite content with branding and optional spinning
    const rewrittenData = createCompellingCampaign(campaignData, customReplacements, spinContent, useStockImages);

    return new Response(JSON.stringify({ success: true, data: rewrittenData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Scrape error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to scrape URL' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

interface CategoryData {
  slug: string;
  label: string;
}

// ============================================
// KEYWORD-BASED UNSPLASH IMAGE SEARCH
// ============================================

/**
 * Generates Unsplash image URLs based on campaign keywords
 * Uses Unsplash Source API - free, no branding, keyword-targeted
 */
function generateKeywordImageUrl(title: string, country: string, category: string, size: string = '1200x800'): string {
  const keywords = extractImageKeywords(title, country, category);
  // Unsplash Source API returns a random image matching keywords
  return `https://source.unsplash.com/${size}/?${keywords.join(',')}`;
}

/**
 * Generates multiple unique gallery images based on keywords
 */
function generateKeywordGalleryUrls(title: string, country: string, category: string, count: number = 4): string[] {
  const baseKeywords = extractImageKeywords(title, country, category);
  const urls: string[] = [];

  // Add variation keywords for each gallery image to get different results
  const variations = ['people', 'community', 'aid', 'hope', 'children', 'family', 'village', 'help'];

  for (let i = 0; i < count; i++) {
    const variedKeywords = [...baseKeywords];
    if (variations[i]) {
      variedKeywords.push(variations[i]);
    }
    // Add index to force different images (Unsplash caches by URL)
    urls.push(`https://source.unsplash.com/800x600/?${variedKeywords.join(',')}&sig=${Date.now() + i}`);
  }

  return urls;
}

/**
 * Extracts relevant keywords from campaign data for image search
 */
function extractImageKeywords(title: string, country: string, category: string): string[] {
  const keywords: string[] = [];

  // Add country-specific terms
  const countryKeywords: Record<string, string[]> = {
    'syria': ['syria', 'syrian', 'middle east'],
    'palestine': ['palestine', 'palestinian', 'gaza'],
    'gaza': ['gaza', 'palestinian', 'middle east'],
    'yemen': ['yemen', 'arabian', 'middle east'],
    'sudan': ['sudan', 'african', 'africa'],
    'afghanistan': ['afghanistan', 'afghan'],
    'pakistan': ['pakistan', 'south asia'],
    'bangladesh': ['bangladesh', 'south asia'],
    'somalia': ['somalia', 'african', 'horn of africa'],
    'turkey': ['turkey', 'earthquake'],
    'lebanon': ['lebanon', 'middle east'],
    'india': ['india', 'south asia'],
    'africa': ['africa', 'african'],
    'east africa': ['africa', 'african', 'kenya'],
  };

  // Add category-specific terms
  const categoryKeywords: Record<string, string[]> = {
    'emergencies': ['humanitarian', 'crisis', 'emergency', 'relief'],
    'water-for-life': ['water', 'well', 'clean water', 'drinking'],
    'food-aid': ['food', 'hunger', 'feeding', 'meals'],
    'orphan-sponsorship': ['children', 'orphan', 'kids', 'school'],
    'education': ['education', 'school', 'classroom', 'learning'],
    'healthcare': ['medical', 'healthcare', 'hospital', 'doctor'],
    'sadaqah-jariyah': ['mosque', 'construction', 'building', 'community'],
    'qurbani': ['eid', 'celebration', 'meat', 'family'],
  };

  // Add country keywords
  const normalizedCountry = country?.toLowerCase().trim() || '';
  if (countryKeywords[normalizedCountry]) {
    keywords.push(...countryKeywords[normalizedCountry].slice(0, 2));
  } else if (country) {
    keywords.push(country.toLowerCase());
  }

  // Add category keywords
  if (categoryKeywords[category]) {
    keywords.push(...categoryKeywords[category].slice(0, 2));
  }

  // Extract meaningful words from title
  const titleWords = title.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(word =>
      word.length > 3 &&
      !['appeal', 'emergency', 'crisis', 'donate', 'help', 'support', 'fund', 'campaign', 'the', 'and', 'for'].includes(word)
    )
    .slice(0, 2);

  keywords.push(...titleWords);

  // Ensure we have at least 3 keywords, dedupe
  const uniqueKeywords = [...new Set(keywords)].slice(0, 5);

  // If we don't have enough, add generic humanitarian terms
  if (uniqueKeywords.length < 3) {
    uniqueKeywords.push('humanitarian', 'people', 'community');
  }

  return uniqueKeywords.slice(0, 5);
}

function extractCampaignData(html: string, url: string, categories: CategoryData[]) {
  // Extract title
  const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                     html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                     html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const rawTitle = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : 'Untitled Campaign';

  // Extract description
  const descMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i) ||
                    html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
  const rawDescription = descMatch ? decodeHTMLEntities(descMatch[1].trim()) : '';

  // Extract ALL images from the page
  const images = extractAllImages(html, url);

  // Extract main content paragraphs
  const paragraphs: string[] = [];
  const pMatches = html.matchAll(/<p[^>]*>(.+?)<\/p>/gis);
  for (const match of pMatches) {
    const text = decodeHTMLEntities(match[1].replace(/<[^>]+>/g, '').trim());
    if (text.length > 30 && text.length < 600 && !text.includes('cookie') && !text.includes('©')) {
      paragraphs.push(text);
    }
  }

  // Extract donation amounts if present
  const donationAmounts = extractDonationAmounts(html);

  // Extract any statistics/impact numbers
  const impactNumbers = extractImpactNumbers(html);

  // Generate slug from title
  const slug = rawTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
    .replace(/-$/, '');

  // Detect country from content
  const detectedCountry = detectCountry(html);

  // Auto-detect category based on content keywords
  const detectedCategory = detectCategory(html, url, categories);

  // Detect if emergency
  const isEmergency = /emergency|urgent|crisis|disaster|flood|earthquake|war|conflict|famine|humanitarian/i.test(html);

  // Detect if zakat eligible
  const isZakatEligible = /zakat|zakah|zakat-eligible|zakat eligible|pay.*zakat|eligible.*zakat/i.test(html);

  // Extract any video URLs
  const videoUrl = extractVideoUrl(html);

  return {
    sourceUrl: url,
    rawTitle,
    rawDescription,
    images,
    paragraphs: paragraphs.slice(0, 8),
    donationAmounts,
    impactNumbers,
    slug,
    detectedCountry,
    detectedCategory,
    isEmergency,
    isZakatEligible,
    videoUrl
  };
}

function extractAllImages(html: string, baseUrl: string): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  // OG Image (highest priority)
  const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  if (ogMatch) {
    const img = makeAbsoluteUrl(ogMatch[1], baseUrl);
    if (img && !seen.has(img)) {
      images.push(img);
      seen.add(img);
    }
  }

  // Twitter image
  const twitterMatch = html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i);
  if (twitterMatch) {
    const img = makeAbsoluteUrl(twitterMatch[1], baseUrl);
    if (img && !seen.has(img)) {
      images.push(img);
      seen.add(img);
    }
  }

  // All img tags with decent sized images
  const imgMatches = html.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/gi);
  for (const match of imgMatches) {
    const src = match[1];
    // Skip tiny images, icons, logos
    if (src.includes('logo') || src.includes('icon') || src.includes('favicon') ||
        src.includes('1x1') || src.includes('pixel') || src.includes('tracking') ||
        src.includes('avatar') || src.includes('profile')) {
      continue;
    }
    const img = makeAbsoluteUrl(src, baseUrl);
    if (img && !seen.has(img) && images.length < 10) {
      images.push(img);
      seen.add(img);
    }
  }

  // Background images in style attributes
  const bgMatches = html.matchAll(/background(?:-image)?:\s*url\(['"]?([^'")]+)['"]?\)/gi);
  for (const match of bgMatches) {
    const img = makeAbsoluteUrl(match[1], baseUrl);
    if (img && !seen.has(img) && images.length < 10) {
      images.push(img);
      seen.add(img);
    }
  }

  return images;
}

function extractDonationAmounts(html: string): { amount: number; label: string }[] {
  const amounts: { amount: number; label: string }[] = [];
  const seen = new Set<number>();

  // Common donation button patterns
  const patterns = [
    /[\$£€](\d+(?:,\d{3})*)\s*[-–—:]\s*([^<\n]{10,60})/gi,
    /data-amount="(\d+)"[^>]*>([^<]+)</gi,
    /value="(\d+)"[^>]*>\s*[\$£€]?\d+\s*[-–—]?\s*([^<]*)</gi,
  ];

  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const amount = parseInt(match[1].replace(/,/g, ''));
      const label = decodeHTMLEntities(match[2].trim().replace(/<[^>]+>/g, ''));
      if (amount >= 5 && amount <= 10000 && label.length > 3 && !seen.has(amount)) {
        amounts.push({ amount, label });
        seen.add(amount);
      }
    }
  }

  return amounts.slice(0, 6);
}

function extractImpactNumbers(html: string): { number: string; label: string }[] {
  const impacts: { number: string; label: string }[] = [];

  // Look for stat-like patterns
  const patterns = [
    /(\d+(?:,\d{3})*(?:\.\d+)?[KkMm]?)\s*\+?\s*(families|people|children|meals|wells|projects|homes|schools|patients)[^<]*/gi,
    /([\d,]+)\s*(beneficiaries|served|helped|supported|reached|impacted)/gi,
  ];

  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      if (impacts.length < 4) {
        impacts.push({
          number: match[1],
          label: match[2].toLowerCase()
        });
      }
    }
  }

  return impacts;
}

function extractVideoUrl(html: string): string | null {
  // YouTube
  const ytMatch = html.match(/(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/i);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // Vimeo
  const vimeoMatch = html.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}

function detectCountry(html: string): string {
  const countries = [
    'Palestine', 'Gaza', 'Sudan', 'Yemen', 'Syria', 'Afghanistan', 'Pakistan',
    'Bangladesh', 'Somalia', 'Ethiopia', 'Kenya', 'Lebanon', 'Turkey', 'Türkiye',
    'Morocco', 'Libya', 'India', 'Myanmar', 'Rohingya', 'Iraq', 'Jordan',
    'UK', 'United Kingdom', 'USA', 'America', 'Mali', 'Niger', 'Chad',
    'Indonesia', 'Philippines', 'Nepal', 'Sri Lanka', 'Uganda', 'Tanzania',
    'Mozambique', 'Malawi', 'Zimbabwe', 'South Africa', 'Egypt', 'Tunisia',
    'Algeria', 'Senegal', 'Ghana', 'Nigeria', 'Cameroon', 'Congo', 'Rwanda'
  ];

  const lowerHtml = html.toLowerCase();

  // Count occurrences to find most mentioned country
  let maxCount = 0;
  let detectedCountry = '';

  for (const country of countries) {
    const regex = new RegExp(country.toLowerCase(), 'g');
    const matches = lowerHtml.match(regex);
    const count = matches ? matches.length : 0;
    if (count > maxCount) {
      maxCount = count;
      detectedCountry = country;
    }
  }

  return detectedCountry;
}

function detectCategory(html: string, url: string, categories: CategoryData[]): string {
  const lowerHtml = html.toLowerCase();
  const lowerUrl = url.toLowerCase();

  // Category keyword mappings with weights
  const categoryKeywords: Record<string, { keywords: string[]; weight: number }[]> = {
    'emergencies': [
      { keywords: ['emergency', 'urgent', 'crisis'], weight: 5 },
      { keywords: ['disaster', 'flood', 'earthquake', 'tsunami'], weight: 4 },
      { keywords: ['war', 'conflict', 'gaza', 'palestine', 'sudan'], weight: 4 },
      { keywords: ['famine', 'relief', 'humanitarian'], weight: 3 },
    ],
    'water-for-life': [
      { keywords: ['water well', 'borehole', 'water pump'], weight: 5 },
      { keywords: ['clean water', 'safe water', 'drinking water'], weight: 4 },
      { keywords: ['water tanker', 'water project'], weight: 4 },
      { keywords: ['thirst', 'drought'], weight: 3 },
    ],
    'food-aid': [
      { keywords: ['food pack', 'food parcel', 'meal'], weight: 5 },
      { keywords: ['hunger', 'hungry', 'feed the'], weight: 4 },
      { keywords: ['ramadan', 'iftar', 'suhoor'], weight: 4 },
      { keywords: ['nutrition', 'food aid', 'homeless'], weight: 3 },
    ],
    'orphan-sponsorship': [
      { keywords: ['orphan', 'sponsor a child', 'sponsor an orphan'], weight: 5 },
      { keywords: ['child sponsorship', 'orphan care'], weight: 4 },
      { keywords: ['hafiz', 'yateem', 'parentless'], weight: 4 },
    ],
    'education': [
      { keywords: ['education', 'school', 'classroom'], weight: 5 },
      { keywords: ['student', 'teacher', 'learn'], weight: 4 },
      { keywords: ['scholarship', 'madrassa', 'adopt a school'], weight: 4 },
    ],
    'healthcare': [
      { keywords: ['health', 'medical', 'hospital'], weight: 5 },
      { keywords: ['doctor', 'medicine', 'clinic', 'patient'], weight: 4 },
      { keywords: ['surgery', 'safe delivery', 'maternal', 'healthcare'], weight: 4 },
    ],
    'sadaqah-jariyah': [
      { keywords: ['sadaqah jariyah', 'ongoing charity'], weight: 5 },
      { keywords: ['mosque', 'masjid', 'build'], weight: 4 },
      { keywords: ['zakat al-fitr', 'fitrana', 'fitrah'], weight: 4 },
      { keywords: ['construction', 'sustainable'], weight: 3 },
    ],
    'qurbani': [
      { keywords: ['qurbani', 'udhiya', 'udhiyah'], weight: 5 },
      { keywords: ['sacrifice', 'eid al-adha', 'dhul hijjah'], weight: 4 },
      { keywords: ['aqiqah', 'meat distribution'], weight: 4 },
    ],
  };

  // Score each category
  const scores: Record<string, number> = {};

  for (const [category, keywordGroups] of Object.entries(categoryKeywords)) {
    scores[category] = 0;
    for (const group of keywordGroups) {
      for (const keyword of group.keywords) {
        // Check URL (higher weight)
        if (lowerUrl.includes(keyword.replace(/ /g, '-')) || lowerUrl.includes(keyword.replace(/ /g, ''))) {
          scores[category] += group.weight * 3;
        }
        // Check content
        const regex = new RegExp(keyword, 'gi');
        const matches = lowerHtml.match(regex);
        if (matches) {
          scores[category] += matches.length * group.weight;
        }
      }
    }
  }

  // Find category with highest score
  let bestCategory = 'emergencies';
  let highestScore = 0;

  for (const [category, score] of Object.entries(scores)) {
    if (score > highestScore) {
      highestScore = score;
      bestCategory = category;
    }
  }

  // Verify category exists in database
  const categoryExists = categories.some(c => c.slug === bestCategory);
  return categoryExists ? bestCategory : 'emergencies';
}

function createCompellingCampaign(
  data: ReturnType<typeof extractCampaignData>,
  replacements: { find: string; replace: string }[],
  spinContent: boolean,
  useStockImages: boolean = false
) {
  let title = data.rawTitle;
  let description = data.rawDescription;

  // Clean title - remove org names and common suffixes
  title = title
    .replace(/\s*[-|–—]\s*[^-|–—]+$/i, '')
    .replace(/\s*\|\s*[^|]+$/i, '')
    .trim();

  // Apply all replacements
  for (const { find, replace } of replacements) {
    const regex = new RegExp(escapeRegExp(find), 'gi');
    title = title.replace(regex, replace);
    description = description.replace(regex, replace);
  }

  // Clean up title
  title = title.replace(/Qurbani Foundation\s*[-|–—]\s*/gi, '').trim();

  // Create compelling title
  const finalTitle = spinContent ? createCompellingTitle(title, data) : title;

  // Create emotional subtitle
  const subtitle = createSubtitle(data);

  // Create compelling description
  const finalDescription = createCompellingDescription(description, data, replacements, spinContent);

  // Create full long description with sections
  const longDescription = createLongDescription(data, finalTitle, replacements, spinContent);

  // Create content sections for structured display
  const contentSections = createContentSections(data, replacements);

  // Create impactful donation options
  const donationOptions = createDonationOptions(data, replacements);

  // Create impact stats
  const impactStats = createImpactStats(data);

  // Choose images based on useStockImages flag
  // When true: Use keyword-based Unsplash search (no branding, contextually relevant)
  // When false: Use scraped images from source website (may have branding)
  let featuredImage: string;
  let heroImage: string;
  let galleryImages: string[];

  if (useStockImages) {
    // Generate keyword-targeted Unsplash images based on campaign title, country, category
    featuredImage = generateKeywordImageUrl(finalTitle, data.detectedCountry, data.detectedCategory, '1200x800');
    heroImage = generateKeywordImageUrl(finalTitle, data.detectedCountry, data.detectedCategory, '1920x1080');
    galleryImages = generateKeywordGalleryUrls(finalTitle, data.detectedCountry, data.detectedCategory, 4);

    console.log(`[Stock Images] Keywords: ${extractImageKeywords(finalTitle, data.detectedCountry, data.detectedCategory).join(', ')}`);
  } else {
    // Use scraped images with static stock fallback
    const stockFallback = getDefaultImage(data.detectedCategory, data.detectedCountry);
    featuredImage = data.images[0] || stockFallback;
    heroImage = featuredImage;
    galleryImages = data.images.slice(1, 6);
  }

  // Determine template based on category
  const templateMap: Record<string, string> = {
    'emergencies': 'emergency-appeal',
    'water-for-life': 'green-with-yellow',
    'food-aid': 'green-with-yellow',
    'orphan-sponsorship': 'green-with-yellow',
    'education': 'green-with-yellow',
    'healthcare': 'green-with-yellow',
    'sadaqah-jariyah': 'green-with-yellow',
    'qurbani': 'green-with-yellow'
  };

  // Generate unique slug
  const uniqueSlug = data.slug + '-' + Date.now().toString(36).slice(-4);

  return {
    // Core fields
    name: finalTitle,
    title: finalTitle,
    slug: uniqueSlug,
    subtitle: subtitle,
    description: finalDescription,
    long_description: longDescription,

    // Images
    featured_image: featuredImage,
    hero_image_url: heroImage,
    image_url: featuredImage,
    og_image_url: featuredImage,
    gallery_images: galleryImages,

    // Location
    country: data.detectedCountry,
    region: data.detectedCountry,

    // Categorization
    category: data.detectedCategory,
    is_active: true,
    is_featured: data.isEmergency,
    is_zakat_eligible: data.isZakatEligible || true,
    show_on_homepage: data.isEmergency,

    // Templates - null means use site defaults
    page_template: null,
    donation_box_template: null,

    // Donation & Goals
    donation_options: donationOptions,
    goal_amount: generateRealisticGoal(data),
    raised_amount: generateRealisticRaised(data),

    // Impact
    impact_stats: impactStats,
    content_sections: contentSections,

    // SEO
    meta_title: `${finalTitle} | Qurbani Foundation`,
    meta_description: finalDescription.substring(0, 155) + '...',

    // Source tracking
    sourceUrl: data.sourceUrl
  };
}

function createCompellingTitle(title: string, data: ReturnType<typeof extractCampaignData>): string {
  // Remove generic suffixes
  let cleaned = title
    .replace(/\s*(appeal|campaign|fund|relief|donation|donate)\s*$/i, '')
    .trim();

  // Add compelling suffix based on category/context
  const suffixes: Record<string, string[]> = {
    'emergencies': ['Emergency Appeal', 'Urgent Relief', 'Crisis Response'],
    'water-for-life': ['Clean Water Initiative', 'Water for Life', 'Life-Saving Water Project'],
    'food-aid': ['Food Aid Program', 'Feed the Hungry', 'Hunger Relief'],
    'orphan-sponsorship': ['Orphan Care Program', 'Child Sponsorship', 'Give Hope to Orphans'],
    'education': ['Education Initiative', 'School Support Program', 'Empower Through Education'],
    'healthcare': ['Healthcare Mission', 'Medical Aid Program', 'Save Lives Today'],
    'sadaqah-jariyah': ['Sadaqah Jariyah', 'Lasting Impact', 'Ongoing Charity'],
    'qurbani': ['Qurbani Program', 'Eid Sacrifice', 'Share the Blessing'],
  };

  const options = suffixes[data.detectedCategory] || ['Appeal'];
  const suffix = options[Math.floor(Math.random() * options.length)];

  // Check if title already has a good ending
  if (/appeal|relief|program|initiative|project|mission/i.test(cleaned)) {
    return cleaned;
  }

  return `${cleaned} ${suffix}`;
}

function createSubtitle(data: ReturnType<typeof extractCampaignData>): string {
  const country = data.detectedCountry || 'those in need';

  const subtitles: Record<string, string[]> = {
    'emergencies': [
      `Urgent humanitarian aid for ${country}`,
      `Your donation saves lives in ${country}`,
      `Emergency relief when every moment counts`,
    ],
    'water-for-life': [
      `Bring clean water to communities in ${country}`,
      `Every drop brings hope and life`,
      `Transform lives with the gift of water`,
    ],
    'food-aid': [
      `Feed families facing hunger in ${country}`,
      `No one should go to sleep hungry`,
      `Your generosity ends hunger`,
    ],
    'orphan-sponsorship': [
      `Give orphaned children hope for a brighter future`,
      `Every child deserves love and care`,
      `Change an orphan's life forever`,
    ],
    'education': [
      `Empower children through education`,
      `Knowledge is the path out of poverty`,
      `Build futures through learning`,
    ],
    'healthcare': [
      `Provide life-saving medical care`,
      `Health is a human right`,
      `Your support heals and saves lives`,
    ],
    'sadaqah-jariyah': [
      `Give charity that keeps on giving`,
      `Create lasting change for generations`,
      `Your legacy of continuous reward`,
    ],
    'qurbani': [
      `Share the blessed meat with families in need`,
      `Fulfill your Qurbani obligation with us`,
      `Spread joy this Eid al-Adha`,
    ],
  };

  const options = subtitles[data.detectedCategory] || [`Support ${country} today`];
  return options[Math.floor(Math.random() * options.length)];
}

function createCompellingDescription(
  description: string,
  data: ReturnType<typeof extractCampaignData>,
  replacements: { find: string; replace: string }[],
  spinContent: boolean
): string {
  const country = data.detectedCountry || 'communities in need';

  // Apply replacements to original description
  let cleaned = applyReplacements(description, replacements);

  // If no description, create one
  if (!cleaned || cleaned.length < 50) {
    const templates: Record<string, string[]> = {
      'emergencies': [
        `Families in ${country} face an unprecedented crisis. Your urgent donation to Qurbani Foundation provides life-saving aid including food, water, shelter, and medical supplies to those who have lost everything.`,
        `The situation in ${country} is critical. Qurbani Foundation is on the ground delivering emergency relief. Your donation today could save a life.`,
      ],
      'water-for-life': [
        `Millions lack access to clean water. Your donation to Qurbani Foundation builds wells and water systems, bringing the gift of life to communities in ${country}.`,
        `Clean water transforms everything. Help Qurbani Foundation bring safe drinking water to families in ${country} who walk miles for contaminated water.`,
      ],
      'food-aid': [
        `Hunger is devastating families in ${country}. Your donation to Qurbani Foundation provides nutritious food packages to those facing starvation.`,
        `No family should go hungry. Qurbani Foundation delivers food aid to the most vulnerable in ${country}. Your generosity feeds hope.`,
      ],
      'orphan-sponsorship': [
        `Orphaned children in ${country} need your love and support. Sponsor an orphan through Qurbani Foundation and provide education, healthcare, and hope for a brighter future.`,
        `Every orphan deserves a chance. Your sponsorship through Qurbani Foundation gives vulnerable children the care and opportunities they need to thrive.`,
      ],
      'education': [
        `Education breaks the cycle of poverty. Help Qurbani Foundation build schools and provide learning opportunities for children in ${country}.`,
        `Knowledge empowers. Your donation to Qurbani Foundation gives children in ${country} access to quality education and a path to a better life.`,
      ],
      'healthcare': [
        `Access to healthcare saves lives. Qurbani Foundation provides medical care to underserved communities in ${country}. Your donation heals.`,
        `Many in ${country} have no access to medical care. Your support helps Qurbani Foundation deliver life-saving healthcare to those in need.`,
      ],
      'sadaqah-jariyah': [
        `Give Sadaqah Jariyah that benefits you and others for years to come. Qurbani Foundation builds mosques, schools, and water wells that serve communities for generations.`,
        `Your ongoing charity creates lasting impact. Support Qurbani Foundation's Sadaqah Jariyah projects and earn continuous rewards.`,
      ],
      'qurbani': [
        `Fulfill your Qurbani obligation with Qurbani Foundation. We distribute fresh, blessed meat to families in ${country} who rarely eat protein.`,
        `Share the joy of Eid al-Adha with families in need. Qurbani Foundation ensures your sacrifice reaches those who need it most.`,
      ],
    };

    const options = templates[data.detectedCategory] || templates['emergencies'];
    cleaned = options[Math.floor(Math.random() * options.length)];
  } else {
    // Enhance existing description
    cleaned = `${cleaned} Support Qurbani Foundation's mission to help ${country}.`;
  }

  return cleaned.substring(0, 350);
}

function createLongDescription(
  data: ReturnType<typeof extractCampaignData>,
  title: string,
  replacements: { find: string; replace: string }[],
  spinContent: boolean
): string {
  const country = data.detectedCountry || 'affected communities';

  let content = `<div class="campaign-content">`;

  // Opening hook
  content += `<h2>About This Appeal</h2>`;
  content += `<p class="lead">`;

  if (data.paragraphs.length > 0) {
    content += applyReplacements(data.paragraphs[0], replacements);
  } else {
    content += `Qurbani Foundation is working tirelessly to provide essential support to ${country}. With your help, we can make a real difference in the lives of those who need it most.`;
  }
  content += `</p>`;

  // The situation
  content += `<h3>The Situation</h3>`;
  if (data.paragraphs.length > 1) {
    content += `<p>${applyReplacements(data.paragraphs[1], replacements)}</p>`;
  } else {
    const situations: Record<string, string> = {
      'emergencies': `The crisis has left countless families displaced and vulnerable. Basic necessities like food, clean water, and shelter are desperately needed. Every day without help means more suffering.`,
      'water-for-life': `Without access to clean water, families face disease, children miss school to collect water, and communities cannot thrive. A single well can transform an entire village.`,
      'food-aid': `Hunger affects not just the body, but the mind and spirit. Children cannot learn, parents cannot work, and families lose hope. Your food donation restores dignity and strength.`,
      'orphan-sponsorship': `Orphaned children face unimaginable challenges. Without support, they may miss out on education, healthcare, and the love every child deserves.`,
      'education': `In many regions, children have no access to education. Schools are damaged, teachers are scarce, and families cannot afford supplies. Education is their only path forward.`,
      'healthcare': `Medical facilities are overwhelmed or non-existent. Preventable diseases claim lives daily. A single medical intervention can save an entire family.`,
      'sadaqah-jariyah': `Sustainable projects create lasting change. When you build a well, mosque, or school, you create benefits that continue for generations.`,
      'qurbani': `Many families can only dream of eating meat. Your Qurbani brings not just nutrition, but the joy and dignity of celebrating Eid properly.`,
    };
    content += `<p>${situations[data.detectedCategory] || situations['emergencies']}</p>`;
  }

  // How donations help
  content += `<h3>How Your Donation Helps</h3>`;
  content += `<ul class="donation-impact">`;

  const impacts = data.donationAmounts.length > 0
    ? data.donationAmounts.slice(0, 4)
    : getDefaultDonationImpacts(data.detectedCategory);

  for (const impact of impacts) {
    content += `<li><strong>$${impact.amount}</strong> - ${applyReplacements(impact.label, replacements)}</li>`;
  }
  content += `</ul>`;

  // Additional paragraphs if available
  if (data.paragraphs.length > 2) {
    content += `<h3>Our Work</h3>`;
    for (let i = 2; i < Math.min(data.paragraphs.length, 4); i++) {
      content += `<p>${applyReplacements(data.paragraphs[i], replacements)}</p>`;
    }
  }

  // Call to action
  content += `<h3>Your Support Matters</h3>`;
  content += `<p>At Qurbani Foundation, we ensure your donation reaches those who need it most. Our teams work directly with local communities to deliver aid efficiently and with dignity.</p>`;
  content += `<p><strong>100% of your Zakat goes directly to those in need.</strong> Administrative costs are covered separately, so every penny of your Zakat fulfills its purpose.</p>`;
  content += `<p>Don't wait. Your donation today can transform lives. Together, we can bring hope to ${country}.</p>`;

  content += `</div>`;

  return content;
}

function createContentSections(
  data: ReturnType<typeof extractCampaignData>,
  replacements: { find: string; replace: string }[]
): object[] {
  const sections = [];

  // Hero section
  sections.push({
    type: 'hero',
    title: data.rawTitle,
    subtitle: createSubtitle(data),
    image: data.images[0] || null,
    cta: 'Donate Now'
  });

  // Impact stats section
  if (data.impactNumbers.length > 0) {
    sections.push({
      type: 'stats',
      items: data.impactNumbers.map(stat => ({
        value: stat.number,
        label: stat.label
      }))
    });
  }

  // Video section if available
  if (data.videoUrl) {
    sections.push({
      type: 'video',
      url: data.videoUrl,
      title: 'See Our Impact'
    });
  }

  // Gallery section
  if (data.images.length > 1) {
    sections.push({
      type: 'gallery',
      images: data.images.slice(1, 5)
    });
  }

  return sections;
}

function createDonationOptions(
  data: ReturnType<typeof extractCampaignData>,
  replacements: { find: string; replace: string }[]
): { amount: number; label: string; description?: string }[] {
  if (data.donationAmounts.length >= 3) {
    return data.donationAmounts.slice(0, 4).map(opt => ({
      amount: opt.amount,
      label: applyReplacements(opt.label, replacements),
    }));
  }

  return getDefaultDonationImpacts(data.detectedCategory);
}

function getDefaultDonationImpacts(category: string): { amount: number; label: string }[] {
  const defaults: Record<string, { amount: number; label: string }[]> = {
    'emergencies': [
      { amount: 50, label: 'Emergency food pack for a family' },
      { amount: 100, label: 'Clean water and hygiene supplies' },
      { amount: 250, label: 'Shelter kit for a displaced family' },
      { amount: 500, label: 'Comprehensive emergency relief package' },
    ],
    'water-for-life': [
      { amount: 30, label: 'Water purification supplies' },
      { amount: 100, label: 'Hand pump installation' },
      { amount: 300, label: 'Community water point' },
      { amount: 1500, label: 'Full water well construction' },
    ],
    'food-aid': [
      { amount: 25, label: 'Feed a family for a week' },
      { amount: 50, label: 'Monthly food package' },
      { amount: 100, label: 'Ramadan iftar for 10 people' },
      { amount: 250, label: 'Feed a family for 3 months' },
    ],
    'orphan-sponsorship': [
      { amount: 30, label: 'One month of orphan care' },
      { amount: 100, label: 'Education supplies for a year' },
      { amount: 360, label: 'Full year orphan sponsorship' },
      { amount: 500, label: 'Comprehensive orphan support' },
    ],
    'education': [
      { amount: 25, label: 'School supplies for a child' },
      { amount: 75, label: 'Sponsor a student for a month' },
      { amount: 150, label: 'Teacher training support' },
      { amount: 500, label: 'Classroom renovation' },
    ],
    'healthcare': [
      { amount: 35, label: 'Essential medicines' },
      { amount: 100, label: 'Medical consultation and treatment' },
      { amount: 150, label: 'Safe childbirth delivery' },
      { amount: 500, label: 'Surgery or major treatment' },
    ],
    'sadaqah-jariyah': [
      { amount: 50, label: 'Contribute to mosque construction' },
      { amount: 100, label: 'Plant fruit trees' },
      { amount: 300, label: 'School desk sponsorship' },
      { amount: 1000, label: 'Name a classroom' },
    ],
    'qurbani': [
      { amount: 75, label: 'Goat/Sheep Qurbani' },
      { amount: 150, label: 'Premium Qurbani' },
      { amount: 350, label: 'Cow share (1/7th)' },
      { amount: 2500, label: 'Whole cow Qurbani' },
    ],
  };

  return defaults[category] || defaults['emergencies'];
}

function createImpactStats(data: ReturnType<typeof extractCampaignData>): object {
  if (data.impactNumbers.length > 0) {
    return data.impactNumbers.reduce((acc, stat) => {
      acc[stat.label] = stat.number;
      return acc;
    }, {} as Record<string, string>);
  }

  // Generate realistic default stats
  const defaults: Record<string, object> = {
    'emergencies': { families_helped: '5,000+', meals_provided: '50,000+', countries: '8' },
    'water-for-life': { wells_built: '500+', people_served: '250,000+', villages: '100+' },
    'food-aid': { meals_served: '100,000+', families_fed: '10,000+', countries: '12' },
    'orphan-sponsorship': { orphans_supported: '2,000+', countries: '10', years_active: '15+' },
    'education': { students: '5,000+', schools: '50+', teachers_trained: '200+' },
    'healthcare': { patients_treated: '25,000+', clinics: '10', surgeries: '500+' },
    'sadaqah-jariyah': { mosques_built: '25+', wells: '300+', schools: '15+' },
    'qurbani': { animals_distributed: '10,000+', families: '30,000+', countries: '15' },
  };

  return defaults[data.detectedCategory] || defaults['emergencies'];
}

function generateRealisticGoal(data: ReturnType<typeof extractCampaignData>): number {
  const goals: Record<string, number[]> = {
    'emergencies': [250000, 500000, 750000, 1000000],
    'water-for-life': [50000, 100000, 150000],
    'food-aid': [75000, 150000, 250000],
    'orphan-sponsorship': [100000, 200000],
    'education': [50000, 100000, 150000],
    'healthcare': [100000, 200000, 300000],
    'sadaqah-jariyah': [75000, 150000, 250000],
    'qurbani': [100000, 250000, 500000],
  };

  const options = goals[data.detectedCategory] || goals['emergencies'];
  return options[Math.floor(Math.random() * options.length)];
}

function generateRealisticRaised(data: ReturnType<typeof extractCampaignData>): number {
  const goal = generateRealisticGoal(data);
  // Raised between 15% and 65% of goal
  const percentage = 0.15 + (Math.random() * 0.5);
  return Math.floor(goal * percentage);
}

function getDefaultImage(category: string, country?: string): string {
  // Country + Category specific images for contextual relevance
  const countryImages: Record<string, Record<string, string>> = {
    'syria': {
      'emergencies': 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=1200', // Syrian cityscape
      'food-aid': 'https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=1200',
      'healthcare': 'https://images.unsplash.com/photo-1584515933487-779824d29309?w=1200',
      'default': 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=1200',
    },
    'palestine': {
      'emergencies': 'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?w=1200', // Middle East humanitarian
      'food-aid': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200',
      'healthcare': 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200',
      'default': 'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?w=1200',
    },
    'gaza': {
      'emergencies': 'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?w=1200',
      'food-aid': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200',
      'healthcare': 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200',
      'default': 'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?w=1200',
    },
    'yemen': {
      'emergencies': 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=1200',
      'food-aid': 'https://images.unsplash.com/photo-1593113616828-6f22bca04804?w=1200', // Hunger/food crisis
      'water-for-life': 'https://images.unsplash.com/photo-1541544537156-7627a7a4aa1c?w=1200',
      'default': 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=1200',
    },
    'sudan': {
      'emergencies': 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1200', // African humanitarian
      'food-aid': 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=1200',
      'water-for-life': 'https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=1200',
      'default': 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1200',
    },
    'afghanistan': {
      'emergencies': 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=1200', // Afghan people
      'education': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200',
      'orphan-sponsorship': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200',
      'default': 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=1200',
    },
    'pakistan': {
      'emergencies': 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?w=1200', // Pakistan floods/disaster
      'water-for-life': 'https://images.unsplash.com/photo-1541544537156-7627a7a4aa1c?w=1200',
      'education': 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200',
      'default': 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?w=1200',
    },
    'bangladesh': {
      'emergencies': 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200',
      'water-for-life': 'https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=1200',
      'food-aid': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200',
      'default': 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200',
    },
    'somalia': {
      'emergencies': 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1200',
      'food-aid': 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=1200',
      'water-for-life': 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=1200',
      'default': 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1200',
    },
    'turkey': {
      'emergencies': 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1200', // Turkey earthquake
      'default': 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1200',
    },
    'morocco': {
      'emergencies': 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=1200', // Morocco
      'default': 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=1200',
    },
    'india': {
      'food-aid': 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=1200',
      'education': 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200',
      'healthcare': 'https://images.unsplash.com/photo-1584515933487-779824d29309?w=1200',
      'default': 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=1200',
    },
    'africa': {
      'water-for-life': 'https://images.unsplash.com/photo-1541544537156-7627a7a4aa1c?w=1200',
      'food-aid': 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1200',
      'orphan-sponsorship': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200',
      'education': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200',
      'default': 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1200',
    },
  };

  // Generic category fallbacks
  const categoryImages: Record<string, string> = {
    'emergencies': 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=1200',
    'water-for-life': 'https://images.unsplash.com/photo-1541544537156-7627a7a4aa1c?w=1200',
    'food-aid': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200',
    'orphan-sponsorship': 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=1200',
    'education': 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200',
    'healthcare': 'https://images.unsplash.com/photo-1584515933487-779824d29309?w=1200',
    'sadaqah-jariyah': 'https://images.unsplash.com/photo-1519817650390-64a93db51149?w=1200',
    'qurbani': 'https://images.unsplash.com/photo-1566378179184-966da6548e09?w=1200',
  };

  // Try country + category specific image first
  if (country) {
    const normalizedCountry = country.toLowerCase().trim();
    const countryConfig = countryImages[normalizedCountry];
    if (countryConfig) {
      return countryConfig[category] || countryConfig['default'] || categoryImages[category] || categoryImages['emergencies'];
    }
  }

  // Fall back to category image
  return categoryImages[category] || categoryImages['emergencies'];
}

function getStockGalleryImages(category: string, country?: string): string[] {
  // Country-specific gallery images for contextually relevant visuals
  const countryGalleryImages: Record<string, Record<string, string[]>> = {
    'syria': {
      'emergencies': [
        'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800',
        'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?w=800',
        'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800',
        'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800',
      ],
    },
    'palestine': {
      'emergencies': [
        'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?w=800',
        'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800',
        'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800',
        'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800',
      ],
    },
    'gaza': {
      'emergencies': [
        'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?w=800',
        'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800',
        'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800',
        'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800',
      ],
    },
    'yemen': {
      'emergencies': [
        'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800',
        'https://images.unsplash.com/photo-1593113616828-6f22bca04804?w=800',
        'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800',
        'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800',
      ],
      'food-aid': [
        'https://images.unsplash.com/photo-1593113616828-6f22bca04804?w=800',
        'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800',
        'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
        'https://images.unsplash.com/photo-1459183885421-5cc683b8dbba?w=800',
      ],
    },
    'sudan': {
      'emergencies': [
        'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800',
        'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800',
        'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800',
        'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800',
      ],
    },
    'afghanistan': {
      'emergencies': [
        'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800',
        'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800',
        'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800',
        'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800',
      ],
      'education': [
        'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800',
        'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800',
        'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800',
        'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800',
      ],
    },
    'africa': {
      'water-for-life': [
        'https://images.unsplash.com/photo-1541544537156-7627a7a4aa1c?w=800',
        'https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=800',
        'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800',
        'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800',
      ],
      'food-aid': [
        'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800',
        'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800',
        'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
        'https://images.unsplash.com/photo-1593113616828-6f22bca04804?w=800',
      ],
      'orphan-sponsorship': [
        'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
        'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800',
        'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=800',
        'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=800',
      ],
    },
  };

  // Generic category fallback gallery images
  const categoryGalleryImages: Record<string, string[]> = {
    'emergencies': [
      'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800',
      'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800',
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800',
      'https://images.unsplash.com/photo-1542810634-71277d95dcbb?w=800',
    ],
    'water-for-life': [
      'https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=800',
      'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=800',
      'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800',
      'https://images.unsplash.com/photo-1504297050568-910d24c426d3?w=800',
    ],
    'food-aid': [
      'https://images.unsplash.com/photo-1593113616828-6f22bca04804?w=800',
      'https://images.unsplash.com/photo-1459183885421-5cc683b8dbba?w=800',
      'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=800',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
    ],
    'orphan-sponsorship': [
      'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
      'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=800',
      'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800',
      'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=800',
    ],
    'education': [
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800',
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800',
      'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800',
    ],
    'healthcare': [
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800',
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800',
      'https://images.unsplash.com/photo-1551076805-e1869033e561?w=800',
      'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=800',
    ],
    'sadaqah-jariyah': [
      'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800',
      'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800',
      'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=800',
      'https://images.unsplash.com/photo-1508780709619-79562169bc64?w=800',
    ],
    'qurbani': [
      'https://images.unsplash.com/photo-1529973565457-a60a2ccf750d?w=800',
      'https://images.unsplash.com/photo-1517649281203-dad836b4abe5?w=800',
      'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800',
      'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=800',
    ],
  };

  // Try country + category specific gallery first
  if (country) {
    const normalizedCountry = country.toLowerCase().trim();
    const countryConfig = countryGalleryImages[normalizedCountry];
    if (countryConfig && countryConfig[category]) {
      return countryConfig[category];
    }
  }

  // Fall back to category gallery
  return categoryGalleryImages[category] || categoryGalleryImages['emergencies'];
}

function applyReplacements(text: string, replacements: { find: string; replace: string }[]): string {
  let result = text;
  for (const { find, replace } of replacements) {
    const regex = new RegExp(escapeRegExp(find), 'gi');
    result = result.replace(regex, replace);
  }
  return result;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeAbsoluteUrl(url: string, baseUrl: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('data:')) return '';

  try {
    const base = new URL(baseUrl);
    if (url.startsWith('//')) {
      return `${base.protocol}${url}`;
    }
    if (url.startsWith('/')) {
      return `${base.protocol}//${base.host}${url}`;
    }
    return `${base.protocol}//${base.host}/${url}`;
  } catch {
    return '';
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .trim();
}
