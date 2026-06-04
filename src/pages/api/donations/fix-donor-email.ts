/**
 * POST /api/donations/fix-donor-email
 *
 * Body: {
 *   donationId: string,            // The donation row to update
 *   newEmail: string,              // The corrected email
 *   updateAllFromSameDonor?: bool, // If true, updates ALL donations matching the old email (default true)
 *   resetQurbaniConfirmation?: bool, // If true, clears qurbani_confirmation_sent_at on the donation (default true)
 * }
 *
 * Updates donor_email everywhere in the donations table, and (optionally) clears the
 * qurbani confirmation tracking so the row reappears in the pending list and can be
 * re-sent. Returns a count of records updated.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

function isValidEmailFormat(email: string): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  // Simple but strict format: local@domain.tld
  const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return re.test(trimmed);
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const donationId = String(body?.donationId || '').trim();
  const newEmail = String(body?.newEmail || '').trim().toLowerCase();
  const updateAllFromSameDonor = body?.updateAllFromSameDonor !== false; // default true
  const resetQurbaniConfirmation = body?.resetQurbaniConfirmation !== false; // default true

  if (!donationId) {
    return new Response(JSON.stringify({ error: 'donationId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isValidEmailFormat(newEmail)) {
    return new Response(
      JSON.stringify({ error: 'New email format is invalid', email: newEmail }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 1. Fetch the donation to confirm it exists and capture the old email
  const { data: donation, error: fetchError } = await supabaseAdmin
    .from('donations')
    .select('id, donor_email, donor_name')
    .eq('id', donationId)
    .maybeSingle();

  if (fetchError || !donation) {
    return new Response(JSON.stringify({ error: 'Donation not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const oldEmail = (donation.donor_email || '').trim();
  const oldEmailLower = oldEmail.toLowerCase();

  if (!oldEmail) {
    return new Response(
      JSON.stringify({ error: 'Donation has no existing email — use a different flow to set one' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (oldEmailLower === newEmail) {
    return new Response(
      JSON.stringify({ ok: true, message: 'New email is the same as the current one. No changes made.', updatedCount: 0 }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Determine which donations to update
  const update: Record<string, any> = { donor_email: newEmail };
  if (resetQurbaniConfirmation) {
    update.qurbani_confirmation_sent_at = null;
    update.qurbani_confirmation_hijri_day = null;
  }

  let updatedCount = 0;
  const errors: string[] = [];

  if (updateAllFromSameDonor) {
    // Update all donations matching the old email (case-insensitive)
    const { data: matching, error: matchErr } = await supabaseAdmin
      .from('donations')
      .select('id')
      .ilike('donor_email', oldEmail);

    if (matchErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to find related donations: ' + matchErr.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ids = (matching || []).map((d: any) => d.id);
    if (ids.length === 0) ids.push(donationId); // safety fallback

    const { error: updateErr, count } = await supabaseAdmin
      .from('donations')
      .update(update, { count: 'exact' })
      .in('id', ids);

    if (updateErr) {
      errors.push('Bulk update failed: ' + updateErr.message);
    } else {
      updatedCount = count || ids.length;
    }
  } else {
    // Update only this one donation
    const { error: updateErr } = await supabaseAdmin
      .from('donations')
      .update(update)
      .eq('id', donationId);

    if (updateErr) {
      errors.push('Update failed: ' + updateErr.message);
    } else {
      updatedCount = 1;
    }
  }

  if (errors.length) {
    return new Response(
      JSON.stringify({ error: errors.join('; '), updatedCount }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      oldEmail,
      newEmail,
      updatedCount,
      resetConfirmation: resetQurbaniConfirmation,
      message:
        `Updated ${updatedCount} donation${updatedCount === 1 ? '' : 's'} from ${donation.donor_name || 'this donor'}` +
        (resetQurbaniConfirmation ? ' and reset Qurbani confirmation tracking.' : '.'),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};
