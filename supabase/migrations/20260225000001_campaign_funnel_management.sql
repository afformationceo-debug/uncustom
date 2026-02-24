-- Campaign Funnel Management: Extend campaign_influencers + Create activity log
-- 15-step funnel: extracted → contacted → interested → client_approved → confirmed →
--   guideline_sent → crm_registered → visit_scheduled → visited →
--   upload_pending → uploaded → completed → settled (+ declined, dropped)

-- =============================================================================
-- 1. ALTER campaign_influencers: Add funnel management columns
-- =============================================================================

-- Funnel status (replaces legacy 7-step status)
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS funnel_status TEXT NOT NULL DEFAULT 'extracted';

-- Outreach
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS outreach_round INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_outreach_at TIMESTAMPTZ;

-- Reply
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS reply_channel TEXT,
  ADD COLUMN IF NOT EXISTS reply_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_summary TEXT;

-- Confirmation
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS interest_confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interest_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_note TEXT,
  ADD COLUMN IF NOT EXISTS final_confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_confirmed_at TIMESTAMPTZ;

-- Payment
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS payment_amount DECIMAL,
  ADD COLUMN IF NOT EXISTS payment_currency TEXT NOT NULL DEFAULT 'KRW',
  ADD COLUMN IF NOT EXISTS invoice_amount DECIMAL,
  ADD COLUMN IF NOT EXISTS invoice_currency TEXT NOT NULL DEFAULT 'KRW';

-- Guideline
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS guideline_url TEXT,
  ADD COLUMN IF NOT EXISTS guideline_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guideline_sent_at TIMESTAMPTZ;

-- CRM
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS crm_registered BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crm_registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS crm_note TEXT;

-- Visit
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS visit_scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS visit_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visit_completed_at TIMESTAMPTZ;

-- Upload
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS upload_url TEXT,
  ADD COLUMN IF NOT EXISTS content_metrics_cache JSONB;

-- Settlement
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS settlement_info JSONB,
  ADD COLUMN IF NOT EXISTS influencer_payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS influencer_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS influencer_paid_amount DECIMAL,
  ADD COLUMN IF NOT EXISTS client_payment_status TEXT NOT NULL DEFAULT 'uninvoiced',
  ADD COLUMN IF NOT EXISTS client_invoiced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_paid_amount DECIMAL;

-- Second funnel
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS second_funnel_campaign_id UUID REFERENCES campaigns(id),
  ADD COLUMN IF NOT EXISTS second_funnel_status TEXT;

-- =============================================================================
-- 2. Backfill funnel_status from legacy status
-- =============================================================================
UPDATE campaign_influencers SET funnel_status = status WHERE funnel_status = 'extracted' AND status != 'extracted';

-- =============================================================================
-- 3. Create funnel_activity_log table
-- =============================================================================
CREATE TABLE IF NOT EXISTS funnel_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_influencer_id UUID REFERENCES campaign_influencers(id) ON DELETE CASCADE,
  campaign_id UUID,
  influencer_id UUID,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  performed_by UUID,
  performed_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 4. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_ci_funnel_status ON campaign_influencers(funnel_status);
CREATE INDEX IF NOT EXISTS idx_ci_interest_confirmed ON campaign_influencers(interest_confirmed) WHERE interest_confirmed = true;
CREATE INDEX IF NOT EXISTS idx_ci_client_approved ON campaign_influencers(client_approved) WHERE client_approved = true;
CREATE INDEX IF NOT EXISTS idx_ci_final_confirmed ON campaign_influencers(final_confirmed) WHERE final_confirmed = true;
CREATE INDEX IF NOT EXISTS idx_ci_visit_completed ON campaign_influencers(visit_completed) WHERE visit_completed = true;
CREATE INDEX IF NOT EXISTS idx_ci_influencer_payment_status ON campaign_influencers(influencer_payment_status);
CREATE INDEX IF NOT EXISTS idx_ci_client_payment_status ON campaign_influencers(client_payment_status);
CREATE INDEX IF NOT EXISTS idx_ci_visit_scheduled_date ON campaign_influencers(visit_scheduled_date);
CREATE INDEX IF NOT EXISTS idx_ci_upload_deadline ON campaign_influencers(upload_deadline);

-- Activity log indexes
CREATE INDEX IF NOT EXISTS idx_fal_campaign_influencer_id ON funnel_activity_log(campaign_influencer_id);
CREATE INDEX IF NOT EXISTS idx_fal_campaign_id ON funnel_activity_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fal_performed_at ON funnel_activity_log(performed_at DESC);

-- =============================================================================
-- 5. RLS for funnel_activity_log
-- =============================================================================
ALTER TABLE funnel_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view activity logs" ON funnel_activity_log
  FOR SELECT USING (
    campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN team_members tm ON tm.team_id = c.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert activity logs" ON funnel_activity_log
  FOR INSERT WITH CHECK (
    campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN team_members tm ON tm.team_id = c.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 6. Realtime for funnel_activity_log
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE funnel_activity_log;
