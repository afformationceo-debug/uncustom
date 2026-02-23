-- Additional performance indexes for extraction pipeline and master queries

-- Composite index for extraction_jobs lookup by type and status
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_type_status
  ON extraction_jobs(type, status);

-- Composite index for extraction_jobs lookup by campaign, type, and status
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_campaign_type_status
  ON extraction_jobs(campaign_id, type, status);

-- Partial index for influencers with email_source (only non-null rows)
CREATE INDEX IF NOT EXISTS idx_influencers_email_source
  ON influencers(email_source) WHERE email_source IS NOT NULL;
