/**
 * GET /api/donations/qurbani-send-log?minutes=30&outcome=already_sent
 *
 * Returns per-row send outcomes from the qurbani_send_log table so admin
 * can look up which specific donor was skipped/failed in any recent batch.
 *
 * Query params:
 *   - minutes: how far back to look (default 30)
 *   - outcome: filter by 'sent' | 'already_sent' | 'failed' | 'invalid' (optional)
 *   - hijri_day: filter by hijri_day (optional)
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const GET: APIRoute = async ({ url }) => {
  const minutes = Math.min(Number(url.searchParams.get('minutes') || 30), 24 * 60);
  const outcome = url.searchParams.get('outcome');
  const hijriDay = url.searchParams.get('hijri_day');

  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();

  try {
    let q = supabaseAdmin
      .from('qurbani_send_log')
      .select('*')
      .gte('sent_at', since)
      .order('sent_at', { ascending: false })
      .limit(500);

    if (outcome) q = q.eq('outcome', outcome);
    if (hijriDay) q = q.eq('hijri_day', Number(hijriDay));

    const { data, error } = await q;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Quick summary counts
    const counts = {
      sent: 0,
      already_sent: 0,
      failed: 0,
      invalid: 0,
    };
    (data || []).forEach((r: any) => {
      if (counts[r.outcome as keyof typeof counts] !== undefined) {
        counts[r.outcome as keyof typeof counts]++;
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        minutes,
        outcome: outcome || null,
        hijri_day: hijriDay ? Number(hijriDay) : null,
        counts,
        total: data?.length || 0,
        entries: data || [],
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
