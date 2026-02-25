-- CRM MySQL → Uncustom 양방향 마이그레이션 스키마 확장
-- campaigns: 병원 CRM 데이터 매핑용 10개 컬럼
-- influencers: CRM 사용자 연결 4개 컬럼
-- campaign_influencers: CRM 예약 연결 4개 컬럼
-- 새 테이블: crm_sync_log, crm_procedures

-- ============================================================
-- 1. campaigns 테이블 확장 (10개 컬럼)
-- ============================================================
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS crm_hospital_id INTEGER UNIQUE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS crm_hospital_code TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS business_number TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(3,2);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS tax_invoice_email TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ceo_name TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS operating_hours TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS crm_config JSONB DEFAULT '{}';

-- ============================================================
-- 2. influencers 테이블 확장 (4개 컬럼)
-- ============================================================
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS crm_user_id INTEGER UNIQUE;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS line_id TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS default_settlement_info JSONB;

-- ============================================================
-- 3. campaign_influencers 테이블 확장 (4개 컬럼)
-- ============================================================
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS crm_reservation_id INTEGER UNIQUE;
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS crm_procedure TEXT;
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS crm_requested_procedure TEXT;
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS crm_data JSONB DEFAULT '{}';

-- ============================================================
-- 4. crm_sync_log 테이블 (양방향 동기화 추적)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL,             -- 'crm_to_uncustom' | 'uncustom_to_crm'
  entity_type TEXT NOT NULL,           -- 'hospital' | 'influencer' | 'reservation' | 'procedure' | 'automation'
  crm_id INTEGER,                      -- MySQL 측 ID
  uncustom_id UUID,                    -- Supabase 측 ID
  action TEXT NOT NULL,                -- 'created' | 'updated' | 'skipped' | 'error' | 'matched'
  details JSONB,                       -- 변환 상세 / 에러 메시지
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_sync_entity ON crm_sync_log(entity_type, crm_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_direction ON crm_sync_log(direction, synced_at DESC);

-- ============================================================
-- 5. crm_procedures 테이블 (시술 카탈로그)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  crm_procedure_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  fee_rate DECIMAL(5,2),
  is_sponsorable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_procedures_campaign ON crm_procedures(campaign_id);
CREATE INDEX IF NOT EXISTS idx_crm_procedures_crm_id ON crm_procedures(crm_procedure_id);

-- ============================================================
-- 6. 인덱스 추가
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_crm_hospital_id ON campaigns(crm_hospital_id) WHERE crm_hospital_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencers_crm_user_id ON influencers(crm_user_id) WHERE crm_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_influencers_crm_reservation_id ON campaign_influencers(crm_reservation_id) WHERE crm_reservation_id IS NOT NULL;

-- ============================================================
-- 7. RLS 정책 for crm_sync_log
-- ============================================================
ALTER TABLE crm_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_sync_log_read" ON crm_sync_log FOR SELECT USING (true);
CREATE POLICY "crm_sync_log_insert" ON crm_sync_log FOR INSERT WITH CHECK (true);

-- ============================================================
-- 8. RLS 정책 for crm_procedures
-- ============================================================
ALTER TABLE crm_procedures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_procedures_team_read" ON crm_procedures FOR SELECT USING (
  campaign_id IN (
    SELECT c.id FROM campaigns c
    JOIN team_members tm ON tm.team_id = c.team_id
    WHERE tm.user_id = auth.uid()
  )
);
CREATE POLICY "crm_procedures_team_write" ON crm_procedures FOR ALL USING (
  campaign_id IN (
    SELECT c.id FROM campaigns c
    JOIN team_members tm ON tm.team_id = c.team_id
    WHERE tm.user_id = auth.uid()
  )
);

-- ============================================================
-- 9. Realtime 설정
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE crm_sync_log;
