import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Edge-cached proxy for Supabase Storage `media` bucket files.
 *
 * Requests to `/cdn/media/<path>` are served from the Cloudflare cache. On a
 * miss we fetch the file once from Supabase, stamp it with a 1-year immutable
 * cache header, and store it at the edge. Filenames are timestamp-prefixed and
 * never reused, so caching forever is safe.
 *
 * This is what keeps Supabase "cached egress" low: each file is pulled from
 * Supabase at most once per edge location, not once per visitor.
 */

const SUPABASE_URL = (import.meta.env.PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const ONE_YEAR = 31536000;

export const GET: APIRoute = async ({ params, request }) => {
  const path = (params.path || '').replace(/^\/+/, '');

  if (!SUPABASE_URL || !path || path.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  // Cloudflare edge cache (available at runtime; absent in `astro dev`).
  const cache = (globalThis as any).caches?.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const upstream = `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
  let resp: Response;
  try {
    resp = await fetch(upstream, {
      // Cache the subrequest to Supabase at the Cloudflare layer too.
      cf: { cacheEverything: true, cacheTtl: ONE_YEAR },
    } as RequestInit);
  } catch {
    return new Response('Upstream error', { status: 502 });
  }

  if (!resp.ok) {
    // Supabase returns 400/404 for a missing public object → treat as 404.
    // Reserve 502 for genuine upstream (5xx) failures.
    return new Response('Not found', { status: resp.status >= 500 ? 502 : 404 });
  }

  const headers = new Headers();
  const contentType = resp.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set('cache-control', `public, max-age=${ONE_YEAR}, immutable`);
  headers.set('x-media-proxy', 'cloudflare-edge');

  const buf = await resp.arrayBuffer();
  const out = new Response(buf, { status: 200, headers });

  if (cache) {
    try {
      await cache.put(cacheKey, out.clone());
    } catch {
      // Non-fatal: serving uncached is still correct.
    }
  }

  return out;
};
