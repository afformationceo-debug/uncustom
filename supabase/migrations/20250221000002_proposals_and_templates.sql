-- Phase 2: Proposals & Template System Migration
-- Creates proposals, proposal_responses tables and extends email_templates

-- 1. Proposals table
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  language TEXT DEFAULT 'ko',
  hero_image_url TEXT,
  mission_html TEXT,
  mission_images TEXT[] DEFAULT '{}',
  products JSONB DEFAULT '[]',
  required_tags TEXT[] DEFAULT '{}',
  rewards_html TEXT,
  collect_instagram BOOLEAN DEFAULT true,
  collect_paypal BOOLEAN DEFAULT false,
  collect_basic_info BOOLEAN DEFAULT true,
  collect_shipping BOOLEAN DEFAULT false,
  allowed_countries TEXT[] DEFAULT '{}',
  cs_channel TEXT,
  cs_account TEXT,
  notice_html TEXT,
  status TEXT DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Proposal Responses table
CREATE TABLE proposal_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  influencer_name TEXT,
  instagram_id TEXT,
  email TEXT,
  phone TEXT,
  paypal_email TEXT,
  shipping_address JSONB,
  message TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Extend email_templates
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'email';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS dm_body TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES proposals(id);

-- 4. RLS Policies for proposals
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposals_select" ON proposals
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "proposals_insert" ON proposals
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "proposals_update" ON proposals
  FOR UPDATE USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "proposals_delete" ON proposals
  FOR DELETE USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- 5. RLS for proposal_responses
ALTER TABLE proposal_responses ENABLE ROW LEVEL SECURITY;

-- Team members can read responses for their proposals
CREATE POLICY "proposal_responses_select" ON proposal_responses
  FOR SELECT USING (
    proposal_id IN (
      SELECT p.id FROM proposals p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Anyone can submit a response (public form)
CREATE POLICY "proposal_responses_insert" ON proposal_responses
  FOR INSERT WITH CHECK (true);

-- 6. Indexes
CREATE INDEX idx_proposals_campaign_id ON proposals(campaign_id);
CREATE INDEX idx_proposals_team_id ON proposals(team_id);
CREATE INDEX idx_proposals_slug ON proposals(slug);
CREATE INDEX idx_proposal_responses_proposal_id ON proposal_responses(proposal_id);
CREATE INDEX idx_email_templates_type ON email_templates(type);

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE proposal_responses;
