-- Additional Realtime + Performance Indexes
-- influencer_links realtime for tracking email scraping progress
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE influencer_links;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_influencer_links_scraped ON influencer_links(scraped);
CREATE INDEX IF NOT EXISTS idx_influencers_follower_count ON influencers(follower_count);
CREATE INDEX IF NOT EXISTS idx_influencers_email ON influencers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencers_platform_follower ON influencers(platform, follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_influencers_country ON influencers(country) WHERE country IS NOT NULL;
