export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('template_config')
      .eq('slug', 'qurbani')
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      countries: data?.template_config?.countries || [],
      priceGroups: data?.template_config?.priceGroups || [],
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { countries, priceGroups } = body;

    if (!Array.isArray(countries)) {
      return new Response(JSON.stringify({ error: 'countries must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get existing template_config to preserve other fields
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('campaigns')
      .select('template_config')
      .eq('slug', 'qurbani')
      .single();

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const templateConfig = existing?.template_config || {};
    templateConfig.countries = countries;
    if (Array.isArray(priceGroups)) templateConfig.priceGroups = priceGroups;

    const { error: updateError } = await supabaseAdmin
      .from('campaigns')
      .update({ template_config: templateConfig })
      .eq('slug', 'qurbani');

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, count: countries.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
