-- Backfill avg_likes, avg_comments, avg_views from raw_data->'latestPosts'
-- For Instagram records that have latestPosts but no avg metrics computed yet

UPDATE influencers SET
  avg_likes = sub.avg_likes,
  avg_comments = sub.avg_comments,
  avg_views = CASE WHEN sub.avg_views > 0 THEN sub.avg_views ELSE NULL END
FROM (
  SELECT
    id,
    ROUND(AVG((post->>'likesCount')::numeric)) AS avg_likes,
    ROUND(AVG((post->>'commentsCount')::numeric)) AS avg_comments,
    ROUND(AVG(COALESCE((post->>'videoViewCount')::numeric, 0))) AS avg_views
  FROM influencers,
    jsonb_array_elements(raw_data->'latestPosts') AS post
  WHERE platform = 'instagram'
    AND avg_likes IS NULL
    AND raw_data->'latestPosts' IS NOT NULL
    AND jsonb_array_length(raw_data->'latestPosts') > 0
  GROUP BY id
) sub
WHERE influencers.id = sub.id;
