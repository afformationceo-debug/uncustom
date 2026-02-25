-- ============================================
-- Uncustom v2.0 - Data Refresh Scheduling
-- Schedule-based data refresh jobs + campaigns sns_accounts extension
-- ============================================

-- data_refresh_jobs: Schedule-based data refresh
CREATE TABLE IF NOT EXISTS data_refresh_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- brand_account, influencer_profile, influencer_content, brand_content, commerce
  entity_id UUID NOT NULL,
  refresh_interval_hours INT DEFAULT 168, -- default weekly
  priority INT DEFAULT 5, -- 1 (highest) to 10 (lowest)
  status TEXT DEFAULT 'scheduled', -- scheduled, queued, running, completed, failed
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  estimated_cost_usd DECIMAL(8,4),
  actual_cost_usd DECIMAL(8,4),
  error_message TEXT,
  run_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE data_refresh_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drj_select" ON data_refresh_jobs FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "drj_insert" ON data_refresh_jobs FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "drj_update" ON data_refresh_jobs FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "drj_delete" ON data_refresh_jobs FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

CREATE INDEX idx_drj_team ON data_refresh_jobs(team_id);
CREATE INDEX idx_drj_entity ON data_refresh_jobs(entity_type, entity_id);
CREATE INDEX idx_drj_next_run ON data_refresh_jobs(next_run_at) WHERE status = 'scheduled';
CREATE INDEX idx_drj_status ON data_refresh_jobs(status);

-- Add sns_accounts to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sns_accounts JSONB DEFAULT '[]';
