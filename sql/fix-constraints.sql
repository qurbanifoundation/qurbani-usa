-- Fix CHECK constraints to include all used values
-- Run this migration to update donation status and type constraints

-- 1. Update donations.status to include 'disputed' and 'chargedback'
ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_status_check;
ALTER TABLE donations ADD CONSTRAINT donations_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled', 'disputed', 'chargedback'));

-- 2. Update donations.donation_type to include 'weekly' (may already exist from weekly-subscriptions.sql)
ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_donation_type_check;
ALTER TABLE donations ADD CONSTRAINT donations_donation_type_check
  CHECK (donation_type IN ('single', 'monthly', 'weekly'));

-- 3. If fulfillment_status column has a CHECK constraint, update it
-- Our code uses: 'pending', 'processing', 'fulfilled', 'failed', 'not_applicable'
ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_fulfillment_status_check;
ALTER TABLE donations ADD CONSTRAINT donations_fulfillment_status_check
  CHECK (fulfillment_status IN ('pending', 'processing', 'fulfilled', 'failed', 'not_applicable'));
