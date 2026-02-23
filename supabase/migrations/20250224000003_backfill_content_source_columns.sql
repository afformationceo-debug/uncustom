-- ============================================================
-- 기존 raw_data에서 새 콘텐츠/프로필 컬럼 백필
-- ============================================================

-- Twitter: 트윗 URL, 텍스트, 미디어, 날짜, 언어, 해시태그, 계정생성일, 커버이미지, 북마크, 인용
UPDATE influencers SET
  source_content_url = COALESCE(raw_data->>'url', raw_data->>'twitterUrl'),
  source_content_text = COALESCE(raw_data->>'fullText', raw_data->>'text'),
  source_content_media = CASE WHEN raw_data->'media' IS NOT NULL AND jsonb_typeof(raw_data->'media') = 'array' THEN raw_data->'media' ELSE NULL END,
  source_content_created_at = raw_data->>'createdAt',
  content_language = raw_data->>'lang',
  account_created_at = raw_data->'author'->>'createdAt',
  cover_image_url = raw_data->'author'->>'coverPicture',
  bookmark_count = (raw_data->>'bookmarkCount')::bigint,
  quote_count = (raw_data->>'quoteCount')::bigint,
  favourites_count = (raw_data->'author'->>'favouritesCount')::bigint
WHERE platform = 'twitter' AND raw_data IS NOT NULL AND source_content_url IS NULL;

-- TikTok: 비디오 URL, 텍스트, 날짜, 언어, 북마크(collect), 리포스트, 영상길이
UPDATE influencers SET
  source_content_url = raw_data->>'webVideoUrl',
  source_content_text = raw_data->>'text',
  source_content_created_at = raw_data->>'createTimeISO',
  content_language = raw_data->>'textLanguage',
  bookmark_count = (raw_data->>'collectCount')::bigint,
  quote_count = (raw_data->>'repostCount')::bigint,
  favourites_count = (raw_data->'authorMeta'->>'digg')::bigint,
  video_duration = (raw_data->'videoMeta'->>'duration')::integer,
  is_private = COALESCE((raw_data->'authorMeta'->>'privateAccount')::boolean, false)
WHERE platform = 'tiktok' AND raw_data IS NOT NULL AND source_content_url IS NULL;

-- YouTube: 비디오 URL, 제목, 설명, 날짜, 해시태그, 영상길이
UPDATE influencers SET
  source_content_url = raw_data->>'url',
  source_content_text = COALESCE(raw_data->>'text', raw_data->>'details'),
  source_content_created_at = raw_data->>'date',
  content_language = raw_data->>'defaultLanguage',
  video_title = raw_data->>'title',
  account_created_at = raw_data->>'channelJoinedDate'
WHERE platform = 'youtube' AND raw_data IS NOT NULL AND source_content_url IS NULL;

-- Instagram: 콘텐츠 URL (릴스/해시태그 스크래퍼), 캡션, 비공개
UPDATE influencers SET
  source_content_url = raw_data->>'url',
  source_content_text = COALESCE(raw_data->>'caption', raw_data->>'text'),
  is_private = COALESCE((raw_data->>'private')::boolean, false)
WHERE platform = 'instagram' AND raw_data IS NOT NULL AND source_content_url IS NULL;
