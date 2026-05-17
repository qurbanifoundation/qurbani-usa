/**
 * Add regional price groups (Middle East / Africa / Asia) for countries not
 * already assigned to an existing group. Idempotent: doesn't reassign any
 * country that already has a priceGroupId.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const client = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const regional = [
  { id: 'group-middle-east', name: 'Middle East',
    countries: ['egypt', 'iraq-refugees', 'morocco', 'palestine-jerusalem',
                'refugees-jordan', 'refugees-lebanon', 'tunisia', 'turkey',
                'albania', 'kosovo'] },
  { id: 'group-africa', name: 'Africa',
    countries: ['burundi', 'cameroon', 'chad', 'ghana', 'mauritania',
                'nigeria', 'senegal', 'tanzania', 'uganda'] },
  { id: 'group-asia', name: 'Asia',
    countries: ['indonesia', 'kashmir-india', 'kashmir-pakistan',
                'myanmar-refugees', 'nepal', 'philippines', 'rohingya-malaysia'] },
];

const { data, error } = await client
  .from('campaigns')
  .select('template_config')
  .eq('slug', 'qurbani')
  .single();

if (error) { console.error('Fetch failed:', error.message); process.exit(1); }

const countries = data?.template_config?.countries || [];
const priceGroups = data?.template_config?.priceGroups || [];
const countryById = new Map(countries.map(c => [c.id, c]));
const existingIds = new Set(priceGroups.map(g => g.id));

const results = {};
const missing = [];

for (const region of regional) {
  results[region.name] = { assigned: [], skipped: [] };

  // Add group if not already present
  if (!existingIds.has(region.id)) {
    priceGroups.push({
      id: region.id,
      name: region.name,
      sheep_goat: null,
      cow_share: null,
      cow_full: null,
    });
  }

  for (const cid of region.countries) {
    const country = countryById.get(cid);
    if (!country) { missing.push({ region: region.name, id: cid }); continue; }
    if (country.priceGroupId) {
      results[region.name].skipped.push(cid + ' (in ' + country.priceGroupId + ')');
      continue;
    }
    country.priceGroupId = region.id;
    results[region.name].assigned.push(cid);
  }
}

const tc = data.template_config || {};
tc.countries = countries;
tc.priceGroups = priceGroups;

const { error: updateError } = await client
  .from('campaigns')
  .update({ template_config: tc })
  .eq('slug', 'qurbani');

if (updateError) { console.error('Update failed:', updateError.message); process.exit(1); }

for (const [name, r] of Object.entries(results)) {
  console.log(`${name}: ${r.assigned.length} assigned`);
  if (r.assigned.length) console.log(`  → ${r.assigned.join(', ')}`);
  if (r.skipped.length) console.log(`  skipped (already grouped): ${r.skipped.join(', ')}`);
}
if (missing.length) {
  console.log('\nMissing countries (not in DB):');
  for (const m of missing) console.log(`  ${m.region}: "${m.id}"`);
}
