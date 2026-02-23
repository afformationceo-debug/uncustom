-- Backfill new platform-specific columns from existing raw_data JSONB
-- This processes all ~130K influencers in batches

-- Twitter: author.isBlueVerified, author.verifiedType, author.location, author.website
UPDATE influencers SET
  is_blue_verified = COALESCE(
    (raw_data->'author'->>'isBlueVerified')::boolean,
    (raw_data->>'isBlueVerified')::boolean
  ),
  verified_type = COALESCE(
    raw_data->'author'->>'verifiedType',
    raw_data->>'verifiedType'
  ),
  location = COALESCE(
    raw_data->'author'->>'location',
    raw_data->>'location'
  ),
  external_url = COALESCE(
    raw_data->'author'->>'website',
    raw_data->>'website'
  )
WHERE platform = 'twitter'
  AND raw_data IS NOT NULL
  AND (is_blue_verified IS NULL OR location IS NULL OR external_url IS NULL);

-- TikTok: authorMeta.heart, shareCount, authorMeta.bioLink.link
UPDATE influencers SET
  heart_count = COALESCE(
    (raw_data->'authorMeta'->>'heart')::bigint,
    (raw_data->>'heartCount')::bigint
  ),
  share_count = (raw_data->>'shareCount')::bigint,
  external_url = COALESCE(
    raw_data->'authorMeta'->'bioLink'->>'link',
    raw_data->'authorMeta'->>'bioLink'
  )
WHERE platform = 'tiktok'
  AND raw_data IS NOT NULL
  AND (heart_count IS NULL OR external_url IS NULL);

-- YouTube: viewCount, country, channelJoinedDate, isMonetized
UPDATE influencers SET
  total_views = (raw_data->>'viewCount')::bigint,
  location = raw_data->>'country',
  channel_joined_date = CASE
    WHEN raw_data->>'channelJoinedDate' IS NOT NULL
    THEN (raw_data->>'channelJoinedDate')::timestamptz
    ELSE NULL
  END,
  is_monetized = (raw_data->>'isMonetized')::boolean,
  external_url = COALESCE(
    raw_data->>'channelUrl',
    raw_data->>'url'
  )
WHERE platform = 'youtube'
  AND raw_data IS NOT NULL
  AND (total_views IS NULL OR location IS NULL);

-- Instagram: externalUrl / externalUrlShimmed
UPDATE influencers SET
  external_url = COALESCE(
    raw_data->>'externalUrl',
    raw_data->>'externalUrlShimmed'
  )
WHERE platform = 'instagram'
  AND raw_data IS NOT NULL
  AND external_url IS NULL
  AND (raw_data->>'externalUrl' IS NOT NULL OR raw_data->>'externalUrlShimmed' IS NOT NULL);
