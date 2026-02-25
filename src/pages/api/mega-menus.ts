import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { clearNavbarCache } from '../../lib/menus';

export const prerender = false;

// GET all mega menus
export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('mega_menus')
      .select('*')
      .order('sort_order');

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

// POST create new mega menu
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    if (!body.id || !body.name) {
      return new Response(JSON.stringify({ error: 'Menu ID and name required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data, error } = await supabaseAdmin
      .from('mega_menus')
      .insert([{
        id: body.id,
        name: body.name,
        sort_order: body.sort_order || 0,
        is_active: body.is_active !== false,
        color: body.color || '#01534d',
        icon: body.icon || 'heart',
      }])
      .select()
      .single();

    if (error) throw error;

    // Clear cache so changes appear immediately
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

// PUT update mega menu
export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, newId, ...updateData } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Menu ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle ID change (requires updating widgets too)
    if (newId && newId !== id) {
      // Validate new ID format
      if (!/^[a-z0-9-]+$/.test(newId)) {
        return new Response(JSON.stringify({ error: 'New ID must contain only lowercase letters, numbers, and hyphens' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if new ID already exists
      const { data: existing } = await supabaseAdmin
        .from('mega_menus')
        .select('id')
        .eq('id', newId)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ error: 'A menu with this ID already exists' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get current menu data
      const { data: currentMenu, error: fetchError } = await supabaseAdmin
        .from('mega_menus')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !currentMenu) {
        return new Response(JSON.stringify({ error: 'Menu not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create new menu with updated ID
      const newMenuData = {
        ...currentMenu,
        ...updateData,
        id: newId,
        updated_at: new Date().toISOString()
      };
      delete newMenuData.created_at; // Let DB handle this

      const { error: insertError } = await supabaseAdmin
        .from('mega_menus')
        .insert([newMenuData]);

      if (insertError) throw insertError;

      // Update all widgets to point to new menu ID
      const { error: widgetError } = await supabaseAdmin
        .from('menu_widgets')
        .update({ menu_id: newId })
        .eq('menu_id', id);

      if (widgetError) {
        console.warn('Warning: Could not update widgets:', widgetError.message);
      }

      // Update all categories that belong to this menu
      const { error: categoryError } = await supabaseAdmin
        .from('categories')
        .update({ menu: newId })
        .eq('menu', id);

      if (categoryError) {
        console.warn('Warning: Could not update categories:', categoryError.message);
      }

      // Delete old menu
      await supabaseAdmin
        .from('mega_menus')
        .delete()
        .eq('id', id);

      // Clear cache
      clearNavbarCache();

      return new Response(JSON.stringify({ ...newMenuData, oldId: id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Regular update (no ID change)
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('mega_menus')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Clear cache so changes appear immediately
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

// DELETE mega menu
export const DELETE: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Menu ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete associated widgets first
    await supabaseAdmin
      .from('menu_widgets')
      .delete()
      .eq('menu_id', id);

    // Delete the menu
    const { error } = await supabaseAdmin
      .from('mega_menus')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Clear cache so changes appear immediately
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
