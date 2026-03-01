import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { clearSettingsCache } from '../../lib/settings';
import { clearNavbarCache } from '../../lib/menus';

export const prerender = false;

// GET - List all hero slides
export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('hero_slides')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ slides: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch slides' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST - Create or update hero slide
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, ...slideData } = body;

    let result;
    if (id) {
      // Update existing
      result = await supabaseAdmin
        .from('hero_slides')
        .update(slideData)
        .eq('id', id)
        .select()
        .single();
    } else {
      // Create new
      result = await supabaseAdmin
        .from('hero_slides')
        .insert(slideData)
        .select()
        .single();
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Clear caches so slide changes appear immediately
    clearSettingsCache();
    clearNavbarCache();

    return new Response(JSON.stringify({ success: true, slide: result.data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to save slide' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE - Remove a hero slide
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const { id } = await request.json();

    const { error } = await supabaseAdmin
      .from('hero_slides')
      .delete()
      .eq('id', id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Clear caches so slide deletion is reflected immediately
    clearSettingsCache();
    clearNavbarCache();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete slide' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
