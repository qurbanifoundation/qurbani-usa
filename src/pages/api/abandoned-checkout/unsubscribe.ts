/**
 * GET/POST /api/abandoned-checkout/unsubscribe
 *
 * One-click unsubscribe from recovery emails.
 * Supports both GET (link click) and POST (List-Unsubscribe-Post header).
 * Returns a friendly HTML confirmation page.
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

async function handleUnsubscribe(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response('Missing token', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Mark as unsubscribed and stop recovery emails
  await supabaseAdmin
    .from('abandoned_checkouts')
    .update({
      unsubscribed_at: new Date().toISOString(),
      status: 'expired',
    })
    .eq('resume_token', token);

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed - Qurbani Foundation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align: center; padding: 60px 20px; background: #f9fafb; color: #374151; }
    .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 48px 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 24px; margin-bottom: 12px; color: #111827; }
    p { font-size: 16px; line-height: 1.6; color: #6b7280; }
    a { color: #d97706; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
    .check { font-size: 48px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="check">&#10003;</div>
    <h1>You've been unsubscribed</h1>
    <p>You will no longer receive donation reminders from us.</p>
    <p>If you'd like to support our mission in the future, you're always welcome.</p>
    <p style="margin-top: 24px;"><a href="https://www.qurbani.com">Return to Qurbani.com</a></p>
  </div>
</body>
</html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

export const GET: APIRoute = async ({ request }) => handleUnsubscribe(request);
export const POST: APIRoute = async ({ request }) => handleUnsubscribe(request);
