-- Donation Disputes table (for chargebacks)
CREATE TABLE IF NOT EXISTS donation_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_dispute_id TEXT UNIQUE NOT NULL,
  stripe_charge_id TEXT,
  donation_id UUID REFERENCES donations(id),
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'usd',
  reason TEXT,
  status TEXT,
  donor_email TEXT,
  donor_name TEXT,
  won BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Admin Notifications table (for alerts)
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  severity TEXT DEFAULT 'medium',
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_disputes_stripe_id ON donation_disputes(stripe_dispute_id);
CREATE INDEX IF NOT EXISTS idx_disputes_charge_id ON donation_disputes(stripe_charge_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON admin_notifications(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);

-- Add 'disputed' and 'chargedback' to donations status if not exists
-- (This is a comment - the status column should already accept these values)
