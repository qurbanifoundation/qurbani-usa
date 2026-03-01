/**
 * POST /api/abandoned-checkout/capture
 *
 * Captures donor information as soon as email is entered in checkout.
 * Creates or updates an abandoned_checkouts record in Supabase.
 * Called silently on email blur — must never block checkout flow.
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

// Simple in-memory rate limiter (per-isolate in Cloudflare Workers)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 30_000; // 30 seconds

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const lastCall = rateLimitMap.get(email);
  if (lastCall && now - lastCall < RATE_LIMIT_WINDOW_MS) {
    return true;
  }
  rateLimitMap.set(email, now);

  // Cleanup old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, time] of rateLimitMap) {
      if (now - time > RATE_LIMIT_WINDOW_MS * 2) rateLimitMap.delete(key);
    }
  }

  return false;
}

function isValidEmail(email: string): boolean {
  const atIndex = email.indexOf('@');
  if (atIndex < 1) return false;
  const dotIndex = email.indexOf('.', atIndex);
  return dotIndex > atIndex + 1 && dotIndex < email.length - 1;
}

interface CaptureRequestBody {
  email: string;
  first_name?: string;
  last_name?: string;
  amount?: number;
  currency?: string;
  campaign_type?: string;
  campaign_slug?: string;
  country?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse body — support both JSON and sendBeacon text
    let body: CaptureRequestBody;
    const contentType = request.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const text = await request.text();
      body = JSON.parse(text);
    }

    const email = (body.email || '').trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit: skip DB work if same email called within 30s
    if (isRateLimited(email)) {
      return new Response(
        JSON.stringify({ success: true, rate_limited: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing active checkout (started or abandoned)
    const { data: existing } = await supabaseAdmin
      .from('abandoned_checkouts')
      .select('id, resume_token, resume_url')
      .eq('email', email)
      .in('status', ['started', 'abandoned'])
      .maybeSingle();

    if (existing) {
      // Update existing record with fresh data
      await supabaseAdmin
        .from('abandoned_checkouts')
        .update({
          first_name: body.first_name || undefined,
          last_name: body.last_name || undefined,
          amount: body.amount || undefined,
          currency: body.currency || undefined,
          campaign_type: body.campaign_type || undefined,
          campaign_slug: body.campaign_slug || undefined,
          country: body.country || undefined,
          utm_source: body.utm_source || undefined,
          utm_medium: body.utm_medium || undefined,
          utm_campaign: body.utm_campaign || undefined,
          utm_term: body.utm_term || undefined,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      return new Response(
        JSON.stringify({
          success: true,
          resume_token: existing.resume_token,
          resume_url: existing.resume_url,
          updated: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create new abandoned checkout record
    const resume_token = crypto.randomUUID();
    const resume_url = `https://www.qurbani.com/donate/resume?token=${resume_token}`;

    const { data: created, error: insertError } = await supabaseAdmin
      .from('abandoned_checkouts')
      .insert({
        email,
        first_name: body.first_name || null,
        last_name: body.last_name || null,
        amount: body.amount || null,
        currency: body.currency || 'USD',
        campaign_type: body.campaign_type || null,
        campaign_slug: body.campaign_slug || null,
        country: body.country || null,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        utm_term: body.utm_term || null,
        resume_token,
        resume_url,
        status: 'started',
        checkout_started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .select('id, resume_token, resume_url')
      .single();

    if (insertError) {
      // Partial unique constraint violation — another active checkout exists
      // (race condition: another request inserted between our SELECT and INSERT)
      if (insertError.code === '23505') {
        const { data: fallback } = await supabaseAdmin
          .from('abandoned_checkouts')
          .select('id, resume_token, resume_url')
          .eq('email', email)
          .in('status', ['started', 'abandoned'])
          .maybeSingle();

        if (fallback) {
          return new Response(
            JSON.stringify({
              success: true,
              resume_token: fallback.resume_token,
              resume_url: fallback.resume_url,
              updated: false,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      console.error('Abandoned checkout insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save checkout data' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        resume_token: created?.resume_token || resume_token,
        resume_url: created?.resume_url || resume_url,
        created: true,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Abandoned checkout capture error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
