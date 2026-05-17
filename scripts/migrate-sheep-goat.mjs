/**
 * One-shot migration: convert existing sheep / goat entries in the qurbani
 * campaign's template_config.countries[].animals[] into a single sheep_goat
 * entry per country with label "Sheep/Goat".
 *
 * Safe to re-run: entries already converted are left alone.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const client = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await client
  .from('campaigns')
  .select('template_config')
  .eq('slug', 'qurbani')
  .single();

if (error) { console.error('Fetch failed:', error.message); process.exit(1); }

const countries = data?.template_config?.countries || [];
let converted = 0;
let skipped = 0;

for (const country of countries) {
  const animals = country.animals || [];
  const sheepGoatEntries = animals.filter((a) => a.type === 'sheep' || a.type === 'goat');
  if (sheepGoatEntries.length === 0) { skipped++; continue; }

  // Pick the entry to keep: prefer any active one, else the first
  const keeper = sheepGoatEntries.find((a) => a.active !== false) || sheepGoatEntries[0];

  // Rewrite animals: drop all sheep/goat, then prepend a single sheep_goat
  const others = animals.filter((a) => a.type !== 'sheep' && a.type !== 'goat');
  const merged = {
    type: 'sheep_goat',
    label: 'Sheep/Goat',
    price: keeper.price,
    active: keeper.active !== false,
  };
  country.animals = [merged, ...others];
  converted++;
}

const templateConfig = data.template_config || {};
templateConfig.countries = countries;

const { error: updateError } = await client
  .from('campaigns')
  .update({ template_config: templateConfig })
  .eq('slug', 'qurbani');

if (updateError) { console.error('Update failed:', updateError.message); process.exit(1); }

console.log(`Done. Converted ${converted} countries, skipped ${skipped} (no sheep/goat entries).`);
