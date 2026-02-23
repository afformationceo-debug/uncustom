-- Fix RLS policies for keywords, tagged_accounts, and extraction_jobs
-- to allow global rows (campaign_id IS NULL) for authenticated users

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can access campaign keywords" ON keywords;
DROP POLICY IF EXISTS "Users can access campaign tagged accounts" ON tagged_accounts;
DROP POLICY IF EXISTS "Users can access campaign extraction jobs" ON extraction_jobs;

-- Re-create with NULL campaign_id support
CREATE POLICY "Users can access keywords" ON keywords
  FOR ALL USING (
    campaign_id IS NULL AND auth.uid() IS NOT NULL
    OR
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );

CREATE POLICY "Users can access tagged accounts" ON tagged_accounts
  FOR ALL USING (
    campaign_id IS NULL AND auth.uid() IS NOT NULL
    OR
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );

CREATE POLICY "Users can access extraction jobs" ON extraction_jobs
  FOR ALL USING (
    campaign_id IS NULL AND auth.uid() IS NOT NULL
    OR
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );
