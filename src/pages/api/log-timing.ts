import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';

export const prerender = false;

/**
 * Log client-side timing breakdown for checkout debugging.
 * Stores timing into the donation row's metadata.timing for later analysis.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { donation_id, payment_intent, timing, success_page_visible_at } = body;

    console.log('[log-timing] received:', {
      donation_id,
      payment_intent,
      timing,
      success_page_visible_at: new Date(success_page_visible_at).toISOString(),
    });

    if (donation_id) {
      try {
        const { data: existing } = await supabaseAdmin
          .from('donations')
          .select('metadata')
          .eq('id', donation_id)
          .maybeSingle();
        const meta = existing?.metadata || {};
        await supabaseAdmin
          .from('donations')
          .update({
            metadata: {
              ...meta,
              timing,
              success_page_visible_at,
            },
          })
          .eq('id', donation_id);
      } catch (e) {
        console.error('[log-timing] failed to update donation metadata:', e);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
