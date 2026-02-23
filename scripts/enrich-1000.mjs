import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
const envContent = readFileSync('.env.local', 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const apifyToken = envVars.APIFY_API_TOKEN;

if (!supabaseUrl || !supabaseKey || !apifyToken) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Bio-link filter domains ──
const SKIP_DOMAINS = [
  'youtube.com', 'youtu.be', 'tiktok.com', 'twitter.com', 'x.com',
  'instagram.com', 'facebook.com', 'amazon.com', 'amzn.to',
  'amazon.co.jp', 'amazon.co.uk', 'rakuten.co.jp', 'shopee',
  'lazada', 'qoo10', 'coupang.com', 'naver.com', 'google.com',
  'apple.com', 'spotify.com', 'music.apple.com', 'open.spotify.com',
];

const GENERIC_EMAIL_DOMAINS = [
  '29cm.co.kr', 'liketoknow.it', 'amazon.com', 'tiktok.com',
  'youtube.com', 'instagram.com', 'naver.com', 'google.com',
  'truemed.com', 'fanicon.net',
];

function isEmailExtractable(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !SKIP_DOMAINS.some(d => host.includes(d));
  } catch { return false; }
}

function isPersonalEmail(email) {
  return !GENERIC_EMAIL_DOMAINS.some(d => email.endsWith(`@${d}`));
}

// ── Step 1: Find 1000 unenriched 10K+ followers ──
console.log('=== Step 1: Finding 1000 unenriched 10K+ influencers ===');

const { data: influencers, error: fetchErr } = await supabase
  .from('influencers')
  .select('id, username, follower_count, bio, display_name, email')
  .eq('platform', 'instagram')
  .gte('follower_count', 10000)
  .or('bio.is.null,display_name.is.null,profile_image_url.eq.,profile_image_url.is.null')
  .not('username', 'is', null)
  .order('follower_count', { ascending: false })
  .limit(1000);

if (fetchErr) {
  console.error('Fetch error:', fetchErr.message);
  process.exit(1);
}

console.log(`Found ${influencers.length} unenriched 10K+ influencers`);

if (influencers.length === 0) {
  console.log('All 10K+ influencers already enriched!');
  process.exit(0);
}

const usernames = [...new Set(influencers.map(i => i.username).filter(Boolean))];
console.log(`Unique usernames: ${usernames.length}`);
console.log(`Top 5: ${usernames.slice(0, 5).join(', ')}`);
console.log(`Follower range: ${influencers[influencers.length - 1].follower_count?.toLocaleString()} ~ ${influencers[0].follower_count?.toLocaleString()}`);

// ── Step 2: Create extraction job ──
console.log('\n=== Step 2: Creating extraction job ===');

const { data: job, error: jobErr } = await supabase
  .from('extraction_jobs')
  .insert({
    type: 'enrich',
    platform: 'instagram',
    status: 'running',
    input_config: { usernames, batch_size: usernames.length, priority: 'high_10k' },
    started_at: new Date().toISOString(),
  })
  .select('*')
  .single();

if (jobErr) {
  console.error('Job creation error:', jobErr.message);
  process.exit(1);
}

console.log(`Job ID: ${job.id}`);

// ── Step 3: Launch Apify Instagram Profile Scraper ──
console.log('\n=== Step 3: Launching Apify Instagram Profile Scraper ===');
console.log(`Sending ${usernames.length} usernames to Profile Scraper...`);

const actorId = 'apify~instagram-profile-scraper';
const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`;

const startRes = await fetch(startUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ usernames }),
});

if (!startRes.ok) {
  const errText = await startRes.text();
  console.error('Apify start error:', errText);
  await supabase.from('extraction_jobs').update({ status: 'failed' }).eq('id', job.id);
  process.exit(1);
}

const runData = await startRes.json();
const runId = runData.data?.id;
console.log(`Apify Run ID: ${runId}`);

await supabase.from('extraction_jobs').update({ apify_run_id: runId }).eq('id', job.id);

// ── Step 4: Poll until complete ──
console.log('\n=== Step 4: Polling for completion ===');

const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`;
let completed = false;

while (!completed) {
  await new Promise(r => setTimeout(r, 15000));

  const statusRes = await fetch(statusUrl);
  const statusData = await statusRes.json();
  const status = statusData.data?.status;
  const stats = statusData.data?.stats;

  console.log(`  [${new Date().toLocaleTimeString()}] ${status} | Duration: ${Math.round((stats?.durationMillis ?? 0) / 1000)}s`);

  if (status === 'SUCCEEDED') {
    completed = true;
    console.log('\nProfile Scraper COMPLETED!');

    // ── Step 5: Fetch results and process ──
    console.log('\n=== Step 5: Fetching and processing results ===');

    const datasetId = statusData.data?.defaultDatasetId;
    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&limit=1100`);
    const items = await itemsRes.json();
    console.log(`Fetched ${items.length} profile results`);

    let enrichedCount = 0;
    let emailsFound = 0;
    let linksStored = 0;
    let linksFiltered = 0;
    let businessEmails = 0;
    let bioEmails = 0;

    for (const record of items) {
      try {
        const username = record.username || record.ownerUsername;
        const platformId = String(record.id || record.pk || record.ownerId || '');
        if (!username && !platformId) continue;

        // Find matching influencer
        let existing = null;
        if (platformId) {
          const { data } = await supabase
            .from('influencers')
            .select('id, email, follower_count')
            .eq('platform', 'instagram')
            .eq('platform_id', platformId)
            .single();
          existing = data;
        }
        if (!existing && username) {
          const { data } = await supabase
            .from('influencers')
            .select('id, email, follower_count')
            .eq('platform', 'instagram')
            .ilike('username', username)
            .single();
          existing = data;
        }
        if (!existing) continue;

        // Build update
        const updateData = { last_updated_at: new Date().toISOString() };

        if (username) updateData.username = username;
        if (record.fullName) updateData.display_name = record.fullName;
        if (record.biography) updateData.bio = record.biography;
        if (record.followersCount != null) updateData.follower_count = record.followersCount;
        if (record.followsCount != null) updateData.following_count = record.followsCount;
        if (record.postsCount != null) updateData.post_count = record.postsCount;
        if (platformId) updateData.platform_id = platformId;

        const profilePic = record.profilePicUrlHD || record.profilePicUrl;
        if (profilePic && profilePic.startsWith('http')) {
          updateData.profile_image_url = profilePic;
        }

        if (record.profileUrl || username) {
          updateData.profile_url = record.profileUrl || `https://instagram.com/${username}`;
        }

        if (record.isVerified === true) updateData.is_verified = true;
        if (record.isBusinessAccount === true) updateData.is_business = true;
        if (record.businessCategoryName) updateData.category = record.businessCategoryName;

        // Engagement rate from latestPosts
        if (record.followersCount > 0 && Array.isArray(record.latestPosts) && record.latestPosts.length > 0) {
          const posts = record.latestPosts.slice(0, 12);
          let totalEng = 0;
          for (const p of posts) {
            totalEng += (Number(p.likesCount || 0)) + (Number(p.commentsCount || 0));
          }
          updateData.engagement_rate = Math.round((totalEng / posts.length / record.followersCount) * 10000) / 10000;
        }

        // Email: businessEmail > bio regex
        const businessEmail = record.businessEmail;
        if (businessEmail && businessEmail.includes('@')) {
          updateData.email = businessEmail;
          updateData.email_source = 'business';
          businessEmails++;
        } else if (!existing.email) {
          const emailMatch = (record.biography || '').match(/[\w.-]+@[\w.-]+\.\w+/);
          if (emailMatch) {
            updateData.email = emailMatch[0];
            updateData.email_source = 'bio';
            bioEmails++;
          }
        }

        // Raw data
        updateData.raw_data = { ...record, _enrichedAt: new Date().toISOString() };

        await supabase.from('influencers').update(updateData).eq('id', existing.id);
        enrichedCount++;
        if (updateData.email) emailsFound++;

        // Store bio links - ONLY extractable links (filter out Amazon, YouTube etc.)
        const finalEmail = updateData.email || existing.email;
        if (!finalEmail) {
          const bio = record.biography || '';
          const externalUrl = record.externalUrl || null;
          const links = [];

          const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
          const bioMatches = bio.match(urlRegex) || [];
          links.push(...bioMatches);
          if (externalUrl && externalUrl.startsWith('http')) links.push(externalUrl);

          const uniqueLinks = [...new Set(links)];
          const extractableLinks = uniqueLinks.filter(isEmailExtractable);
          linksFiltered += (uniqueLinks.length - extractableLinks.length);

          for (const url of extractableLinks) {
            await supabase
              .from('influencer_links')
              .upsert({ influencer_id: existing.id, url, scraped: false }, { onConflict: 'influencer_id,url' });
            linksStored++;
          }
        }
      } catch (err) {
        // skip
      }
    }

    // Update job
    await supabase.from('extraction_jobs').update({
      status: 'completed',
      total_extracted: enrichedCount,
      new_extracted: emailsFound,
      completed_at: new Date().toISOString(),
    }).eq('id', job.id);

    console.log('\n============================');
    console.log('ENRICHMENT RESULTS');
    console.log('============================');
    console.log(`Profiles enriched: ${enrichedCount}/${items.length}`);
    console.log(`Emails found: ${emailsFound} (business: ${businessEmails}, bio: ${bioEmails})`);
    console.log(`Bio links stored: ${linksStored} (filtered out: ${linksFiltered})`);

    // ── Step 6: Email extraction from bio links only ──
    console.log('\n=== Step 6: Checking stored links for email extraction ===');

    const { data: unscrapedLinks, count: linkCount } = await supabase
      .from('influencer_links')
      .select('id, influencer_id, url', { count: 'exact' })
      .eq('scraped', false)
      .limit(1000);

    console.log(`Total unscraped links: ${linkCount}`);

    if (unscrapedLinks && unscrapedLinks.length > 0) {
      const linkMap = {};
      const startUrls = [];
      const seenUrls = new Set();

      for (const link of unscrapedLinks) {
        if (seenUrls.has(link.url)) continue;
        seenUrls.add(link.url);
        linkMap[link.url] = { link_id: link.id, influencer_id: link.influencer_id };
        startUrls.push({ url: link.url });
      }

      console.log(`Unique URLs to scrape: ${startUrls.length}`);

      // Create email scrape job
      const { data: emailJob } = await supabase
        .from('extraction_jobs')
        .insert({
          type: 'email_scrape',
          platform: 'all',
          status: 'running',
          input_config: { total_links: startUrls.length },
          started_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      console.log(`Email scrape job: ${emailJob?.id}`);

      // Launch Email Extractor with startUrls format
      const emailActorId = 'ahmed_jasarevic~linktree-beacons-bio-email-scraper-extract-leads';
      const emailStartRes = await fetch(`https://api.apify.com/v2/acts/${emailActorId}/runs?token=${apifyToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startUrls }),
      });

      if (emailStartRes.ok) {
        const emailRunData = await emailStartRes.json();
        const emailRunId = emailRunData.data?.id;
        console.log(`Email Extractor Run ID: ${emailRunId}`);

        await supabase.from('extraction_jobs').update({ apify_run_id: emailRunId }).eq('id', emailJob.id);

        // Poll email extraction
        console.log('\nPolling email extraction...');
        let emailDone = false;

        while (!emailDone) {
          await new Promise(r => setTimeout(r, 30000)); // 30s intervals

          const eRes = await fetch(`https://api.apify.com/v2/actor-runs/${emailRunId}?token=${apifyToken}`);
          const eData = await eRes.json();
          const eStatus = eData.data?.status;
          const eDuration = Math.round((eData.data?.stats?.durationMillis ?? 0) / 1000);

          // Check dataset count
          let itemCount = '?';
          const dsId = eData.data?.defaultDatasetId;
          if (dsId) {
            try {
              const cRes = await fetch(`https://api.apify.com/v2/datasets/${dsId}?token=${apifyToken}`);
              const cData = await cRes.json();
              itemCount = cData.data?.itemCount ?? '?';
            } catch {}
          }

          console.log(`  [${new Date().toLocaleTimeString()}] ${eStatus} | Items: ${itemCount}/${startUrls.length} | ${eDuration}s`);

          if (eStatus === 'SUCCEEDED') {
            emailDone = true;

            const eDatasetId = eData.data?.defaultDatasetId;
            const eItems = await (await fetch(`https://api.apify.com/v2/datasets/${eDatasetId}/items?token=${apifyToken}&limit=2000`)).json();

            console.log(`\nEmail results: ${eItems.length}`);

            let linkEmailsFound = 0;
            let linksProcessed = 0;

            for (const item of eItems) {
              const scrapedUrl = item.sourceUrl || item.url || item.inputUrl || item.link;
              const emails = item.emails || item.email || [];
              const emailList = Array.isArray(emails)
                ? emails.filter(e => typeof e === 'string' && e.includes('@') && isPersonalEmail(e))
                : [];

              if (!scrapedUrl) continue;

              // Match URL (exact then normalized)
              let matched = linkMap[scrapedUrl];
              if (!matched) {
                try {
                  const u = new URL(scrapedUrl);
                  const norm = `https://${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
                  for (const [mapUrl, mapInfo] of Object.entries(linkMap)) {
                    try {
                      const mu = new URL(mapUrl);
                      const normMap = `https://${mu.hostname.replace(/^www\./, '')}${mu.pathname.replace(/\/+$/, '')}`.toLowerCase();
                      if (normMap === norm) { matched = mapInfo; break; }
                    } catch {}
                  }
                } catch {}
              }

              if (!matched) continue;
              linksProcessed++;

              await supabase.from('influencer_links').update({
                scraped: true,
                emails_found: emailList.length > 0 ? emailList : null,
                scraped_at: new Date().toISOString(),
              }).eq('id', matched.link_id);

              if (emailList.length > 0) {
                const { data: inf } = await supabase
                  .from('influencers')
                  .select('email')
                  .eq('id', matched.influencer_id)
                  .single();

                if (inf && !inf.email) {
                  let emailSource = 'link';
                  try {
                    emailSource = `${new URL(scrapedUrl).hostname.replace('www.', '')}:${scrapedUrl}`;
                  } catch {}

                  await supabase.from('influencers').update({
                    email: emailList[0],
                    email_source: emailSource,
                  }).eq('id', matched.influencer_id);

                  linkEmailsFound++;
                  console.log(`  + ${emailList[0]} <- ${scrapedUrl.substring(0, 50)}`);
                }
              }
            }

            // Mark unmatched links as scraped
            const processedIds = new Set();
            for (const item of eItems) {
              const url = item.sourceUrl || item.url || item.inputUrl || item.link;
              if (url && linkMap[url]) processedIds.add(linkMap[url].link_id);
            }
            const unmatched = unscrapedLinks.filter(l => !processedIds.has(l.id));
            for (const link of unmatched) {
              await supabase.from('influencer_links').update({
                scraped: true, scraped_at: new Date().toISOString(),
              }).eq('id', link.id);
            }

            await supabase.from('extraction_jobs').update({
              status: 'completed',
              total_extracted: linksProcessed,
              new_extracted: linkEmailsFound,
              completed_at: new Date().toISOString(),
            }).eq('id', emailJob.id);

            console.log('\n--- EMAIL EXTRACTION ---');
            console.log(`Links matched: ${linksProcessed}/${eItems.length}`);
            console.log(`New emails from links: ${linkEmailsFound}`);

          } else if (eStatus === 'FAILED' || eStatus === 'ABORTED') {
            emailDone = true;
            console.log(`Email extraction ${eStatus}`);
            await supabase.from('extraction_jobs').update({ status: 'failed' }).eq('id', emailJob.id);
          }
        }
      } else {
        console.log('Failed to start email extractor:', await emailStartRes.text());
      }
    } else {
      console.log('No unscraped links to process.');
    }

    // ── Final Summary ──
    const { count: totalIG } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram');
    const { count: enrichedIG } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').not('bio', 'is', null);
    const { count: withEmail } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').not('email', 'is', null);
    const { count: verified } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').eq('is_verified', true);
    const { count: business } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').eq('is_business', true);

    console.log('\n============================');
    console.log('FINAL SUMMARY');
    console.log('============================');
    console.log(`Total Instagram: ${totalIG?.toLocaleString()}`);
    console.log(`Enriched (has bio): ${enrichedIG?.toLocaleString()} (${Math.round(enrichedIG/totalIG*100)}%)`);
    console.log(`With email: ${withEmail?.toLocaleString()}`);
    console.log(`Verified: ${verified?.toLocaleString()}`);
    console.log(`Business accounts: ${business?.toLocaleString()}`);

  } else if (status === 'FAILED' || status === 'ABORTED') {
    completed = true;
    console.log(`\nProfile Scraper ${status}!`);
    await supabase.from('extraction_jobs').update({ status: 'failed' }).eq('id', job.id);
    process.exit(1);
  }
}
