-- Add unsubscribe tracking column to abandoned_checkouts
ALTER TABLE abandoned_checkouts
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ DEFAULT NULL;
