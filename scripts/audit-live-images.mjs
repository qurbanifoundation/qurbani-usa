// Audit live production pages: find every image, its host, size, and flag the heavy ones.
// Usage: node scripts/audit-live-images.mjs

const BASE = 'https://www.qurbani.com';
const PAGES = [
  '/', '/qurbani', '/donate', '/zakat', '/aqiqah', '/sadaqah',
  '/orphans', '/palestine', '/water', '/ramadan', '/appeals',
];

const UA = { 'user-agent': 'Mozilla/5.0 (image-audit)' };

function extractImageUrls(html, pageUrl) {
  const urls = new Set();
  const abs = (u) => {
    try { return new URL(u, pageUrl).toString(); } catch { return null; }
  };
  // <img src>, data-src, srcset
  for (const m of html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi)) {
    const u = abs(m[1]); if (u) urls.add(u);
  }
  for (const m of html.matchAll(/srcset=["']([^"']+)["']/gi)) {
    for (const part of m[1].split(',')) {
      const u = abs(part.trim().split(/\s+/)[0]); if (u) urls.add(u);
    }
  }
  // CSS background-image: url(...)
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+\.(?:png|jpe?g|webp|gif|svg|avif))["']?\s*\)/gi)) {
    const u = abs(m[1]); if (u) urls.add(u);
  }
  // Inline JSON image refs (escaped or not) — any image-looking URL
  for (const m of html.matchAll(/https?:\\?\/\\?\/[^"'\s)]+?\.(?:png|jpe?g|webp|gif|avif)/gi)) {
    const u = abs(m[0].replace(/\\\//g, '/')); if (u) urls.add(u);
  }
  return [...urls].filter(u => /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(u));
}

function hostBucket(u) {
  const h = new URL(u).host;
  if (h.includes('supabase.co')) return 'SUPABASE';
  if (h.includes('qurbani.com')) return 'cloudflare/own';
  if (h.includes('staging9') || h.includes('wp-content')) return 'wordpress-staging';
  return h;
}

async function sizeOf(u) {
  try {
    let r = await fetch(u, { method: 'HEAD', headers: UA });
    if (!r.ok || !r.headers.get('content-length')) {
      // some hosts don't answer HEAD; do a ranged GET
      r = await fetch(u, { headers: { ...UA, range: 'bytes=0-0' } });
    }
    const cl = r.headers.get('content-length');
    const cr = r.headers.get('content-range'); // bytes 0-0/12345
    let size = cl ? parseInt(cl) : 0;
    if (cr) { const t = cr.split('/')[1]; if (t) size = parseInt(t); }
    return { size, type: r.headers.get('content-type') || '', status: r.status };
  } catch (e) {
    return { size: 0, type: 'ERR:' + e.message, status: 0 };
  }
}

const kb = (n) => (n / 1024).toFixed(0).padStart(6) + ' KB';
const globalByHost = {};
const allImages = new Map(); // url -> {size,type,pages:Set}

for (const path of PAGES) {
  const pageUrl = BASE + path;
  let html;
  try {
    const res = await fetch(pageUrl, { headers: UA });
    if (!res.ok) { console.log(`\n### ${path} → HTTP ${res.status} (skip)`); continue; }
    html = await res.text();
  } catch (e) { console.log(`\n### ${path} → fetch error ${e.message}`); continue; }

  const imgs = extractImageUrls(html, pageUrl);
  let pageTotal = 0;
  const rows = [];
  for (const u of imgs) {
    let entry = allImages.get(u);
    if (!entry) {
      const s = await sizeOf(u);
      entry = { ...s, pages: new Set() };
      allImages.set(u, entry);
    }
    entry.pages.add(path);
    pageTotal += entry.size;
    const bucket = hostBucket(u);
    globalByHost[bucket] = (globalByHost[bucket] || 0) + 0; // ensure key
    rows.push({ u, size: entry.size, bucket });
  }
  rows.sort((a, b) => b.size - a.size);
  console.log(`\n### ${path}  —  ${imgs.length} images, ${(pageTotal/1024/1024).toFixed(2)} MB total page image weight`);
  for (const r of rows.slice(0, 12)) {
    console.log(`  ${kb(r.size)}  [${r.bucket}]  ${r.u.replace(BASE,'').slice(0,90)}`);
  }
}

// Global summary
console.log('\n\n========== GLOBAL SUMMARY ==========');
const byHost = {};
let supabaseBytes = 0, supabaseCount = 0;
const heavy = [];
for (const [u, e] of allImages) {
  const b = hostBucket(u);
  byHost[b] = byHost[b] || { count: 0, bytes: 0 };
  byHost[b].count++; byHost[b].bytes += e.size;
  if (b === 'SUPABASE') { supabaseBytes += e.size; supabaseCount++; }
  if (e.size > 400 * 1024) heavy.push({ u, size: e.size, b });
}
console.log('\nUnique images by host:');
for (const [h, v] of Object.entries(byHost).sort((a,b)=>b[1].bytes-a[1].bytes)) {
  console.log(`  ${h.padEnd(20)} ${String(v.count).padStart(4)} files  ${(v.bytes/1024/1024).toFixed(2)} MB`);
}
console.log(`\nSUPABASE-hosted images still being served: ${supabaseCount} files, ${(supabaseBytes/1024/1024).toFixed(2)} MB`);

heavy.sort((a,b)=>b.size-a.size);
console.log(`\nHEAVY images (>400 KB) — ${heavy.length} total, top 20:`);
for (const h of heavy.slice(0,20)) {
  console.log(`  ${kb(h.size)}  [${h.b}]  ${h.u.replace(BASE,'')}`);
}
