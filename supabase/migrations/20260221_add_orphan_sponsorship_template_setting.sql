-- Add orphan_sponsorship_template column to site_settings
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS orphan_sponsorship_template TEXT DEFAULT 'orphan-sponsorship';

-- Update existing rows to have the default value
UPDATE site_settings
SET orphan_sponsorship_template = 'orphan-sponsorship'
WHERE orphan_sponsorship_template IS NULL;
