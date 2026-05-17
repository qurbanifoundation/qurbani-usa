-- Capture cart line items on abandoned checkouts so admin recovery view can
-- show what the donor actually had in their cart. Mirrors donations.items
-- shape: JSONB array of { id, name, campaign, amount, quantity, type,
-- label, metadata, ... }.
ALTER TABLE abandoned_checkouts
  ADD COLUMN IF NOT EXISTS items JSONB;

-- Free-form cart-level metadata (cover_fees, fee_amount, base_amount,
-- billing_address, etc.) — same flexible JSONB pattern used on donations.
ALTER TABLE abandoned_checkouts
  ADD COLUMN IF NOT EXISTS cart_metadata JSONB;
