-- ============================================
-- Uncustom v2.0 - Brand-Influencer Content & Relationships
-- Individual content tracking and aggregated collaboration history
-- ============================================

-- brand_influencer_contents: Individual content where influencer mentions/tags a brand
CREATE TABLE IF NOT EXISTS brand_influencer_contents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_account_id UUID NOT NULL REFERENCES brand_accounts(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES influencers(id) ON DELETE SET NULL,
  influencer_username TEXT,
  -- Content identification
  platform TEXT NOT NULL,
  content_url TEXT,
  content_platform_id TEXT,
  content_type TEXT, -- reel, post, story, video, tweet, etc.
  -- Content data
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  mentions TEXT[] DEFAULT '{}',
  media_urls JSONB DEFAULT '[]',
  thumbnail_url TEXT,
  -- Metrics
  views_count BIGINT DEFAULT 0,
  likes_count BIGINT DEFAULT 0,
  comments_count BIGINT DEFAULT 0,
  shares_count BIGINT DEFAULT 0,
  saves_count BIGINT DEFAULT 0,
  engagement_rate DECIMAL(8,4),
  -- Timing (CRITICAL for collaboration cycle analysis)
  posted_at TIMESTAMPTZ,
  -- Classification
  is_sponsored BOOLEAN DEFAULT false,
  is_organic BOOLEAN DEFAULT true,
  sponsorship_indicators TEXT[] DEFAULT '{}',
  detected_products TEXT[] DEFAULT '{}',
  brand_mention_type TEXT, -- tagged, mentioned, hashtag, caption
  sentiment_score DECIMAL(4,2),
  sentiment_label TEXT, -- positive, neutral, negative
  -- Discovery
  discovered_via TEXT, -- tagged_scraper, mention_search, manual
  extraction_job_id UUID REFERENCES extraction_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(brand_account_id, platform, content_platform_id)
);

ALTER TABLE brand_influencer_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_influencer_contents_select" ON brand_influencer_contents FOR SELECT
  USING (brand_account_id IN (
    SELECT ba.id FROM brand_accounts ba WHERE ba.team_id IN (SELECT get_user_team_ids())
  ));
CREATE POLICY "brand_influencer_contents_insert" ON brand_influencer_contents FOR INSERT
  WITH CHECK (brand_account_id IN (
    SELECT ba.id FROM brand_accounts ba WHERE ba.team_id IN (SELECT get_user_team_ids())
  ));
CREATE POLICY "brand_influencer_contents_update" ON brand_influencer_contents FOR UPDATE
  USING (brand_account_id IN (
    SELECT ba.id FROM brand_accounts ba WHERE ba.team_id IN (SELECT get_user_team_ids())
  ));

CREATE INDEX idx_bic_brand_account_id ON brand_influencer_contents(brand_account_id);
CREATE INDEX idx_bic_influencer_id ON brand_influencer_contents(influencer_id);
CREATE INDEX idx_bic_platform ON brand_influencer_contents(platform);
CREATE INDEX idx_bic_posted_at ON brand_influencer_contents(posted_at DESC);
CREATE INDEX idx_bic_content_type ON brand_influencer_contents(content_type);

-- brand_influencer_relationships: Aggregated collaboration history
CREATE TABLE IF NOT EXISTS brand_influencer_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_account_id UUID NOT NULL REFERENCES brand_accounts(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  -- Stats
  total_collaborations INT DEFAULT 0,
  sponsored_count INT DEFAULT 0,
  organic_count INT DEFAULT 0,
  -- Performance
  avg_views BIGINT,
  avg_likes BIGINT,
  avg_comments BIGINT,
  avg_shares BIGINT,
  avg_engagement_rate DECIMAL(8,4),
  total_views BIGINT DEFAULT 0,
  -- Frequency
  first_collaboration_at TIMESTAMPTZ,
  last_collaboration_at TIMESTAMPTZ,
  avg_days_between_collabs DECIMAL(8,2),
  collaboration_recency_days INT,
  -- Scoring
  relationship_strength_score DECIMAL(4,2),
  estimated_collaboration_value DECIMAL(12,2),
  estimated_cpm DECIMAL(8,2),
  -- Type
  likely_payment_model TEXT, -- gifted, paid, affiliate, ambassador
  is_brand_ambassador BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_exclusive BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(brand_account_id, influencer_id)
);

ALTER TABLE brand_influencer_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bir_select" ON brand_influencer_relationships FOR SELECT
  USING (brand_account_id IN (
    SELECT ba.id FROM brand_accounts ba WHERE ba.team_id IN (SELECT get_user_team_ids())
  ));
CREATE POLICY "bir_insert" ON brand_influencer_relationships FOR INSERT
  WITH CHECK (brand_account_id IN (
    SELECT ba.id FROM brand_accounts ba WHERE ba.team_id IN (SELECT get_user_team_ids())
  ));
CREATE POLICY "bir_update" ON brand_influencer_relationships FOR UPDATE
  USING (brand_account_id IN (
    SELECT ba.id FROM brand_accounts ba WHERE ba.team_id IN (SELECT get_user_team_ids())
  ));

CREATE INDEX idx_bir_brand_account_id ON brand_influencer_relationships(brand_account_id);
CREATE INDEX idx_bir_influencer_id ON brand_influencer_relationships(influencer_id);
CREATE INDEX idx_bir_relationship_strength ON brand_influencer_relationships(relationship_strength_score DESC);
CREATE INDEX idx_bir_last_collab ON brand_influencer_relationships(last_collaboration_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE brand_influencer_relationships;
