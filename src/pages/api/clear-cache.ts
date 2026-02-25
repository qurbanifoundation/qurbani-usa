import type { APIRoute } from 'astro';
import { clearNavbarCache } from '../../lib/menus';
import { clearSettingsCache } from '../../lib/settings';
import { clearCategoriesCache } from '../../lib/categories';

export const prerender = false;

// POST - Clear all caches
export const POST: APIRoute = async () => {
  try {
    // Clear all caches
    clearNavbarCache();
    clearSettingsCache();
    clearCategoriesCache();

    return new Response(JSON.stringify({
      success: true,
      message: 'All caches cleared successfully',
      cleared: ['navbar', 'settings', 'categories'],
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
