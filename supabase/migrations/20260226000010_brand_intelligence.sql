-- ============================================
-- Uncustom v2.0 - Brand Intelligence
-- Brand account registration, analysis, and monitoring
-- ============================================

-- brand_accounts: Target brand account registration and analysis
CREATE TABLE IF NOT EXISTS brand_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  platform_id TEXT,
  display_name TEXT,
  profile_url TEXT,
  profile_image_url TEXT,
  -- Brand metadata (user input)
  brand_name TEXT,
  brand_group TEXT,
  industry TEXT,
  sub_category TEXT,
  target_countries TEXT[] DEFAULT '{}',
  target_demographics JSONB DEFAULT '{}',
  -- Metrics (scraped)
  follower_count BIGINT,
  engagement_rate DECIMAL(8,4),
  avg_likes BIGINT,
  avg_comments BIGINT,
  avg_views BIGINT,
  post_count BIGINT,
  -- Analysis computed
  content_style TEXT[] DEFAULT '{}',
  posting_frequency TEXT,
  brand_voice TEXT,
  top_hashtags TEXT[] DEFAULT '{}',
  primary_content_types TEXT[] DEFAULT '{}',
  audience_quality_score DECIMAL(4,2),
  -- Competition
  competitor_of UUID[] DEFAULT '{}',
  -- Scheduling
  analysis_enabled BOOLEAN DEFAULT false,
  analysis_interval_hours INT DEFAULT 168,
  last_analyzed_at TIMESTAMPTZ,
  next_analysis_at TIMESTAMPTZ,
  -- Notes
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, platform, username)
);

-- Enable RLS
ALTER TABLE brand_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "brand_accounts_select" ON brand_accounts FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "brand_accounts_insert" ON brand_accounts FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "brand_accounts_update" ON brand_accounts FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "brand_accounts_delete" ON brand_accounts FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

-- Indexes
CREATE INDEX idx_brand_accounts_team_id ON brand_accounts(team_id);
CREATE INDEX idx_brand_accounts_platform ON brand_accounts(platform);
CREATE INDEX idx_brand_accounts_campaign_id ON brand_accounts(campaign_id);
CREATE INDEX idx_brand_accounts_industry ON brand_accounts(industry);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE brand_accounts;

-- brand_account_analysis: Brand analysis snapshots (time series)
CREATE TABLE IF NOT EXISTS brand_account_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_account_id UUID NOT NULL REFERENCES brand_accounts(id) ON DELETE CASCADE,
  analysis_period_start TIMESTAMPTZ NOT NULL,
  analysis_period_end TIMESTAMPTZ NOT NULL,
  -- Growth
  follower_count_start BIGINT,
  follower_count_end BIGINT,
  follower_growth_rate DECIMAL(8,4),
  post_count_delta INT,
  -- Engagement
  avg_engagement_rate DECIMAL(8,4),
  avg_likes BIGINT,
  avg_comments BIGINT,
  avg_views BIGINT,
  avg_shares BIGINT,
  avg_saves BIGINT,
  -- Content breakdown
  content_type_breakdown JSONB DEFAULT '{}',
  content_category_breakdown JSONB DEFAULT '{}',
  top_performing_content JSONB DEFAULT '[]',
  -- Audience
  audience_demographics JSONB DEFAULT '{}',
  -- Hashtags
  hashtags_used JSONB DEFAULT '{}',
  new_hashtags TEXT[] DEFAULT '{}',
  -- Influencer mentions
  influencer_mentions_count INT DEFAULT 0,
  new_influencer_partners INT DEFAULT 0,
  -- Metadata
  extraction_job_id UUID REFERENCES extraction_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE brand_account_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_account_analysis_select" ON brand_account_analysis FOR SELECT
  USING (brand_account_id IN (
    SELECT ba.id FROM brand_accounts ba WHERE ba.team_id IN (SELECT get_user_team_ids())
  ));
CREATE POLICY "brand_account_analysis_insert" ON brand_account_analysis FOR INSERT
  WITH CHECK (brand_account_id IN (
    SELECT ba.id FROM brand_accounts ba WHERE ba.team_id IN (SELECT get_user_team_ids())
  ));

CREATE INDEX idx_brand_account_analysis_brand_id ON brand_account_analysis(brand_account_id);
CREATE INDEX idx_brand_account_analysis_period ON brand_account_analysis(analysis_period_start, analysis_period_end);
