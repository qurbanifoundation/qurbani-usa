/**
 * Shared donation box defaults — used by CWDonationBox component and admin campaign editor
 * to auto-generate impact texts and default monthly impact text based on campaign slug.
 */

export function generateImpactTexts(slug: string): { monthly: Record<number, string>; single: Record<number, string> } {
  const s = slug.toLowerCase();

  if (s.includes('water') || s.includes('well')) {
    return {
      monthly: {
        10: 'Provides <strong>clean water</strong> to 12 people every year',
        20: 'Provides <strong>clean water</strong> to 24 people every year',
        40: 'Provides <strong>clean water</strong> to a village every year',
        100: 'Can help <strong>fund an entire water well</strong> project'
      },
      single: {
        50: 'Provides <strong>clean water</strong> to 6 people',
        100: 'Provides <strong>clean water</strong> to 12 people',
        150: 'Helps <strong>build a community water well</strong>',
        200: 'Brings <strong>lasting clean water access</strong> to a community'
      }
    };
  }

  if (s.includes('sudan')) {
    return {
      monthly: {
        10: 'Provides <strong>emergency food</strong> to a family in Sudan monthly',
        20: 'Delivers <strong>medical supplies</strong> to displaced Sudanese families',
        40: 'Supports <strong>shelter and essentials</strong> for a Sudanese family',
        100: 'Provides <strong>comprehensive relief</strong> to multiple families in Sudan'
      },
      single: {
        50: 'Delivers <strong>emergency food packs</strong> to families in Sudan',
        100: 'Provides <strong>medical aid</strong> to displaced Sudanese families',
        150: 'Supplies <strong>shelter and clean water</strong> to a family in crisis',
        200: 'Delivers <strong>life-saving relief</strong> to families in Sudan'
      }
    };
  }

  if (s.includes('gaza') || s.includes('palestin')) {
    return {
      monthly: {
        10: 'Delivers <strong>food and water</strong> to families in Gaza monthly',
        20: 'Provides <strong>medical supplies</strong> to hospitals in Gaza',
        40: 'Supports <strong>displaced families</strong> with shelter and essentials',
        100: 'Provides <strong>comprehensive relief</strong> to families in Palestine'
      },
      single: {
        50: 'Delivers <strong>emergency food packs</strong> to families in Gaza',
        100: 'Provides <strong>medical aid</strong> for injured civilians',
        150: 'Supplies <strong>shelter materials</strong> for displaced families',
        200: 'Delivers <strong>life-saving aid</strong> to families in Gaza'
      }
    };
  }

  if (s.includes('syria')) {
    return {
      monthly: {
        10: 'Provides <strong>food and warmth</strong> to Syrian families monthly',
        20: 'Delivers <strong>medical care</strong> to displaced Syrian families',
        40: 'Supports <strong>refugee families</strong> with shelter and nutrition',
        100: 'Provides <strong>comprehensive relief</strong> to Syrian communities'
      },
      single: {
        50: 'Delivers <strong>emergency supplies</strong> to Syrian families',
        100: 'Provides <strong>winter relief kits</strong> to families in need',
        150: 'Supports <strong>medical clinics</strong> serving Syrian refugees',
        200: 'Delivers <strong>life-saving aid</strong> to families in Syria'
      }
    };
  }

  if (s.includes('yemen')) {
    return {
      monthly: {
        10: 'Provides <strong>food aid</strong> to a family in Yemen monthly',
        20: 'Delivers <strong>clean water and nutrition</strong> to Yemeni children',
        40: 'Supports <strong>healthcare access</strong> for families in Yemen',
        100: 'Provides <strong>comprehensive relief</strong> to Yemeni communities'
      },
      single: {
        50: 'Delivers <strong>emergency food packs</strong> to families in Yemen',
        100: 'Provides <strong>nutrition support</strong> for malnourished children',
        150: 'Supplies <strong>medical aid</strong> to families in crisis',
        200: 'Delivers <strong>life-saving relief</strong> to families in Yemen'
      }
    };
  }

  if (s.includes('zakat')) {
    return {
      monthly: {
        10: 'Your Zakat reaches <strong>those most in need</strong> every month',
        20: 'Helps fulfill <strong>Zakat obligations</strong> to the most vulnerable',
        40: 'Your Zakat provides <strong>essential support</strong> to eligible recipients',
        100: 'Distributes your <strong>Zakat to multiple families</strong> in need'
      },
      single: {
        50: 'Your Zakat directly <strong>supports families</strong> in need',
        100: 'Provides <strong>essential aid</strong> to Zakat-eligible recipients',
        150: 'Your Zakat <strong>transforms lives</strong> of those most in need',
        200: 'Distributes <strong>life-changing Zakat</strong> to vulnerable communities'
      }
    };
  }

  if (s.includes('ramadan') || s.includes('fasting') || s.includes('iftar') || s.includes('fidya') || s.includes('kaffarah') || s.includes('fitr')) {
    return {
      monthly: {
        10: 'Provides <strong>iftar meals</strong> throughout the blessed month',
        20: 'Feeds <strong>a family</strong> during Ramadan every month',
        40: 'Delivers <strong>Ramadan food packs</strong> to families in need',
        100: 'Sponsors <strong>community iftars</strong> for those fasting in poverty'
      },
      single: {
        50: 'Provides <strong>iftar meals</strong> for families during Ramadan',
        100: 'Delivers <strong>Ramadan food packs</strong> to multiple families',
        150: 'Sponsors <strong>community iftars</strong> and food distribution',
        200: 'Feeds <strong>entire communities</strong> during the blessed month'
      }
    };
  }

  if (s.includes('orphan')) {
    return {
      monthly: {
        10: 'Provides <strong>meals and care</strong> to an orphan each month',
        20: 'Supports an orphan with <strong>food, clothing and education</strong>',
        40: 'Sponsors <strong>an orphan\'s essential needs</strong> every month',
        100: '<strong>Fully sponsors an orphan</strong> with education and healthcare'
      },
      single: {
        50: 'Provides <strong>essential supplies</strong> to orphaned children',
        100: 'Supports <strong>an orphan\'s education</strong> and wellbeing',
        150: 'Delivers <strong>comprehensive care</strong> to orphaned children',
        200: 'Provides <strong>lasting support</strong> to orphans in need'
      }
    };
  }

  if (s.includes('food') || s.includes('feed') || s.includes('meal') || s.includes('hunger')) {
    return {
      monthly: {
        10: 'Provides <strong>nutritious meals</strong> to a family each month',
        20: 'Feeds <strong>multiple families</strong> with food packs monthly',
        40: 'Delivers <strong>sustained nutrition</strong> to families in need',
        100: 'Feeds <strong>an entire community</strong> every month'
      },
      single: {
        50: 'Provides <strong>food packs</strong> to families in need',
        100: 'Delivers <strong>nutritious meals</strong> to multiple families',
        150: 'Feeds <strong>a community</strong> with essential food supplies',
        200: 'Provides <strong>sustained food aid</strong> to vulnerable families'
      }
    };
  }

  if (s.includes('school') || s.includes('education') || s.includes('quran')) {
    return {
      monthly: {
        10: 'Provides <strong>school supplies</strong> to a child each month',
        20: 'Supports <strong>a child\'s education</strong> with books and materials',
        40: 'Sponsors <strong>a student\'s tuition</strong> and learning needs',
        100: 'Funds <strong>education for multiple children</strong> every month'
      },
      single: {
        50: 'Provides <strong>educational materials</strong> to children in need',
        100: 'Supports <strong>a child\'s full school year</strong> of learning',
        150: 'Funds <strong>classroom resources</strong> for an entire school',
        200: 'Provides <strong>transformative education</strong> to a community'
      }
    };
  }

  if (s.includes('medical') || s.includes('health') || s.includes('clinic') || s.includes('eye-care')) {
    return {
      monthly: {
        10: 'Provides <strong>basic medical care</strong> to patients monthly',
        20: 'Delivers <strong>essential medications</strong> to families in need',
        40: 'Supports <strong>mobile clinic operations</strong> every month',
        100: 'Funds <strong>comprehensive healthcare</strong> for communities'
      },
      single: {
        50: 'Provides <strong>medical treatment</strong> to patients in need',
        100: 'Delivers <strong>essential medical supplies</strong> to clinics',
        150: 'Supports <strong>life-saving surgeries</strong> for those in need',
        200: 'Funds <strong>comprehensive medical care</strong> for a community'
      }
    };
  }

  if (s.includes('qurbani') || s.includes('aqiqah') || s.includes('udhiyah')) {
    return {
      monthly: {
        10: 'Contributes to <strong>Qurbani distribution</strong> for families',
        20: 'Helps deliver <strong>fresh meat</strong> to families in need',
        40: 'Supports <strong>Qurbani for a family</strong> each month',
        100: 'Provides <strong>Qurbani to multiple families</strong> in need'
      },
      single: {
        50: 'Contributes to <strong>Qurbani</strong> for families in need',
        100: 'Provides <strong>a full Qurbani share</strong> for a family',
        150: 'Delivers <strong>Qurbani meat</strong> to multiple families',
        200: 'Sponsors <strong>Qurbani for an entire community</strong>'
      }
    };
  }

  if (s.includes('mosque') || s.includes('masjid')) {
    return {
      monthly: {
        10: 'Supports <strong>mosque maintenance</strong> and upkeep monthly',
        20: 'Contributes to <strong>community prayer spaces</strong> each month',
        40: 'Helps <strong>build and maintain masjids</strong> for communities',
        100: 'Supports <strong>mosque construction</strong> as Sadaqah Jariyah'
      },
      single: {
        50: 'Contributes to <strong>mosque construction</strong> efforts',
        100: 'Supports <strong>building a house of Allah</strong> for a community',
        150: 'Funds <strong>mosque facilities</strong> for a growing community',
        200: 'Provides <strong>lasting Sadaqah Jariyah</strong> through a masjid'
      }
    };
  }

  if (s.includes('sadaqah') || s.includes('sadaqa') || s.includes('jariyah')) {
    return {
      monthly: {
        10: 'Plants seeds of <strong>ongoing charity</strong> every month',
        20: 'Your <strong>Sadaqah Jariyah</strong> creates lasting impact',
        40: 'Builds <strong>lasting charitable projects</strong> each month',
        100: 'Funds <strong>transformative Sadaqah Jariyah</strong> projects'
      },
      single: {
        50: 'Provides <strong>ongoing charity</strong> that keeps giving',
        100: 'Your <strong>Sadaqah Jariyah</strong> creates lasting change',
        150: 'Builds <strong>sustainable projects</strong> for communities',
        200: 'Creates <strong>lasting impact</strong> as continuous charity'
      }
    };
  }

  if (s.includes('emergency') || s.includes('crisis') || s.includes('relief') || s.includes('disaster')) {
    return {
      monthly: {
        10: 'Delivers <strong>emergency aid</strong> to families each month',
        20: 'Provides <strong>relief supplies</strong> to disaster-affected families',
        40: 'Supports <strong>emergency response</strong> operations monthly',
        100: 'Funds <strong>comprehensive relief</strong> for communities in crisis'
      },
      single: {
        50: 'Delivers <strong>immediate emergency relief</strong> to families',
        100: 'Provides <strong>life-saving supplies</strong> in times of crisis',
        150: 'Supports <strong>emergency shelter and aid</strong> for families',
        200: 'Delivers <strong>comprehensive emergency relief</strong> to communities'
      }
    };
  }

  // Default / general / where-needed
  return {
    monthly: {
      10: 'Your monthly gift <strong>transforms lives</strong> around the world',
      20: 'Provides <strong>essential support</strong> where it\'s needed most',
      40: 'Delivers <strong>lasting change</strong> to communities in need',
      100: 'Creates <strong>transformative impact</strong> across multiple programs'
    },
    single: {
      50: 'Provides <strong>essential aid</strong> where it\'s needed most',
      100: 'Delivers <strong>meaningful support</strong> to those in need',
      150: 'Your generosity <strong>changes lives</strong> across communities',
      200: 'Creates <strong>lasting impact</strong> for vulnerable families'
    }
  };
}

export function getDefaultMonthlyImpact(slug: string): string {
  const s = slug.toLowerCase();
  if (s.includes('water') || s.includes('well')) return 'Gives <strong>clean water</strong> to people in need every year';
  if (s.includes('sudan')) return 'Delivers <strong>emergency relief</strong> to families in Sudan';
  if (s.includes('gaza') || s.includes('palestin')) return 'Provides <strong>life-saving aid</strong> to families in Gaza';
  if (s.includes('syria')) return 'Supports <strong>Syrian families</strong> with essential relief';
  if (s.includes('yemen')) return 'Delivers <strong>critical aid</strong> to families in Yemen';
  if (s.includes('zakat')) return 'Fulfills your <strong>Zakat</strong> to those most in need';
  if (s.includes('orphan')) return 'Supports <strong>orphaned children</strong> with love and care';
  if (s.includes('ramadan') || s.includes('iftar')) return 'Feeds <strong>families</strong> during the blessed month';
  if (s.includes('qurbani') || s.includes('aqiqah')) return 'Delivers <strong>Qurbani</strong> to families in need';
  if (s.includes('food') || s.includes('feed') || s.includes('meal')) return 'Provides <strong>nutritious meals</strong> to families in need';
  if (s.includes('education') || s.includes('school')) return 'Supports <strong>children\'s education</strong> and future';
  if (s.includes('medical') || s.includes('health')) return 'Provides <strong>medical care</strong> to those in need';
  if (s.includes('mosque') || s.includes('masjid')) return 'Builds <strong>houses of Allah</strong> for communities';
  if (s.includes('sadaqah') || s.includes('jariyah')) return 'Creates <strong>lasting charity</strong> that keeps giving';
  if (s.includes('emergency') || s.includes('crisis')) return 'Delivers <strong>emergency aid</strong> to communities in crisis';
  return 'Your generosity <strong>transforms lives</strong> around the world';
}

export const DEFAULT_MONTHLY_AMOUNTS = [10, 20, 40, 100];
export const DEFAULT_ONETIME_AMOUNTS = [50, 100, 150, 200];
export const DEFAULT_UPSELL_BODY = "By making a monthly donation, you'll empower us to make long-term investments to bring clean water to more families around the world.";
export const DEFAULT_UPSELL_SUBTEXT = 'Please consider joining our monthly giving community. Monthly donors are our most impactful and committed supporters.';
export const DEFAULT_BUTTON_MONTHLY = 'JOIN TODAY';
export const DEFAULT_BUTTON_ONETIME = 'GIVE';
