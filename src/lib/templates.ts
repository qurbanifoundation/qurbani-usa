/**
 * Template Utilities
 * Centralized template fetching from database
 * All template dropdowns should use these functions
 *
 * HOW TO ADD A NEW TEMPLATE:
 * 1. Create the template component in /src/templates/ (e.g., NewTemplate.astro)
 * 2. Add to database: INSERT INTO template_options (template_type, template_key, template_label, sort_order)
 *    VALUES ('page', 'new-template-key', 'New Template Label', 3);
 * 3. Update /src/pages/campaigns/[slug].astro and /src/pages/appeals/[slug].astro
 *    to import and conditionally render the new template
 *
 * After step 2, the template will automatically appear in all admin dropdowns.
 * Step 3 is required for the template to actually render on campaign pages.
 */

import { supabaseAdmin } from './supabase';

export interface TemplateOption {
  id: number;
  template_type: 'page' | 'donation_box' | 'checkout';
  template_key: string;
  template_label: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

/**
 * Fetch all page template options from database
 */
export async function getPageTemplates(): Promise<TemplateOption[]> {
  const { data, error } = await supabaseAdmin
    .from('template_options')
    .select('*')
    .eq('template_type', 'page')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('Error fetching page templates:', error);
    // Return fallback options if database fails
    return [
      { id: 1, template_type: 'page', template_key: 'green-with-yellow', template_label: 'Sticky Sidebar', description: null, is_active: true, sort_order: 1 },
      { id: 2, template_type: 'page', template_key: 'emergency-appeal', template_label: 'Urgent Appeal', description: null, is_active: true, sort_order: 2 },
      { id: 3, template_type: 'page', template_key: 'orphan-sponsorship', template_label: 'Orphan Sponsorship', description: 'High-converting orphan sponsorship page with quantity selector', is_active: true, sort_order: 3 },
    ];
  }

  return data || [];
}

/**
 * Fetch all donation box template options from database
 */
export async function getDonationBoxTemplates(): Promise<TemplateOption[]> {
  const { data, error } = await supabaseAdmin
    .from('template_options')
    .select('*')
    .eq('template_type', 'donation_box')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('Error fetching donation box templates:', error);
    // Return fallback options if database fails
    return [
      { id: 1, template_type: 'donation_box', template_key: 'teal-yellow', template_label: 'Teal Yellow', description: null, is_active: true, sort_order: 1 },
      { id: 2, template_type: 'donation_box', template_key: 'dark-teal', template_label: 'Dark Teal', description: null, is_active: true, sort_order: 2 },
      { id: 3, template_type: 'donation_box', template_key: 'white', template_label: 'White', description: null, is_active: true, sort_order: 3 },
      { id: 4, template_type: 'donation_box', template_key: 'list-style', template_label: 'List Style', description: null, is_active: true, sort_order: 4 },
      { id: 5, template_type: 'donation_box', template_key: 'urgent-appeal', template_label: 'Urgent Appeal', description: null, is_active: true, sort_order: 5 },
      { id: 6, template_type: 'donation_box', template_key: 'cw-donation', template_label: 'CW Donation', description: 'charity:water-inspired with monthly upsell', is_active: true, sort_order: 6 },
      { id: 7, template_type: 'donation_box', template_key: 'home-donation', template_label: 'Home Donation Box', description: 'Original homepage widget with matching banner, social proof, and fund selector', is_active: true, sort_order: 7 },
    ];
  }

  return data || [];
}

/**
 * Fetch checkout template options from database
 */
export async function getCheckoutTemplates(): Promise<TemplateOption[]> {
  const { data, error } = await supabaseAdmin
    .from('template_options')
    .select('*')
    .eq('template_type', 'checkout')
    .eq('is_active', true)
    .order('sort_order');

  if (error || !data || data.length === 0) {
    console.error('Error fetching checkout templates:', error);
    return [
      { id: 1, template_type: 'checkout', template_key: 'three-step', template_label: '3-Step Checkout', description: 'Side Cart → Information → Payment (current default)', is_active: true, sort_order: 1 },
      { id: 2, template_type: 'checkout', template_key: 'two-step', template_label: '1-Step Checkout', description: 'Direct single-page checkout with info + payment combined', is_active: true, sort_order: 2 },
    ];
  }

  return data || [];
}

/**
 * Fetch all template options (both page and donation box)
 */
export async function getAllTemplates(): Promise<{ pageTemplates: TemplateOption[], donationBoxTemplates: TemplateOption[] }> {
  const [pageTemplates, donationBoxTemplates] = await Promise.all([
    getPageTemplates(),
    getDonationBoxTemplates(),
  ]);

  return { pageTemplates, donationBoxTemplates };
}

/**
 * Fetch orphan sponsorship template options from database
 */
export async function getOrphanSponsorshipTemplates(): Promise<TemplateOption[]> {
  const { data, error } = await supabaseAdmin
    .from('template_options')
    .select('*')
    .eq('template_type', 'orphan_sponsorship')
    .eq('is_active', true)
    .order('sort_order');

  if (error || !data || data.length === 0) {
    console.error('Error fetching orphan sponsorship templates:', error);
    // Return fallback options if database fails
    return [
      { id: 1, template_type: 'orphan_sponsorship' as any, template_key: 'orphan-sponsorship', template_label: 'ListStyle Sponsorship', description: 'High-converting page with country selection and quantity picker', is_active: true, sort_order: 1 },
      { id: 2, template_type: 'orphan_sponsorship' as any, template_key: 'tilestack-sponsorship', template_label: 'TileStack Sponsorship', description: 'Tile-based selection with social proof', is_active: true, sort_order: 2 },
    ];
  }

  return data || [];
}

/**
 * Fetch appeals page template options from database
 */
export async function getAppealsPageTemplates(): Promise<TemplateOption[]> {
  const { data, error } = await supabaseAdmin
    .from('template_options')
    .select('*')
    .eq('template_type', 'appeals_page')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('Error fetching appeals page templates:', error);
    // Return fallback options if database fails
    return [
      { id: 1, template_type: 'appeals_page' as any, template_key: 'green', template_label: 'Green (Teal)', description: 'Teal/blue color scheme', is_active: true, sort_order: 1 },
      { id: 2, template_type: 'appeals_page' as any, template_key: 'orange', template_label: 'Orange', description: 'Orange color scheme', is_active: true, sort_order: 2 },
    ];
  }

  // If no templates in database, return fallback
  if (!data || data.length === 0) {
    return [
      { id: 1, template_type: 'appeals_page' as any, template_key: 'green', template_label: 'Green (Teal)', description: 'Teal/blue color scheme', is_active: true, sort_order: 1 },
      { id: 2, template_type: 'appeals_page' as any, template_key: 'orange', template_label: 'Orange', description: 'Orange color scheme', is_active: true, sort_order: 2 },
    ];
  }

  return data || [];
}

/**
 * Fetch Ramadan page template options from database
 */
export async function getRamadanPageTemplates(): Promise<TemplateOption[]> {
  const { data, error } = await supabaseAdmin
    .from('template_options')
    .select('*')
    .eq('template_type', 'ramadan_page')
    .eq('is_active', true)
    .order('sort_order');

  if (error || !data || data.length === 0) {
    console.error('Error fetching Ramadan page templates:', error);
    // Return fallback options if database fails
    return [
      { id: 1, template_type: 'ramadan_page' as any, template_key: 'pennyappeal', template_label: 'PennyAppeal Style', description: 'Original 30 Days of Ramadan wizard with green theme, daily giving automation, multipliers, and Night 27 options', is_active: true, sort_order: 1 },
      { id: 2, template_type: 'ramadan_page' as any, template_key: 'amanah', template_label: 'Amanah Style', description: 'Modern mobile-first 6-step wizard with cloud background, amplify options, and streamlined checkout', is_active: true, sort_order: 2 },
    ];
  }

  return data || [];
}

/**
 * Fetch homepage template options from database
 */
export async function getHomepageTemplates(): Promise<TemplateOption[]> {
  const { data, error } = await supabaseAdmin
    .from('template_options')
    .select('*')
    .eq('template_type', 'homepage')
    .eq('is_active', true)
    .order('sort_order');

  if (error || !data || data.length === 0) {
    console.error('Error fetching homepage templates:', error);
    // Return fallback options if database fails
    return [
      { id: 1, template_type: 'homepage' as any, template_key: 'pennybill', template_label: 'Pennybill', description: 'Professional charity homepage with hero carousel, animated stats, and donation widget', is_active: true, sort_order: 1 },
      { id: 2, template_type: 'homepage' as any, template_key: 'immersive', template_label: 'Immersive', description: 'Full-screen hero with parallax effects, horizontal scroll carousel, and modern amber/orange design', is_active: true, sort_order: 2 },
      { id: 3, template_type: 'homepage' as any, template_key: 'almustafa', template_label: 'Almustafa', description: 'Professional charity homepage with orphan sponsorship widget, 100% Zakat section, impact stats, and appeals grid', is_active: true, sort_order: 3 },
    ];
  }

  return data || [];
}
