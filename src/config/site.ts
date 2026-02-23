/**
 * SITE CONFIGURATION
 *
 * Edit this file to update:
 * - Logo
 * - Top bar (phone numbers, language)
 * - Header menu links
 * - Footer content
 * - Social media links
 * - Contact information
 */

export const siteConfig = {
  // ============================================
  // BRANDING
  // ============================================
  name: 'Qurbani Foundation USA',
  tagline: 'A Muslim Charity Serving Humanity',
  logo: 'https://www.staging9.qurbani.com/wp-content/uploads/2021/07/QurbaniFoundation-Logo-2.png',
  favicon: '/favicon.svg',

  // ============================================
  // CONTACT INFORMATION
  // ============================================
  contact: {
    phone: '+1 (703) 596-4900',
    tollFree: '1-800-900-0027',
    email: 'info@qurbani.com',
    address: {
      street: '145 Sherwood Ave',
      city: 'Teaneck',
      state: 'NJ',
      zip: '07666',
      country: 'USA',
    },
  },

  // ============================================
  // TOP BAR SETTINGS
  // ============================================
  topBar: {
    showPhone: true,
    showTollFree: true,
    showLanguage: true,
    showCurrency: true,
    defaultLanguage: 'EN',
    defaultCurrency: 'USD',
    backgroundColor: '#1a1a1a',
  },

  // ============================================
  // HEADER / NAVIGATION
  // ============================================
  navigation: {
    // Main menu items (excluding mega menu)
    mainMenu: [
      {
        label: 'ZAKAT',
        href: '/zakat',
        hasDropdown: true,
        dropdownItems: [
          { label: 'Pay Zakat', href: '/zakat' },
          { label: 'Zakat Calculator', href: '/zakat-calculator' },
          { label: 'Zakat FAQ', href: '/zakat-faq' },
        ],
      },
      {
        label: 'ABOUT US',
        href: '/about',
        hasDropdown: true,
        dropdownItems: [
          { label: 'Our Story', href: '/about' },
          { label: 'Our Team', href: '/about/team' },
          { label: 'Annual Reports', href: '/about/reports' },
        ],
      },
      { label: 'CONTACT US', href: '/contact', hasDropdown: false },
      { label: 'ZAKAT CALCULATOR', href: '/zakat-calculator', hasDropdown: false },
    ],

    // Donate button
    donateButton: {
      text: 'DONATE NOW',
      href: '/donate',
      backgroundColor: '#fdc448',
      hoverBackgroundColor: '#efb000',
      textColor: '#333',
    },
  },

  // ============================================
  // APPEALS MEGA MENU CATEGORIES
  // ============================================
  appealCategories: [
    { id: 'emergencies', title: 'Emergencies', color: '#c41e3a' },
    { id: 'sight', title: 'Sight Restoration Programme', color: '#01534d' },
    { id: 'water', title: 'Water for Life', color: '#01534d' },
    { id: 'food', title: 'Food Aid', color: '#01534d' },
    { id: 'orphan', title: 'Orphan Sponsorship', color: '#a67c52' },
    { id: 'education', title: 'Education', color: '#c9a227' },
    { id: 'sadaqah', title: 'Sadaqah Jariyah Gifting', color: '#01534d' },
    { id: 'neighbours', title: 'Neighbours First', color: '#7a7a7a' },
    { id: 'more', title: 'More Appeals', color: '#d4a5a5' },
  ],

  // ============================================
  // FOOTER SETTINGS
  // ============================================
  footer: {
    // About section
    about: {
      description: 'A Muslim charity dedicated to alleviating suffering of the world\'s poorest people. Operating in 53+ countries since 1999.',
      zakatPolicy: '100% Zakat Policy',
      ein: '38-4109716',
    },

    // Quick links
    quickLinks: [
      { label: 'Cataract Surgery', href: '/appeals/cataract-surgery' },
      { label: 'Water', href: '/appeals/water' },
      { label: 'Orphan Sponsorship', href: '/appeals/orphan-sponsorship' },
      { label: 'Education', href: '/appeals/education' },
      { label: 'Zakat', href: '/zakat' },
      { label: 'Sadaqah', href: '/sadaqah' },
      { label: 'Corporate Giving', href: '/corporate' },
    ],

    // Legal links
    legalLinks: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
      { label: 'Refund Policy', href: '/refund' },
      { label: 'Sitemap', href: '/sitemap' },
    ],

    // Newsletter
    newsletter: {
      enabled: true,
      title: 'Subscribe to Our Newsletter',
      subtitle: 'Stay updated with our latest appeals and impact stories',
      backgroundColor: '#255764',
    },

    // Copyright
    copyright: 'Qurbani Foundation USA. All rights reserved.',
  },

  // ============================================
  // SOCIAL MEDIA
  // ============================================
  social: {
    facebook: 'https://facebook.com/qurbani',
    youtube: 'https://youtube.com/qurbani',
    instagram: 'https://instagram.com/qurbani',
    twitter: 'https://twitter.com/qurbani',
  },

  // ============================================
  // BRAND COLORS
  // ============================================
  colors: {
    primary: '#01534d',      // Dark teal
    secondary: '#fdc448',    // Gold/Yellow
    accent: '#ef7c01',       // Orange
    dark: '#1a1a1a',         // Near black
    light: '#fbefdd',        // Cream
  },
};

export type SiteConfig = typeof siteConfig;
