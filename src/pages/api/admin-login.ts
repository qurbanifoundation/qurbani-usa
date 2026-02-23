import type { APIRoute } from 'astro';

export const prerender = false;

const ADMIN_PASSWORD = 'Qurbani2026';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  try {
    const formData = await request.formData();
    const password = formData.get('password');
    const returnUrl = formData.get('returnUrl') || '/admin';

    // Debug: log the comparison
    console.log('Password received:', password);
    console.log('Expected:', ADMIN_PASSWORD);
    console.log('Match:', password === ADMIN_PASSWORD);

    if (String(password) === ADMIN_PASSWORD) {
      // Set session cookie
      // Note: secure should be true in production, but false for localhost testing
      const isProduction = import.meta.env.PROD;
      cookies.set('admin_session', ADMIN_PASSWORD, {
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
      });

      return redirect(returnUrl as string);
    }

    // Wrong password - redirect back to admin (will show login form again)
    return redirect(`${returnUrl}?error=1`);
  } catch (e) {
    return new Response('Invalid request', { status: 400 });
  }
};
