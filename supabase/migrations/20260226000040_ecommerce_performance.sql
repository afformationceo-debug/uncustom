-- ============================================
-- Uncustom v2.0 - E-commerce Performance
-- Commerce tracking, sales aggregation, and ROAS
-- ============================================

CREATE TABLE IF NOT EXISTS influencer_commerce (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  -- Shop links
  tiktok_shop_url TEXT,
  tiktok_shop_id TEXT,
  instagram_shop_url TEXT,
  affiliate_links JSONB DEFAULT '[]',
  affiliate_code TEXT,
  -- Sales aggregate
  total_clicks BIGINT DEFAULT 0,
  total_orders BIGINT DEFAULT 0,
  total_revenue DECIMAL(14,2) DEFAULT 0,
  total_commission DECIMAL(14,2) DEFAULT 0,
  conversion_rate DECIMAL(8,4),
  average_order_value DECIMAL(10,2),
  -- ROAS
  campaign_spend DECIMAL(14,2),
  roas DECIMAL(8,2),
  cpa DECIMAL(10,2),
  cpe DECIMAL(10,2),
  -- Products
  products_sold JSONB DEFAULT '[]',
  top_product TEXT,
  product_categories TEXT[] DEFAULT '{}',
  -- Commission
  commission_rate DECIMAL(6,4),
  commission_model TEXT, -- flat, percentage, hybrid
  -- Metadata
  data_source TEXT, -- tiktok_shop, instagram_shop, manual, affiliate_network
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(influencer_id)
);

ALTER TABLE influencer_commerce ENABLE ROW LEVEL SECURITY;

-- Influencer data is team-agnostic (same pattern as influencers table)
CREATE POLICY "ic_select" ON influencer_commerce FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ic_insert" ON influencer_commerce FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ic_update" ON influencer_commerce FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_ic_influencer_id ON influencer_commerce(influencer_id);
CREATE INDEX idx_ic_total_revenue ON influencer_commerce(total_revenue DESC NULLS LAST);
CREATE INDEX idx_ic_roas ON influencer_commerce(roas DESC NULLS LAST);
