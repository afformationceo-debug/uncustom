-- ============================================
-- Extend brand_accounts with additional profile data from Apify
-- biography, external_url, following_count, is_verified, etc.
-- ============================================

ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS biography TEXT;
ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS following_count BIGINT;
ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS is_business_account BOOLEAN DEFAULT false;
ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS business_category TEXT;
ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS avg_shares BIGINT;
ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS avg_saves BIGINT;
ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS raw_profile_data JSONB DEFAULT '{}';
