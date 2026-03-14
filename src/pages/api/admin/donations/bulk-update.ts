import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

export const prerender = false;

/**
 * POST /api/admin/donations/bulk-update
 * Bulk update donation status or other allowed fields
 * Body: { ids: string[], updates: { status?: string, fulfillment_status?: string, receipt_sent?: boolean } }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { ids, updates } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Donation IDs are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'Updates are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Whitelist allowed fields
    const allowedFields = ['status', 'fulfillment_status', 'receipt_sent'];
    const safeUpdates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        safeUpdates[field] = updates[field];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate status values
    if (safeUpdates.status) {
      const validStatuses = ['completed', 'pending', 'failed', 'refunded'];
      if (!validStatuses.includes(safeUpdates.status as string)) {
        return new Response(JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Set timestamp fields based on status change
      if (safeUpdates.status === 'completed') {
        safeUpdates.completed_at = new Date().toISOString();
      } else if (safeUpdates.status === 'refunded') {
        safeUpdates.refunded_at = new Date().toISOString();
      }
    }

    safeUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('donations')
      .update(safeUpdates)
      .in('id', ids)
      .select('id');

    if (error) {
      throw error;
    }

    console.log(`[Admin] Bulk updated ${data?.length || 0} donations:`, safeUpdates);

    return new Response(JSON.stringify({
      success: true,
      message: `Updated ${data?.length || 0} donation(s)`,
      updatedCount: data?.length || 0,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Admin] Bulk update error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to update donations' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * DELETE /api/admin/donations/bulk-update
 * Bulk delete donations
 * Body: { ids: string[] }
 */
export const DELETE: APIRoute = async ({ request }) => {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Donation IDs are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabaseAdmin
      .from('donations')
      .delete()
      .in('id', ids)
      .select('id');

    if (error) {
      throw error;
    }

    console.log(`[Admin] Bulk deleted ${data?.length || 0} donations`);

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted ${data?.length || 0} donation(s)`,
      deletedCount: data?.length || 0,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Admin] Bulk delete error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to delete donations' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
