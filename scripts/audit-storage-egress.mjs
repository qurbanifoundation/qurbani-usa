// One-off audit: measure Supabase Storage `media` bucket and find where its URLs are referenced in the DB.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key);

const PROJECT_HOST = new URL(url).host; // e.g. epsjdbnxhmeprjrgcbyw.supabase.co

console.log('Project host:', PROJECT_HOST);

// 1) List the media bucket and total size
async function listAll(bucket, prefix = '') {
  let all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) { console.log(`  list error for ${bucket}/${prefix}:`, error.message); break; }
    if (!data || data.length === 0) break;
    for (const item of data) {
      // folders have no metadata
      if (item.id === null || item.metadata == null) {
        const sub = await listAll(bucket, prefix ? `${prefix}/${item.name}` : item.name);
        all = all.concat(sub);
      } else {
        all.push({ path: prefix ? `${prefix}/${item.name}` : item.name, size: item.metadata?.size || 0 });
      }
    }
    offset += data.length;
    if (data.length < 100) break;
  }
  return all;
}

// discover buckets
const { data: buckets } = await sb.storage.listBuckets();
console.log('\n=== BUCKETS ===');
for (const b of buckets || []) console.log(`  ${b.name} (public=${b.public})`);

for (const b of buckets || []) {
  const files = await listAll(b.name);
  const total = files.reduce((s, f) => s + f.size, 0);
  console.log(`\n=== BUCKET "${b.name}": ${files.length} files, ${(total/1e6).toFixed(1)} MB total ===`);
  const top = [...files].sort((a, b) => b.size - a.size).slice(0, 15);
  for (const f of top) console.log(`  ${(f.size/1e3).toFixed(0).padStart(7)} KB  ${f.path}`);
}

// 2) Find DB references to storage URLs
console.log('\n=== DB REFERENCES TO supabase.co/storage ===');
const tables = ['campaigns', 'site_settings', 'mega_menus', 'menu_widgets', 'packages', 'categories'];
for (const t of tables) {
  try {
    const { data, error } = await sb.from(t).select('*').limit(1000);
    if (error) { console.log(`  ${t}: ${error.message}`); continue; }
    let hits = 0;
    const sampleFiles = new Set();
    for (const row of data || []) {
      const json = JSON.stringify(row);
      const matches = json.match(/storage\/v1\/object\/public\/[a-zA-Z0-9_\-\/\.]+/g);
      if (matches) {
        hits += matches.length;
        matches.slice(0, 3).forEach(m => sampleFiles.add(m));
      }
    }
    console.log(`  ${t}: ${hits} storage URL refs across ${data?.length || 0} rows`);
    [...sampleFiles].slice(0, 5).forEach(f => console.log(`      e.g. ${f}`));
  } catch (e) { console.log(`  ${t}: ${e.message}`); }
}
