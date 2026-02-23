-- Delete specific campaign pages
-- water-charity, prophetic-qurbani, qurbani-2026, syria-emergency

-- Option 1: Hard delete (permanently remove)
DELETE FROM campaigns WHERE slug IN (
  'water-charity',
  'prophetic-qurbani',
  'qurbani-2026',
  'syria-emergency'
);

-- Verify deletion
SELECT slug, name FROM campaigns WHERE slug IN (
  'water-charity',
  'prophetic-qurbani',
  'qurbani-2026',
  'syria-emergency'
);
