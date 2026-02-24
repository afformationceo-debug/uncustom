-- Add shipping_carrier column for tracking which delivery company
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS shipping_carrier TEXT;
