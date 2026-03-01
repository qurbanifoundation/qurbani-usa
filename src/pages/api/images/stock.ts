import type { APIRoute } from 'astro';

export const prerender = false;

interface StockImageRequest {
  title: string;
  category?: string;
  country?: string;
  count?: number;
  page?: number;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body: StockImageRequest = await request.json();
    const { title, category = '', country = '', count = 8, page = 1 } = body;

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build smart search query from the title
    const searchQuery = buildSearchQuery(title, category, country);

    // Try Pexels API first (if key available), then fall back to curated + Unsplash source
    const pexelsKey = import.meta.env.PEXELS_API_KEY || '';
    let images: { url: string; thumbnail: string }[] = [];

    if (pexelsKey) {
      images = await fetchFromPexels(pexelsKey, searchQuery, count, page);
    }

    // If Pexels didn't work or no key, use Unsplash search
    if (images.length === 0) {
      images = await fetchFromUnsplash(searchQuery, count, page);
    }

    // If Unsplash also failed, fall back to curated library
    if (images.length === 0) {
      const keywords = extractKeywords(title.toLowerCase());
      images = getCuratedImages(keywords, category, country, count);
    }

    console.log(`[Stock Images API] Query: "${searchQuery}" | Page: ${page} | Images: ${images.length}`);

    return new Response(JSON.stringify({
      success: true,
      keywords: searchQuery.split(' '),
      query: searchQuery,
      page,
      images
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Stock images error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate images' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Build an optimized search query from the campaign title
 */
function buildSearchQuery(title: string, category: string, country: string): string {
  // Remove generic words to build a more targeted query
  const stopWords = [
    'appeal', 'emergency', 'crisis', 'donate', 'help', 'support', 'fund',
    'campaign', 'the', 'and', 'for', 'to', 'in', 'of', 'a', 'an', 'relief',
    'response', 'project', 'program', 'initiative', 'give', 'giving',
    'foundation', 'charity', 'usa', 'now', 'please', 'urgent', 'critical'
  ];

  const keywords = title
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));

  // Add context boosters for charity/humanitarian images
  const contextMap: Record<string, string> = {
    'sudan': 'sudan humanitarian aid people',
    'syria': 'syria humanitarian children families',
    'gaza': 'gaza palestinian humanitarian aid',
    'palestine': 'palestine humanitarian people',
    'yemen': 'yemen humanitarian crisis families',
    'afghanistan': 'afghanistan humanitarian people',
    'somalia': 'somalia humanitarian aid',
    'water': 'clean water well village africa',
    'orphan': 'orphan children smile hope',
    'orphans': 'orphan children smile hope',
    'education': 'education school children developing',
    'food': 'food distribution humanitarian aid',
    'hunger': 'food aid hunger relief',
    'medical': 'medical humanitarian doctor clinic',
    'health': 'healthcare clinic developing world',
    'mosque': 'mosque islamic architecture',
    'masjid': 'mosque islamic architecture',
    'ramadan': 'ramadan iftar islamic charity',
    'qurbani': 'eid sacrifice livestock charity',
    'zakat': 'islamic charity giving helping',
    'sadaqah': 'islamic charity donation community',
    'fidya': 'ramadan food distribution charity',
    'aqiqah': 'islamic newborn celebration charity',
    'sponsor': 'child sponsorship smile hope',
  };

  // Check if any keyword has a context mapping
  let query = '';
  for (const kw of keywords) {
    if (contextMap[kw]) {
      query = contextMap[kw];
      break;
    }
  }

  // If no specific mapping, use the cleaned keywords + humanitarian context
  if (!query) {
    query = keywords.slice(0, 3).join(' ');
    if (query && !query.includes('humanitarian') && !query.includes('charity')) {
      query += ' humanitarian';
    }
  }

  // Add country context if provided and not already in query
  if (country && !query.includes(country.toLowerCase())) {
    query = country.toLowerCase() + ' ' + query;
  }

  return query || 'humanitarian aid charity';
}

/**
 * Fetch images from Pexels API (free, high quality)
 */
async function fetchFromPexels(apiKey: string, query: string, count: number, page: number): Promise<{ url: string; thumbnail: string }[]> {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&page=${page}&orientation=landscape`;
    const res = await fetch(url, {
      headers: { 'Authorization': apiKey }
    });

    if (!res.ok) {
      console.error(`Pexels API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    return (data.photos || []).map((photo: any) => ({
      url: photo.src.large2x || photo.src.large || photo.src.original,
      thumbnail: photo.src.medium || photo.src.small
    }));
  } catch (e) {
    console.error('Pexels fetch error:', e);
    return [];
  }
}

/**
 * Fetch images from Unsplash via their internal API (no key needed)
 * Falls back to direct Unsplash URLs on failure
 */
async function fetchFromUnsplash(query: string, count: number, page: number): Promise<{ url: string; thumbnail: string }[]> {
  try {
    // Use Unsplash's internal search API (same as their website uses)
    const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&page=${page}&orientation=landscape`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!res.ok) {
      console.error(`Unsplash napi error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results = data.results || [];

    return results.map((photo: any) => ({
      url: photo.urls?.regular || photo.urls?.full || `https://images.unsplash.com/${photo.id}?w=1200&h=800&fit=crop&auto=format`,
      thumbnail: photo.urls?.small || photo.urls?.thumb || `https://images.unsplash.com/${photo.id}?w=400&h=300&fit=crop&auto=format`
    }));
  } catch (e) {
    console.error('Unsplash fetch error:', e);
    return [];
  }
}

/**
 * Extract meaningful keywords from search query
 */
function extractKeywords(query: string): string[] {
  const stopWords = ['appeal', 'emergency', 'crisis', 'donate', 'help', 'support', 'fund', 'campaign', 'the', 'and', 'for', 'to', 'in', 'of', 'a', 'an', 'relief'];

  return query
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
}

/**
 * Match keywords to image categories
 */
function matchKeywordsToCategories(keywords: string[]): string[] {
  const keywordMap: Record<string, string[]> = {
    'palestine': ['middle-east', 'emergencies'],
    'palestinian': ['middle-east', 'emergencies'],
    'gaza': ['middle-east', 'emergencies'],
    'syria': ['middle-east', 'emergencies'],
    'syrian': ['middle-east', 'emergencies'],
    'yemen': ['middle-east', 'emergencies'],
    'sudan': ['africa', 'emergencies'],
    'somalia': ['africa', 'emergencies'],
    'afghanistan': ['middle-east', 'emergencies'],
    'pakistan': ['emergencies'],
    'bangladesh': ['emergencies'],
    'africa': ['africa'],
    'african': ['africa'],
    'turkey': ['middle-east', 'emergencies'],
    'earthquake': ['emergencies'],
    'lebanon': ['middle-east'],
    'water': ['water'],
    'well': ['water'],
    'food': ['food'],
    'hunger': ['food'],
    'feeding': ['food'],
    'ramadan': ['food', 'ramadan'],
    'iftar': ['food', 'ramadan'],
    'orphan': ['orphan'],
    'children': ['orphan'],
    'child': ['orphan'],
    'kids': ['orphan'],
    'education': ['education'],
    'school': ['education'],
    'medical': ['healthcare'],
    'health': ['healthcare'],
    'hospital': ['healthcare'],
    'doctor': ['healthcare'],
    'mosque': ['sadaqah'],
    'masjid': ['sadaqah'],
    'qurbani': ['qurbani'],
    'eid': ['qurbani'],
    'sacrifice': ['qurbani'],
    'zakat': ['zakat'],
    'sadaqah': ['sadaqah'],
  };

  const matchedCategories: string[] = [];

  for (const keyword of keywords) {
    if (keywordMap[keyword]) {
      matchedCategories.push(...keywordMap[keyword]);
    }
  }

  return [...new Set(matchedCategories)].length > 0
    ? [...new Set(matchedCategories)]
    : ['emergencies'];
}

/**
 * Curated fallback library (only used when live search fails)
 */
function getCuratedImages(keywords: string[], category: string, country: string, count: number): { url: string; thumbnail: string }[] {

  const imageLibrary: Record<string, string[]> = {
    'emergencies': [
      'photo-1469571486292-0ba58a3f068b', 'photo-1532629345422-7515f3d16bb6',
      'photo-1593113598332-cd288d649433', 'photo-1559027615-cd4628902d4a',
      'photo-1542810634-71277d95dcbb', 'photo-1578357078586-491adf1aa5ba',
      'photo-1509099836639-18ba1795216d', 'photo-1488521787991-ed7bbaae773c',
      'photo-1547471080-7cc2caa01a7e', 'photo-1516026672322-bc52d61a55d5',
    ],
    'water': [
      'photo-1541544537156-7627a7a4aa1c', 'photo-1594398901394-4e34939a4fd0',
      'photo-1519125323398-675f0ddb6308', 'photo-1503220317375-aaad61436b1b',
      'photo-1504297050568-910d24c426d3', 'photo-1562016600-ece13e8ba570',
      'photo-1581093458791-9d15482442f6', 'photo-1559827291-9e6b22f8f4a1',
      'photo-1536939459926-301728717817', 'photo-1495774539583-885e02cca8c2',
    ],
    'food': [
      'photo-1488521787991-ed7bbaae773c', 'photo-1593113616828-6f22bca04804',
      'photo-1593113598332-cd288d649433', 'photo-1459183885421-5cc683b8dbba',
      'photo-1504674900247-0877df9cc836', 'photo-1547592180-85f173990554',
      'photo-1506368249639-73a05d6f6488', 'photo-1517433670267-08bbd4be890f',
      'photo-1498837167922-ddd27525d352', 'photo-1504754524776-8f4f37790ca0',
    ],
    'ramadan': [
      'photo-1564769625905-50e93615e769', 'photo-1519817650390-64a93db51149',
      'photo-1591604466107-ec97de577aff', 'photo-1545296664-39db56ad95bd',
      'photo-1532629345422-7515f3d16bb6', 'photo-1504674900247-0877df9cc836',
      'photo-1547592180-85f173990554', 'photo-1488521787991-ed7bbaae773c',
    ],
    'orphan': [
      'photo-1509099836639-18ba1795216d', 'photo-1488521787991-ed7bbaae773c',
      'photo-1502086223501-7ea6ecd79368', 'photo-1529107386315-e1a2ed48a620',
      'photo-1516627145497-ae6968895b74', 'photo-1594608661623-aa0bd3a69d98',
      'photo-1497486751825-1233686d5d80', 'photo-1542810634-71277d95dcbb',
      'photo-1523050854058-8df90110c9f1', 'photo-1503454537195-1dcabb73ffb9',
    ],
    'education': [
      'photo-1497633762265-9d179a990aa6', 'photo-1503676260728-1c00da094a0b',
      'photo-1509062522246-3755977927d7', 'photo-1522202176988-66273c2fd55f',
      'photo-1580582932707-520aed937b7b', 'photo-1481627834876-b7833e8f5570',
      'photo-1427504494785-3a9ca7044f45', 'photo-1523050854058-8df90110c9f1',
      'photo-1503454537195-1dcabb73ffb9', 'photo-1529107386315-e1a2ed48a620',
    ],
    'healthcare': [
      'photo-1584515933487-779824d29309', 'photo-1576091160550-2173dba999ef',
      'photo-1579684385127-1ef15d508118', 'photo-1551076805-e1869033e561',
      'photo-1612349317150-e413f6a5b16d', 'photo-1516549655169-df83a0774514',
      'photo-1581056771107-24ca5f033842', 'photo-1559757175-5700dde675bc',
      'photo-1538108149393-fbbd81895907', 'photo-1504813184591-01572f98c85f',
    ],
    'sadaqah': [
      'photo-1519817650390-64a93db51149', 'photo-1564769625905-50e93615e769',
      'photo-1466611653911-95081537e5b7', 'photo-1509099836639-18ba1795216d',
      'photo-1508780709619-79562169bc64', 'photo-1545296664-39db56ad95bd',
      'photo-1542816417-0983c9c9ad53', 'photo-1559827291-9e6b22f8f4a1',
    ],
    'zakat': [
      'photo-1532629345422-7515f3d16bb6', 'photo-1469571486292-0ba58a3f068b',
      'photo-1488521787991-ed7bbaae773c', 'photo-1509099836639-18ba1795216d',
      'photo-1519817650390-64a93db51149', 'photo-1564769625905-50e93615e769',
      'photo-1542816417-0983c9c9ad53', 'photo-1547471080-7cc2caa01a7e',
    ],
    'qurbani': [
      'photo-1566378179184-966da6548e09', 'photo-1529973565457-a60a2ccf750d',
      'photo-1517649281203-dad836b4abe5', 'photo-1532012197267-da84d127e765',
      'photo-1590779033100-9f60a05a013d', 'photo-1544785349-c4a5301826fd',
      'photo-1559827291-9e6b22f8f4a1', 'photo-1504674900247-0877df9cc836',
    ],
    'middle-east': [
      'photo-1570168007204-dfb528c6958f', 'photo-1591696205602-2f950c417cb9',
      'photo-1547471080-7cc2caa01a7e', 'photo-1558618666-fcd25c85cd64',
      'photo-1548013146-72479768bada', 'photo-1559827291-9e6b22f8f4a1',
      'photo-1564769625905-50e93615e769', 'photo-1573152958734-1922c188fba3',
      'photo-1469571486292-0ba58a3f068b', 'photo-1532629345422-7515f3d16bb6',
    ],
    'africa': [
      'photo-1547471080-7cc2caa01a7e', 'photo-1516026672322-bc52d61a55d5',
      'photo-1523805009345-7448845a9e53', 'photo-1504674900247-0877df9cc836',
      'photo-1509099836639-18ba1795216d', 'photo-1541544537156-7627a7a4aa1c',
      'photo-1493225457124-a3eb161ffa5f', 'photo-1589395937772-f67057e233c1',
      'photo-1488521787991-ed7bbaae773c', 'photo-1542810634-71277d95dcbb',
    ],
  };

  const matchedCategories = matchKeywordsToCategories(keywords);

  if (category && imageLibrary[category]) {
    matchedCategories.unshift(category);
  }

  let allImages: string[] = [];
  for (const cat of matchedCategories) {
    if (imageLibrary[cat]) {
      allImages.push(...imageLibrary[cat]);
    }
  }

  if (allImages.length === 0) {
    allImages = imageLibrary['emergencies'];
  }

  const uniqueImages = [...new Set(allImages)];
  const shuffled = shuffleArray(uniqueImages);
  const selectedImages = shuffled.slice(0, count);

  return selectedImages.map(photoId => ({
    url: `https://images.unsplash.com/${photoId}?w=1200&h=800&fit=crop&auto=format`,
    thumbnail: `https://images.unsplash.com/${photoId}?w=400&h=300&fit=crop&auto=format`
  }));
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
