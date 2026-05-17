// Cloudflare Turnstile server-side verification
// Protects payment endpoints against bot-driven card testing attacks.

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileResult {
  success: boolean;
  error?: string;
  codes?: string[];
}

export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string | null
): Promise<TurnstileResult> {
  const secret = import.meta.env.TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.error('[turnstile] TURNSTILE_SECRET_KEY not configured — failing closed');
    return { success: false, error: 'Bot protection not configured' };
  }

  if (!token || typeof token !== 'string') {
    return { success: false, error: 'Missing bot-protection token' };
  }

  const form = new URLSearchParams();
  form.append('secret', secret);
  form.append('response', token);
  if (remoteIp) form.append('remoteip', remoteIp);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: form,
    });
    const data = await res.json() as { success: boolean; 'error-codes'?: string[] };
    if (!data.success) {
      return {
        success: false,
        error: 'Bot-protection check failed',
        codes: data['error-codes'] || [],
      };
    }
    return { success: true };
  } catch (e: any) {
    console.error('[turnstile] verify error:', e?.message || e);
    return { success: false, error: 'Bot-protection verification error' };
  }
}

export function getClientIp(request: Request): string | null {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    null
  );
}
