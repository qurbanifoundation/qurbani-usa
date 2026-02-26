import { defineMiddleware } from 'astro:middleware';
import { generateSessionToken, PUBLIC_API_ROUTES, PUBLIC_GET_ONLY_ROUTES, SELF_AUTHED_ROUTES } from './lib/auth';

// Admin password from env var — NEVER hardcoded
const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || '';

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(route => pathname.startsWith(route));
}

function isPublicGetRoute(pathname: string, method: string): boolean {
  if (method !== 'GET') return false;
  return PUBLIC_GET_ONLY_ROUTES.some(route => pathname.startsWith(route));
}

function isSelfAuthedRoute(pathname: string): boolean {
  return SELF_AUTHED_ROUTES.some(route => pathname.startsWith(route));
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Don't protect non-admin, non-API routes
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/')) {
    return next();
  }

  // Public API routes — no auth needed
  if (pathname.startsWith('/api/') && isPublicApiRoute(pathname)) {
    return next();
  }

  // Public GET routes — GET is public, all other methods need admin auth
  const method = context.request.method.toUpperCase();
  if (pathname.startsWith('/api/') && isPublicGetRoute(pathname, method)) {
    return next();
  }

  // Self-authenticated routes — they handle their own auth
  if (pathname.startsWith('/api/') && isSelfAuthedRoute(pathname)) {
    return next();
  }

  // Everything else needs admin session
  if (!ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD env var is not set! Admin access is disabled.');
    return new Response(JSON.stringify({ error: 'Admin access not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check for valid session cookie
  const sessionCookie = context.cookies.get('admin_session');
  const expectedToken = generateSessionToken(ADMIN_PASSWORD);

  if (sessionCookie?.value === expectedToken) {
    return next();
  }

  // Fallback: parse cookie header directly (some Astro adapters have cookie parsing issues)
  const cookieHeader = context.request.headers.get('cookie') || '';
  if (cookieHeader.includes(`admin_session=${expectedToken}`)) {
    return next();
  }

  // For API routes, return 401 JSON
  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // For admin pages, show login form
  const hasError = context.url.searchParams.get('error') === '1';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login - Qurbani USA</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    .logo {
      width: 60px;
      height: 60px;
      background: #01534d;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .logo svg { width: 32px; height: 32px; color: white; }
    h1 {
      text-align: center;
      color: #1a1a1a;
      font-size: 24px;
      margin-bottom: 8px;
    }
    p {
      text-align: center;
      color: #666;
      font-size: 14px;
      margin-bottom: 32px;
    }
    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 8px;
    }
    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      font-size: 16px;
      transition: border-color 0.2s;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #01534d;
    }
    button {
      width: 100%;
      padding: 14px;
      background: #01534d;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 24px;
      transition: background 0.2s;
    }
    button:hover { background: #013d39; }
    .back-link {
      display: block;
      text-align: center;
      margin-top: 24px;
      color: #666;
      font-size: 14px;
      text-decoration: none;
    }
    .back-link:hover { color: #01534d; }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="logo">
      <svg fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path>
      </svg>
    </div>
    <h1>Admin Access</h1>
    <p>Enter the admin password to continue</p>
    <form method="POST" action="/api/admin-login">
      <input type="hidden" name="returnUrl" value="${pathname}">
      ${hasError ? '<div style="background:#fee2e2;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:16px;font-size:14px;text-align:center;">Incorrect password. Please try again.</div>' : ''}
      <label for="password">Password</label>
      <input type="password" id="password" name="password" placeholder="Enter admin password" required autofocus>
      <button type="submit">Sign In</button>
    </form>
    <a href="/" class="back-link">Back to website</a>
  </div>
</body>
</html>
  `;

  return new Response(html, {
    status: 401,
    headers: { 'Content-Type': 'text/html' },
  });
});
