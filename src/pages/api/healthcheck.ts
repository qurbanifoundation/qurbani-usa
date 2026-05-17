import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { getStripe } from '../../lib/stripe-cache';

export const prerender = false;

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const ADMIN_EMAIL = import.meta.env.ADMIN_EMAIL || 'qurbanifoundation@gmail.com';

/**
 * Health check endpoint for external uptime monitors (UptimeRobot, Better Stack, etc).
 *
 * Pings:
 *   1. Supabase (read settings table)
 *   2. Stripe (list customers w/ limit 1 — minimal API call)
 *
 * Returns 200 OK if all green, 503 if anything fails. On failure, also fires
 * an admin email alert (rate-limited to once per hour so we don't spam).
 *
 * Add this URL to your uptime monitor with a 5-min poll interval:
 *   https://www.qurbani.com/api/healthcheck
 */
export const GET: APIRoute = async () => {
  const checks: Record<string, { ok: boolean; ms: number; error?: string }> = {};
  const overallStart = Date.now();

  // 1) Supabase
  try {
    const t0 = Date.now();
    const { error } = await supabaseAdmin
      .from('site_settings')
      .select('id')
      .limit(1)
      .maybeSingle();
    checks.supabase = { ok: !error, ms: Date.now() - t0, error: error?.message };
  } catch (e: any) {
    checks.supabase = { ok: false, ms: 0, error: e?.message || String(e) };
  }

  // 2) Stripe
  try {
    const t0 = Date.now();
    const stripe = await getStripe();
    await stripe.customers.list({ limit: 1 });
    checks.stripe = { ok: true, ms: Date.now() - t0 };
  } catch (e: any) {
    checks.stripe = { ok: false, ms: 0, error: e?.message || String(e) };
  }

  const allOk = Object.values(checks).every(c => c.ok);
  const overall_ms = Date.now() - overallStart;

  // If anything failed, fire admin alert (rate-limited — see below)
  if (!allOk) {
    fireHealthcheckAlert(checks).catch(err =>
      console.error('[healthcheck] alert send failed:', err)
    );
  }

  return new Response(JSON.stringify({
    ok: allOk,
    overall_ms,
    timestamp: new Date().toISOString(),
    checks,
  }, null, 2), {
    status: allOk ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * Send an admin alert when healthcheck fails. Rate-limited via Supabase to
 * one email per hour per failing service — prevents spam during long outages.
 */
async function fireHealthcheckAlert(checks: Record<string, any>) {
  if (!RESEND_API_KEY) return;

  // Rate-limit: skip if we sent an alert in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  try {
    const { data: recent } = await supabaseAdmin
      .from('admin_notifications')
      .select('id')
      .eq('type', 'payment_failed')
      .ilike('title', '%Healthcheck Failed%')
      .gte('created_at', oneHourAgo)
      .limit(1);
    if (recent && recent.length > 0) return; // already alerted in last hour
  } catch {}

  const failing = Object.entries(checks).filter(([_, c]) => !c.ok);
  const summary = failing.map(([svc, c]) => `${svc}: ${c.error || 'unknown'}`).join(', ');

  // Log to admin_notifications (also drives rate-limiting check above)
  try {
    await supabaseAdmin.from('admin_notifications').insert({
      type: 'payment_failed',
      title: 'Healthcheck Failed',
      message: `Services failing: ${summary}`,
      severity: 'critical',
      metadata: { checks },
      read: false,
    });
  } catch {}

  // Resend email
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px;">
          <h2 style="margin: 0 0 8px; color: #991b1b;">🚨 Checkout System Down</h2>
          <p style="margin: 0; color: #7f1d1d;">External healthcheck detected a failing service. Donors may be unable to complete donations.</p>
        </div>
        <h3 style="color: #111827; margin: 16px 0 8px;">Failing Services</h3>
        <ul>
          ${failing.map(([svc, c]) => `<li><strong>${svc}</strong>: ${c.error || 'unknown error'}</li>`).join('')}
        </ul>
        <h3 style="color: #111827; margin: 16px 0 8px;">All Service Status</h3>
        <pre style="background: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 12px;">${JSON.stringify(checks, null, 2)}</pre>
        <p style="margin: 24px 0 0; color: #6b7280; font-size: 12px;">Next alert rate-limited to once per hour. Check the dashboard at /admin/checkout-health for full status.</p>
      </div>
    `;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Qurbani USA Alerts <alerts@notifications.qurbani.com>',
        to: ADMIN_EMAIL,
        subject: `🚨 Checkout System Down — ${failing.map(([s]) => s).join(', ')}`,
        html,
      }),
    });
  } catch {}
}
