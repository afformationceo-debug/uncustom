-- ============================================================
-- 콘텐츠 소스 + 프로필 확장 컬럼 추가 (14개)
-- 4개 플랫폼 Apify Actor output 전수 분석 기반
-- ============================================================

-- 1. 콘텐츠 소스 정보 (어떤 콘텐츠에서 인플루언서를 발견했는지)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS source_content_url TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS source_content_text TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS source_content_media JSONB DEFAULT '[]'::jsonb;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS source_content_created_at TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS content_language TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS content_hashtags TEXT[] DEFAULT '{}';

-- 2. 프로필 확장 정보
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS account_created_at TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- 3. 추가 참여 지표
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS bookmark_count BIGINT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS quote_count BIGINT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS favourites_count BIGINT;

-- 4. 콘텐츠 메타
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS video_duration INTEGER;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS video_title TEXT;

-- 인덱스: 콘텐츠 언어, 계정 생성일
CREATE INDEX IF NOT EXISTS idx_influencers_content_language ON influencers(content_language) WHERE content_language IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencers_account_created_at ON influencers(account_created_at) WHERE account_created_at IS NOT NULL;
