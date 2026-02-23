import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    // List all files in media bucket
    const { data, error } = await supabaseAdmin.storage
      .from('media')
      .list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('List error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Filter only images and get public URLs
    const images = (data || [])
      .filter(file =>
        file.name &&
        !file.name.startsWith('.') &&
        /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(file.name)
      )
      .map(file => {
        const { data: urlData } = supabaseAdmin.storage
          .from('media')
          .getPublicUrl(file.name);

        return {
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          created_at: file.created_at
        };
      });

    return new Response(JSON.stringify({ images }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('List error:', error);
    return new Response(JSON.stringify({ error: 'Failed to list images' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
