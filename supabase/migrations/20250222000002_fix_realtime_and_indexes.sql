-- Fix: 5 tables missing from realtime publication
-- UI uses useRealtime() on these but they were never added to publication
-- Use DO block to handle "already exists" gracefully
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE influencers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE email_templates;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tagged_accounts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE campaign_sns_accounts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE influencer_contents;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Missing performance indexes
CREATE INDEX IF NOT EXISTS idx_keywords_campaign_id ON keywords(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tagged_accounts_campaign_id ON tagged_accounts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_influencer_links_influencer_id ON influencer_links(influencer_id);
