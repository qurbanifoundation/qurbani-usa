import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { clearNavbarCache } from '../../lib/menus';

export const prerender = false;

// GET all campaigns or single campaign
export const GET: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

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

// POST create new campaign
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Generate slug from title if not provided
    if (!body.slug && body.title) {
      body.slug = body.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert([{
        slug: body.slug,
        name: body.title,
        title: body.title,
        subtitle: body.subtitle || null,
        description: body.description || null,
        featured_image: body.featured_image || null,
        gallery_images: body.gallery_images || [],
        goal_amount: body.goal_amount || null,
        raised_amount: body.raised_amount || 0,
        donation_options: body.donation_options || [],
        donation_presets: body.donation_presets || [],
        content_sections: body.content_sections || [],
        is_active: body.is_active !== false,
        is_featured: body.is_featured || false,
        show_on_homepage: body.show_on_homepage || false,
        display_order: body.display_order || 0,
        meta_title: body.meta_title || null,
        meta_description: body.meta_description || null,
        url_path: body.url_path || ('/' + body.slug),
        template_type: body.template_type || 'standard',
        template_config: body.template_config || {},
        page_template: body.page_template || null,
        donation_box_template: body.donation_box_template || null
      }])
      .select()
      .single();

    if (error) throw error;

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

// PUT update campaign
export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Campaign ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate and sanitize slug if provided
    if (updateData.slug) {
      // Sanitize: lowercase, only letters, numbers, and hyphens
      updateData.slug = updateData.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/(^-|-$)/g, '');

      if (!updateData.slug) {
        return new Response(JSON.stringify({ error: 'Invalid slug format' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if slug is already used by another campaign
      const { data: existing } = await supabaseAdmin
        .from('campaigns')
        .select('id')
        .eq('slug', updateData.slug)
        .neq('id', id)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ error: 'This slug is already used by another campaign' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

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

// DELETE campaign
export const DELETE: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Campaign ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { error } = await supabaseAdmin
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) throw error;

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
