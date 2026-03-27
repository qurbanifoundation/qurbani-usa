import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { title, category, country, section, donationOptions } = body;

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate content for a specific section or all sections
    const content = section
      ? { [section]: generateSection(section, title, category, country, donationOptions) }
      : generateAllContent(title, category, country, donationOptions);

    return new Response(JSON.stringify({ success: true, content }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

function generateSection(section: string, title: string, category: string, country: string, donationOptions: any[]): any {
  switch (section) {
    case 'theCrisis': return generateCrisis(title, category, country);
    case 'howDonationHelps': return generateDonationHelps(title, category, donationOptions);
    case 'midCta': return generateMidCta(title, category);
    case 'chooseYourImpact': return generateChooseImpact(title, category);
    case 'whyMonthly': return generateWhyMonthly(title, category);
    case 'faq': return generateFaq(title, category, country);
    case 'finalCta': return generateFinalCta(title, category);
    default: return {};
  }
}

function generateAllContent(title: string, category: string, country: string, donationOptions: any[]): any {
  return {
    theCrisis: generateCrisis(title, category, country),
    howDonationHelps: generateDonationHelps(title, category, donationOptions),
    midCta: generateMidCta(title, category),
    chooseYourImpact: generateChooseImpact(title, category),
    whyMonthly: generateWhyMonthly(title, category),
    faq: generateFaq(title, category, country),
    finalCta: generateFinalCta(title, category),
  };
}

// ─── Content Generators ─────────────────────────────────────────────────────

function generateCrisis(title: string, category: string, country: string): any {
  const lc = (title + ' ' + category + ' ' + country).toLowerCase();

  if (lc.includes('water') || lc.includes('thirst')) {
    return {
      heading: 'The Water Crisis',
      content: 'Every year, 3.57 million people die from water-related diseases, and 2.2 million of them are children under five. In many parts of Africa and Asia, families walk miles each day just to collect dirty water that makes them sick. Access to clean water is not a luxury — it is a basic human right that millions are still denied.',
    };
  }
  if (lc.includes('orphan') || lc.includes('sponsor')) {
    return {
      heading: 'The Orphan Crisis',
      content: 'Over 140 million children worldwide have lost one or both parents. Without support, these children face poverty, malnutrition, and lack of education. Many are forced into child labor or early marriage just to survive. Every orphan deserves a chance at a better future — a chance that begins with your sponsorship.',
    };
  }
  if (lc.includes('food') || lc.includes('hunger') || lc.includes('feed')) {
    return {
      heading: 'The Hunger Crisis',
      content: 'Globally, 828 million people go to bed hungry every night. Conflict, climate change, and economic instability have pushed millions to the brink of famine. Children are the most vulnerable — malnutrition is responsible for nearly half of all deaths in children under five. Your donation provides life-saving food to families who have nothing.',
    };
  }
  if (lc.includes('emergency') || lc.includes('relief') || lc.includes('crisis')) {
    return {
      heading: 'The Humanitarian Crisis',
      content: 'Millions of families are displaced, injured, and in desperate need of help. Natural disasters, conflict, and poverty have created unprecedented humanitarian emergencies across the globe. From emergency shelter to medical aid, your support provides critical assistance to those who need it most — right when they need it.',
    };
  }
  if (lc.includes('zakat')) {
    return {
      heading: 'The Obligation of Zakat',
      content: 'Zakat is the third pillar of Islam — an obligation upon every Muslim who meets the nisab threshold. It purifies your wealth and ensures that those in need receive their rightful share. With millions living below the poverty line, your Zakat reaches verified recipients across 15+ countries, providing food, shelter, healthcare, and education.',
    };
  }
  if (lc.includes('education') || lc.includes('school')) {
    return {
      heading: 'The Education Crisis',
      content: 'Over 250 million children worldwide are out of school. In conflict zones and impoverished regions, education is often the first casualty. Without education, children are trapped in a cycle of poverty with no way out. Your support builds schools, provides supplies, and trains teachers — giving children the foundation they need to build a better future.',
    };
  }
  if (lc.includes('health') || lc.includes('medical')) {
    return {
      heading: 'The Healthcare Crisis',
      content: 'Millions of people lack access to basic healthcare. In remote and conflict-affected areas, a simple illness can become a death sentence. Mothers die in childbirth, children suffer from preventable diseases, and the elderly are left without medication. Your donation funds mobile clinics, medical supplies, and healthcare workers who bring hope to the most vulnerable.',
    };
  }
  if (lc.includes('palestine') || lc.includes('gaza')) {
    return {
      heading: 'The Crisis in Palestine',
      content: 'The ongoing conflict in Gaza has created one of the worst humanitarian catastrophes in modern history. Over 2.3 million people are in need of urgent assistance — displaced from their homes, without access to food, clean water, or medical care. Children are bearing the heaviest burden. Your support provides emergency relief to families who have lost everything.',
    };
  }
  if (lc.includes('sudan')) {
    return {
      heading: 'The Sudan Crisis',
      content: 'Sudan is facing one of the world\'s largest displacement crises, with over 7 million people forced from their homes. Armed conflict has devastated communities, leaving millions without food, shelter, or medical care. Children are particularly vulnerable, with 14 million in urgent need of humanitarian assistance.',
    };
  }

  // Generic fallback
  return {
    heading: 'The Crisis',
    content: 'Millions of people around the world are facing unimaginable hardship. Poverty, conflict, and natural disasters have left families without food, clean water, shelter, or medical care. Every day, children go hungry, communities are destroyed, and hope fades. But with your generosity, we can change that — one family, one community, one life at a time.',
  };
}

function generateDonationHelps(title: string, category: string, donationOptions: any[]): any {
  // If donation options exist, use them
  if (donationOptions && donationOptions.length > 0) {
    return {
      heading: 'How Your Donation Helps',
      items: donationOptions.slice(0, 4).map((opt: any) => ({
        amount: '$' + (opt.amount || 0),
        label: opt.label || opt.description || 'Support a family in need',
      })),
    };
  }

  const lc = (title + ' ' + category).toLowerCase();

  if (lc.includes('water')) {
    return {
      heading: 'How Your Donation Helps',
      items: [
        { amount: '$300', label: 'Installs a water hand pump for 40 families' },
        { amount: '$400', label: 'Builds an electric water well for 600 people' },
        { amount: '$600', label: 'Constructs a deep water well for 60 families' },
      ],
    };
  }
  if (lc.includes('orphan')) {
    return {
      heading: 'How Your Donation Helps',
      items: [
        { amount: '$45/mo', label: 'Sponsors an orphan with food, education, and healthcare' },
        { amount: '$90/mo', label: 'Sponsors two orphans in the same community' },
        { amount: '$540', label: 'Covers a full year of care for one child' },
      ],
    };
  }
  if (lc.includes('food') || lc.includes('hunger')) {
    return {
      heading: 'How Your Donation Helps',
      items: [
        { amount: '$35', label: 'Feeds a family for a month' },
        { amount: '$70', label: 'Provides hot meals for 20 people' },
        { amount: '$150', label: 'Feeds an entire community for a week' },
      ],
    };
  }

  return {
    heading: 'How Your Donation Helps',
    items: [
      { amount: '$50', label: 'Provides immediate relief to a family in need' },
      { amount: '$100', label: 'Delivers essential supplies to a community' },
      { amount: '$250', label: 'Funds long-term support for vulnerable families' },
    ],
  };
}

function generateMidCta(title: string, category: string): any {
  const lc = (title + ' ' + category).toLowerCase();

  if (lc.includes('water')) return { heading: 'Give the Gift of Clean Water', subtext: 'Every drop counts. Your donation brings safe, clean water to families who need it most.', primaryButtonText: 'Donate Now', secondaryButtonText: 'Give Monthly' };
  if (lc.includes('orphan')) return { heading: 'Change a Child\'s Life Today', subtext: 'Your sponsorship provides food, education, healthcare, and hope to an orphan in need.', primaryButtonText: 'Sponsor Now', secondaryButtonText: 'Give Monthly' };
  if (lc.includes('food') || lc.includes('hunger')) return { heading: 'No Family Should Go Hungry', subtext: 'Your generosity puts food on the table for families who have nothing.', primaryButtonText: 'Feed a Family', secondaryButtonText: 'Give Monthly' };
  if (lc.includes('zakat')) return { heading: 'Purify Your Wealth, Transform Lives', subtext: '100% of your Zakat reaches verified recipients. Fulfill your obligation with confidence.', primaryButtonText: 'Pay Zakat Now', secondaryButtonText: 'Calculate Zakat' };
  if (lc.includes('emergency') || lc.includes('relief')) return { heading: 'Every Minute Counts', subtext: 'Families are in crisis right now. Your urgent donation provides immediate relief.', primaryButtonText: 'Donate Now', secondaryButtonText: 'Give Monthly' };

  return { heading: 'Make a Difference Today', subtext: 'Your generosity can transform lives and bring hope to families in need.', primaryButtonText: 'Donate Now', secondaryButtonText: 'Give Monthly' };
}

function generateChooseImpact(title: string, category: string): any {
  const lc = (title + ' ' + category).toLowerCase();

  if (lc.includes('water')) return { heading: 'Choose Your Impact', subtext: 'Select a water project to fund', singleTabText: 'GIVE ONCE', monthlyTabText: 'MONTHLY' };
  if (lc.includes('orphan')) return { heading: 'Choose Your Impact', subtext: 'Select your sponsorship level', singleTabText: 'GIVE ONCE', monthlyTabText: 'MONTHLY' };
  if (lc.includes('zakat')) return { heading: 'Choose Your Impact', subtext: 'Select an amount to give as Zakat', singleTabText: 'GIVE ONCE', monthlyTabText: 'MONTHLY' };

  return { heading: 'Choose Your Impact', subtext: 'Select an amount to add to your donation', singleTabText: 'GIVE ONCE', monthlyTabText: 'MONTHLY' };
}

function generateWhyMonthly(title: string, category: string): any {
  const lc = (title + ' ' + category).toLowerCase();

  const benefits = lc.includes('water')
    ? ['Fund ongoing water maintenance', 'Reach more communities', 'Ensure clean water year-round', 'Create lasting impact']
    : lc.includes('orphan')
    ? ['Provide consistent care for your child', 'Cover education and healthcare monthly', 'Build a long-term relationship', 'Create lasting change in their life']
    : lc.includes('food')
    ? ['Feed families consistently', 'Plan nutritional programs', 'Reduce food insecurity long-term', 'Create sustainable feeding programs']
    : ['Plan long-term relief programs', 'Reach more families in need', 'Respond faster to emergencies', 'Deliver consistent, reliable impact'];

  return {
    heading: 'Why Monthly Support Changes Everything',
    benefits,
    footerText: 'Even $1/day creates lasting change. Cancel anytime.',
  };
}

function generateFaq(title: string, category: string, country: string): any {
  const lc = (title + ' ' + category).toLowerCase();

  const items = [
    { question: 'Where does my donation go?', answer: '100% of your donation goes directly to those in need. We maintain a strict 100% donation policy, meaning administrative costs are covered separately and never taken from your charitable contributions.' },
    { question: 'Is my donation tax-deductible?', answer: 'Yes. Qurbani Foundation USA is a registered 501(c)(3) nonprofit organization (EIN: 38-4109716). All donations are tax-deductible to the extent allowed by law. You will receive a donation receipt via email.' },
    { question: 'Can I cancel my monthly donation?', answer: 'Absolutely. You can cancel or modify your recurring donation at any time through the link in your donation receipt email, or by contacting us at info@qurbani.com or calling 1-800-900-0027.' },
    { question: 'How is my payment processed?', answer: 'All payments are processed securely through Stripe, a PCI-compliant payment processor used by millions of organizations worldwide. We accept all major credit and debit cards, as well as Apple Pay and Google Pay.' },
  ];

  if (lc.includes('zakat')) {
    items.unshift({ question: 'Is this Zakat eligible?', answer: 'Yes, 100% of donations to this campaign are Zakat eligible. We ensure your Zakat reaches verified recipients who meet all Islamic criteria.' });
  }
  if (lc.includes('orphan')) {
    items.unshift({ question: 'Will I receive updates about my sponsored child?', answer: 'Yes! Within 4-6 weeks of your first payment, you will receive your child\'s profile including their name, age, and background story. You will then receive annual progress reports with updates on their education and wellbeing.' });
  }
  if (lc.includes('water')) {
    items.unshift({ question: 'How long does a water project last?', answer: 'Our water projects are built to last 15-20+ years with proper maintenance. We train local communities to maintain the infrastructure and conduct follow-up visits to ensure long-term functionality.' });
  }

  return { heading: 'Frequently Asked Questions', items };
}

function generateFinalCta(title: string, category: string): any {
  const lc = (title + ' ' + category).toLowerCase();

  if (lc.includes('water')) return { heading: 'Give Clean Water Today', subtext: 'Your generosity can bring the gift of clean, safe water to families who desperately need it. Every dollar makes a difference.', primaryButtonText: 'Donate Now', secondaryButtonText: 'Join as Monthly Supporter' };
  if (lc.includes('orphan')) return { heading: 'Be Their Hope Today', subtext: 'Your sponsorship can change the trajectory of a child\'s entire life. Give them the chance they deserve.', primaryButtonText: 'Sponsor Now', secondaryButtonText: 'Join as Monthly Supporter' };
  if (lc.includes('zakat')) return { heading: 'Fulfill Your Zakat Today', subtext: 'Your Zakat reaches those who need it most. 100% Zakat policy. Shariah compliant. Full transparency.', primaryButtonText: 'Pay Zakat Now', secondaryButtonText: 'Calculate Your Zakat' };

  return { heading: 'Be the Change Today', subtext: 'Your generosity can transform lives and bring hope to families in need. Every donation makes a difference.', primaryButtonText: 'Give Today', secondaryButtonText: 'Join as Monthly Supporter' };
}
