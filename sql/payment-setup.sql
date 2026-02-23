-- Payment Settings: Add columns to site_settings
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS stripe_enabled boolean DEFAULT true;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS stripe_publishable_key text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS stripe_secret_key text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS stripe_webhook_secret text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS google_pay_enabled boolean DEFAULT true;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS apple_pay_enabled boolean DEFAULT true;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS paypal_enabled boolean DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS paypal_client_id text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS paypal_client_secret text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS payment_test_mode boolean DEFAULT true;

-- Donations Table
CREATE TABLE IF NOT EXISTS donations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Payment Info
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  stripe_subscription_id text,

  -- Amounts
  amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'usd',

  -- Status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
  donation_type text DEFAULT 'single' CHECK (donation_type IN ('single', 'monthly')),

  -- Donor Info
  donor_email text,
  donor_name text,
  donor_phone text,
  donor_address jsonb,

  -- Items (what they donated to)
  items jsonb DEFAULT '[]'::jsonb,

  -- Campaign tracking
  campaign_slug text,
  campaign_name text,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  error_message text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  refunded_at timestamptz
);

-- Indexes for donations
CREATE INDEX IF NOT EXISTS idx_donations_email ON donations(donor_email);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_campaign ON donations(campaign_slug);
CREATE INDEX IF NOT EXISTS idx_donations_stripe_pi ON donations(stripe_payment_intent_id);

-- Enable RLS
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Policies for donations
DROP POLICY IF EXISTS "Service role full access to donations" ON donations;
CREATE POLICY "Service role full access to donations" ON donations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow public to insert (for creating donation records)
DROP POLICY IF EXISTS "Public can insert donations" ON donations;
CREATE POLICY "Public can insert donations" ON donations
  FOR INSERT
  WITH CHECK (true);

-- Update trigger
CREATE OR REPLACE FUNCTION update_donations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS donations_updated_at ON donations;
CREATE TRIGGER donations_updated_at
  BEFORE UPDATE ON donations
  FOR EACH ROW
  EXECUTE FUNCTION update_donations_updated_at();

-- Monthly Subscriptions Table (for recurring donations)
CREATE TABLE IF NOT EXISTS donation_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Stripe
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,

  -- Donor
  donor_email text NOT NULL,
  donor_name text,

  -- Subscription details
  amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'usd',
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'past_due')),

  -- Campaign
  campaign_slug text,
  items jsonb DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  next_billing_date timestamptz
);

-- Enable RLS
ALTER TABLE donation_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to subscriptions" ON donation_subscriptions;
CREATE POLICY "Service role full access to subscriptions" ON donation_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
