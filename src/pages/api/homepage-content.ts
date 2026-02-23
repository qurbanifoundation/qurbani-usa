import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { defaultHomepageContent } from '../../lib/homepage';

export const prerender = false;

// GET - Fetch homepage content
export const GET: APIRoute = async ({ request }) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('homepage_content')
      .select('*')
      .eq('id', 'main')
      .single();

    // Set aggressive cache headers for speed
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
    };

    if (error || !data) {
      // Return defaults if no data
      return new Response(JSON.stringify(defaultHomepageContent), {
        status: 200,
        headers
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch content' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST - Save homepage content
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Upsert - insert or update
    const { data, error } = await supabaseAdmin
      .from('homepage_content')
      .upsert({
        id: 'main',
        about: body.about,
        stats: body.stats,
        faq: body.faq,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to save content' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
