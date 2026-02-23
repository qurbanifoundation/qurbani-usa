import { supabase } from './supabase';

// Default homepage content - used as fallback and initial data
export const defaultHomepageContent = {
  about: {
    badge: 'ABOUT QURBANI',
    title: 'What is Qurbani?',
    paragraphs: [
      '<strong>Qurbani</strong> (also known as Udhiyah) is the Islamic tradition of sacrificing an animal during Eid al-Adha. It commemorates Prophet Ibrahim\'s (AS) willingness to sacrifice his son in obedience to Allah (SWT).',
      'It is <strong>obligatory (Wajib)</strong> for every Muslim who possesses the nisab (minimum threshold of wealth). The meat is then distributed to family, friends, and most importantly—to those in need.',
      'At <strong>Qurbani Foundation USA</strong>, we partner with trusted local organizations in 70+ countries to perform your sacrifice according to strict Islamic guidelines and distribute fresh meat to families who rarely have access to protein.'
    ],
    image: 'https://www.staging9.qurbani.com/wp-content/uploads/2025/06/file-16827-bee9b8e831c08b2fe42891f4ae29b65e.jpg',
    features: [
      { icon: 'check', title: 'Shariah Compliant', description: 'All sacrifices follow Islamic guidelines', color: '#255764' },
      { icon: 'location', title: 'Local Distribution', description: 'Fresh meat delivered within 48 hours', color: '#255764' },
      { icon: 'checkmark', title: '100% Policy', description: 'Every dollar reaches the beneficiaries', color: '#ef7c01' },
      { icon: 'mail', title: 'Confirmation', description: 'Receive photos and reports post-Eid', color: '#255764' }
    ]
  },
  stats: {
    items: [
      { number: '25+', label: 'Years of Service', icon: 'calendar' },
      { number: '70+', label: 'Countries Worldwide', icon: 'globe' },
      { number: '5M+', label: 'People Fed Annually', icon: 'users' },
      { number: '100%', label: 'Zakat Policy', icon: 'heart' }
    ]
  },
  faq: {
    title: 'Frequently Asked Questions',
    subtitle: 'Everything you need to know about Qurbani',
    items: [
      {
        question: 'What is Qurbani and who is it obligatory for?',
        answer: 'Qurbani is the sacrifice of an animal during Eid al-Adha. It is obligatory (Wajib) for every sane Muslim who possesses the nisab (minimum threshold of wealth, equivalent to 87.48 grams of gold or 612.36 grams of silver) and is not a traveler.'
      },
      {
        question: 'When should Qurbani be performed?',
        answer: 'Qurbani must be performed during the days of Eid al-Adha: from after the Eid prayer on the 10th of Dhul Hijjah until before sunset on the 13th of Dhul Hijjah.'
      },
      {
        question: 'What animals can be sacrificed for Qurbani?',
        answer: 'Permissible animals include goats, sheep (at least 1 year old), cattle, buffalo, and camels (cattle count as 7 shares, camels as 7 shares). Animals must be healthy and free from defects.'
      },
      {
        question: 'How is the meat distributed?',
        answer: 'Traditionally, the meat is divided into three parts: one-third for the family, one-third for relatives and friends, and one-third for those in need. When donating through us, 100% goes to those in need.'
      },
      {
        question: 'Can I give Qurbani on behalf of someone else?',
        answer: 'Yes, you can give Qurbani on behalf of deceased relatives, children, or anyone else. Many people give multiple Qurbanis—one for themselves and additional ones for family members.'
      }
    ]
  }
};

export type HomepageContent = typeof defaultHomepageContent;

// Cache the content in memory for ultra-fast subsequent requests
let cachedContent: HomepageContent | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute cache

export async function getHomepageContent(): Promise<HomepageContent> {
  // Return cached content if still valid
  const now = Date.now();
  if (cachedContent && (now - cacheTime) < CACHE_DURATION) {
    return cachedContent;
  }

  try {
    const { data, error } = await supabase
      .from('homepage_content')
      .select('*')
      .eq('id', 'main')
      .single();

    if (error || !data) {
      // Return defaults if no data in database
      return defaultHomepageContent;
    }

    // Merge with defaults to ensure all fields exist
    const content: HomepageContent = {
      about: { ...defaultHomepageContent.about, ...data.about },
      stats: { ...defaultHomepageContent.stats, ...data.stats },
      faq: { ...defaultHomepageContent.faq, ...data.faq }
    };

    // Update cache
    cachedContent = content;
    cacheTime = now;

    return content;
  } catch (error) {
    console.error('Error fetching homepage content:', error);
    return defaultHomepageContent;
  }
}
