/**
 * Mega Menu Library
 * Enterprise-level caching for menu data
 *
 * Performance strategy:
 * - Cache menu data in memory for 60 seconds (fast page loads)
 * - Single consolidated fetch for all navbar data
 * - Fallback to static data if database unavailable
 * - Admin endpoints bypass cache for immediate updates
 */

import { supabaseAdmin } from './supabase';

// Types
export interface MegaMenu {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  color: string;
  icon: string;
}

export interface MenuWidget {
  id: string;
  menu_id: string;
  position: 'left' | 'center' | 'right';
  widget_type: string;
  title: string | null;
  config: Record<string, any>;
  sort_order: number;
}

export interface NavbarData {
  menuOrder: string[];
  menuNames: Record<string, string>;
  menuColors: Record<string, string>;
  categories: Array<{
    id: string;
    slug: string;
    label: string;
    color: string;
    icon: string;
    menu: string;
  }>;
  campaignsByCategory: Record<string, Array<{
    slug: string;
    name: string;
    image: string;
    isPage?: boolean; // true for campaign_pages (standalone files), false/undefined for DB campaigns
  }>>;
  // Widgets grouped by menu_id and position
  widgets: Record<string, {
    left: MenuWidget[];
    center: MenuWidget[];
    right: MenuWidget[];
  }>;
  lastFetched: number;
}

// Cache configuration - manual clear only, no automatic expiration
const CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year (effectively permanent until manually cleared or server restart)

// In-memory cache
let navbarCache: NavbarData | null = null;

// Default fallback data
const defaultMenuOrder = ['our-work', 'zakat', 'appeals', 'about'];
const defaultMenuNames: Record<string, string> = {
  'our-work': 'Our Work',
  'zakat': 'Zakat',
  'appeals': 'Appeals',
  'about': 'About'
};
const defaultMenuColors: Record<string, string> = {
  'our-work': '#D97718',
  'zakat': '#0096D6',
  'appeals': '#024139',
  'about': '#D97718'
};

/**
 * Check if cache is valid
 */
function isCacheValid(): boolean {
  if (!navbarCache) return false;
  return Date.now() - navbarCache.lastFetched < CACHE_TTL_MS;
}

/**
 * Get all navbar data with caching
 * This consolidates multiple DB calls into one cached result
 */
export async function getNavbarData(): Promise<NavbarData> {
  // Return cached data if valid
  if (isCacheValid() && navbarCache) {
    return navbarCache;
  }

  try {
    // Fetch all data in parallel for speed
    const [menusResult, categoriesResult, campaignsResult, campaignPagesResult, widgetsResult] = await Promise.all([
      supabaseAdmin
        .from('mega_menus')
        .select('id, name, sort_order, color')
        .eq('is_active', true)
        .order('sort_order'),

      supabaseAdmin
        .from('categories')
        .select('id, slug, label, color, icon, menu')
        .eq('is_active', true)
        .eq('show_in_menu', true)
        .order('sort_order'),

      supabaseAdmin
        .from('campaigns')
        .select('slug, name, featured_image, hero_image_url, image_url, category, url_path')
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('sort_order', { ascending: true })
        .limit(100), // Limit total campaigns for performance

      // Also fetch campaign_pages (standalone donation pages)
      supabaseAdmin
        .from('campaign_pages')
        .select('slug, name, url_path, featured_image, category_id, categories(slug)')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),

      supabaseAdmin
        .from('menu_widgets')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
    ]);

    // Process menus
    const menuOrder: string[] = [];
    const menuNames: Record<string, string> = { ...defaultMenuNames };
    const menuColors: Record<string, string> = { ...defaultMenuColors };

    if (menusResult.data && menusResult.data.length > 0) {
      menusResult.data.forEach(m => {
        menuOrder.push(m.id);
        menuNames[m.id] = m.name;
        menuColors[m.id] = m.color;
      });
    } else {
      menuOrder.push(...defaultMenuOrder);
    }

    // Process categories
    const categories = (categoriesResult.data || []).map(cat => ({
      id: cat.id,
      slug: cat.slug,
      label: cat.label,
      color: cat.color,
      icon: cat.icon,
      menu: cat.menu || 'our-work'
    }));

    // Process campaigns AND campaign_pages (group by category, limit 8 per category)
    const campaignsByCategory: Record<string, Array<{ slug: string; name: string; image: string; isPage?: boolean }>> = {};

    // First, add campaign_pages (they appear first as they're core donation pages)
    if (campaignPagesResult.data) {
      campaignPagesResult.data.forEach((page: any) => {
        const catSlug = page.categories?.slug || 'other';
        if (!campaignsByCategory[catSlug]) {
          campaignsByCategory[catSlug] = [];
        }
        campaignsByCategory[catSlug].push({
          slug: page.url_path, // Use url_path for campaign pages (e.g., /fidya)
          name: page.name,
          image: page.featured_image || '',
          isPage: true
        });
      });
    }

    // Then add campaigns from the campaigns table
    if (campaignsResult.data) {
      campaignsResult.data.forEach(campaign => {
        const cat = campaign.category || 'other';
        if (!campaignsByCategory[cat]) {
          campaignsByCategory[cat] = [];
        }
        if (campaignsByCategory[cat].length < 8) {
          campaignsByCategory[cat].push({
            // Use url_path if set, otherwise build from category/slug
            slug: campaign.url_path || (campaign.category ? `/${campaign.category}/${campaign.slug}` : `/${campaign.slug}`),
            name: campaign.name,
            image: campaign.featured_image || campaign.hero_image_url || campaign.image_url || ''
          });
        }
      });
    }

    // Process widgets (group by menu_id and position)
    const widgets: Record<string, { left: MenuWidget[]; center: MenuWidget[]; right: MenuWidget[] }> = {};

    if (widgetsResult.data) {
      widgetsResult.data.forEach((widget: MenuWidget) => {
        if (!widgets[widget.menu_id]) {
          widgets[widget.menu_id] = { left: [], center: [], right: [] };
        }
        const position = widget.position as 'left' | 'center' | 'right';
        if (widgets[widget.menu_id][position]) {
          widgets[widget.menu_id][position].push(widget);
        }
      });
    }

    // Build cache object
    navbarCache = {
      menuOrder,
      menuNames,
      menuColors,
      categories,
      campaignsByCategory,
      widgets,
      lastFetched: Date.now()
    };

    return navbarCache;

  } catch (error) {
    console.error('Error fetching navbar data:', error);

    // Return fallback data
    return {
      menuOrder: defaultMenuOrder,
      menuNames: defaultMenuNames,
      menuColors: defaultMenuColors,
      categories: [],
      campaignsByCategory: {},
      widgets: {},
      lastFetched: Date.now()
    };
  }
}

/**
 * Clear the navbar cache
 * Call this when menus, categories, or campaigns are updated
 */
export function clearNavbarCache(): void {
  navbarCache = null;
}

/**
 * Get menu order only (lightweight, uses cache)
 */
export async function getMenuOrder(): Promise<string[]> {
  const data = await getNavbarData();
  return data.menuOrder;
}

/**
 * Get menu names only (lightweight, uses cache)
 */
export async function getMenuNames(): Promise<Record<string, string>> {
  const data = await getNavbarData();
  return data.menuNames;
}

/**
 * Check if a menu has any widgets configured
 */
export function hasWidgets(widgets: NavbarData['widgets'], menuId: string): boolean {
  const menuWidgets = widgets[menuId];
  if (!menuWidgets) return false;
  return menuWidgets.left.length > 0 || menuWidgets.center.length > 0 || menuWidgets.right.length > 0;
}

/**
 * Get widgets for a specific menu
 */
export function getMenuWidgets(widgets: NavbarData['widgets'], menuId: string): { left: MenuWidget[]; center: MenuWidget[]; right: MenuWidget[] } {
  return widgets[menuId] || { left: [], center: [], right: [] };
}
