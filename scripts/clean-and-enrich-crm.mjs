/**
 * CRM 인플루언서 username 정리 + Instagram Profile Scraper로 보강
 *
 * 문제: CRM에서 가져온 username에 "dorachai 페이스북 : https:" 같은
 * 불필요한 텍스트가 포함됨. 실제 IG handle만 추출하여 정리 필요.
 */
import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnuxbjdjkrmuibwptqzj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudXhiamRqa3JtdWlid3B0cXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2NTYwNywiZXhwIjoyMDg3MTQxNjA3fQ.42R0RE_lnhcEIzZE9fPRWfcPT4Qf4-VQuSA8aI-FsXU'
);

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
if (!APIFY_TOKEN) { console.error('APIFY_API_TOKEN 환경변수 필요'); process.exit(1); }

function extractCleanUsername(raw) {
  if (!raw) return null;
  // Remove common CRM noise patterns
  let clean = raw
    .replace(/\s*(페이스북|유튜브|틱톡|쓰레드|트위터|facebook|youtube|tiktok|threads|twitter)\s*:?\s*/gi, ' ')
    .replace(/\s*https?:?\s*/gi, ' ')
    .replace(/\s*팔로워\s*[\d.만K]+\s*/gi, ' ')
    .replace(/\s*\([\d.만K]+\)\s*/gi, ' ')
    .trim();

  // Take first word as username
  const parts = clean.split(/\s+/);
  const username = parts[0];

  // Validate: IG username can only have letters, numbers, dots, underscores
  if (!username || !/^[a-zA-Z0-9._]+$/.test(username)) return null;
  if (username.length < 2) return null;

  return username;
}

async function run() {
  console.log('=== CRM IG 인플루언서 정리 & 보강 ===\n');

  // 1. Get all IG influencers from CRM without follower_count
  const { data: crmInfluencers, error } = await s.from('influencers')
    .select('id, username, platform_id, bio, import_source, display_name')
    .eq('platform', 'instagram')
    .is('follower_count', null)
    .limit(100);

  if (error) { console.error('Error:', error.message); return; }
  console.log(`CRM IG 보강 대상: ${crmInfluencers.length}명\n`);

  // 2. Clean usernames
  const enrichable = [];
  const notEnrichable = [];
  const dupCheck = new Set();

  for (const inf of crmInfluencers) {
    const cleanName = extractCleanUsername(inf.username);
    if (cleanName && !dupCheck.has(cleanName.toLowerCase())) {
      dupCheck.add(cleanName.toLowerCase());
      enrichable.push({ ...inf, cleanUsername: cleanName });
    } else {
      notEnrichable.push(inf);
    }
  }

  console.log(`정리 결과:`);
  console.log(`  보강 가능 (clean username): ${enrichable.length}명`);
  console.log(`  보강 불가 (no valid username): ${notEnrichable.length}명\n`);

  // Show cleaned usernames
  console.log('보강할 인플루언서:');
  enrichable.forEach(inf => {
    console.log(`  ${inf.username} → ${inf.cleanUsername}`);
  });

  // 3. Check if these clean usernames already exist in DB (different row)
  const cleanUsernames = enrichable.map(e => e.cleanUsername);
  const { data: existing } = await s.from('influencers')
    .select('id, username, follower_count')
    .eq('platform', 'instagram')
    .in('username', cleanUsernames);

  const existingMap = {};
  (existing || []).forEach(e => { existingMap[e.username.toLowerCase()] = e; });

  console.log(`\n이미 DB에 존재하는 username: ${Object.keys(existingMap).length}개`);

  // 4. Update polluted usernames to clean ones
  let fixedCount = 0;
  for (const inf of enrichable) {
    const existingRow = existingMap[inf.cleanUsername.toLowerCase()];
    if (existingRow && existingRow.id !== inf.id) {
      // This username already exists as a different row — it's a duplicate
      console.log(`  ⚠️ ${inf.cleanUsername} 이미 존재 (id: ${existingRow.id}, followers: ${existingRow.follower_count}) — CRM row will be marked`);
      // Update the CRM row's display_name to keep the info, but fix username
      continue;
    }

    // Fix the username
    const { error: updateErr } = await s.from('influencers')
      .update({ username: inf.cleanUsername })
      .eq('id', inf.id);

    if (!updateErr) {
      fixedCount++;
    } else {
      console.log(`  ❌ ${inf.cleanUsername}: ${updateErr.message}`);
    }
  }
  console.log(`\nusername 정리 완료: ${fixedCount}건`);

  // 5. Now trigger Apify Instagram Profile Scraper for the cleaned usernames
  const toEnrich = enrichable.filter(e => {
    const existingRow = existingMap[e.cleanUsername.toLowerCase()];
    return !existingRow || existingRow.id === e.id;
  }).map(e => e.cleanUsername);

  if (toEnrich.length === 0) {
    console.log('\n보강할 인플루언서 없음');
    return;
  }

  console.log(`\n=== Apify Instagram Profile Scraper 실행 (${toEnrich.length}명) ===`);
  console.log('Usernames:', JSON.stringify(toEnrich));

  const actorId = 'apify~instagram-profile-scraper';
  const input = {
    usernames: toEnrich,
    resultsLimit: 1,
  };

  const res = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    console.error('Apify 실행 실패:', await res.text());
    return;
  }

  const runData = await res.json();
  const runId = runData.data.id;
  console.log(`Run ID: ${runId}`);
  console.log(`Status: ${runData.data.status}`);

  // 6. Poll for completion
  console.log('\n대기 중...');
  let status = runData.data.status;
  while (status === 'RUNNING' || status === 'READY') {
    await new Promise(r => setTimeout(r, 5000));
    const check = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const checkData = await check.json();
    status = checkData.data.status;
    process.stdout.write(`.`);
  }
  console.log(`\nRun 완료: ${status}`);

  if (status !== 'SUCCEEDED') {
    console.error('실패:', status);
    return;
  }

  // 7. Get results and update DB
  const datasetId = (await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)).json()).data.defaultDatasetId;
  const items = await (await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`)).json();

  console.log(`\n결과: ${items.length}개 프로필\n`);

  let enrichedCount = 0;
  for (const item of items) {
    const username = item.username;
    if (!username) continue;

    const update = {};
    if (item.followersCount) update.follower_count = item.followersCount;
    if (item.followsCount) update.following_count = item.followsCount;
    if (item.postsCount) update.post_count = item.postsCount;
    if (item.biography) update.bio = item.biography;
    if (item.profilePicUrlHD || item.profilePicUrl) update.profile_image_url = item.profilePicUrlHD || item.profilePicUrl;
    if (item.fullName) update.display_name = item.fullName;
    if (item.externalUrl) update.external_url = item.externalUrl;
    if (item.isVerified) update.is_verified = true;
    if (item.isBusinessAccount) update.is_business = true;
    if (item.businessCategoryName) update.category = item.businessCategoryName;
    if (item.id) update.platform_id = item.id;

    // Email from bio
    if (item.biography) {
      const emailMatch = item.biography.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
      if (emailMatch && !update.email) {
        update.email = emailMatch[0];
        update.email_source = 'bio';
      }
    }
    if (item.businessEmail) {
      update.email = item.businessEmail;
      update.email_source = 'business';
    }

    // raw_data for further backfill
    update.raw_data = item;
    update.last_updated_at = new Date().toISOString();

    // Engagement rate from latestPosts
    if (item.latestPosts && item.latestPosts.length > 0 && item.followersCount > 0) {
      const posts = item.latestPosts.slice(0, 12);
      const tLikes = posts.reduce((s, p) => s + (p.likesCount || 0), 0);
      const tComments = posts.reduce((s, p) => s + (p.commentsCount || 0), 0);
      const tViews = posts.reduce((s, p) => s + (p.videoViewCount || p.videoPlayCount || 0), 0);
      update.avg_likes = Math.round(tLikes / posts.length);
      update.avg_comments = Math.round(tComments / posts.length);
      if (tViews > 0) update.avg_views = Math.round(tViews / posts.length);
      update.engagement_rate = (update.avg_likes + update.avg_comments) / item.followersCount;
    }

    if (Object.keys(update).length === 0) continue;

    const { error: updateErr } = await s.from('influencers')
      .update(update)
      .eq('platform', 'instagram')
      .eq('username', username);

    if (!updateErr) {
      enrichedCount++;
      console.log(`  ✅ ${username}: ${item.followersCount} followers`);
    } else {
      console.log(`  ❌ ${username}: ${updateErr.message}`);
    }
  }

  console.log(`\n=== 보강 완료: ${enrichedCount}/${items.length} ===`);

  // 8. Run backfill for these newly enriched
  console.log('\n--- 파생 필드 계산 ---');
  const { data: enriched } = await s.from('influencers')
    .select('id, username, follower_count, following_count, post_count, bio, is_verified, raw_data, engagement_rate, source_content_created_at')
    .eq('platform', 'instagram')
    .in('username', toEnrich)
    .not('raw_data', 'is', null);

  let derivedCount = 0;
  for (const inf of (enriched || [])) {
    const rd = inf.raw_data;
    const update = {};

    // influence_score
    let score = 0;
    const fc = inf.follower_count || 0;
    if (fc >= 1000000) score += 30;
    else if (fc >= 100000) score += 25;
    else if (fc >= 10000) score += 20;
    else if (fc >= 1000) score += 10;
    const er = inf.engagement_rate || 0;
    if (er >= 0.06) score += 25;
    else if (er >= 0.03) score += 20;
    else if (er >= 0.01) score += 15;
    else if (er > 0) score += 5;
    if (inf.bio) score += 5;
    if (inf.is_verified) score += 10;
    update.influence_score = Math.min(100, score);

    // content_quality_score
    let cq = 50;
    if (rd.latestPosts && rd.latestPosts.length > 0) {
      const posts = rd.latestPosts;
      const engagements = posts.map(p => (p.likesCount || 0) + (p.commentsCount || 0));
      const avg = engagements.reduce((a, b) => a + b, 0) / engagements.length;
      const variance = engagements.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / engagements.length;
      const cv = avg > 0 ? Math.sqrt(variance) / avg : 1;
      if (cv < 0.5) cq += 15;
      else if (cv < 1.0) cq += 8;
      if (posts.length >= 10) cq += 10;
      else if (posts.length >= 5) cq += 5;
      const types = new Set(posts.map(p => p.type || p.productType || 'unknown'));
      if (types.size >= 3) cq += 10;
      else if (types.size >= 2) cq += 5;
      const withCaptions = posts.filter(p => p.caption && p.caption.length > 50);
      if (withCaptions.length >= posts.length * 0.7) cq += 10;
    }
    update.content_quality_score = Math.min(100, cq);

    // audience_authenticity_score
    let aa = 50;
    if (er > 0 && er < 0.20) aa += 20;
    else if (er >= 0.20) aa -= 10;
    const followRatio = inf.following_count > 0 ? inf.follower_count / inf.following_count : 0;
    if (followRatio > 2) aa += 10;
    if (inf.bio) aa += 5;
    if (inf.is_verified) aa += 15;
    update.audience_authenticity_score = Math.max(0, Math.min(100, aa));

    // last_content_at
    if (!inf.source_content_created_at && rd.latestPosts && rd.latestPosts[0]) {
      const ts = rd.latestPosts[0].timestamp;
      if (ts) update.last_content_at = ts;
    }

    // Extract content fields
    if (rd.latestPosts && rd.latestPosts.length > 0) {
      const allHashtags = [];
      const allMentions = [];
      for (const p of rd.latestPosts) {
        if (p.hashtags) allHashtags.push(...p.hashtags);
        if (p.caption) {
          const ht = p.caption.match(/#[\w\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7A3\u4E00-\u9FFF]+/g);
          if (ht) allHashtags.push(...ht.map(h => h.replace('#', '')));
          const mt = p.caption.match(/@[\w.]+/g);
          if (mt) allMentions.push(...mt);
        }
        if (p.taggedUsers) {
          for (const tu of p.taggedUsers) {
            if (tu.username) allMentions.push('@' + tu.username);
          }
        }
      }
      if (allHashtags.length > 0) update.content_hashtags = [...new Set(allHashtags)];
      if (allMentions.length > 0) update.mentions = [...new Set(allMentions)];

      const fp = rd.latestPosts[0];
      if (fp.url) update.source_content_url = fp.url;
      if (fp.caption) update.source_content_text = fp.caption.substring(0, 5000);
      if (fp.timestamp) {
        update.source_content_created_at = fp.timestamp;
        update.last_content_at = fp.timestamp;
      }
      if (fp.locationName) update.location = fp.locationName;
      if (fp.videoDuration) update.video_duration = fp.videoDuration;
      if (fp.musicInfo) update.music_info = fp.musicInfo;
      if (fp.type || fp.productType) update.product_type = fp.type || fp.productType;
    }

    const { error: ue } = await s.from('influencers').update(update).eq('id', inf.id);
    if (!ue) derivedCount++;
  }

  console.log(`파생 필드 업데이트: ${derivedCount}건`);

  // Final stats
  const { count: remaining } = await s.from('influencers')
    .select('id', { count: 'exact', head: true })
    .eq('platform', 'instagram')
    .is('follower_count', null);
  console.log(`\n잔여 보강 필요: ${remaining}명`);
}

run().catch(console.error);
