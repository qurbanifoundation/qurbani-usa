import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { clearNavbarCache } from '../../../lib/menus';

export const prerender = false;

// POST: Bulk update campaign pages
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { ids, updates } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'No page IDs provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'No updates provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add updated_at timestamp
    updates.updated_at = new Date().toISOString();

    // Update all pages
    const { data, error } = await supabaseAdmin
      .from('campaign_pages')
      .update(updates)
      .in('id', ids)
      .select();

    if (error) throw error;

    // Clear navbar cache
    clearNavbarCache();

    return new Response(JSON.stringify({
      success: true,
      message: `Updated ${data?.length || ids.length} pages`,
      updated: data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Bulk update error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
