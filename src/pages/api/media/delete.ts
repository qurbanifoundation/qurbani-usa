import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { filename } = await request.json();

    if (!filename) {
      return new Response(JSON.stringify({ error: 'No filename provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete from Supabase Storage
    const { error } = await supabaseAdmin.storage
      .from('media')
      .remove([filename]);

    if (error) {
      console.error('Delete error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Delete error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete image' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
