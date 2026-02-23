-- Site Settings Table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  site_name TEXT DEFAULT 'Qurbani Foundation USA',
  site_tagline TEXT DEFAULT 'A Muslim Charity Serving Humanity',
  site_logo TEXT DEFAULT 'https://www.staging9.qurbani.com/wp-content/uploads/2021/07/QurbaniFoundation-Logo-2.png',

  -- Contact Info
  contact_phone TEXT DEFAULT '+1 (703) 596-4900',
  contact_toll_free TEXT DEFAULT '1-800-900-0027',
  contact_email TEXT DEFAULT 'info@qurbaniusa.org',
  contact_address_street TEXT DEFAULT '145 Sherwood Ave',
  contact_address_city TEXT DEFAULT 'Teaneck',
  contact_address_state TEXT DEFAULT 'NJ',
  contact_address_zip TEXT DEFAULT '07666',

  -- Social Media
  social_facebook TEXT DEFAULT 'https://facebook.com/qurbaniusa',
  social_youtube TEXT DEFAULT 'https://youtube.com/qurbaniusa',
  social_instagram TEXT DEFAULT 'https://instagram.com/qurbaniusa',
  social_twitter TEXT DEFAULT 'https://twitter.com/qurbaniusa',

  -- Footer
  footer_about TEXT DEFAULT 'A Muslim charity dedicated to alleviating suffering of the world''s poorest people. Operating in 53+ countries since 1999.',
  footer_zakat_policy TEXT DEFAULT '100% Zakat Policy',
  footer_ein TEXT DEFAULT '38-4109716',
  footer_copyright TEXT DEFAULT 'Qurbani Foundation USA (Al Mustafa Relief Aid USA). All rights reserved.',

  -- Donate Button
  donate_button_text TEXT DEFAULT 'DONATE NOW',
  donate_button_href TEXT DEFAULT '/donate',
  donate_button_color TEXT DEFAULT '#fdc448',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default row if not exists
INSERT INTO site_settings (id) VALUES ('main') ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read" ON site_settings FOR SELECT USING (true);

-- Allow authenticated users to update (for admin)
CREATE POLICY "Allow authenticated update" ON site_settings FOR UPDATE USING (true);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_site_settings_updated_at ON site_settings;
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
