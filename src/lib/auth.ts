/**
 * Admin Authentication Utilities
 *
 * Shared between middleware.ts and admin-login.ts
 * Generates deterministic session tokens from the admin password
 */

// Generate a deterministic session token from the password
// Uses a simple but effective hash — all workers/instances produce the same token
// without needing shared state (sessions table, Redis, etc.)
export function generateSessionToken(password: string): string {
  let hash = 0;
  const str = `qurbani-session-salt-2026:${password}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex and pad to 64 chars for consistent format
  const base = Math.abs(hash).toString(16);
  const token = (base.repeat(Math.ceil(64 / base.length))).slice(0, 64);
  return token;
}

// Public API routes that don't require admin auth
// NOTE: Some of these have mixed GET (public) and POST (admin) methods.
// The middleware allows ALL methods through for these routes.
// Routes with admin-only write operations are still safe because:
//   - /api/settings/payments POST is protected by middleware (not in this list)
//   - /api/campaigns POST/PUT/DELETE are protected by middleware (not in this list)
export const PUBLIC_API_ROUTES = [
  '/api/admin-login',
  '/api/contact',
  '/api/newsletter',
  '/api/checkout',
  '/api/donate/checkout',
  '/api/payments/create-intent',
  '/api/payments/create-setup-intent',
  '/api/payments/create-subscription',
  '/api/metal-prices',
  '/api/campaigns/crisis-stats',
  '/api/ghl/track-cart',
  '/api/ghl/track-view',
  '/api/ghl/track-zakat',
  '/api/ghl/sync-contact',
  '/api/webhooks/stripe',
  '/api/webhooks/ghl',
  '/api/subscriptions/manage',
  '/api/donor/lookup',
  '/api/images/stock',
  '/api/automated-donations/',
];

// Routes where GET is public but all other methods require admin auth
export const PUBLIC_GET_ONLY_ROUTES = [
  '/api/settings/payments',     // Frontend needs publishable key
  '/api/campaigns',             // Frontend needs campaign listings (GET only)
  '/api/categories',            // Frontend needs category data
  '/api/homepage-content',      // Frontend needs homepage sections
  '/api/hero-slides',           // Frontend needs hero carousel data
  '/api/mega-menus',            // Frontend needs nav menu data
  '/api/menu-widgets',          // Frontend needs menu widgets
  '/api/pages',                 // Frontend needs CMS pages
];

// Routes that use their own auth (API key, cron secret, etc.)
export const SELF_AUTHED_ROUTES = [
  '/api/fulfillment/process',
  '/api/cron/',
];
