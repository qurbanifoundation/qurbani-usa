-- GoHighLevel Integration Tables
-- Creates leads table for form submissions and ghl_tokens for secure credential storage

-- ============================================
-- LEADS TABLE
-- Stores all form submissions (contact, newsletter, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact Information
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(50),

  -- Lead Source & Context
  source VARCHAR(50) NOT NULL DEFAULT 'website',  -- 'contact_form', 'newsletter', 'donation', 'zakat_calculator'
  subject VARCHAR(100),
  message TEXT,

  -- Form metadata
  form_data JSONB,  -- Store any additional form fields
  page_url VARCHAR(500),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),

  -- GHL Integration
  ghl_contact_id VARCHAR(100),
  ghl_synced_at TIMESTAMPTZ,
  ghl_sync_error TEXT,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'new',  -- 'new', 'contacted', 'qualified', 'converted', 'closed'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_ghl_contact_id ON leads(ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- ============================================
-- GHL TOKENS TABLE
-- Secure storage for GoHighLevel OAuth tokens
-- ============================================
CREATE TABLE IF NOT EXISTS ghl_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- GHL identifiers
  location_id VARCHAR(100) NOT NULL UNIQUE,

  -- OAuth tokens (encrypted at rest by Supabase)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type VARCHAR(50) DEFAULT 'Bearer',

  -- Token expiry
  expires_at TIMESTAMPTZ,

  -- Metadata
  scopes TEXT[],

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GHL WEBHOOK LOGS TABLE
-- Track incoming webhooks from GHL
-- ============================================
CREATE TABLE IF NOT EXISTS ghl_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Webhook data
  event_type VARCHAR(100),
  contact_id VARCHAR(100),
  payload JSONB,

  -- Processing status
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ghl_webhook_logs_contact_id ON ghl_webhook_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_ghl_webhook_logs_processed ON ghl_webhook_logs(processed);

-- ============================================
-- UPDATED_AT TRIGGER
-- Auto-update updated_at on row changes
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to leads table
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to ghl_tokens table
DROP TRIGGER IF EXISTS update_ghl_tokens_updated_at ON ghl_tokens;
CREATE TRIGGER update_ghl_tokens_updated_at
  BEFORE UPDATE ON ghl_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policies for leads (service role only for writes, anon can insert)
CREATE POLICY "Allow anonymous lead submissions" ON leads
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Service role full access to leads" ON leads
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for ghl_tokens (service role only)
CREATE POLICY "Service role only for ghl_tokens" ON ghl_tokens
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for ghl_webhook_logs (service role only)
CREATE POLICY "Service role only for ghl_webhook_logs" ON ghl_webhook_logs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE leads IS 'Stores all form submissions and lead data from the website';
COMMENT ON TABLE ghl_tokens IS 'Secure storage for GoHighLevel OAuth tokens - never expose to frontend';
COMMENT ON TABLE ghl_webhook_logs IS 'Logs all incoming webhooks from GoHighLevel for debugging and replay';
