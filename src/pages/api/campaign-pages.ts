import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { clearNavbarCache } from '../../lib/menus';

export const prerender = false;

// GET all campaign pages
export const GET: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('campaign_pages')
        .select('*, categories(id, slug, label)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data, error } = await supabaseAdmin
      .from('campaign_pages')
      .select('*, categories(id, slug, label)')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

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

// PUT update campaign page
export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Page ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    updateData.updated_at = new Date().toISOString();

    // Auto-update url_path when category changes (and url_path not explicitly set in this request)
    if (updateData.category_id && !updateData.url_path) {
      const [catResult, pageResult] = await Promise.all([
        supabaseAdmin.from('categories').select('slug').eq('id', updateData.category_id).single(),
        supabaseAdmin.from('campaign_pages').select('slug, url_path').eq('id', id).single(),
      ]);
      if (catResult.data && pageResult.data) {
        const slug = updateData.slug || pageResult.data.slug;
        updateData.url_path = `/${catResult.data.slug}/${slug}`;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('campaign_pages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Clear navbar cache so changes appear immediately
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

// POST create new campaign page (for future use)
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('campaign_pages')
      .insert([{
        name: body.name,
        slug: body.slug,
        url_path: body.url_path,
        category_id: body.category_id || null,
        description: body.description || null,
        icon: body.icon || null,
        featured_image: body.featured_image || null,
        is_active: body.is_active !== false,
        display_order: body.display_order || 0,
        template_type: body.template_type || 'default',
        meta_title: body.meta_title || null,
        meta_description: body.meta_description || null,
      }])
      .select()
      .single();

    if (error) throw error;

    // Clear navbar cache
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

// DELETE campaign page
export const DELETE: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Page ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { error } = await supabaseAdmin
      .from('campaign_pages')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Clear navbar cache
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
