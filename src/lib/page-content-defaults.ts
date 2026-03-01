/**
 * Default page content for GreenWithYellowTemplate sections.
 * Used as fallback when campaign.template_config.pageContent is not set.
 * Shared between the frontend template and the admin editor.
 */

export interface PageContent {
  theCrisis: {
    heading: string;
    content: string;
  };
  howDonationHelps: {
    heading: string;
    items: Array<{ amount: string; label: string }>;
  };
  midCta: {
    heading: string;
    subtext: string;
    primaryButtonText: string;
    secondaryButtonText: string;
  };
  chooseYourImpact: {
    heading: string;
    subtext: string;
    singleTabText: string;
    monthlyTabText: string;
  };
  whyMonthly: {
    heading: string;
    benefits: string[];
    footerText: string;
  };
  faq: {
    heading: string;
    items: Array<{ question: string; answer: string }>;
  };
  finalCta: {
    heading: string;
    subtext: string;
    primaryButtonText: string;
    secondaryButtonText: string;
  };
}

export const DEFAULT_PAGE_CONTENT: PageContent = {
  theCrisis: {
    heading: 'The Crisis',
    content: '',
  },
  howDonationHelps: {
    heading: 'How Your Donation Helps',
    items: [],
  },
  midCta: {
    heading: 'Help a Family Today',
    subtext: 'Your gift delivers immediate relief to those who need it most.',
    primaryButtonText: 'Give Once',
    secondaryButtonText: 'Join Monthly',
  },
  chooseYourImpact: {
    heading: 'Choose Your Impact',
    subtext: 'Select an amount to add to your donation',
    singleTabText: 'Give Once',
    monthlyTabText: 'Monthly',
  },
  whyMonthly: {
    heading: 'Why Monthly Support Changes Everything',
    benefits: [
      'Plan long-term relief',
      'Reach more families',
      'Respond faster to emergencies',
      'Deliver consistent impact',
    ],
    footerText: 'Even $1/day creates lasting change. Cancel anytime.',
  },
  faq: {
    heading: 'Frequently Asked Questions',
    items: [
      {
        question: 'Where does my donation go?',
        answer: '100% of your donation goes directly to those in need. We maintain a strict 100% donation policy, meaning administrative costs are covered separately and never taken from your charitable contributions.',
      },
      {
        question: 'Is my donation tax-deductible?',
        answer: 'Yes. Qurbani Foundation USA is a registered 501(c)(3) nonprofit organization (EIN: 38-4109716). All donations are tax-deductible to the extent allowed by law. You will receive a donation receipt via email.',
      },
      {
        question: 'Can I cancel my monthly donation?',
        answer: 'Absolutely. You can cancel or modify your recurring donation at any time through the link in your donation receipt email, or by contacting us at info@qurbani.com or calling 1-800-900-0027.',
      },
      {
        question: 'How is my payment processed?',
        answer: 'All payments are processed securely through Stripe, a PCI-compliant payment processor used by millions of organizations worldwide. We accept all major credit and debit cards, as well as Apple Pay and Google Pay.',
      },
    ],
  },
  finalCta: {
    heading: 'Be the Change Today',
    subtext: 'Your generosity can transform lives and bring hope to families in need. Every donation makes a difference.',
    primaryButtonText: 'Give Today',
    secondaryButtonText: 'Join as Monthly Supporter',
  },
};
