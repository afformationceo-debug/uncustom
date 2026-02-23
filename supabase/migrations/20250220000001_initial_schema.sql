-- ============================================
-- Uncustom - 인플루언서 마케팅 자동화 플랫폼
-- Initial Database Schema
-- ============================================

-- 0. 팀 & 사용자 (Supabase Auth 연동)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- owner, admin, member
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- 1. 캠페인
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active', -- active, paused, completed
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 키워드 등록
CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  platform TEXT NOT NULL, -- instagram, tiktok, youtube, twitter
  country TEXT, -- KR, US, JP 등
  estimated_count INT, -- API로 예상 인플루언서 수
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, keyword, platform)
);

-- 3. 태그됨 (경쟁사 계정) 등록
CREATE TABLE tagged_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  account_username TEXT NOT NULL,
  platform TEXT NOT NULL,
  estimated_count INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, account_username, platform)
);

-- 4. 추출 작업
CREATE TABLE extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- keyword, tagged
  source_id UUID, -- keyword_id 또는 tagged_account_id
  platform TEXT NOT NULL,
  apify_run_id TEXT, -- Apify 실행 ID
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  input_config JSONB, -- Apify input 파라미터
  total_extracted INT DEFAULT 0,
  new_extracted INT DEFAULT 0, -- 중복 제외 신규
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 인플루언서 마스터 테이블 (플랫폼 통합)
CREATE TABLE influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL, -- instagram, tiktok, youtube, twitter
  platform_id TEXT, -- 플랫폼 내 고유 ID
  username TEXT,
  display_name TEXT,
  profile_url TEXT,
  profile_image_url TEXT,
  email TEXT,
  email_source TEXT, -- bio, linktree, website, manual
  bio TEXT,
  follower_count INT,
  following_count INT,
  post_count INT,
  engagement_rate DECIMAL,
  country TEXT,
  language TEXT,
  extracted_keywords TEXT[], -- 어떤 키워드로 추출되었는지
  extracted_from_tags TEXT[], -- 어떤 태그 계정에서 추출되었는지
  raw_data JSONB, -- 플랫폼별 원본 스키마 전체 보관
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform, platform_id)
);

-- 6. 인플루언서 링크 (bio 내 linktree 등)
CREATE TABLE influencer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  scraped BOOLEAN DEFAULT false,
  emails_found TEXT[],
  scraped_at TIMESTAMPTZ
);

-- 7. 캠페인-인플루언서 매핑 (N:M)
CREATE TABLE campaign_influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'extracted', -- extracted, contacted, replied, confirmed, visited, uploaded, completed
  agreed_date DATE,
  visit_date DATE,
  upload_deadline DATE,
  actual_upload_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, influencer_id)
);

-- 8. 이메일 템플릿
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  round_number INT DEFAULT 1, -- N회차
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  sender_name TEXT,
  sender_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. 이메일 발송 로그
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id),
  round_number INT DEFAULT 1,
  resend_message_id TEXT,
  status TEXT DEFAULT 'queued', -- queued, sent, delivered, opened, clicked, bounced, failed
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  cta_clicked BOOLEAN DEFAULT false,
  cta_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. 이메일 스레드 (인박스)
CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  unread BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, influencer_id)
);

-- 11. 이메일 메시지 (스레드 내 개별 메시지)
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL, -- inbound, outbound
  from_email TEXT,
  to_email TEXT,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  resend_message_id TEXT,
  received_at TIMESTAMPTZ DEFAULT now()
);

-- 12. 캠페인 SNS 계정 관리
CREATE TABLE campaign_sns_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_name TEXT,
  account_id TEXT, -- 플랫폼별 ID
  access_token TEXT, -- 암호화 저장
  refresh_token TEXT,
  api_key TEXT,
  api_secret TEXT,
  extra_config JSONB, -- 플랫폼별 추가 설정
  connected BOOLEAN DEFAULT false,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, platform)
);

-- 13. 인플루언서 콘텐츠 (업로드된)
CREATE TABLE influencer_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  original_platform TEXT NOT NULL,
  original_url TEXT NOT NULL,
  original_content_id TEXT,
  video_storage_path TEXT, -- Supabase Storage 경로
  video_downloaded BOOLEAN DEFAULT false,
  caption TEXT,
  uploaded_at TIMESTAMPTZ, -- 인플루언서가 올린 날짜
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. 멀티채널 업로드 (리포스팅)
CREATE TABLE multi_channel_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES influencer_contents(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  target_platform TEXT NOT NULL, -- youtube, twitter, tiktok, threads, instagram
  sns_account_id UUID REFERENCES campaign_sns_accounts(id),
  caption TEXT, -- 플랫폼별 수정된 캡션
  title TEXT, -- YouTube용
  tags TEXT[],
  status TEXT DEFAULT 'pending', -- pending, uploading, published, failed
  platform_post_id TEXT, -- 업로드 후 플랫폼에서 받은 ID
  platform_post_url TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. 콘텐츠 메트릭 추적
CREATE TABLE content_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES multi_channel_uploads(id) ON DELETE CASCADE,
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  engagement_rate DECIMAL,
  tracked_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 인덱스
-- ============================================
CREATE INDEX idx_influencers_platform ON influencers(platform);
CREATE INDEX idx_influencers_email ON influencers(email);
CREATE INDEX idx_influencers_follower ON influencers(follower_count);
CREATE INDEX idx_email_logs_campaign ON email_logs(campaign_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_campaign_influencers_status ON campaign_influencers(status);
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX idx_email_threads_campaign ON email_threads(campaign_id);
CREATE INDEX idx_content_metrics_upload ON content_metrics(upload_id);

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE tagged_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sns_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE multi_channel_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_metrics ENABLE ROW LEVEL SECURITY;

-- Helper function: 사용자의 팀 ID 조회
CREATE OR REPLACE FUNCTION get_user_team_ids()
RETURNS SETOF UUID AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- teams: 자신이 멤버인 팀만 조회
CREATE POLICY "Users can view their teams" ON teams
  FOR SELECT USING (id IN (SELECT get_user_team_ids()));

CREATE POLICY "Users can create teams" ON teams
  FOR INSERT WITH CHECK (true);

-- team_members: 같은 팀 멤버만 조회
CREATE POLICY "Users can view team members" ON team_members
  FOR SELECT USING (team_id IN (SELECT get_user_team_ids()));

CREATE POLICY "Team owners can manage members" ON team_members
  FOR ALL USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can join teams" ON team_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- campaigns: 팀 기반 접근 제어
CREATE POLICY "Users can view team campaigns" ON campaigns
  FOR SELECT USING (team_id IN (SELECT get_user_team_ids()));

CREATE POLICY "Users can manage team campaigns" ON campaigns
  FOR ALL USING (team_id IN (SELECT get_user_team_ids()));

-- keywords: 캠페인 기반 접근 제어
CREATE POLICY "Users can access campaign keywords" ON keywords
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );

-- tagged_accounts: 캠페인 기반 접근 제어
CREATE POLICY "Users can access campaign tagged accounts" ON tagged_accounts
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );

-- extraction_jobs: 캠페인 기반 접근 제어
CREATE POLICY "Users can access campaign extraction jobs" ON extraction_jobs
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );

-- influencers: 모든 인증 사용자 읽기 가능 (마스터 데이터)
CREATE POLICY "Authenticated users can view influencers" ON influencers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert influencers" ON influencers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update influencers" ON influencers
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- influencer_links: 인플루언서 읽기 가능하면 링크도 읽기 가능
CREATE POLICY "Authenticated users can access influencer links" ON influencer_links
  FOR ALL USING (auth.uid() IS NOT NULL);

-- campaign_influencers: 캠페인 기반 접근 제어
CREATE POLICY "Users can access campaign influencers" ON campaign_influencers
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );

-- email_templates: 캠페인 기반 접근 제어
CREATE POLICY "Users can access campaign email templates" ON email_templates
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );

-- email_logs: 캠페인 기반 접근 제어
CREATE POLICY "Users can access campaign email logs" ON email_logs
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );

-- email_threads: 캠페인 기반 접근 제어
CREATE POLICY "Users can access campaign email threads" ON email_threads
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );

-- email_messages: 스레드 기반 접근 제어
CREATE POLICY "Users can access email messages" ON email_messages
  FOR ALL USING (
    thread_id IN (
      SELECT id FROM email_threads WHERE campaign_id IN (
        SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
      )
    )
  );

-- campaign_sns_accounts: 캠페인 기반 접근 제어
CREATE POLICY "Users can access campaign sns accounts" ON campaign_sns_accounts
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );

-- influencer_contents: 캠페인 기반 접근 제어
CREATE POLICY "Users can access campaign influencer contents" ON influencer_contents
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );

-- multi_channel_uploads: 캠페인 기반 접근 제어
CREATE POLICY "Users can access campaign uploads" ON multi_channel_uploads
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
    )
  );

-- content_metrics: 업로드 기반 접근 제어
CREATE POLICY "Users can access content metrics" ON content_metrics
  FOR ALL USING (
    upload_id IN (
      SELECT id FROM multi_channel_uploads WHERE campaign_id IN (
        SELECT id FROM campaigns WHERE team_id IN (SELECT get_user_team_ids())
      )
    )
  );

-- ============================================
-- Realtime 활성화
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE extraction_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_influencers;
ALTER PUBLICATION supabase_realtime ADD TABLE email_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE email_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE email_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE multi_channel_uploads;
ALTER PUBLICATION supabase_realtime ADD TABLE content_metrics;
