/**
 * 마스터데이터 백필 + 중복 제거 스크립트
 * 1. 중복 인플루언서 제거 (125건)
 * 2. raw_data.latestPosts에서 avg_likes/avg_comments/avg_views 계산
 * 3. influence_score 계산 (engagement_rate + follower tier + completeness)
 */
import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnuxbjdjkrmuibwptqzj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudXhiamRqa3JtdWlid3B0cXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2NTYwNywiZXhwIjoyMDg3MTQxNjA3fQ.42R0RE_lnhcEIzZE9fPRWfcPT4Qf4-VQuSA8aI-FsXU'
);

async function fetchAll(table, select, filters = {}) {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    let q = s.from(table).select(select).range(from, from + PAGE - 1);
    for (const [k, v] of Object.entries(filters)) {
      if (v === null) q = q.is(k, null);
      else q = q.eq(k, v);
    }
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ============================================================
// STEP 1: 중복 제거
// ============================================================
async function dedup() {
  console.log('=== STEP 1: 중복 인플루언서 제거 ===\n');

  const all = await fetchAll('influencers', 'id, username, platform, platform_id, import_source, follower_count, email, bio, avg_likes');

  // Group by username+platform
  const byKey = {};
  for (const r of all) {
    const u = (r.username || '').toLowerCase().trim();
    if (!u || u === 'null') continue;
    const key = `${u}::${r.platform}`;
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(r);
  }

  const dupes = Object.entries(byKey).filter(([, v]) => v.length > 1);
  if (dupes.length === 0) {
    console.log('중복 없음!\n');
    return 0;
  }

  const toDelete = [];
  for (const [key, rows] of dupes) {
    // Score each row: higher = better, keep the best
    const scored = rows.map(r => {
      let score = 0;
      if (r.follower_count && r.follower_count > 0) score += 10000;
      if (r.email) score += 1000;
      if (r.bio) score += 500;
      if (r.avg_likes) score += 200;
      if (r.platform_id) score += 100;
      score += (r.follower_count || 0) / 1e8; // tiebreak by follower count
      return { ...r, score };
    }).sort((a, b) => b.score - a.score);

    // Keep first (best), merge email/bio into it if missing, delete rest
    const keep = scored[0];
    const remove = scored.slice(1);

    // Merge missing data from duplicates into the keeper
    let mergeUpdate = {};
    for (const dup of remove) {
      if (!keep.email && dup.email) mergeUpdate.email = dup.email;
      if (!keep.bio && dup.bio) mergeUpdate.bio = dup.bio;
      if ((!keep.follower_count || keep.follower_count === 0) && dup.follower_count > 0) {
        mergeUpdate.follower_count = dup.follower_count;
      }
      if (!keep.platform_id && dup.platform_id) mergeUpdate.platform_id = dup.platform_id;
    }

    // Update keeper with merged data
    if (Object.keys(mergeUpdate).length > 0) {
      await s.from('influencers').update(mergeUpdate).eq('id', keep.id);
    }

    // Also move campaign_influencers references from deleted → kept
    for (const dup of remove) {
      // Update campaign_influencers to point to the keeper
      const { data: ciRefs } = await s.from('campaign_influencers')
        .select('id, campaign_id')
        .eq('influencer_id', dup.id);

      if (ciRefs && ciRefs.length > 0) {
        for (const ci of ciRefs) {
          // Check if keeper already has this campaign
          const { data: existing } = await s.from('campaign_influencers')
            .select('id')
            .eq('campaign_id', ci.campaign_id)
            .eq('influencer_id', keep.id)
            .limit(1);

          if (!existing || existing.length === 0) {
            // Move the reference
            await s.from('campaign_influencers')
              .update({ influencer_id: keep.id })
              .eq('id', ci.id);
          } else {
            // Delete the duplicate campaign_influencer
            await s.from('campaign_influencers').delete().eq('id', ci.id);
          }
        }
      }

      // Move influencer_links references
      const { data: linkRefs } = await s.from('influencer_links')
        .select('id, url')
        .eq('influencer_id', dup.id);

      if (linkRefs && linkRefs.length > 0) {
        for (const link of linkRefs) {
          const { data: existingLink } = await s.from('influencer_links')
            .select('id')
            .eq('influencer_id', keep.id)
            .eq('url', link.url)
            .limit(1);

          if (!existingLink || existingLink.length === 0) {
            await s.from('influencer_links')
              .update({ influencer_id: keep.id })
              .eq('id', link.id);
          } else {
            await s.from('influencer_links').delete().eq('id', link.id);
          }
        }
      }

      toDelete.push(dup.id);
    }
  }

  // Delete duplicate rows
  console.log(`삭제 대상: ${toDelete.length}건`);
  const BATCH = 50;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    const { error } = await s.from('influencers').delete().in('id', batch);
    if (error) {
      console.error(`  삭제 오류: ${error.message}`);
    } else {
      deleted += batch.length;
    }
  }
  console.log(`삭제 완료: ${deleted}건\n`);
  return deleted;
}

// ============================================================
// STEP 2: avg_likes/avg_comments/avg_views 백필
// ============================================================
async function backfillAvgMetrics() {
  console.log('=== STEP 2: avg_likes/avg_comments/avg_views 백필 ===\n');

  // Fetch influencers that have raw_data but missing avg_likes
  // We need raw_data which is large, so do in batches
  let updated = 0;
  let page = 0;
  const PAGE = 200;

  while (true) {
    const { data: batch, error } = await s.from('influencers')
      .select('id, username, platform, raw_data, follower_count')
      .is('avg_likes', null)
      .not('raw_data', 'is', null)
      .range(page * PAGE, (page + 1) * PAGE - 1);

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!batch || batch.length === 0) break;

    let batchUpdated = 0;
    for (const inf of batch) {
      const rd = inf.raw_data;
      if (!rd) continue;

      let avgLikes = null, avgComments = null, avgViews = null;

      // Instagram: latestPosts
      if (rd.latestPosts && rd.latestPosts.length > 0) {
        const posts = rd.latestPosts.slice(0, 12);
        const totalLikes = posts.reduce((s, p) => s + (p.likesCount || 0), 0);
        const totalComments = posts.reduce((s, p) => s + (p.commentsCount || 0), 0);
        const totalViews = posts.reduce((s, p) => s + (p.videoViewCount || p.videoPlayCount || 0), 0);
        avgLikes = Math.round(totalLikes / posts.length);
        avgComments = Math.round(totalComments / posts.length);
        if (totalViews > 0) avgViews = Math.round(totalViews / posts.length);
      }
      // TikTok: authorMeta or stats
      else if (rd.authorMeta || rd.stats) {
        const stats = rd.stats || rd.authorMeta;
        if (stats.heartCount && stats.videoCount) {
          avgLikes = Math.round(stats.heartCount / Math.max(stats.videoCount, 1));
        }
        if (stats.commentCount && stats.videoCount) {
          avgComments = Math.round(stats.commentCount / Math.max(stats.videoCount, 1));
        }
        if (stats.playCount && stats.videoCount) {
          avgViews = Math.round(stats.playCount / Math.max(stats.videoCount, 1));
        }
      }
      // TikTok alternative: diggCount/playCount from video-level data
      else if (rd.diggCount !== undefined || rd.playCount !== undefined) {
        avgLikes = rd.diggCount || null;
        avgComments = rd.commentCount || null;
        avgViews = rd.playCount || null;
      }
      // YouTube: channelRenderer or video stats
      else if (rd.subscriberCountText || rd.videoCountText) {
        // YouTube channel-level, skip individual averages
      }

      if (avgLikes === null && avgComments === null && avgViews === null) continue;

      // Also calculate engagement_rate if missing
      let engagement_rate = null;
      if (inf.follower_count && inf.follower_count > 0 && avgLikes !== null) {
        engagement_rate = (avgLikes + (avgComments || 0)) / inf.follower_count;
      }

      const update = {};
      if (avgLikes !== null) update.avg_likes = avgLikes;
      if (avgComments !== null) update.avg_comments = avgComments;
      if (avgViews !== null) update.avg_views = avgViews;
      if (engagement_rate !== null) update.engagement_rate = engagement_rate;

      const { error: updateErr } = await s.from('influencers').update(update).eq('id', inf.id);
      if (updateErr) {
        console.error(`  ${inf.username}: ${updateErr.message}`);
      } else {
        batchUpdated++;
      }
    }

    updated += batchUpdated;
    console.log(`  Page ${page + 1}: ${batchUpdated}/${batch.length} updated`);

    if (batch.length < PAGE) break;
    page++;
  }

  console.log(`\navg 백필 완료: ${updated}건\n`);
  return updated;
}

// ============================================================
// STEP 3: influence_score 계산
// ============================================================
async function calcInfluenceScore() {
  console.log('=== STEP 3: influence_score 계산 ===\n');

  let updated = 0;
  let page = 0;
  const PAGE = 1000;

  while (true) {
    const { data: batch, error } = await s.from('influencers')
      .select('id, follower_count, engagement_rate, avg_likes, avg_comments, avg_views, email, bio, is_verified, is_business, post_count, category')
      .is('influence_score', null)
      .range(page * PAGE, (page + 1) * PAGE - 1);

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!batch || batch.length === 0) break;

    let batchUpdated = 0;
    for (const inf of batch) {
      let score = 0;

      // 1. Follower tier (0-30 points)
      const fc = inf.follower_count || 0;
      if (fc >= 1000000) score += 30;
      else if (fc >= 500000) score += 27;
      else if (fc >= 100000) score += 24;
      else if (fc >= 50000) score += 20;
      else if (fc >= 10000) score += 15;
      else if (fc >= 5000) score += 10;
      else if (fc >= 1000) score += 5;
      else if (fc > 0) score += 2;

      // 2. Engagement rate (0-25 points)
      const er = inf.engagement_rate || 0;
      if (er >= 0.10) score += 25;
      else if (er >= 0.05) score += 20;
      else if (er >= 0.03) score += 15;
      else if (er >= 0.02) score += 12;
      else if (er >= 0.01) score += 8;
      else if (er > 0) score += 3;

      // 3. Content activity (0-15 points)
      const pc = inf.post_count || 0;
      if (pc >= 500) score += 15;
      else if (pc >= 200) score += 12;
      else if (pc >= 100) score += 10;
      else if (pc >= 50) score += 7;
      else if (pc >= 10) score += 4;
      else if (pc > 0) score += 1;

      // 4. Profile completeness (0-15 points)
      if (inf.bio) score += 3;
      if (inf.email) score += 4;
      if (inf.category) score += 3;
      if (inf.avg_likes) score += 3;
      if (inf.avg_views) score += 2;

      // 5. Verification & business (0-15 points)
      if (inf.is_verified) score += 10;
      if (inf.is_business) score += 5;

      // Clamp to 0-100
      score = Math.min(100, Math.max(0, score));

      // Only update if we have some data
      if (inf.follower_count === null && !inf.bio && !inf.email) continue;

      const { error: updateErr } = await s.from('influencers')
        .update({ influence_score: score })
        .eq('id', inf.id);

      if (!updateErr) batchUpdated++;
    }

    updated += batchUpdated;
    console.log(`  Page ${page + 1}: ${batchUpdated}/${batch.length} scored`);

    if (batch.length < PAGE) break;
    page++;
  }

  console.log(`\ninfluence_score 계산 완료: ${updated}건\n`);
  return updated;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('========================================');
  console.log('마스터데이터 백필 & 중복 제거 시작');
  console.log('========================================\n');

  const dedupCount = await dedup();
  const avgCount = await backfillAvgMetrics();
  const scoreCount = await calcInfluenceScore();

  console.log('========================================');
  console.log('전체 완료');
  console.log(`  중복 제거: ${dedupCount}건`);
  console.log(`  avg 백필: ${avgCount}건`);
  console.log(`  influence_score: ${scoreCount}건`);
  console.log('========================================');
}

main().catch(console.error);
