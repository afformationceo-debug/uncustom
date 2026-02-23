-- Add columns for bulk import, advanced filtering, and profile enrichment
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS is_business boolean DEFAULT false;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS import_source text;

-- Index for advanced filtering queries
CREATE INDEX IF NOT EXISTS idx_influencers_country ON influencers(country);
CREATE INDEX IF NOT EXISTS idx_influencers_follower_count ON influencers(follower_count);
CREATE INDEX IF NOT EXISTS idx_influencers_category ON influencers(category);
CREATE INDEX IF NOT EXISTS idx_influencers_is_verified ON influencers(is_verified) WHERE is_verified = true;
CREATE INDEX IF NOT EXISTS idx_influencers_import_source ON influencers(import_source);
CREATE INDEX IF NOT EXISTS idx_influencers_email_not_null ON influencers(email) WHERE email IS NOT NULL;
