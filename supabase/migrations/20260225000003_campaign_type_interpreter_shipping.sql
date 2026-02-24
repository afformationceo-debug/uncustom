-- Campaign type: visit (방문형) or shipping (배송형)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'visit';

-- Interpreter fields (visit type, between visit_scheduled_date and visit_completed)
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS interpreter_needed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS interpreter_name TEXT;

-- Shipping fields (shipping type)
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS shipping_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_received BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address TEXT;

-- Index for campaign type
CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_type ON campaigns(campaign_type);
