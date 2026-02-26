/**
 * 마스터데이터 백필 v2 — 비어있는 값 강제 채우기
 *
 * 이전 백필의 문제: 빈 배열([])을 falsy로 판단 못함 → 실제 데이터로 치환 안됨
 *
 * 이 스크립트:
 * 1. content_hashtags: raw_data.latestPosts[].hashtags + caption regex 에서 추출
 * 2. mentions: raw_data.latestPosts[].mentions + caption @regex 에서 추출
 * 3. music_info: latestPosts[].musicInfo 에서 추출
 * 4. video_duration: latestPosts 비디오 평균 duration
 * 5. is_private: raw_data.private
 * 6. content_language: caption 언어 감지
 * 7. language: biography 언어 감지
 * 8. location: latestPosts[0].locationName 또는 프로필 데이터
 * 9. source_content_url/text/created_at: 첫 번째 포스트
 * 10. product_type: 포스트 유형
 * 11. influence_score: 재계산
 * 12. last_content_at: source_content_created_at 또는 latestPosts[0].timestamp
 * 13. content_quality_score: avg engagement + posting consistency
 * 14. audience_authenticity_score: engagement ratio analysis
 */
import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnuxbjdjkrmuibwptqzj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudXhiamRqa3JtdWlid3B0cXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2NTYwNywiZXhwIjoyMDg3MTQxNjA3fQ.42R0RE_lnhcEIzZE9fPRWfcPT4Qf4-VQuSA8aI-FsXU'
);

function isEmpty(val) {
  if (val === null || val === undefined) return true;
  if (Array.isArray(val) && val.length === 0) return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  return false;
}

function detectLanguage(text) {
  if (!text || text.length < 3) return null;
  const jp = text.match(/[\u3040-\u309F\u30A0-\u30FF]/g);
  const kr = text.match(/[\uAC00-\uD7A3]/g);
  const cn = text.match(/[\u4E00-\u9FFF]/g);
  const jpLen = jp?.length || 0;
  const krLen = kr?.length || 0;
  const cnLen = cn?.length || 0;
  if (jpLen > krLen && jpLen > cnLen && jpLen > 2) return 'ja';
  if (krLen > jpLen && krLen > cnLen && krLen > 2) return 'ko';
  if (cnLen > jpLen && cnLen > krLen && cnLen > 2) return 'zh';
  if (text.match(/[a-zA-Z]/g)?.length > text.length * 0.4) return 'en';
  return null;
}

function extractHashtags(posts) {
  const tags = new Set();
  for (const p of posts) {
    // explicit hashtags field
    if (Array.isArray(p.hashtags)) {
      for (const h of p.hashtags) {
        const tag = (typeof h === 'string' ? h : h?.name || h?.title || '').replace(/^#/, '').trim();
        if (tag) tags.add(tag);
      }
    }
    // regex from caption
    if (p.caption) {
      const matches = p.caption.match(/#[\w\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7A3\u4E00-\u9FFF\u0E00-\u0E7F]+/g);
      if (matches) matches.forEach(m => { const t = m.replace(/^#/, '').trim(); if (t) tags.add(t); });
    }
  }
  return [...tags];
}

function extractMentions(posts) {
  const mentions = new Set();
  for (const p of posts) {
    if (Array.isArray(p.mentions)) {
      for (const m of p.mentions) {
        const name = (typeof m === 'string' ? m : m?.username || m?.full_name || '').replace(/^@/, '').trim();
        if (name) mentions.add(name);
      }
    }
    if (Array.isArray(p.taggedUsers)) {
      for (const t of p.taggedUsers) {
        const name = (typeof t === 'string' ? t : t?.username || '').trim();
        if (name) mentions.add(name);
      }
    }
    if (p.caption) {
      const matches = p.caption.match(/@[\w.]+/g);
      if (matches) matches.forEach(m => { const t = m.replace(/^@/, '').trim(); if (t) mentions.add(t); });
    }
  }
  return [...mentions];
}

function calcContentQuality(inf, posts) {
  // Score 0-100 based on:
  // - engagement consistency (low variance = higher quality)
  // - avg engagement rate
  // - posting frequency
  // - content diversity (types)
  let score = 0;

  if (!posts || posts.length === 0) {
    // No posts data — use whatever we have
    if (inf.engagement_rate > 0.05) score += 30;
    else if (inf.engagement_rate > 0.02) score += 20;
    else if (inf.engagement_rate > 0.01) score += 10;
    if (inf.post_count > 100) score += 15;
    else if (inf.post_count > 50) score += 10;
    else if (inf.post_count > 10) score += 5;
    return score > 0 ? Math.min(100, score) : null;
  }

  const likes = posts.map(p => p.likesCount || p.diggCount || 0);
  const avgLikes = likes.reduce((a, b) => a + b, 0) / likes.length;

  // Engagement consistency (0-25)
  if (likes.length >= 3) {
    const variance = likes.reduce((s, l) => s + Math.pow(l - avgLikes, 2), 0) / likes.length;
    const cv = avgLikes > 0 ? Math.sqrt(variance) / avgLikes : 1; // coefficient of variation
    if (cv < 0.3) score += 25; // very consistent
    else if (cv < 0.5) score += 20;
    else if (cv < 0.8) score += 15;
    else if (cv < 1.2) score += 10;
    else score += 5;
  }

  // Avg engagement rate (0-30)
  const fc = inf.follower_count || 1;
  const avgEng = posts.reduce((s, p) => s + ((p.likesCount || 0) + (p.commentsCount || 0)) / fc, 0) / posts.length;
  if (avgEng > 0.08) score += 30;
  else if (avgEng > 0.05) score += 25;
  else if (avgEng > 0.03) score += 20;
  else if (avgEng > 0.02) score += 15;
  else if (avgEng > 0.01) score += 10;
  else if (avgEng > 0) score += 5;

  // Post count (0-20) — more posts = more consistent creator
  if (inf.post_count > 500) score += 20;
  else if (inf.post_count > 200) score += 15;
  else if (inf.post_count > 100) score += 12;
  else if (inf.post_count > 50) score += 8;
  else if (inf.post_count > 10) score += 4;

  // Content diversity (0-15)
  const types = new Set(posts.map(p => p.type || p.productType || 'unknown'));
  if (types.size >= 3) score += 15;
  else if (types.size >= 2) score += 10;
  else score += 5;

  // Has captions / hashtags (0-10)
  const withCaptions = posts.filter(p => p.caption && p.caption.length > 20).length;
  score += Math.min(10, Math.round(withCaptions / posts.length * 10));

  return Math.min(100, score);
}

function calcAudienceAuth(inf) {
  // Audience authenticity heuristic (0-100)
  // Based on: follower/following ratio, engagement rate vs follower count
  if (!inf.follower_count || inf.follower_count < 100) return null;

  let score = 50; // start neutral

  const fc = inf.follower_count;
  const er = inf.engagement_rate || 0;

  // 1. Engagement rate sanity check (+/- 25)
  // Suspiciously high ER with large following = likely fake
  if (fc > 100000 && er > 0.15) score -= 20; // too good to be true
  else if (fc > 10000 && er > 0.20) score -= 15;
  else if (er > 0.03 && er < 0.15) score += 20; // healthy range
  else if (er > 0.01) score += 10;
  else if (er < 0.005 && fc > 10000) score -= 15; // dead followers

  // 2. Follower/Following ratio (+/- 15)
  const fg = inf.following_count || 0;
  if (fg > 0) {
    const ratio = fc / fg;
    if (ratio > 5) score += 15; // many more followers than following = organic
    else if (ratio > 2) score += 10;
    else if (ratio < 0.5) score -= 10; // follows more than followed = might be follow/unfollow
  }

  // 3. Has bio (+5)
  if (inf.bio && inf.bio.length > 10) score += 5;

  // 4. Post count (+/- 10)
  const pc = inf.post_count || 0;
  if (pc > 0 && fc / pc > 10000) score -= 10; // high followers but few posts = suspicious
  else if (pc > 50) score += 5;

  // 5. Verified = more trustworthy (+10)
  if (inf.is_verified) score += 10;

  return Math.min(100, Math.max(0, score));
}

function calcInfluenceScore(inf) {
  let score = 0;
  const fc = inf.follower_count || 0;
  if (fc >= 1000000) score += 30;
  else if (fc >= 500000) score += 27;
  else if (fc >= 100000) score += 24;
  else if (fc >= 50000) score += 20;
  else if (fc >= 10000) score += 15;
  else if (fc >= 5000) score += 10;
  else if (fc >= 1000) score += 5;
  else if (fc > 0) score += 2;

  const er = inf.engagement_rate || 0;
  if (er >= 0.10) score += 25;
  else if (er >= 0.05) score += 20;
  else if (er >= 0.03) score += 15;
  else if (er >= 0.02) score += 12;
  else if (er >= 0.01) score += 8;
  else if (er > 0) score += 3;

  const pc = inf.post_count || 0;
  if (pc >= 500) score += 15;
  else if (pc >= 200) score += 12;
  else if (pc >= 100) score += 10;
  else if (pc >= 50) score += 7;
  else if (pc >= 10) score += 4;
  else if (pc > 0) score += 1;

  if (inf.bio) score += 3;
  if (inf.email) score += 4;
  if (inf.category) score += 3;
  if (inf.avg_likes) score += 3;
  if (inf.avg_views) score += 2;
  if (inf.is_verified) score += 10;
  if (inf.is_business) score += 5;

  return Math.min(100, Math.max(0, score));
}

async function run() {
  console.log('=== 마스터데이터 백필 v2 — 비어있는 값 강제 채우기 ===\n');

  // Before stats
  console.log('--- BEFORE ---');
  const checkCols = ['content_hashtags', 'mentions', 'music_info', 'video_duration', 'content_language', 'language', 'location', 'product_type', 'source_content_url', 'influence_score', 'content_quality_score', 'audience_authenticity_score', 'last_content_at'];
  const { count: total } = await s.from('influencers').select('id', { count: 'exact', head: true });
  for (const col of checkCols) {
    const { count } = await s.from('influencers').select('id', { count: 'exact', head: true }).not(col, 'is', null);
    console.log(`  ${col}: ${count}/${total}`);
  }

  let totalUpdated = 0;
  let page = 0;
  const PAGE = 200;

  while (true) {
    const { data: batch, error } = await s.from('influencers')
      .select('id, username, platform, follower_count, following_count, post_count, engagement_rate, bio, email, category, is_verified, is_business, avg_likes, avg_comments, avg_views, raw_data, content_hashtags, mentions, music_info, video_duration, content_language, language, location, product_type, source_content_url, source_content_text, source_content_created_at, is_private, is_sponsored, influence_score, content_quality_score, audience_authenticity_score, last_content_at')
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

      // Get latestPosts
      const lp = rd.latestPosts || rd.recentPosts || [];
      const posts = Array.isArray(lp) ? lp.slice(0, 12) : [];
      const fp = posts[0]; // first post

      // --- 1. content_hashtags (FORCE overwrite empty arrays) ---
      if (isEmpty(inf.content_hashtags)) {
        const tags = extractHashtags(posts);
        // Also check top-level hashtags (TikTok)
        if (rd.hashtags && Array.isArray(rd.hashtags)) {
          for (const h of rd.hashtags) {
            const tag = (typeof h === 'string' ? h : h?.name || h?.title || '').replace(/^#/, '').trim();
            if (tag && !tags.includes(tag)) tags.push(tag);
          }
        }
        if (tags.length > 0) {
          update.content_hashtags = tags;
          hasUpdate = true;
        }
      }

      // --- 2. mentions (FORCE overwrite empty arrays) ---
      if (isEmpty(inf.mentions)) {
        const ments = extractMentions(posts);
        if (ments.length > 0) {
          update.mentions = ments;
          hasUpdate = true;
        }
      }

      // --- 3. music_info ---
      if (!inf.music_info) {
        // Check all posts for music
        for (const p of posts) {
          if (p.musicInfo) {
            update.music_info = p.musicInfo;
            hasUpdate = true;
            break;
          }
        }
        // TikTok
        if (!update.music_info && rd.musicMeta) {
          update.music_info = rd.musicMeta;
          hasUpdate = true;
        }
      }

      // --- 4. video_duration ---
      if (!inf.video_duration) {
        // Check posts for video duration
        const durations = posts
          .map(p => p.videoDuration || p.duration)
          .filter(d => d && d > 0);
        if (durations.length > 0) {
          update.video_duration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
          hasUpdate = true;
        }
        // TikTok
        if (!update.video_duration && rd.videoMeta?.duration) {
          update.video_duration = rd.videoMeta.duration;
          hasUpdate = true;
        }
      }

      // --- 5. content_language ---
      if (!inf.content_language) {
        // Try first post caption
        if (fp?.caption) {
          const lang = detectLanguage(fp.caption);
          if (lang) { update.content_language = lang; hasUpdate = true; }
        }
        // TikTok text
        if (!update.content_language && rd.text) {
          const lang = detectLanguage(rd.text);
          if (lang) { update.content_language = lang; hasUpdate = true; }
        }
        // Twitter
        if (!update.content_language && rd.full_text) {
          const lang = detectLanguage(rd.full_text);
          if (lang) { update.content_language = lang; hasUpdate = true; }
        }
      }

      // --- 6. language (profile language) ---
      if (!inf.language) {
        const bioText = rd.biography || rd.bio || rd.description || '';
        const lang = detectLanguage(bioText);
        if (lang) { update.language = lang; hasUpdate = true; }
        // Fallback: use content language
        if (!lang && (update.content_language || inf.content_language)) {
          update.language = update.content_language || inf.content_language;
          hasUpdate = true;
        }
      }

      // --- 7. location ---
      if (!inf.location) {
        if (fp?.locationName) { update.location = fp.locationName; hasUpdate = true; }
        else if (rd.locationName) { update.location = rd.locationName; hasUpdate = true; }
        else if (rd.city) { update.location = rd.city; hasUpdate = true; }
        else if (rd.authorMeta?.region) { update.location = rd.authorMeta.region; hasUpdate = true; }
        else if (rd.user?.location) { update.location = rd.user.location; hasUpdate = true; }
        else {
          // Check other posts for location
          for (const p of posts) {
            if (p.locationName) { update.location = p.locationName; hasUpdate = true; break; }
          }
        }
      }

      // --- 8. source_content_url/text/created_at ---
      if (!inf.source_content_url && fp) {
        if (fp.url) { update.source_content_url = fp.url; hasUpdate = true; }
        if (fp.caption) { update.source_content_text = fp.caption.substring(0, 5000); hasUpdate = true; }
        if (fp.timestamp) { update.source_content_created_at = fp.timestamp; hasUpdate = true; }
      }
      if (!inf.source_content_url && rd.webVideoUrl) {
        update.source_content_url = rd.webVideoUrl; hasUpdate = true;
      }
      if (!inf.source_content_text && rd.text) {
        update.source_content_text = rd.text.substring(0, 5000); hasUpdate = true;
      }
      if (!inf.source_content_text && rd.full_text) {
        update.source_content_text = rd.full_text.substring(0, 5000); hasUpdate = true;
      }

      // --- 9. product_type ---
      if (!inf.product_type) {
        if (fp?.type) { update.product_type = fp.type; hasUpdate = true; }
        else if (fp?.productType) { update.product_type = fp.productType; hasUpdate = true; }
      }

      // --- 10. is_private ---
      if (inf.is_private === null && rd.private !== undefined) {
        update.is_private = !!rd.private;
        hasUpdate = true;
      }

      // --- 11. avg_likes/comments/views (only if missing) ---
      if (!inf.avg_likes && posts.length > 0) {
        const tL = posts.reduce((s, p) => s + (p.likesCount || p.diggCount || 0), 0);
        const tC = posts.reduce((s, p) => s + (p.commentsCount || 0), 0);
        const tV = posts.reduce((s, p) => s + (p.videoViewCount || p.videoPlayCount || p.playCount || 0), 0);
        update.avg_likes = Math.round(tL / posts.length);
        update.avg_comments = Math.round(tC / posts.length);
        if (tV > 0) update.avg_views = Math.round(tV / posts.length);
        if (inf.follower_count > 0) {
          update.engagement_rate = (update.avg_likes + update.avg_comments) / inf.follower_count;
        }
        hasUpdate = true;
      }

      // --- 12. last_content_at ---
      if (!inf.last_content_at) {
        // From source_content_created_at
        const scd = inf.source_content_created_at || update.source_content_created_at;
        if (scd) { update.last_content_at = scd; hasUpdate = true; }
        else if (fp?.timestamp) { update.last_content_at = fp.timestamp; hasUpdate = true; }
        else if (rd.createTimeISO) { update.last_content_at = rd.createTimeISO; hasUpdate = true; }
        else if (rd.created_at) { update.last_content_at = rd.created_at; hasUpdate = true; }
      }

      // --- 13. content_quality_score ---
      if (!inf.content_quality_score) {
        const cqs = calcContentQuality(inf, posts);
        if (cqs !== null) { update.content_quality_score = cqs; hasUpdate = true; }
      }

      // --- 14. audience_authenticity_score ---
      if (!inf.audience_authenticity_score) {
        const aas = calcAudienceAuth(inf);
        if (aas !== null) { update.audience_authenticity_score = aas; hasUpdate = true; }
      }

      // --- 15. influence_score (always recalculate) ---
      {
        const merged = { ...inf, ...update };
        const newScore = calcInfluenceScore(merged);
        if (newScore !== inf.influence_score) {
          update.influence_score = newScore;
          hasUpdate = true;
        }
      }

      if (!hasUpdate) continue;

      const { error: updateErr } = await s.from('influencers').update(update).eq('id', inf.id);
      if (!updateErr) batchUpdated++;
      else if (updateErr.message.includes('invalid input syntax')) {
        // Try without problematic fields
        delete update.last_content_at;
        delete update.source_content_created_at;
        const { error: retry } = await s.from('influencers').update(update).eq('id', inf.id);
        if (!retry) batchUpdated++;
      }
    }

    totalUpdated += batchUpdated;
    process.stdout.write(`  Page ${page + 1}: ${batchUpdated}/${batch.length} updated\n`);

    if (batch.length < PAGE) break;
    page++;
  }

  // Also process influencers WITHOUT raw_data — compute derived fields
  console.log('\n--- Derived fields for non-raw_data influencers ---');
  let derivedUpdated = 0;
  let dpage = 0;
  while (true) {
    const { data: batch, error } = await s.from('influencers')
      .select('id, follower_count, following_count, post_count, engagement_rate, bio, email, category, is_verified, is_business, avg_likes, avg_views, influence_score, content_quality_score, audience_authenticity_score, source_content_created_at, last_content_at')
      .is('raw_data', null)
      .range(dpage * 1000, (dpage + 1) * 1000 - 1);

    if (error || !batch || batch.length === 0) break;

    let batchUp = 0;
    for (const inf of batch) {
      const update = {};
      let has = false;

      if (!inf.influence_score) {
        const sc = calcInfluenceScore(inf);
        if (sc > 0) { update.influence_score = sc; has = true; }
      }
      if (!inf.audience_authenticity_score) {
        const aa = calcAudienceAuth(inf);
        if (aa !== null) { update.audience_authenticity_score = aa; has = true; }
      }
      if (!inf.content_quality_score && (inf.engagement_rate > 0 || inf.post_count > 0)) {
        const cq = calcContentQuality(inf, []);
        if (cq !== null) { update.content_quality_score = cq; has = true; }
      }
      if (!inf.last_content_at && inf.source_content_created_at) {
        update.last_content_at = inf.source_content_created_at;
        has = true;
      }

      if (!has) continue;
      const { error: ue } = await s.from('influencers').update(update).eq('id', inf.id);
      if (!ue) batchUp++;
    }
    derivedUpdated += batchUp;
    if (batch.length < 1000) break;
    dpage++;
  }
  console.log(`  Derived fields updated: ${derivedUpdated}`);

  console.log(`\n총 업데이트: ${totalUpdated + derivedUpdated}건`);

  // After stats
  console.log('\n--- AFTER ---');
  for (const col of checkCols) {
    const { count } = await s.from('influencers').select('id', { count: 'exact', head: true }).not(col, 'is', null);
    console.log(`  ${col}: ${count}/${total}`);
  }
}

run().catch(console.error);
