-- Weekly (Jummah/Friday) Subscription Support
-- Run this after subscription-enhancements.sql

-- =====================================================
-- 1. Add interval column to donation_subscriptions
-- =====================================================
ALTER TABLE donation_subscriptions ADD COLUMN IF NOT EXISTS interval text DEFAULT 'monthly'
  CHECK (interval IN ('weekly', 'monthly'));

-- =====================================================
-- 2. Update donations table to support weekly donation type
-- =====================================================
-- First drop the existing constraint
ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_donation_type_check;

-- Add new constraint that includes 'weekly'
ALTER TABLE donations ADD CONSTRAINT donations_donation_type_check
  CHECK (donation_type IN ('single', 'monthly', 'weekly'));

-- =====================================================
-- 3. Add management token for subscription management
-- =====================================================
ALTER TABLE donation_subscriptions ADD COLUMN IF NOT EXISTS management_token text;

-- Create unique index on management token
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_management_token
  ON donation_subscriptions(management_token) WHERE management_token IS NOT NULL;

-- =====================================================
-- 4. Function to generate management tokens
-- =====================================================
CREATE OR REPLACE FUNCTION generate_management_token()
RETURNS text AS $$
DECLARE
  token text;
BEGIN
  token := encode(gen_random_bytes(24), 'base64');
  -- Make URL-safe
  token := replace(replace(replace(token, '+', '-'), '/', '_'), '=', '');
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Trigger to auto-generate management token
-- =====================================================
CREATE OR REPLACE FUNCTION set_management_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.management_token IS NULL THEN
    NEW.management_token := generate_management_token();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_management_token ON donation_subscriptions;
CREATE TRIGGER trigger_set_management_token
  BEFORE INSERT ON donation_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_management_token();

-- =====================================================
-- 6. Update existing subscriptions with management tokens
-- =====================================================
UPDATE donation_subscriptions
SET management_token = generate_management_token()
WHERE management_token IS NULL;
