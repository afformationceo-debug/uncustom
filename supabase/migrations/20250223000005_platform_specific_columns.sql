-- Platform-specific columns for influencers table
-- Adds 13 new nullable columns to support Twitter, TikTok, YouTube, Instagram specific data

-- Twitter-specific
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS is_blue_verified boolean;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS verified_type text;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS location text;

-- TikTok-specific
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS heart_count bigint;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS share_count bigint;

-- YouTube-specific
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS total_views bigint;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS channel_joined_date timestamptz;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS is_monetized boolean;

-- Cross-platform
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS external_url text;

-- Engagement averages (computed from recent posts)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS avg_likes numeric;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS avg_comments numeric;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS avg_views numeric;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS avg_shares numeric;

-- Indexes for commonly filtered/sorted columns
CREATE INDEX IF NOT EXISTS idx_influencers_location ON influencers (location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencers_is_blue_verified ON influencers (is_blue_verified) WHERE is_blue_verified = true;
CREATE INDEX IF NOT EXISTS idx_influencers_heart_count ON influencers (heart_count DESC) WHERE heart_count IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencers_total_views ON influencers (total_views DESC) WHERE total_views IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencers_external_url ON influencers (external_url) WHERE external_url IS NOT NULL;
