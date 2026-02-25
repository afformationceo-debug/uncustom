-- ============================================
-- Uncustom v2.0 - Deep Influencer Profiling
-- Content history, analytics snapshots, and scoring columns
-- ============================================

-- influencer_content_history: Individual feed posts from influencer
CREATE TABLE IF NOT EXISTS influencer_content_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  -- Content identification
  platform TEXT NOT NULL,
  content_url TEXT,
  content_platform_id TEXT,
  content_type TEXT, -- reel, post, story, video, short, tweet
  -- Content data
  caption TEXT,
  media_urls JSONB DEFAULT '[]',
  thumbnail_url TEXT,
  -- Metrics
  views_count BIGINT DEFAULT 0,
  likes_count BIGINT DEFAULT 0,
  comments_count BIGINT DEFAULT 0,
  shares_count BIGINT DEFAULT 0,
  saves_count BIGINT DEFAULT 0,
  engagement_rate DECIMAL(8,4),
  -- Timing
  posted_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  -- Classification
  content_category TEXT,
  content_theme TEXT,
  is_collaboration BOOLEAN DEFAULT false,
  collaboration_brand TEXT,
  is_sponsored BOOLEAN DEFAULT false,
  -- Brand detection
  brand_mentions TEXT[] DEFAULT '{}',
  product_mentions TEXT[] DEFAULT '{}',
  sponsorship_signals TEXT[] DEFAULT '{}',
  -- Media
  music_info JSONB,
  duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(influencer_id, platform, content_platform_id)
);

ALTER TABLE influencer_content_history ENABLE ROW LEVEL SECURITY;

-- Influencer data is team-agnostic (same pattern as influencers table)
CREATE POLICY "ich_select" ON influencer_content_history FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ich_insert" ON influencer_content_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ich_update" ON influencer_content_history FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_ich_influencer_posted ON influencer_content_history(influencer_id, posted_at DESC);
CREATE INDEX idx_ich_platform ON influencer_content_history(platform);
CREATE INDEX idx_ich_content_type ON influencer_content_history(content_type);
CREATE INDEX idx_ich_is_collaboration ON influencer_content_history(is_collaboration) WHERE is_collaboration = true;

-- influencer_analytics: Analysis snapshots (time series)
CREATE TABLE IF NOT EXISTS influencer_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  analysis_period_start TIMESTAMPTZ NOT NULL,
  analysis_period_end TIMESTAMPTZ NOT NULL,
  -- Growth
  follower_count_start BIGINT,
  follower_count_end BIGINT,
  follower_growth_rate DECIMAL(8,4),
  -- Engagement
  avg_engagement_rate DECIMAL(8,4),
  engagement_rate_trend TEXT, -- increasing, stable, decreasing
  -- Content
  posting_frequency DECIMAL(6,2), -- posts per week
  content_type_breakdown JSONB DEFAULT '{}',
  content_category_breakdown JSONB DEFAULT '{}',
  -- Brand collaborations
  brand_collab_count INT DEFAULT 0,
  brand_collab_frequency DECIMAL(6,2),
  brands_mentioned TEXT[] DEFAULT '{}',
  new_brand_partners TEXT[] DEFAULT '{}',
  -- Quality scores
  content_quality_score DECIMAL(4,2),
  audience_authenticity_score DECIMAL(4,2),
  influence_score DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE influencer_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_select" ON influencer_analytics FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ia_insert" ON influencer_analytics FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_ia_influencer_period ON influencer_analytics(influencer_id, analysis_period_end DESC);

-- Add 6 new columns to influencers table for quick filtering
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS influence_score DECIMAL(4,2);
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS content_quality_score DECIMAL(4,2);
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS audience_authenticity_score DECIMAL(4,2);
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS brand_collab_count INT DEFAULT 0;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS last_content_at TIMESTAMPTZ;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS commerce_enabled BOOLEAN DEFAULT false;

-- Indexes for new columns
CREATE INDEX idx_influencers_influence_score ON influencers(influence_score DESC NULLS LAST);
CREATE INDEX idx_influencers_content_quality ON influencers(content_quality_score DESC NULLS LAST);
CREATE INDEX idx_influencers_brand_collab_count ON influencers(brand_collab_count DESC NULLS LAST) WHERE brand_collab_count > 0;
CREATE INDEX idx_influencers_last_content ON influencers(last_content_at DESC NULLS LAST);
CREATE INDEX idx_influencers_commerce ON influencers(commerce_enabled) WHERE commerce_enabled = true;
