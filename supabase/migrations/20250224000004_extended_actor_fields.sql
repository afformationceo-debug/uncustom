-- Extended Apify actor output fields
-- 8 new columns for comprehensive actor data mapping

-- 1. Twitter authority metric (listed in X lists)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS listed_count INTEGER;

-- 2. Media/content total count (Twitter media, etc.)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS media_count INTEGER;

-- 3. Sponsored/ad content flag
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT false;

-- 4. Content type flags (for filtering original vs retweet/reply)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS is_retweet BOOLEAN DEFAULT false;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS is_reply BOOLEAN DEFAULT false;

-- 5. Mentioned users in content
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}';

-- 6. Music/audio metadata (Instagram Reels, TikTok)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS music_info JSONB;

-- 7. Content format type (clips, video, image, short, tweet, etc.)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS product_type TEXT;

-- Index for listed_count (Twitter authority)
CREATE INDEX IF NOT EXISTS idx_influencers_listed_count ON influencers(listed_count) WHERE listed_count IS NOT NULL;
