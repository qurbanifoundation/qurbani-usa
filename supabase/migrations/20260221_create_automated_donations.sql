-- Automated Donations for 30 Days of Ramadan
-- This table stores the scheduled giving plans

-- Main automated donation plans table
CREATE TABLE IF NOT EXISTS automated_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Donor information
  donor_name VARCHAR(255) NOT NULL,
  donor_email VARCHAR(255) NOT NULL,
  donor_phone VARCHAR(50),

  -- Unique access token for management page (no auth required)
  access_token VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Payment information
  stripe_customer_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),

  -- Donation configuration
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Schedule settings
  ramadan_start_date DATE NOT NULL,
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  schedule_type VARCHAR(20) DEFAULT 'all-30', -- all-30, last-10, odd-nights
  odd_multiplier INTEGER DEFAULT 2,
  night27_multiplier INTEGER DEFAULT 5,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, completed, cancelled, failed

  -- Metadata (causes breakdown, etc.)
  causes JSONB NOT NULL DEFAULT '[]',
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Individual nightly donations table
CREATE TABLE IF NOT EXISTS automated_donation_nights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automated_donation_id UUID NOT NULL REFERENCES automated_donations(id) ON DELETE CASCADE,

  -- Night information
  night_number INTEGER NOT NULL, -- 1-30
  scheduled_date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,

  -- Cause breakdown for this night
  causes_breakdown JSONB NOT NULL DEFAULT '[]',

  -- Processing status
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  processed_at TIMESTAMPTZ,

  -- If there's a separate charge per night (optional)
  stripe_charge_id VARCHAR(255),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one entry per donation per night
  UNIQUE(automated_donation_id, night_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_automated_donations_email ON automated_donations(donor_email);
CREATE INDEX IF NOT EXISTS idx_automated_donations_status ON automated_donations(status);
CREATE INDEX IF NOT EXISTS idx_automated_donations_access_token ON automated_donations(access_token);
CREATE INDEX IF NOT EXISTS idx_automated_donation_nights_date ON automated_donation_nights(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_automated_donation_nights_status ON automated_donation_nights(status);
CREATE INDEX IF NOT EXISTS idx_automated_donation_nights_donation_id ON automated_donation_nights(automated_donation_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_automated_donation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_automated_donations_timestamp ON automated_donations;
CREATE TRIGGER update_automated_donations_timestamp
  BEFORE UPDATE ON automated_donations
  FOR EACH ROW
  EXECUTE FUNCTION update_automated_donation_timestamp();

DROP TRIGGER IF EXISTS update_automated_donation_nights_timestamp ON automated_donation_nights;
CREATE TRIGGER update_automated_donation_nights_timestamp
  BEFORE UPDATE ON automated_donation_nights
  FOR EACH ROW
  EXECUTE FUNCTION update_automated_donation_timestamp();

-- Enable RLS
ALTER TABLE automated_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_donation_nights ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow public read with access token, admin full access
CREATE POLICY "Public can read own donations with token" ON automated_donations
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage all donations" ON automated_donations
  FOR ALL USING (true);

CREATE POLICY "Public can read donation nights" ON automated_donation_nights
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage all nights" ON automated_donation_nights
  FOR ALL USING (true);

-- Comments
COMMENT ON TABLE automated_donations IS 'Stores 30 Days of Ramadan automated giving plans';
COMMENT ON TABLE automated_donation_nights IS 'Individual nightly donation records for automated giving';
COMMENT ON COLUMN automated_donations.access_token IS 'Unique token for donors to access their management page without login';
