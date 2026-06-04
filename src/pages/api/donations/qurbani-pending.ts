/**
 * GET /api/donations/qurbani-pending?cutoff={iso}&includeSent=false
 *
 * Returns all completed donations that contain qurbani items, ordered by
 * created_at ASC, with flags showing which still need a confirmation email.
 *
 * Query params:
 *   - cutoff: ISO timestamp — only return donations created BEFORE this time
 *             (used to filter orders eligible for a specific Hijri day)
 *   - includeSent: 'true' to also include already-confirmed donations (for review)
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { formatOrderNumber } from '../../../lib/order-number';
import { getQurbaniItems, deriveOnBehalfOf, isLikelyValidEmail } from '../../../lib/qurbani-confirmation';

export const GET: APIRoute = async ({ url }) => {
  const cutoff = url.searchParams.get('cutoff');
  const includeSent = url.searchParams.get('includeSent') === 'true';

  try {
    let q = supabaseAdmin
      .from('donations')
      .select('id, donor_name, donor_email, amount, items, campaign_name, order_number, created_at, qurbani_confirmation_sent_at, qurbani_confirmation_hijri_day, qurbani_confirmation_last_attempt_at, qurbani_confirmation_last_error, qurbani_confirmation_attempt_count')
      .eq('status', 'completed')
      .order('created_at', { ascending: true });

    if (cutoff) {
      q = q.lte('created_at', cutoff);
    }

    if (!includeSent) {
      q = q.is('qurbani_confirmation_sent_at', null);
    }

    const { data, error } = await q;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Filter to donations containing qurbani items
    const enriched = (data || [])
      .map((d: any) => {
        const qurbaniItems = getQurbaniItems(d);
        if (!qurbaniItems.length) return null;
        const totalQurbanis = qurbaniItems.reduce(
          (sum: number, it: any) => sum + Math.max(1, Number(it.metadata?.quantity || it.quantity || 1)),
          0
        );
        const countries = Array.from(
          new Set(qurbaniItems.map((it: any) => it.metadata?.country || '').filter(Boolean))
        );
        const emailCheck = isLikelyValidEmail(d.donor_email);
        return {
          id: d.id,
          order_number: formatOrderNumber(d.order_number, d.created_at),
          donor_name: d.donor_name,
          donor_email: d.donor_email,
          amount: d.amount,
          created_at: d.created_at,
          item_count: qurbaniItems.length,
          total_qurbanis: totalQurbanis,
          countries,
          on_behalf_of: deriveOnBehalfOf(qurbaniItems, d.donor_name),
          already_sent: !!d.qurbani_confirmation_sent_at,
          sent_at: d.qurbani_confirmation_sent_at,
          sent_hijri_day: d.qurbani_confirmation_hijri_day,
          email_valid: emailCheck.valid,
          email_invalid_reason: emailCheck.valid ? null : emailCheck.reason,
          last_attempt_at: d.qurbani_confirmation_last_attempt_at,
          last_error: d.qurbani_confirmation_last_error,
          attempt_count: d.qurbani_confirmation_attempt_count || 0,
          items_preview: qurbaniItems.map((it: any) => ({
            quantity: Math.max(1, Number(it.metadata?.quantity || it.quantity || 1)),
            animal: it.metadata?.animalLabel || '',
            country: it.metadata?.country || '',
            behalfOf: it.metadata?.behalfOf || null,
          })),
        };
      })
      .filter(Boolean);

    return new Response(
      JSON.stringify({
        success: true,
        cutoff,
        includeSent,
        total: enriched.length,
        donations: enriched,
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
