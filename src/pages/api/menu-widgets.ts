import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { clearNavbarCache } from '../../lib/menus';

export const prerender = false;

// GET widgets for a menu (or all)
export const GET: APIRoute = async ({ url }) => {
  try {
    const menuId = url.searchParams.get('menu');

    let query = supabaseAdmin
      .from('menu_widgets')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (menuId) {
      query = query.eq('menu_id', menuId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return new Response(JSON.stringify(data || []), {
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

// POST create new widget
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('menu_widgets')
      .insert([{
        menu_id: body.menu_id,
        position: body.position,
        widget_type: body.widget_type,
        title: body.title || null,
        config: body.config || {},
        sort_order: body.sort_order || 0,
        is_active: body.is_active !== false,
      }])
      .select()
      .single();

    if (error) throw error;

    // Clear cache so widget changes appear immediately on frontend
    clearNavbarCache();

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PUT update widget
export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Widget ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('menu_widgets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Clear cache so widget changes appear immediately on frontend
    clearNavbarCache();

    return new Response(JSON.stringify(data), {
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

// DELETE widget
export const DELETE: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Widget ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { error } = await supabaseAdmin
      .from('menu_widgets')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Clear cache so widget removal appears immediately on frontend
    clearNavbarCache();

    return new Response(JSON.stringify({ success: true }), {
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
