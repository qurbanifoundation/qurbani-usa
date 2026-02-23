-- Add trust message and default amounts columns to template_colors table
-- Run this in your Supabase SQL editor

ALTER TABLE template_colors
ADD COLUMN IF NOT EXISTS trust_message_text VARCHAR(255) DEFAULT 'Donating through Qurbani Foundation is safe, secure, and easy with many payment options to choose from.';

ALTER TABLE template_colors
ADD COLUMN IF NOT EXISTS trust_link_text VARCHAR(100) DEFAULT 'View other ways to donate';

ALTER TABLE template_colors
ADD COLUMN IF NOT EXISTS trust_link_url VARCHAR(255) DEFAULT '/donate';

ALTER TABLE template_colors
ADD COLUMN IF NOT EXISTS default_amounts JSONB DEFAULT '[{"amount":30,"label":"Feed a family"},{"amount":50,"label":"Provide essentials"},{"amount":80,"label":"Emergency aid"},{"amount":100,"label":"Medical supplies"},{"amount":250,"label":"Transform lives"},{"amount":1000,"label":"Major impact"}]';
