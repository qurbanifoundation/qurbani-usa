// Rewrite hardcoded Supabase media URLs in emails/*.html to Cloudflare-served URLs.
// Logos -> PNG (email-client compatible); other images -> optimized /images/media webp
// (or /cdn/media proxy fallback). Run: node --env-file=.env scripts/fix-email-supabase-urls.mjs
import { readdirSync, readFileSync, writeFileSync } from 'fs';

const PREFIX = process.env.PUBLIC_SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/public/media/';
const ORIGIN = 'https://www.qurbani.com';

// Parse the manifest object out of the generated TS module.
const mtext = readFileSync('src/lib/media-manifest.ts', 'utf8');
const manifest = JSON.parse(mtext.match(/=\s*({[\s\S]*?})\s*;/)[1]);

const LOGO_KEYS = {
  '1771815889576-drvcgb.png': '/images/qurbani-logo.png',
  '1771815947323-nkje6c.png': '/images/qurbani-logo-alt.png',
};

function dest(key) {
  if (LOGO_KEYS[key]) return ORIGIN + LOGO_KEYS[key];
  if (manifest[key]) return ORIGIN + '/images/media/' + manifest[key];
  return ORIGIN + '/cdn/media/' + key;
}

const escaped = PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const re = new RegExp(escaped + '([^"\'\\s)\\\\]+)', 'g');

let totalRepl = 0, touched = 0;
for (const f of readdirSync('emails').filter((x) => x.endsWith('.html'))) {
  const p = 'emails/' + f;
  let n = 0;
  const html = readFileSync(p, 'utf8').replace(re, (_m, key) => { n++; return dest(key); });
  if (n > 0) { writeFileSync(p, html); totalRepl += n; touched++; console.log(`  ${f}: ${n} URLs rewritten`); }
}
console.log(`\nRewrote ${totalRepl} Supabase URLs across ${touched} email files.`);
