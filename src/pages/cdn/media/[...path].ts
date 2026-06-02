import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

/**
 * Edge-cached proxy for Supabase Storage `media` bucket files.
 *
 * Requests to `/cdn/media/<path>` are served from the Cloudflare cache. On a
 * miss we pull the file once from Supabase **via the authenticated service-role
 * client** (the bucket is private — no public egress), stamp it with a 1-year
 * immutable cache header, and store it at the edge. Filenames are
 * timestamp-prefixed and never reused, so caching forever is safe.
 *
 * Used only for files NOT migrated to /public (PDFs like aqiqah certificates,
 * and any not-yet-migrated upload). Images are served as static /images/media
 * assets. Because the bucket is private and reads are edge-cached, this keeps
 * Supabase egress negligible.
 */

const ONE_YEAR = 31536000;

export const GET: APIRoute = async ({ params, request }) => {
  const path = (params.path || '').replace(/^\/+/, '');

  if (!path || path.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  // Cloudflare edge cache (available at runtime; absent in `astro dev`).
  const cache = (globalThis as any).caches?.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  // Authenticated download (works on a private bucket; no public egress).
  const { data, error } = await supabaseAdmin.storage.from('media').download(path);
  if (error || !data) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('content-type', data.type || 'application/octet-stream');
  headers.set('cache-control', `public, max-age=${ONE_YEAR}, immutable`);
  headers.set('x-media-proxy', 'cloudflare-edge');

  const buf = await data.arrayBuffer();
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
