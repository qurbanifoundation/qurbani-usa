/**
 * Fulfillment Settings API
 *
 * GET  - Fetch current Eid dates and fulfillment config
 * POST - Update Eid dates and fulfillment settings
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { clearSettingsCache } from '../../../lib/settings';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('eid_ul_adha_start, eid_ul_adha_end, qurbani_fulfillment_enabled')
      .single();

    if (error) throw error;

    // Get fulfillment stats
    const now = new Date().toISOString();

    // Stats exclude recurring donations (monthly/weekly) — they follow Active Subscriber lifecycle
    const [pending, fulfilled, failed, emailsPending] = await Promise.all([
      supabaseAdmin.from('donations').select('*', { count: 'exact', head: true })
        .eq('fulfillment_status', 'pending').eq('status', 'completed')
        .not('donation_type', 'in', '("monthly","weekly")'),
      supabaseAdmin.from('donations').select('*', { count: 'exact', head: true })
        .eq('fulfillment_status', 'fulfilled'),
      supabaseAdmin.from('donations').select('*', { count: 'exact', head: true })
        .eq('fulfillment_status', 'failed'),
      supabaseAdmin.from('donations').select('*', { count: 'exact', head: true })
        .eq('fulfillment_status', 'fulfilled')
        .eq('fulfillment_email_sent', false),
    ]);

    return new Response(JSON.stringify({
      settings: data,
      stats: {
        pending: pending.count || 0,
        fulfilled: fulfilled.count || 0,
        failed: failed.count || 0,
        emails_pending: emailsPending.count || 0,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { eid_ul_adha_start, eid_ul_adha_end, qurbani_fulfillment_enabled } = body;

    // Validate dates
    if (eid_ul_adha_start && eid_ul_adha_end) {
      const start = new Date(eid_ul_adha_start);
      const end = new Date(eid_ul_adha_end);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return new Response(JSON.stringify({ error: 'Invalid date format' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (end < start) {
        return new Response(JSON.stringify({ error: 'End date must be after start date' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (eid_ul_adha_start !== undefined) updateData.eid_ul_adha_start = eid_ul_adha_start;
    if (eid_ul_adha_end !== undefined) updateData.eid_ul_adha_end = eid_ul_adha_end;
    if (qurbani_fulfillment_enabled !== undefined) updateData.qurbani_fulfillment_enabled = qurbani_fulfillment_enabled;

    const { error } = await supabaseAdmin
      .from('site_settings')
      .update(updateData)
      .not('id', 'is', null);

    if (error) throw error;

    // Clear settings cache so changes appear immediately
    clearSettingsCache();

    return new Response(JSON.stringify({ success: true, message: 'Fulfillment settings saved' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
