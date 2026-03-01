-- Abandoned Checkouts table for donation recovery
-- Captures donor info when checkout begins but payment is not completed
CREATE TABLE IF NOT EXISTS abandoned_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  status TEXT NOT NULL DEFAULT 'started',
  checkout_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  abandoned_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  amount NUMERIC,
  currency TEXT,
  campaign_type TEXT,
  campaign_slug TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  country TEXT,
  resume_token TEXT NOT NULL,
  resume_url TEXT,
  ghl_contact_id TEXT,
  recovery_step_last_sent INTEGER NOT NULL DEFAULT 0,
  recovery_last_sent_at TIMESTAMPTZ
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_email ON abandoned_checkouts(email);
CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_status ON abandoned_checkouts(status);
CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_abandoned_at ON abandoned_checkouts(abandoned_at);

-- Uniqueness: each resume token must be globally unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_abandoned_checkouts_resume_token ON abandoned_checkouts(resume_token);

-- Uniqueness: prevent duplicate active rows per email
-- Only one "started" or "abandoned" checkout per email at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_abandoned_checkouts_email_active
  ON abandoned_checkouts(email)
  WHERE status IN ('started', 'abandoned');
