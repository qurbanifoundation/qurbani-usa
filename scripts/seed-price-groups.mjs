/**
 * Seed qurbani price groups + country assignments.
 * Safe to re-run: replaces existing priceGroups array and updates country priceGroupId.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const client = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const groups = [
  { id: 'group-a', name: 'Group A', sheep_goat: null, cow_share: null, cow_full: null,
    countries: ['ethiopia', 'mali', 'niger', 'somalia', 'kenya', 'india'] },
  { id: 'group-b', name: 'Group B', sheep_goat: null, cow_share: null, cow_full: null,
    countries: ['bangladesh', 'pakistan', 'afghanistan', 'malawi', 'sri-lanka'] },
  { id: 'group-c', name: 'Group C', sheep_goat: null, cow_share: null, cow_full: null,
    countries: ['yemen', 'jordan', 'sudan'] },
  { id: 'group-d', name: 'Group D', sheep_goat: null, cow_share: null, cow_full: null,
    countries: ['bosnia', 'iraq', 'syria'] },
  { id: 'group-e', name: 'Group E', sheep_goat: null, cow_share: null, cow_full: null,
    countries: ['lebanon', 'palestine-gaza'] },
];

const { data, error } = await client
  .from('campaigns')
  .select('template_config')
  .eq('slug', 'qurbani')
  .single();

if (error) { console.error('Fetch failed:', error.message); process.exit(1); }

const countries = data?.template_config?.countries || [];
const countryIdMap = new Map(countries.map(c => [c.id, c]));

// Validate + assign
const assigned = {};
const missing = [];
for (const g of groups) {
  assigned[g.id] = [];
  for (const cid of g.countries) {
    const country = countryIdMap.get(cid);
    if (!country) { missing.push({ group: g.name, id: cid }); continue; }
    country.priceGroupId = g.id;
    assigned[g.id].push(cid);
  }
}

// Clear group assignment from any country not in any group
const assignedIds = new Set(groups.flatMap(g => g.countries));
for (const country of countries) {
  if (!assignedIds.has(country.id) && country.priceGroupId) {
    delete country.priceGroupId;
  }
}

// Strip the temporary `countries` field off groups before saving
const priceGroups = groups.map(({ countries, ...rest }) => rest);

const templateConfig = data.template_config || {};
templateConfig.countries = countries;
templateConfig.priceGroups = priceGroups;

const { error: updateError } = await client
  .from('campaigns')
  .update({ template_config: templateConfig })
  .eq('slug', 'qurbani');

if (updateError) { console.error('Update failed:', updateError.message); process.exit(1); }

console.log('Created', priceGroups.length, 'groups.');
for (const g of groups) {
  console.log(`  ${g.name}: ${assigned[g.id].length} assigned — ${assigned[g.id].join(', ')}`);
}
if (missing.length) {
  console.log('\nMissing countries (not in DB — skipped):');
  for (const m of missing) console.log(`  ${m.group}: "${m.id}"`);
}
