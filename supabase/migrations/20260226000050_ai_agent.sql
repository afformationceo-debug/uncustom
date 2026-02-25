-- ============================================
-- Uncustom v2.0 - AI Agent System
-- Conversations, actions, insights, and token usage tracking
-- ============================================

-- ai_conversations: Chat history
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  page_context TEXT, -- master, campaigns, manage, brands, etc.
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  title TEXT,
  messages JSONB DEFAULT '[]',
  model_id TEXT DEFAULT 'claude-opus-4-6',
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  total_cost_usd DECIMAL(10,6) DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conv_select" ON ai_conversations FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "ai_conv_insert" ON ai_conversations FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "ai_conv_update" ON ai_conversations FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "ai_conv_delete" ON ai_conversations FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

CREATE INDEX idx_ai_conv_team ON ai_conversations(team_id);
CREATE INDEX idx_ai_conv_user ON ai_conversations(user_id);
CREATE INDEX idx_ai_conv_campaign ON ai_conversations(campaign_id);

-- ai_actions: AI suggested action queue
CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- assign_campaign, send_email, update_status, create_proposal, start_extraction
  action_payload JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, executed, failed
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_actions_select" ON ai_actions FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "ai_actions_insert" ON ai_actions FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "ai_actions_update" ON ai_actions FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));

CREATE INDEX idx_ai_actions_team ON ai_actions(team_id);
CREATE INDEX idx_ai_actions_status ON ai_actions(status);
CREATE INDEX idx_ai_actions_conv ON ai_actions(conversation_id);

ALTER PUBLICATION supabase_realtime ADD TABLE ai_actions;

-- ai_insights: Auto-generated insights
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  insight_type TEXT NOT NULL, -- trend_alert, anomaly, opportunity, bottleneck, recommendation
  priority TEXT DEFAULT 'normal', -- low, normal, high, critical
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  page_context TEXT,
  dismissed BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_insights_select" ON ai_insights FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "ai_insights_insert" ON ai_insights FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "ai_insights_update" ON ai_insights FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));

CREATE INDEX idx_ai_insights_team ON ai_insights(team_id);
CREATE INDEX idx_ai_insights_campaign ON ai_insights(campaign_id);
CREATE INDEX idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX idx_ai_insights_priority ON ai_insights(priority);
CREATE INDEX idx_ai_insights_unread ON ai_insights(team_id, is_read) WHERE is_read = false;

ALTER PUBLICATION supabase_realtime ADD TABLE ai_insights;

-- ai_token_usage: Token usage tracking
CREATE TABLE IF NOT EXISTS ai_token_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  model_id TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  endpoint TEXT, -- chat, analyze, recommend, insights
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_select" ON ai_token_usage FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "ai_usage_insert" ON ai_token_usage FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));

CREATE INDEX idx_ai_usage_team ON ai_token_usage(team_id);
CREATE INDEX idx_ai_usage_user ON ai_token_usage(user_id);
CREATE INDEX idx_ai_usage_date ON ai_token_usage(created_at);
