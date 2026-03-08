/**
 * API: Template Options Management
 * PUT - Update template label (rename)
 */
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const PUT: APIRoute = async ({ request }) => {
  try {
    const { template_key, template_label } = await request.json();

    if (!template_key || !template_label) {
      return new Response(JSON.stringify({ error: 'template_key and template_label are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update the label in template_options table
    const { data, error } = await supabaseAdmin
      .from('template_options')
      .update({ template_label: template_label.trim() })
      .eq('template_key', template_key);

    if (error) {
      console.error('Error updating template label:', error);
      return new Response(JSON.stringify({ error: 'Failed to update template label' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, template_key, template_label: template_label.trim() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Template options API error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
