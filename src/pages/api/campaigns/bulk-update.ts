import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { clearNavbarCache } from '../../../lib/menus';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { ids, updates } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Campaign IDs are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'Updates are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Allowed fields for bulk update
    const allowedFields = [
      'page_template',
      'donation_box_template',
      'is_active',
      'is_featured',
      'is_zakat_eligible',
      'show_on_homepage',
      'category'
    ];

    // Filter to only allowed fields
    const safeUpdates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        safeUpdates[field] = updates[field];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add updated_at timestamp
    safeUpdates.updated_at = new Date().toISOString();

    // Perform bulk update
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .update(safeUpdates)
      .in('id', ids)
      .select('id');

    if (error) {
      throw error;
    }

    // Clear navbar cache
    clearNavbarCache();

    return new Response(JSON.stringify({
      success: true,
      message: `Updated ${data?.length || 0} campaigns`,
      updatedCount: data?.length || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Bulk update error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to update campaigns' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Campaign IDs are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .delete()
      .in('id', ids)
      .select('id');

    if (error) {
      throw error;
    }

    // Clear navbar cache
    clearNavbarCache();

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted ${data?.length || 0} campaigns`,
      deletedCount: data?.length || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Bulk delete error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to delete campaigns' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
