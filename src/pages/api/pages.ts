import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// GET - List all pages
export const GET: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');
    const slug = url.searchParams.get('slug');

    let query = supabaseAdmin.from('pages').select('*');

    if (id) {
      query = query.eq('id', id).single();
    } else if (slug) {
      query = query.eq('slug', slug).single();
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(id || slug ? { page: data } : { pages: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch pages' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Default content structure for new pages
function getDefaultContent(title: string = 'Page Title') {
  return {
    sections: [
      {
        id: 'hero',
        type: 'hero',
        title: title,
        subtitle: 'Add your subtitle here',
        backgroundImage: '',
        showButton: true,
        buttonText: 'Learn More',
        buttonLink: '#'
      },
      {
        id: 'content-1',
        type: 'content',
        content: '<p>Start adding your content here...</p>'
      }
    ]
  };
}

// POST - Create or update page
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, ...pageData } = body;

    // If no content provided, set default content
    if (!pageData.content || pageData.content === '{}' || pageData.content === '{"sections":[]}') {
      pageData.content = JSON.stringify(getDefaultContent(pageData.title));
    }

    let result;
    if (id) {
      result = await supabaseAdmin
        .from('pages')
        .update(pageData)
        .eq('id', id)
        .select()
        .single();
    } else {
      result = await supabaseAdmin
        .from('pages')
        .insert(pageData)
        .select()
        .single();
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, page: result.data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to save page' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE - Remove a page
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const { id } = await request.json();

    const { error } = await supabaseAdmin
      .from('pages')
      .delete()
      .eq('id', id);

    if (error) {
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
    return new Response(JSON.stringify({ error: 'Failed to delete page' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
