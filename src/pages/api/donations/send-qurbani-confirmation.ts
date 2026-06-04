/**
 * POST /api/donations/send-qurbani-confirmation
 *
 * Body:
 *   { donationId: string, hijriDay: 10 | 11 | 12, force?: boolean }
 *   OR { donationIds: string[], hijriDay: 10 | 11 | 12, force?: boolean }  (batch)
 *
 * Sends Qurbani confirmation email(s) for the specified donation(s). Each
 * donation gets ONE email listing all qurbani items in that order.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { sendQurbaniConfirmation } from '../../../lib/qurbani-confirmation';

export const POST: APIRoute = async ({ request }) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hijriDay = Number(body.hijriDay);
  if (![10, 11, 12].includes(hijriDay)) {
    return new Response(JSON.stringify({ error: 'hijriDay must be 10, 11, or 12' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const force = body.force === true;

  // Batch mode — cap at 25 per request to stay well within Cloudflare Workers timeouts.
  if (Array.isArray(body.donationIds)) {
    const MAX_PER_REQUEST = 25;
    if (body.donationIds.length > MAX_PER_REQUEST) {
      return new Response(
        JSON.stringify({
          error: `Batch too large. Send up to ${MAX_PER_REQUEST} per request. Got ${body.donationIds.length}.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const results: Array<{ id: string; sent: boolean; reason?: string; emailId?: string }> = [];

    for (let i = 0; i < body.donationIds.length; i++) {
      const id = body.donationIds[i];
      try {
        const r = await sendQurbaniConfirmation(String(id), hijriDay as 10 | 11 | 12, { force });
        results.push({ id: String(id), ...r });
      } catch (e: any) {
        results.push({ id: String(id), sent: false, reason: e.message || 'Unknown error' });
      }
      // Throttle to stay safely under Resend's default 10 req/sec rate limit.
      if (i < body.donationIds.length - 1) {
        await sleep(120);
      }
    }
    const successCount = results.filter((r) => r.sent).length;
    return new Response(
      JSON.stringify({
        success: true,
        total: results.length,
        sent: successCount,
        skipped: results.length - successCount,
        results,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Single mode
  if (!body.donationId || typeof body.donationId !== 'string') {
    return new Response(JSON.stringify({ error: 'donationId (string) or donationIds (array) required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await sendQurbaniConfirmation(body.donationId, hijriDay as 10 | 11 | 12, { force });
    return new Response(
      JSON.stringify({ success: result.sent, ...result }),
      {
        status: result.sent ? 200 : 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
