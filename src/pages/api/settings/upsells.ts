import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { clearSettingsCache } from '../../../lib/settings';

export const prerender = false;

// Get checkout upsells — returns object format (auto-wraps old array format)
export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('checkout_upsells')
      .eq('id', 'main')
      .single();

    if (error) throw error;

    const raw = data?.checkout_upsells;

    // Backward compat: old format is a plain array
    if (Array.isArray(raw)) {
      return new Response(JSON.stringify({
        items: raw,
        heading_desktop: 'Please support us further:',
        heading_mobile: 'Please support us further:',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // New format: object with items + headings
    return new Response(JSON.stringify(raw || { items: [], heading_desktop: 'Please support us further:', heading_mobile: 'Please support us further:' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Save checkout upsells — accepts both old array and new object format, always stores object
export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    let config: { items: any[]; heading_desktop: string; heading_mobile: string };

    // Accept both old array format and new object format
    if (Array.isArray(body)) {
      config = {
        items: body,
        heading_desktop: 'Please support us further:',
        heading_mobile: 'Please support us further:',
      };
    } else if (body && Array.isArray(body.items)) {
      config = {
        items: body.items,
        heading_desktop: body.heading_desktop || 'Please support us further:',
        heading_mobile: body.heading_mobile || 'Please support us further:',
      };
    } else {
      return new Response(JSON.stringify({ error: 'Expected items array or config object with items' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate each upsell has required fields
    for (const u of config.items) {
      if (!u.id || !u.title || typeof u.amount !== 'number') {
        return new Response(JSON.stringify({ error: 'Each upsell must have id, title, and amount' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const { error } = await supabaseAdmin
      .from('site_settings')
      .update({ checkout_upsells: config })
      .eq('id', 'main');

    if (error) throw error;

    clearSettingsCache();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
