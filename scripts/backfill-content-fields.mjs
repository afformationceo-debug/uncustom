/**
 * 콘텐츠 레벨 컬럼 백필
 * raw_data에서 추출하여 빈 컬럼 채우기:
 * - avg_likes, avg_comments, avg_views (latestPosts 평균)
 * - source_content_url, source_content_text, source_content_created_at (latestPosts[0])
 * - content_hashtags, content_language
 * - location, language
 * - is_private
 * - music_info, mentions, video_duration, product_type
 */
import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnuxbjdjkrmuibwptqzj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudXhiamRqa3JtdWlid3B0cXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2NTYwNywiZXhwIjoyMDg3MTQxNjA3fQ.42R0RE_lnhcEIzZE9fPRWfcPT4Qf4-VQuSA8aI-FsXU'
);

function detectLanguage(text) {
  if (!text) return null;
  const jp = text.match(/[\u3040-\u309F\u30A0-\u30FF]/g);
  const kr = text.match(/[\uAC00-\uD7A3]/g);
  const cn = text.match(/[\u4E00-\u9FFF]/g);
  const jpLen = jp?.length || 0;
  const krLen = kr?.length || 0;
  const cnLen = cn?.length || 0;
  if (jpLen > krLen && jpLen > cnLen && jpLen > 3) return 'ja';
  if (krLen > jpLen && krLen > cnLen && krLen > 3) return 'ko';
  if (cnLen > jpLen && cnLen > krLen && cnLen > 3) return 'zh';
  if (text.match(/[a-zA-Z]/g)?.length > text.length * 0.5) return 'en';
  return null;
}

async function run() {
  console.log('=== 콘텐츠 필드 백필 시작 ===\n');

  // 1. 먼저 현재 상태 확인
  console.log('--- 현재 컬럼 채움 현황 ---');
  const checks = [
    'avg_likes', 'avg_comments', 'avg_views', 'language', 'location',
    'source_content_url', 'source_content_text', 'source_content_created_at',
    'content_hashtags', 'content_language', 'is_private',
    'video_duration', 'music_info', 'mentions', 'product_type', 'is_sponsored'
  ];
  for (const col of checks) {
    const { count } = await s.from('influencers')
      .select('id', { count: 'exact', head: true })
      .not(col, 'is', null);
    console.log(`  ${col}: ${count || 0}건`);
  }

  // 2. raw_data가 있는 인플루언서 백필
  console.log('\n--- 백필 실행 ---\n');

  let totalUpdated = 0;
  let page = 0;
  const PAGE = 200;

  while (true) {
    const { data: batch, error } = await s.from('influencers')
      .select('id, username, platform, follower_count, raw_data, avg_likes, source_content_url, language, location, is_private, content_hashtags, music_info, mentions, video_duration, product_type, content_language')
      .not('raw_data', 'is', null)
      .range(page * PAGE, (page + 1) * PAGE - 1);

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!batch || batch.length === 0) break;

    let batchUpdated = 0;

    for (const inf of batch) {
      const rd = inf.raw_data;
      if (!rd) continue;

      const update = {};
      let hasUpdate = false;

      // --- Instagram Profile Scraper raw_data ---
      const lp = rd.latestPosts;
      if (lp && lp.length > 0) {
        // avg_likes/comments/views from latestPosts
        if (!inf.avg_likes) {
          const posts = lp.slice(0, 12);
          const tLikes = posts.reduce((s, p) => s + (p.likesCount || 0), 0);
          const tComments = posts.reduce((s, p) => s + (p.commentsCount || 0), 0);
          const tViews = posts.reduce((s, p) => s + (p.videoViewCount || p.videoPlayCount || 0), 0);
          update.avg_likes = Math.round(tLikes / posts.length);
          update.avg_comments = Math.round(tComments / posts.length);
          if (tViews > 0) update.avg_views = Math.round(tViews / posts.length);

          // engagement_rate
          if (inf.follower_count > 0) {
            update.engagement_rate = (update.avg_likes + update.avg_comments) / inf.follower_count;
          }
          hasUpdate = true;
        }

        // source_content from first post
        const fp = lp[0];
        if (!inf.source_content_url && fp) {
          if (fp.url) { update.source_content_url = fp.url; hasUpdate = true; }
          if (fp.caption) { update.source_content_text = fp.caption.substring(0, 5000); hasUpdate = true; }
          if (fp.timestamp) { update.source_content_created_at = fp.timestamp; hasUpdate = true; }

          // hashtags from first post
          if (!inf.content_hashtags) {
            const hashtags = fp.hashtags || (fp.caption?.match(/#[\w\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7A3\u4E00-\u9FFF]+/g) || []);
            if (hashtags.length > 0) {
              update.content_hashtags = hashtags.map(h => h.replace('#', ''));
              hasUpdate = true;
            }
          }

          // mentions from caption
          if (!inf.mentions && fp.caption) {
            const ments = fp.caption.match(/@[\w.]+/g);
            if (ments && ments.length > 0) {
              update.mentions = ments;
              hasUpdate = true;
            }
          }

          // location from post
          if (!inf.location && fp.locationName) {
            update.location = fp.locationName;
            hasUpdate = true;
          }

          // video_duration
          if (!inf.video_duration && fp.videoDuration) {
            update.video_duration = fp.videoDuration;
            hasUpdate = true;
          }

          // product_type (reel, video, photo, etc.)
          if (!inf.product_type && fp.type) {
            update.product_type = fp.type;
            hasUpdate = true;
          }
          if (!inf.product_type && fp.productType) {
            update.product_type = fp.productType;
            hasUpdate = true;
          }

          // music_info
          if (!inf.music_info && fp.musicInfo) {
            update.music_info = fp.musicInfo;
            hasUpdate = true;
          }
        }
      }

      // is_private from profile data
      if (inf.is_private === null && rd.private !== undefined) {
        update.is_private = rd.private;
        hasUpdate = true;
      }

      // language detection from biography
      if (!inf.language) {
        const bio = rd.biography || rd.bio || '';
        const detected = detectLanguage(bio);
        if (detected) {
          update.language = detected;
          hasUpdate = true;
        }
      }

      // content_language from first post caption
      if (!inf.content_language && lp && lp[0]?.caption) {
        const detected = detectLanguage(lp[0].caption);
        if (detected) {
          update.content_language = detected;
          hasUpdate = true;
        }
      }

      // location from profile
      if (!inf.location && !update.location) {
        if (rd.locationName) { update.location = rd.locationName; hasUpdate = true; }
        else if (rd.city) { update.location = rd.city; hasUpdate = true; }
      }

      // --- TikTok raw_data ---
      if (rd.authorMeta || rd.musicMeta || rd.diggCount !== undefined) {
        if (!inf.avg_likes && rd.diggCount) {
          update.avg_likes = rd.diggCount;
          hasUpdate = true;
        }
        if (!inf.avg_likes && rd.stats?.diggCount) {
          update.avg_likes = rd.stats.diggCount;
          hasUpdate = true;
        }
        if (!inf.source_content_url && rd.webVideoUrl) {
          update.source_content_url = rd.webVideoUrl;
          hasUpdate = true;
        }
        if (!inf.source_content_text && rd.text) {
          update.source_content_text = rd.text.substring(0, 5000);
          hasUpdate = true;
        }
        if (!inf.content_hashtags && rd.hashtags && rd.hashtags.length > 0) {
          update.content_hashtags = rd.hashtags.map(h => typeof h === 'string' ? h : h.name || h.title || '');
          hasUpdate = true;
        }
        if (!inf.music_info && rd.musicMeta) {
          update.music_info = rd.musicMeta;
          hasUpdate = true;
        }
        if (!inf.mentions && rd.mentions && rd.mentions.length > 0) {
          update.mentions = rd.mentions;
          hasUpdate = true;
        }
        if (!inf.video_duration && rd.videoMeta?.duration) {
          update.video_duration = rd.videoMeta.duration;
          hasUpdate = true;
        }
        if (!inf.is_sponsored && rd.isAd) {
          update.is_sponsored = true;
          hasUpdate = true;
        }
        if (!inf.source_content_created_at && rd.createTimeISO) {
          update.source_content_created_at = rd.createTimeISO;
          hasUpdate = true;
        }
        if (!inf.location && rd.authorMeta?.region) {
          update.location = rd.authorMeta.region;
          hasUpdate = true;
        }
      }

      // --- Twitter raw_data ---
      if (rd.full_text || rd.retweetCount !== undefined) {
        if (!inf.source_content_text && rd.full_text) {
          update.source_content_text = rd.full_text.substring(0, 5000);
          hasUpdate = true;
        }
        if (!inf.source_content_url && rd.url) {
          update.source_content_url = rd.url;
          hasUpdate = true;
        }
        if (!inf.content_hashtags && rd.entities?.hashtags?.length > 0) {
          update.content_hashtags = rd.entities.hashtags.map(h => h.text || h.tag || h);
          hasUpdate = true;
        }
        if (!inf.mentions && rd.entities?.user_mentions?.length > 0) {
          update.mentions = rd.entities.user_mentions.map(m => m.screen_name || m);
          hasUpdate = true;
        }
        if (!inf.source_content_created_at && rd.created_at) {
          update.source_content_created_at = rd.created_at;
          hasUpdate = true;
        }
        if (!inf.location && rd.user?.location) {
          update.location = rd.user.location;
          hasUpdate = true;
        }
      }

      if (!hasUpdate) continue;

      const { error: updateErr } = await s.from('influencers').update(update).eq('id', inf.id);
      if (!updateErr) batchUpdated++;
    }

    totalUpdated += batchUpdated;
    process.stdout.write(`  Page ${page + 1}: ${batchUpdated}/${batch.length} updated\n`);

    if (batch.length < PAGE) break;
    page++;
  }

  console.log(`\n총 백필 완료: ${totalUpdated}건`);

  // 3. 결과 확인
  console.log('\n--- 백필 후 컬럼 채움 현황 ---');
  for (const col of checks) {
    const { count } = await s.from('influencers')
      .select('id', { count: 'exact', head: true })
      .not(col, 'is', null);
    console.log(`  ${col}: ${count || 0}건`);
  }
}

run().catch(console.error);
