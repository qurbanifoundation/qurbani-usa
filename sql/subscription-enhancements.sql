-- Subscription System Enhancements for Top-Notch Charity Grade
-- Run this after payment-setup.sql

-- =====================================================
-- 1. Enhanced donation_subscriptions table
-- =====================================================

-- Add failure tracking columns
ALTER TABLE donation_subscriptions ADD COLUMN IF NOT EXISTS failure_count integer DEFAULT 0;
ALTER TABLE donation_subscriptions ADD COLUMN IF NOT EXISTS last_failure_reason text;
ALTER TABLE donation_subscriptions ADD COLUMN IF NOT EXISTS last_failure_at timestamptz;

-- Add card metadata for expiry warnings (never store full card numbers!)
ALTER TABLE donation_subscriptions ADD COLUMN IF NOT EXISTS card_last4 text;
ALTER TABLE donation_subscriptions ADD COLUMN IF NOT EXISTS card_brand text;
ALTER TABLE donation_subscriptions ADD COLUMN IF NOT EXISTS card_exp_month integer;
ALTER TABLE donation_subscriptions ADD COLUMN IF NOT EXISTS card_exp_year integer;

-- Add pause/skip functionality
ALTER TABLE donation_subscriptions ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE donation_subscriptions ADD COLUMN IF NOT EXISTS resume_at timestamptz;
ALTER TABLE donation_subscriptions ADD COLUMN IF NOT EXISTS skip_next_payment boolean DEFAULT false;

-- =====================================================
-- 2. Webhook events table for idempotency
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz DEFAULT now(),
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);

-- Clean up old events (older than 30 days) - run periodically
-- DELETE FROM webhook_events WHERE created_at < NOW() - INTERVAL '30 days';

-- Enable RLS
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to webhook_events" ON webhook_events;
CREATE POLICY "Service role full access to webhook_events" ON webhook_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 3. Donation fee coverage tracking
-- =====================================================
ALTER TABLE donations ADD COLUMN IF NOT EXISTS covers_fees boolean DEFAULT false;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS fee_amount decimal(10,2) DEFAULT 0;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS base_amount decimal(10,2);

-- =====================================================
-- 4. Subscription payment history
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid REFERENCES donation_subscriptions(id),
  stripe_invoice_id text UNIQUE,
  stripe_payment_intent_id text,
  amount decimal(10,2) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  failure_reason text,
  attempt_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- Index for subscription lookup
CREATE INDEX IF NOT EXISTS idx_subscription_payments_sub ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_invoice ON subscription_payments(stripe_invoice_id);

-- Enable RLS
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to subscription_payments" ON subscription_payments;
CREATE POLICY "Service role full access to subscription_payments" ON subscription_payments
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 5. Donor notifications tracking (for payment failures)
-- =====================================================
CREATE TABLE IF NOT EXISTS donor_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_email text NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('payment_failed', 'card_expiring', 'subscription_cancelled', 'payment_received')),
  subscription_id uuid REFERENCES donation_subscriptions(id),
  sent_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Index for tracking notifications
CREATE INDEX IF NOT EXISTS idx_donor_notifications_email ON donor_notifications(donor_email);
CREATE INDEX IF NOT EXISTS idx_donor_notifications_type ON donor_notifications(notification_type);

-- Enable RLS
ALTER TABLE donor_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to donor_notifications" ON donor_notifications;
CREATE POLICY "Service role full access to donor_notifications" ON donor_notifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
