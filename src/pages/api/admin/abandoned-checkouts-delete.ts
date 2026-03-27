/**
 * POST /api/admin/abandoned-checkouts-delete
 *
 * Bulk delete abandoned checkout records.
 * Accepts { ids: string[] } to delete specific records,
 * or { filter: { status, range } } to delete all matching a filter.
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { ids } = body as { ids?: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'No IDs provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Safety limit — max 500 at a time
    if (ids.length > 500) {
      return new Response(JSON.stringify({ error: 'Maximum 500 records per request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error, count } = await supabaseAdmin
      .from('abandoned_checkouts')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('[Admin] Delete abandoned checkouts error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Admin] Deleted ${count ?? ids.length} abandoned checkout(s)`);

    return new Response(JSON.stringify({ success: true, deleted: count ?? ids.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[Admin] Delete abandoned checkouts error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
