/**
 * Instagram 프로필 보강 실행 스크립트
 * - follower_count가 없는 Instagram 인플루언서를 Apify Profile Scraper로 보강
 * - 200명씩 배치로 실행 (Apify 제한)
 * - 결과를 DB에 자동 업데이트
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cnuxbjdjkrmuibwptqzj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudXhiamRqa3JtdWlid3B0cXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2NTYwNywiZXhwIjoyMDg3MTQxNjA3fQ.42R0RE_lnhcEIzZE9fPRWfcPT4Qf4-VQuSA8aI-FsXU';
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
if (!APIFY_TOKEN) { console.error('APIFY_API_TOKEN 환경변수 필요'); process.exit(1); }
const PROFILE_SCRAPER = 'apify/instagram-profile-scraper';

const s = createClient(SUPABASE_URL, SUPABASE_KEY);

function extractEmailFromBio(bio) {
  if (!bio) return null;
  const match = bio.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

function extractLinksFromBio(bio) {
  if (!bio) return [];
  const urlRegex = /https?:\/\/[^\s)>\]]+/gi;
  return (bio.match(urlRegex) || []);
}

async function startApifyActor(usernames) {
  const actorId = encodeURIComponent(PROFILE_SCRAPER);
  const resp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernames: usernames,
      resultsLimit: usernames.length,
    }),
  });
  if (!resp.ok) throw new Error(`Apify start failed: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

async function waitForRun(runId) {
  let attempts = 0;
  while (attempts < 120) { // max 10 minutes
    const resp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const data = await resp.json();
    const status = data.data?.status;
    if (status === 'SUCCEEDED') return data.data;
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Run ${runId} ended with status: ${status}`);
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
  }
  throw new Error('Timeout waiting for run');
}

async function getDatasetItems(datasetId) {
  const resp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json`);
  if (!resp.ok) throw new Error(`Dataset fetch failed: ${resp.status}`);
  return resp.json();
}

function transformProfileData(item) {
  const email = item.businessEmail || item.contactPhoneNumber ? null : extractEmailFromBio(item.biography);
  const bioEmail = extractEmailFromBio(item.biography);
  const finalEmail = item.businessEmail || bioEmail;

  return {
    display_name: item.fullName || null,
    bio: item.biography || null,
    follower_count: item.followersCount || 0,
    following_count: item.followsCount || 0,
    post_count: item.postsCount || 0,
    profile_image_url: item.profilePicUrlHD || item.profilePicUrl || null,
    email: finalEmail || null,
    email_source: finalEmail ? (item.businessEmail ? 'business' : `bio`) : null,
    is_verified: item.verified || item.isVerified || false,
    is_business: item.isBusinessAccount || false,
    category: item.businessCategoryName || null,
    external_url: item.externalUrl || null,
    engagement_rate: calculateEngagement(item),
    raw_data: item,
  };
}

function calculateEngagement(item) {
  if (!item.latestPosts || item.latestPosts.length === 0 || !item.followersCount) return null;
  const posts = item.latestPosts.slice(0, 12);
  const totalEng = posts.reduce((sum, p) => sum + (p.likesCount || 0) + (p.commentsCount || 0), 0);
  return totalEng / posts.length / item.followersCount;
}

async function run() {
  // 1. Get all Instagram influencers needing enrichment
  const { data: needed, error } = await s.from('influencers')
    .select('id, username, platform_id, import_source')
    .eq('platform', 'instagram')
    .or('follower_count.is.null,follower_count.eq.0');

  if (error) { console.error('DB Error:', error.message); return; }

  // Filter to valid usernames only
  const valid = needed.filter(r => r.username && r.username !== 'null' && r.username.trim() !== '');
  const invalid = needed.filter(r => !r.username || r.username === 'null' || r.username.trim() === '');

  console.log(`\nTotal needing enrichment: ${needed.length}`);
  console.log(`Valid usernames: ${valid.length}`);
  console.log(`Invalid (no username, cannot enrich): ${invalid.length}`);

  if (valid.length === 0) {
    console.log('No valid usernames to enrich.');
    return;
  }

  // 2. Batch into groups of 200
  const BATCH_SIZE = 200;
  const batches = [];
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    batches.push(valid.slice(i, i + BATCH_SIZE));
  }

  console.log(`\nBatches: ${batches.length} (${BATCH_SIZE}/batch)`);

  let totalEnriched = 0;
  let totalFailed = 0;

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const usernames = batch.map(r => r.username);
    console.log(`\n--- Batch ${bi + 1}/${batches.length}: ${usernames.length}명 ---`);
    console.log(`Usernames: ${usernames.slice(0, 10).join(', ')}${usernames.length > 10 ? `... (+${usernames.length - 10})` : ''}`);

    try {
      // Start Apify run
      console.log('Starting Apify Profile Scraper...');
      const runResult = await startApifyActor(usernames);
      const runId = runResult.data?.id;
      const datasetId = runResult.data?.defaultDatasetId;
      console.log(`Run started: ${runId}`);

      // Record extraction job
      await s.from('extraction_jobs').insert({
        type: 'enrich',
        platform: 'instagram',
        status: 'running',
        apify_run_id: runId,
        items_found: 0,
        config: { usernames: usernames.length, batch: bi + 1 },
      });

      // Wait for completion
      process.stdout.write('Waiting');
      await waitForRun(runId);
      console.log(' Done!');

      // Get results
      const items = await getDatasetItems(datasetId);
      console.log(`Results: ${items.length} profiles`);

      // Update DB
      let enriched = 0;
      for (const item of items) {
        const username = item.username?.toLowerCase();
        if (!username) continue;

        const match = batch.find(r => r.username?.toLowerCase() === username);
        if (!match) continue;

        const update = transformProfileData(item);
        const { error: updateErr } = await s.from('influencers')
          .update(update)
          .eq('id', match.id);

        if (updateErr) {
          console.error(`  Failed to update ${username}: ${updateErr.message}`);
          totalFailed++;
        } else {
          enriched++;
        }

        // Also store bio links
        const links = extractLinksFromBio(item.biography);
        if (item.externalUrl) links.push(item.externalUrl);
        for (const url of links) {
          await s.from('influencer_links').upsert({
            influencer_id: match.id,
            url: url,
            scraped: false,
          }, { onConflict: 'influencer_id,url' }).select();
        }
      }

      totalEnriched += enriched;
      console.log(`Batch ${bi + 1} enriched: ${enriched}/${usernames.length}`);

      // Update extraction job
      await s.from('extraction_jobs')
        .update({ status: 'completed', items_found: enriched })
        .eq('apify_run_id', runId);

    } catch (err) {
      console.error(`Batch ${bi + 1} failed:`, err.message);
      totalFailed += batch.length;
    }
  }

  console.log(`\n========================================`);
  console.log(`ENRICHMENT COMPLETE`);
  console.log(`Total enriched: ${totalEnriched}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`Skipped (no username): ${invalid.length}`);
  console.log(`========================================`);
}

run().catch(console.error);
