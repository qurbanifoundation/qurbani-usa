import type { APIRoute } from 'astro';

export const prerender = false;

interface CrisisStatsRequest {
  title: string;
  country?: string;
  category?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body: CrisisStatsRequest = await request.json();
    const { title, country = '', category = '' } = body;

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate crisis statistics based on the campaign context
    const stats = generateCrisisStats(title, country, category);

    console.log(`[Crisis Stats API] Generated stats for: "${title}" (${country})`);

    return new Response(JSON.stringify({
      success: true,
      stats
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Crisis stats error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Generate realistic crisis statistics based on campaign context
 * In production, this could be enhanced with real API data from OCHA, UNHCR, etc.
 */
function generateCrisisStats(title: string, country: string, category: string): { value: string; label: string }[] {
  const lowerTitle = title.toLowerCase();
  const lowerCountry = country.toLowerCase();

  // Palestine/Gaza specific stats (based on real UN data)
  if (lowerCountry.includes('palestine') || lowerCountry.includes('gaza') || lowerTitle.includes('gaza') || lowerTitle.includes('palestine')) {
    return [
      { value: '2.3M', label: 'People in Need' },
      { value: '1.9M', label: 'Displaced' },
      { value: '85%', label: 'Infrastructure Damaged' },
      { value: '500K+', label: 'Children Affected' },
    ];
  }

  // Syria specific stats
  if (lowerCountry.includes('syria') || lowerTitle.includes('syria')) {
    return [
      { value: '15.3M', label: 'People in Need' },
      { value: '6.8M', label: 'Internally Displaced' },
      { value: '5.5M', label: 'Refugees' },
      { value: '12 Years', label: 'Of Crisis' },
    ];
  }

  // Yemen specific stats
  if (lowerCountry.includes('yemen') || lowerTitle.includes('yemen')) {
    return [
      { value: '21.6M', label: 'People in Need' },
      { value: '4.5M', label: 'Displaced' },
      { value: '17M', label: 'Food Insecure' },
      { value: '11M', label: 'Children in Need' },
    ];
  }

  // Sudan specific stats
  if (lowerCountry.includes('sudan') || lowerTitle.includes('sudan')) {
    return [
      { value: '24.8M', label: 'People in Need' },
      { value: '7.1M', label: 'Displaced' },
      { value: '18M', label: 'Facing Hunger' },
      { value: '14M', label: 'Children Affected' },
    ];
  }

  // Afghanistan specific stats
  if (lowerCountry.includes('afghanistan') || lowerTitle.includes('afghan')) {
    return [
      { value: '28.3M', label: 'People in Need' },
      { value: '6.3M', label: 'Displaced' },
      { value: '20M', label: 'Food Insecure' },
      { value: '3.2M', label: 'Children Malnourished' },
    ];
  }

  // Somalia specific stats
  if (lowerCountry.includes('somalia') || lowerTitle.includes('somalia')) {
    return [
      { value: '8.3M', label: 'People in Need' },
      { value: '3.8M', label: 'Displaced' },
      { value: '6.6M', label: 'Food Insecure' },
      { value: '1.8M', label: 'Children Malnourished' },
    ];
  }

  // Lebanon specific stats
  if (lowerCountry.includes('lebanon') || lowerTitle.includes('lebanon')) {
    return [
      { value: '4.0M', label: 'People in Need' },
      { value: '1.5M', label: 'Refugees Hosted' },
      { value: '80%', label: 'In Poverty' },
      { value: '2.2M', label: 'Food Insecure' },
    ];
  }

  // Turkey/Earthquake specific stats
  if (lowerCountry.includes('turkey') || lowerTitle.includes('türkiye') || lowerTitle.includes('earthquake')) {
    return [
      { value: '15.7M', label: 'People Affected' },
      { value: '3.3M', label: 'Displaced' },
      { value: '50K+', label: 'Lives Lost' },
      { value: '160K+', label: 'Buildings Destroyed' },
    ];
  }

  // Pakistan floods specific
  if ((lowerCountry.includes('pakistan') || lowerTitle.includes('pakistan')) && (lowerTitle.includes('flood') || category === 'emergencies')) {
    return [
      { value: '33M', label: 'People Affected' },
      { value: '8M', label: 'Displaced' },
      { value: '1,700+', label: 'Lives Lost' },
      { value: '2M', label: 'Homes Damaged' },
    ];
  }

  // Bangladesh specific
  if (lowerCountry.includes('bangladesh') || lowerTitle.includes('bangladesh') || lowerTitle.includes('rohingya')) {
    return [
      { value: '1.2M', label: 'Rohingya Refugees' },
      { value: '900K+', label: 'In Cox\'s Bazar' },
      { value: '52%', label: 'Are Children' },
      { value: '8 Years', label: 'In Exile' },
    ];
  }

  // East Africa / Horn of Africa
  if (lowerCountry.includes('africa') || lowerTitle.includes('africa') || lowerTitle.includes('horn')) {
    return [
      { value: '82M', label: 'People in Need' },
      { value: '36M', label: 'Food Insecure' },
      { value: '12M', label: 'Children Malnourished' },
      { value: '4.4M', label: 'Refugees' },
    ];
  }

  // Water projects
  if (category === 'water-for-life' || lowerTitle.includes('water')) {
    return [
      { value: '2.2B', label: 'Lack Safe Water' },
      { value: '4.2B', label: 'Lack Sanitation' },
      { value: '829K', label: 'Die Annually' },
      { value: '1.4M', label: 'Children At Risk' },
    ];
  }

  // Food aid
  if (category === 'food-aid' || lowerTitle.includes('food') || lowerTitle.includes('hunger')) {
    return [
      { value: '783M', label: 'Face Hunger' },
      { value: '345M', label: 'Acute Food Insecurity' },
      { value: '45M', label: 'Risk of Famine' },
      { value: '149M', label: 'Children Stunted' },
    ];
  }

  // Orphan sponsorship
  if (category === 'orphan-sponsorship' || lowerTitle.includes('orphan')) {
    return [
      { value: '153M', label: 'Orphans Worldwide' },
      { value: '15.1M', label: 'Lost Both Parents' },
      { value: '10%', label: 'Live in Institutions' },
      { value: '26K', label: 'Age Out Daily' },
    ];
  }

  // Education
  if (category === 'education' || lowerTitle.includes('education') || lowerTitle.includes('school')) {
    return [
      { value: '244M', label: 'Children Out of School' },
      { value: '617M', label: 'Can\'t Read Basics' },
      { value: '11M', label: 'Girls Not in School' },
      { value: '69M', label: 'Teachers Needed' },
    ];
  }

  // Healthcare
  if (category === 'healthcare' || lowerTitle.includes('health') || lowerTitle.includes('medical')) {
    return [
      { value: '4.5B', label: 'Lack Healthcare Access' },
      { value: '2B', label: 'No Essential Medicines' },
      { value: '5.9M', label: 'Child Deaths/Year' },
      { value: '300K', label: 'Maternal Deaths/Year' },
    ];
  }

  // Generic emergency fallback
  return [
    { value: '339M', label: 'People in Need Globally' },
    { value: '117M', label: 'Forcibly Displaced' },
      { value: '108M', label: 'Face Hunger Crisis' },
    { value: '$56.7B', label: 'Funding Required' },
  ];
}
