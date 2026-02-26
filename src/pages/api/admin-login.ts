import type { APIRoute } from 'astro';
import { generateSessionToken } from '../../lib/auth';

export const prerender = false;

const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || '';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  try {
    if (!ADMIN_PASSWORD) {
      return new Response('Admin access not configured', { status: 503 });
    }

    const formData = await request.formData();
    const password = formData.get('password');
    const returnUrl = formData.get('returnUrl') || '/admin';

    if (String(password) === ADMIN_PASSWORD) {
      // Generate a session token (NOT the password itself)
      const sessionToken = generateSessionToken(ADMIN_PASSWORD);
      const isProduction = import.meta.env.PROD;

      cookies.set('admin_session', sessionToken, {
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
      });

      return redirect(returnUrl as string);
    }

    // Wrong password - redirect back with error
    return redirect(`${returnUrl}?error=1`);
  } catch (e) {
    return new Response('Invalid request', { status: 400 });
  }
};
