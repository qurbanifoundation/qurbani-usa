/**
 * POST /api/abandoned-checkout/heartbeat
 *
 * Keeps last_activity_at fresh while a donor is actively in checkout.
 * Called every 5 minutes via sendBeacon to prevent false abandonment detection.
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    let body: { resume_token?: string };
    const contentType = request.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const text = await request.text();
      body = JSON.parse(text);
    }

    const resume_token = (body.resume_token || '').trim();
    if (!resume_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing resume_token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await supabaseAdmin
      .from('abandoned_checkouts')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('resume_token', resume_token)
      .eq('status', 'started');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Abandoned checkout heartbeat error:', error);
    return new Response(
      JSON.stringify({ success: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
