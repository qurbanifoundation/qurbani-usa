-- Track admin-generated manual charge links for over-the-phone payments.
-- Admins can generate a Stripe Checkout link from the abandoned-checkout
-- detail page, send it to a donor, and audit it later.
ALTER TABLE abandoned_checkouts
  ADD COLUMN IF NOT EXISTS admin_charge_link_url TEXT,
  ADD COLUMN IF NOT EXISTS admin_charge_link_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS admin_charge_link_created_at TIMESTAMPTZ;
