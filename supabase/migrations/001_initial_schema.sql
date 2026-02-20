-- ============================================
-- QURBANI USA - Initial Database Schema
-- ============================================

-- Note: Using gen_random_uuid() which is built into PostgreSQL 13+

-- ============================================
-- ENUMS
-- ============================================

-- User roles
CREATE TYPE user_role AS ENUM ('admin', 'operations', 'support', 'donor');

-- Order status
CREATE TYPE order_status AS ENUM (
  'pending',
  'paid',
  'processing',
  'fulfilled',
  'partially_fulfilled',
  'cancelled',
  'refunded'
);

-- Fulfillment status
CREATE TYPE fulfillment_status AS ENUM (
  'pending',
  'scheduled',
  'in_progress',
  'completed',
  'failed'
);

-- ============================================
-- PROFILES TABLE (linked to auth.users)
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'donor',
  avatar_url TEXT,
  ghl_contact_id TEXT, -- GoHighLevel contact ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_ghl_contact_id ON profiles(ghl_contact_id);

-- ============================================
-- DONORS TABLE (extended donor info)
-- ============================================

CREATE TABLE donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  stripe_customer_id TEXT,
  ghl_contact_id TEXT,
  total_donated DECIMAL(10,2) DEFAULT 0,
  donation_count INTEGER DEFAULT 0,
  first_donation_at TIMESTAMPTZ,
  last_donation_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_donors_email ON donors(email);
CREATE INDEX idx_donors_profile_id ON donors(profile_id);
CREATE INDEX idx_donors_stripe_customer_id ON donors(stripe_customer_id);

-- ============================================
-- CAMPAIGNS TABLE (with SEO fields)
-- ============================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  long_description TEXT,
  country TEXT NOT NULL,
  region TEXT,
  image_url TEXT,
  hero_image_url TEXT,
  goal_amount DECIMAL(10,2),
  raised_amount DECIMAL(10,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  -- SEO fields
  meta_title TEXT,
  meta_description TEXT,
  og_image_url TEXT,
  canonical_url TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_slug ON campaigns(slug);
CREATE INDEX idx_campaigns_country ON campaigns(country);
CREATE INDEX idx_campaigns_is_active ON campaigns(is_active);

-- ============================================
-- PACKAGES TABLE
-- ============================================

CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  animal_type TEXT, -- goat, sheep, cow, cow_share
  shares_per_animal INTEGER DEFAULT 1, -- 7 for cow shares
  feeds_families TEXT, -- "4-5 families"
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  stripe_price_id TEXT,
  -- Inventory (optional)
  stock_quantity INTEGER,
  max_per_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, slug)
);

CREATE INDEX idx_packages_campaign_id ON packages(campaign_id);
CREATE INDEX idx_packages_is_active ON packages(is_active);

-- ============================================
-- ORDERS TABLE
-- ============================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  donor_id UUID REFERENCES donors(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Contact info (denormalized for receipts)
  donor_email TEXT NOT NULL,
  donor_name TEXT NOT NULL,
  donor_phone TEXT,
  -- Amounts
  subtotal DECIMAL(10,2) NOT NULL,
  processing_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  -- Payment
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  -- Status
  status order_status NOT NULL DEFAULT 'pending',
  -- Fulfillment
  fulfillment_notes TEXT,
  -- On behalf of (for Qurbani on behalf of someone)
  on_behalf_of TEXT,
  -- Admin notes
  internal_notes TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_donor_id ON orders(donor_id);
CREATE INDEX idx_orders_profile_id ON orders(profile_id);
CREATE INDEX idx_orders_donor_email ON orders(donor_email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_stripe_checkout_session_id ON orders(stripe_checkout_session_id);

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  -- Denormalized for historical records
  package_name TEXT NOT NULL,
  campaign_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  -- On behalf of (specific to this item)
  on_behalf_of TEXT,
  -- Fulfillment status for this item
  fulfillment_status fulfillment_status DEFAULT 'pending',
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_package_id ON order_items(package_id);
CREATE INDEX idx_order_items_campaign_id ON order_items(campaign_id);

-- ============================================
-- FULFILLMENTS TABLE
-- ============================================

CREATE TABLE fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  -- Location info
  country TEXT,
  region TEXT,
  location_details TEXT,
  -- Fulfillment info
  scheduled_date DATE,
  completed_date DATE,
  status fulfillment_status NOT NULL DEFAULT 'pending',
  -- Media
  photo_urls TEXT[], -- Array of photo URLs
  video_url TEXT,
  -- Staff
  fulfilled_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fulfillments_order_id ON fulfillments(order_id);
CREATE INDEX idx_fulfillments_status ON fulfillments(status);
CREATE INDEX idx_fulfillments_scheduled_date ON fulfillments(scheduled_date);

-- ============================================
-- FULFILLMENT EVENTS (Status History)
-- ============================================

CREATE TABLE fulfillment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'status_change', 'note_added', 'photo_added', etc.
  previous_status fulfillment_status,
  new_status fulfillment_status,
  description TEXT,
  metadata JSONB,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fulfillment_events_fulfillment_id ON fulfillment_events(fulfillment_id);
CREATE INDEX idx_fulfillment_events_order_id ON fulfillment_events(order_id);
CREATE INDEX idx_fulfillment_events_created_at ON fulfillment_events(created_at DESC);

-- ============================================
-- RECEIPTS TABLE
-- ============================================

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL UNIQUE,
  donor_id UUID REFERENCES donors(id),
  -- Receipt details
  donor_name TEXT NOT NULL,
  donor_email TEXT NOT NULL,
  donor_address TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  -- Tax info
  is_tax_deductible BOOLEAN DEFAULT true,
  tax_year INTEGER,
  -- PDF storage
  pdf_url TEXT,
  -- Email tracking
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipts_order_id ON receipts(order_id);
CREATE INDEX idx_receipts_donor_id ON receipts(donor_id);
CREATE INDEX idx_receipts_receipt_number ON receipts(receipt_number);
CREATE INDEX idx_receipts_tax_year ON receipts(tax_year);

-- ============================================
-- SEO SETTINGS TABLE (Global defaults)
-- ============================================

CREATE TABLE seo_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name TEXT DEFAULT 'Qurbani Foundation USA',
  default_title TEXT DEFAULT 'Qurbani Foundation USA - Fulfill Your Qurbani Obligation',
  default_description TEXT DEFAULT 'Fulfill your Qurbani obligation with Qurbani Foundation USA. We distribute fresh meat to families in need worldwide.',
  default_og_image TEXT,
  twitter_handle TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  youtube_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO seo_settings (site_name) VALUES ('Qurbani Foundation USA');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  random_part TEXT;
  new_number TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YY');
  random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  new_number := 'QRB-' || year_part || '-' || random_part;
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate receipt numbers
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_part TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  seq_part := LPAD(NEXTVAL('receipt_seq')::TEXT, 6, '0');
  RETURN 'RCP-' || year_part || '-' || seq_part;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for receipts
CREATE SEQUENCE IF NOT EXISTS receipt_seq START 1;

-- Trigger to auto-generate order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_donors_updated_at BEFORE UPDATE ON donors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_packages_updated_at BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_fulfillments_updated_at BEFORE UPDATE ON fulfillments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_seo_settings_updated_at BEFORE UPDATE ON seo_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to handle new user signup (creates profile)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'donor'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is staff
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'operations', 'support')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = 'donor'); -- Can't change own role

CREATE POLICY "Staff can view all profiles"
  ON profiles FOR SELECT
  USING (is_staff());

CREATE POLICY "Admin can update any profile"
  ON profiles FOR UPDATE
  USING (is_admin());

-- DONORS POLICIES
CREATE POLICY "Donors can view own record"
  ON donors FOR SELECT
  USING (profile_id = auth.uid() OR email = (SELECT email FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Staff can view all donors"
  ON donors FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can manage donors"
  ON donors FOR ALL
  USING (is_staff());

-- CAMPAIGNS POLICIES (public read, staff write)
CREATE POLICY "Anyone can view active campaigns"
  ON campaigns FOR SELECT
  USING (is_active = true);

CREATE POLICY "Staff can view all campaigns"
  ON campaigns FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can manage campaigns"
  ON campaigns FOR ALL
  USING (is_staff());

-- PACKAGES POLICIES (public read, staff write)
CREATE POLICY "Anyone can view active packages"
  ON packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Staff can view all packages"
  ON packages FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can manage packages"
  ON packages FOR ALL
  USING (is_staff());

-- ORDERS POLICIES
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (profile_id = auth.uid() OR donor_email = (SELECT email FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  WITH CHECK (true); -- Allow anyone to create (guest checkout)

CREATE POLICY "Staff can view all orders"
  ON orders FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can manage orders"
  ON orders FOR ALL
  USING (is_staff());

-- ORDER ITEMS POLICIES
CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.profile_id = auth.uid() OR orders.donor_email = (SELECT email FROM profiles WHERE id = auth.uid()))
    )
  );

CREATE POLICY "Staff can view all order items"
  ON order_items FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can manage order items"
  ON order_items FOR ALL
  USING (is_staff());

-- FULFILLMENTS POLICIES
CREATE POLICY "Users can view own fulfillments"
  ON fulfillments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = fulfillments.order_id
      AND (orders.profile_id = auth.uid() OR orders.donor_email = (SELECT email FROM profiles WHERE id = auth.uid()))
    )
  );

CREATE POLICY "Staff can manage fulfillments"
  ON fulfillments FOR ALL
  USING (is_staff());

-- FULFILLMENT EVENTS POLICIES
CREATE POLICY "Users can view own fulfillment events"
  ON fulfillment_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = fulfillment_events.order_id
      AND (orders.profile_id = auth.uid() OR orders.donor_email = (SELECT email FROM profiles WHERE id = auth.uid()))
    )
  );

CREATE POLICY "Staff can manage fulfillment events"
  ON fulfillment_events FOR ALL
  USING (is_staff());

-- RECEIPTS POLICIES
CREATE POLICY "Users can view own receipts"
  ON receipts FOR SELECT
  USING (
    donor_id IN (SELECT id FROM donors WHERE profile_id = auth.uid())
    OR donor_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Staff can manage receipts"
  ON receipts FOR ALL
  USING (is_staff());

-- SEO SETTINGS POLICIES (public read, admin write)
CREATE POLICY "Anyone can view SEO settings"
  ON seo_settings FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage SEO settings"
  ON seo_settings FOR ALL
  USING (is_admin());

-- ============================================
-- SAMPLE DATA (Optional - for development)
-- ============================================

-- Insert sample campaigns
INSERT INTO campaigns (slug, name, description, country, image_url, goal_amount, is_active, is_featured, meta_title, meta_description) VALUES
('qurbani-2026', 'Qurbani 2026', 'Fulfill your Qurbani obligation this Eid al-Adha', 'Global', 'https://images.unsplash.com/photo-1569288063643-5d29ad6ad7d8?w=800', 500000, true, true, 'Qurbani 2026 - Eid al-Adha Sacrifice', 'Give your Qurbani and feed families in need this Eid al-Adha 2026'),
('pakistan', 'Pakistan Qurbani', 'Qurbani distribution in Pakistan', 'Pakistan', 'https://images.unsplash.com/photo-1586076469182-38e78b8a6bba?w=800', 100000, true, false, 'Pakistan Qurbani - Feed Families in Need', 'Your Qurbani reaches families in Pakistan within 24 hours'),
('bangladesh', 'Bangladesh Qurbani', 'Qurbani distribution in Bangladesh', 'Bangladesh', 'https://images.unsplash.com/photo-1596434300655-e48d3ff3dd5e?w=800', 80000, true, false, 'Bangladesh Qurbani', 'Provide fresh meat to families in Bangladesh'),
('yemen', 'Yemen Emergency', 'Emergency Qurbani for Yemen crisis', 'Yemen', 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800', 150000, true, true, 'Yemen Emergency Qurbani', 'Urgent food relief for families in Yemen');

-- Insert sample packages
INSERT INTO packages (campaign_id, slug, name, description, price, animal_type, shares_per_animal, feeds_families, is_active, is_featured, sort_order) VALUES
((SELECT id FROM campaigns WHERE slug = 'qurbani-2026'), 'goat-sheep', 'Goat / Sheep', 'One whole goat or sheep sacrificed according to Islamic guidelines', 150, 'goat', 1, '4-5 families', true, false, 1),
((SELECT id FROM campaigns WHERE slug = 'qurbani-2026'), 'cow-share', 'Cow Share (1/7)', 'One-seventh share of a cow sacrifice', 195, 'cow_share', 7, '2-3 families', true, true, 2),
((SELECT id FROM campaigns WHERE slug = 'qurbani-2026'), 'full-cow', 'Full Cow', 'Entire cow sacrifice, equivalent to 7 Qurbanis', 1350, 'cow', 1, '15-20 families', true, false, 3),
((SELECT id FROM campaigns WHERE slug = 'qurbani-2026'), 'premium', 'Premium Qurbani', 'Premium quality animal with expedited distribution', 295, 'premium', 1, '5-7 families', true, false, 4),
((SELECT id FROM campaigns WHERE slug = 'pakistan'), 'pakistan-goat', 'Pakistan Goat', 'Goat sacrifice in Pakistan', 120, 'goat', 1, '4-5 families', true, false, 1),
((SELECT id FROM campaigns WHERE slug = 'pakistan'), 'pakistan-cow-share', 'Pakistan Cow Share', 'Cow share sacrifice in Pakistan', 150, 'cow_share', 7, '2-3 families', true, true, 2),
((SELECT id FROM campaigns WHERE slug = 'bangladesh'), 'bangladesh-goat', 'Bangladesh Goat', 'Goat sacrifice in Bangladesh', 110, 'goat', 1, '4-5 families', true, false, 1),
((SELECT id FROM campaigns WHERE slug = 'yemen'), 'yemen-goat', 'Yemen Emergency Goat', 'Emergency goat sacrifice in Yemen', 140, 'goat', 1, '4-5 families', true, true, 1);
