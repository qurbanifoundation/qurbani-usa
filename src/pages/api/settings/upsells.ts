import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { clearSettingsCache } from '../../../lib/settings';

export const prerender = false;

// Get checkout upsells
export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('checkout_upsells')
      .eq('id', 'main')
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data?.checkout_upsells || []), {
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

// Save checkout upsells
export const PUT: APIRoute = async ({ request }) => {
  try {
    const upsells = await request.json();

    if (!Array.isArray(upsells)) {
      return new Response(JSON.stringify({ error: 'Expected an array of upsells' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate each upsell has required fields
    for (const u of upsells) {
      if (!u.id || !u.title || typeof u.amount !== 'number') {
        return new Response(JSON.stringify({ error: 'Each upsell must have id, title, and amount' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const { error } = await supabaseAdmin
      .from('site_settings')
      .update({ checkout_upsells: upsells })
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
