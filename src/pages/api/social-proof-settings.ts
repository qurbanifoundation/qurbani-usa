import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// POST — update social proof settings for a campaign
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Campaign ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Only allow specific social-proof fields
    const updateData: Record<string, unknown> = {};

    if ('show_in_social_proof' in fields) {
      updateData.show_in_social_proof = fields.show_in_social_proof === true;
    }
    if ('social_proof_action' in fields) {
      const action = fields.social_proof_action;
      if (action !== 'popup' && action !== 'redirect') {
        return new Response(JSON.stringify({ error: 'Invalid action type. Must be "popup" or "redirect".' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updateData.social_proof_action = action;
    }
    if ('social_proof_url' in fields) {
      updateData.social_proof_url = fields.social_proof_url || null;
    }
    if ('social_proof_order' in fields) {
      const order = parseInt(fields.social_proof_order, 10);
      if (!isNaN(order) && order >= 0) {
        updateData.social_proof_order = order;
      }
    }
    if ('social_proof_title' in fields) {
      updateData.social_proof_title = fields.social_proof_title || null;
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .update(updateData)
      .eq('id', id)
      .select('id, slug, show_in_social_proof, social_proof_action, social_proof_url, social_proof_order, social_proof_title')
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, campaign: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Social Proof Settings] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
