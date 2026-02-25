/**
 * Categories Library
 * Centralized category fetching with in-memory caching for performance
 * Manual cache clear only - maximum performance
 */

import { supabaseAdmin } from './supabase';

export interface Category {
  id: string;
  slug: string;
  label: string;
  color: string;
  icon: string;
  description: string | null;
  is_active: boolean;
  show_in_menu: boolean;
  sort_order: number;
  menu?: string; // Which header menu this category belongs to (our-work, zakat, ramadan, about)
}

// Cache configuration - manual clear only for maximum performance
let categoriesCache: Category[] | null = null;
let categoriesCacheTime: number = 0;
const CACHE_TTL = 365 * 24 * 60 * 60 * 1000; // 1 year (effectively permanent until manually cleared)

// Fallback categories if database is unavailable
const fallbackCategories: Category[] = [
  { id: '1', slug: 'appeals', label: 'Emergency Appeal', color: '#c41e3a', icon: 'emergency', description: null, is_active: true, show_in_menu: true, sort_order: 1, menu: 'our-work' },
  { id: '2', slug: 'water-aid', label: 'Water Aid', color: '#0891b2', icon: 'water', description: null, is_active: true, show_in_menu: true, sort_order: 2, menu: 'our-work' },
  { id: '3', slug: 'food-aid', label: 'Food Aid', color: '#16a34a', icon: 'food', description: null, is_active: true, show_in_menu: true, sort_order: 3, menu: 'our-work' },
  { id: '4', slug: 'orphan-sponsorship', label: 'Orphan Sponsorship', color: '#be123c', icon: 'orphan', description: null, is_active: true, show_in_menu: true, sort_order: 4, menu: 'our-work' },
  { id: '5', slug: 'education', label: 'Education', color: '#ca8a04', icon: 'education', description: null, is_active: true, show_in_menu: true, sort_order: 5, menu: 'our-work' },
  { id: '6', slug: 'healthcare', label: 'Healthcare', color: '#0b5d3a', icon: 'healthcare', description: null, is_active: true, show_in_menu: true, sort_order: 6, menu: 'our-work' },
  { id: '7', slug: 'sadaqah-jariyah', label: 'Sadaqah Jariyah', color: '#2563eb', icon: 'sadaqah', description: null, is_active: true, show_in_menu: true, sort_order: 7, menu: 'our-work' },
  { id: '8', slug: 'islamic-giving', label: 'Islamic Giving', color: '#01534d', icon: 'qurbani', description: null, is_active: true, show_in_menu: true, sort_order: 8, menu: 'our-work' },
];

/**
 * Get all active categories for the mega menu
 * Cached for maximum performance - use clearCategoriesCache() after admin changes
 */
export async function getMenuCategories(): Promise<Category[]> {
  // Return cached data if valid
  if (categoriesCache && (Date.now() - categoriesCacheTime < CACHE_TTL)) {
    return categoriesCache.filter(c => c.is_active && c.show_in_menu);
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('sort_order');

    if (error) {
      console.error('Error fetching categories:', error.message);
      return categoriesCache?.filter(c => c.is_active && c.show_in_menu) || fallbackCategories;
    }

    // Cache all categories
    categoriesCache = data || fallbackCategories;
    categoriesCacheTime = Date.now();

    return categoriesCache.filter(c => c.is_active && c.show_in_menu);
  } catch (e) {
    console.error('Categories fetch failed:', e);
    return categoriesCache?.filter(c => c.is_active && c.show_in_menu) || fallbackCategories;
  }
}

/**
 * Get all categories (including inactive) for admin
 * Always fetches fresh for admin pages
 */
export async function getAllCategories(): Promise<Category[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('sort_order');

    if (error) {
      console.error('Error fetching all categories:', error.message);
      return fallbackCategories;
    }

    // Update cache with fresh data
    categoriesCache = data || fallbackCategories;
    categoriesCacheTime = Date.now();

    return data || [];
  } catch (e) {
    console.error('Categories fetch failed:', e);
    return fallbackCategories;
  }
}

/**
 * Get a single category by slug
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) return null;
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * Clear the categories cache
 * Call this from admin after making changes
 */
export function clearCategoriesCache(): void {
  categoriesCache = null;
  categoriesCacheTime = 0;
}

/**
 * Icon SVG paths for rendering
 */
export const categoryIcons: Record<string, string> = {
  // Category icons
  emergency: '<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"></path>',
  water: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"></path>',
  food: '<path fill-rule="evenodd" d="M6 3a1 1 0 011-1h.01a1 1 0 010 2H7a1 1 0 01-1-1zm2 3a1 1 0 00-2 0v1a2 2 0 00-2 2v1a2 2 0 00-2 2v.683a3.7 3.7 0 011.055.485 1.704 1.704 0 001.89 0 3.704 3.704 0 014.11 0 1.704 1.704 0 001.89 0 3.704 3.704 0 014.11 0 1.704 1.704 0 001.89 0A3.7 3.7 0 0118 12.683V12a2 2 0 00-2-2V9a2 2 0 00-2-2V6a1 1 0 10-2 0v1h-1V6a1 1 0 10-2 0v1H8V6zm10 8.868a3.704 3.704 0 01-4.055-.036 1.704 1.704 0 00-1.89 0 3.704 3.704 0 01-4.11 0 1.704 1.704 0 00-1.89 0A3.704 3.704 0 012 14.868V17a1 1 0 001 1h14a1 1 0 001-1v-2.132z" clip-rule="evenodd"></path>',
  orphan: '<path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>',
  education: '<path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"></path>',
  healthcare: '<path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path>',
  sadaqah: '<path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5z"></path>',
  qurbani: '<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>',
  aqiqah: '<path fill-rule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clip-rule="evenodd"></path><path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z"></path>',
  heart: '<path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path>',

  // Additional icons for widgets
  user: '<path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>',
  document: '<path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clip-rule="evenodd"></path>',
  image: '<path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path>',
  email: '<path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>',
  money: '<path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"></path>',
  calculator: '<path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 1a1 1 0 10-2 0v2a1 1 0 102 0v-2zm-3-1a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z"></path>',
  question: '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path>',
  book: '<path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"></path>',
  gold: '<path fill-rule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clip-rule="evenodd"></path>',
  'shopping-bag': '<path d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z"></path>',
  moon: '<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>',
  star: '<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>',
  'x-circle': '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>',
};

export function getIconSvg(icon: string): string {
  return categoryIcons[icon] || categoryIcons.heart;
}
