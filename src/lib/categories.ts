/**
 * Categories Library
 * Centralized category fetching with in-memory caching for performance
 * Categories are cached for 5 minutes to minimize database calls
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
}

// In-memory cache for categories (server-side)
let categoriesCache: Category[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fallback categories if database is unavailable
const fallbackCategories: Category[] = [
  { id: '1', slug: 'emergencies', label: 'Emergencies', color: '#c41e3a', icon: 'emergency', description: null, is_active: true, show_in_menu: true, sort_order: 1 },
  { id: '2', slug: 'water-for-life', label: 'Water for Life', color: '#0891b2', icon: 'water', description: null, is_active: true, show_in_menu: true, sort_order: 2 },
  { id: '3', slug: 'food-aid', label: 'Food Aid', color: '#16a34a', icon: 'food', description: null, is_active: true, show_in_menu: true, sort_order: 3 },
  { id: '4', slug: 'orphan-sponsorship', label: 'Orphan Sponsorship', color: '#be123c', icon: 'orphan', description: null, is_active: true, show_in_menu: true, sort_order: 4 },
  { id: '5', slug: 'education', label: 'Education', color: '#ca8a04', icon: 'education', description: null, is_active: true, show_in_menu: true, sort_order: 5 },
  { id: '6', slug: 'healthcare', label: 'Healthcare', color: '#0b5d3a', icon: 'healthcare', description: null, is_active: true, show_in_menu: true, sort_order: 6 },
  { id: '7', slug: 'sadaqah-jariyah', label: 'Sadaqah Jariyah', color: '#2563eb', icon: 'sadaqah', description: null, is_active: true, show_in_menu: true, sort_order: 7 },
  { id: '8', slug: 'religious-giving', label: 'Religious Giving', color: '#01534d', icon: 'qurbani', description: null, is_active: true, show_in_menu: true, sort_order: 8 },
  { id: '9', slug: 'aqiqah', label: 'Aqiqah', color: '#7c3aed', icon: 'aqiqah', description: null, is_active: true, show_in_menu: true, sort_order: 9 },
];

/**
 * Get all active categories for the mega menu
 * Uses in-memory caching for performance
 */
export async function getMenuCategories(): Promise<Category[]> {
  const now = Date.now();

  // Return cached data if valid
  if (categoriesCache && (now - cacheTimestamp) < CACHE_TTL) {
    return categoriesCache;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .eq('show_in_menu', true)
      .order('sort_order');

    if (error) {
      console.error('Error fetching categories:', error.message);
      // Return fallback if cache is empty
      return categoriesCache || fallbackCategories;
    }

    // Update cache
    categoriesCache = data || fallbackCategories;
    cacheTimestamp = now;

    return categoriesCache;
  } catch (e) {
    console.error('Categories fetch failed:', e);
    return categoriesCache || fallbackCategories;
  }
}

/**
 * Get all categories (including inactive) for admin
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
  // Check cache first
  if (categoriesCache) {
    const cached = categoriesCache.find(c => c.slug === slug);
    if (cached) return cached;
  }

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
 * Clear the categories cache (call after updates)
 */
export function clearCategoriesCache(): void {
  categoriesCache = null;
  cacheTimestamp = 0;
}

/**
 * Icon SVG paths for rendering
 */
export const categoryIcons: Record<string, string> = {
  emergency: '<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"></path>',
  water: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"></path>',
  food: '<path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3z"></path>',
  orphan: '<path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>',
  education: '<path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"></path>',
  healthcare: '<path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path>',
  sadaqah: '<path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5z"></path>',
  qurbani: '<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>',
  aqiqah: '<path fill-rule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clip-rule="evenodd"></path><path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z"></path>',
  heart: '<path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path>',
};

export function getIconSvg(icon: string): string {
  return categoryIcons[icon] || categoryIcons.heart;
}
