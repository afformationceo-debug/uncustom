import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load env
const envContent = readFileSync('.env.local', 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);
const apifyToken = envVars.APIFY_API_TOKEN;

const SKIP_DOMAINS = [
  'instagram.com', 'youtube.com', 'youtu.be', 'tiktok.com',
  'twitter.com', 'x.com', 'facebook.com', 'fb.com',
  'threads.net', 'snapchat.com', 'pinterest.com',
  'amazon.com', 'amzn.to', 'music.apple.com', 'spotify.com',
  'soundcloud.com', 'open.spotify.com'
];

function isScrapableUrl(url) {
  if (!url || !url.startsWith('http')) return false;
  try {
    const host = new URL(url).hostname.replace('www.', '').toLowerCase();
    return !SKIP_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch { return false; }
}

async function main() {
  console.log('=== 이메일 스크래핑 시작 ===\n');

  // 1. Collect external_url from influencers (no email, scrapable external_url)
  const { data: extUrlInfluencers } = await supabase
    .from('influencers')
    .select('id, username, platform, external_url')
    .is('email', null)
    .not('external_url', 'is', null)
    .neq('external_url', '')
    .limit(1000);

  const scrapableExtUrls = (extUrlInfluencers || []).filter(inf => isScrapableUrl(inf.external_url));

  // Group by platform for reporting
  const byPlatform = {};
  for (const inf of scrapableExtUrls) {
    byPlatform[inf.platform] = (byPlatform[inf.platform] || 0) + 1;
  }
  console.log('[External URL 대상]');
  for (const [p, c] of Object.entries(byPlatform)) {
    console.log(`  ${p}: ${c}명`);
  }
  console.log(`  합계: ${scrapableExtUrls.length}명\n`);

  // 2. Collect unscraped influencer_links
  const { data: links } = await supabase
    .from('influencer_links')
    .select('id, influencer_id, url')
    .eq('scraped', false)
    .limit(1000);

  console.log(`[Unscraped Links 대상]: ${(links || []).length}개\n`);

  // 3. Merge all URLs
  const urlToMeta = new Map(); // url -> { type, influencer_id, link_id? }
  const seenUrls = new Set();

  for (const inf of scrapableExtUrls) {
    const url = inf.external_url;
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      urlToMeta.set(url, { type: 'external_url', influencer_id: inf.id });
    }
  }

  for (const link of (links || [])) {
    if (!seenUrls.has(link.url) && isScrapableUrl(link.url)) {
      seenUrls.add(link.url);
      urlToMeta.set(link.url, { type: 'link', influencer_id: link.influencer_id, link_id: link.id });
    }
  }

  const allUrls = [...urlToMeta.keys()];
  console.log(`총 스크래핑 대상: ${allUrls.length}개 URL`);
  console.log(`예상 비용: ~$${(0.005 + allUrls.length * 0.002).toFixed(2)}\n`);

  if (allUrls.length === 0) {
    console.log('스크래핑할 URL이 없습니다.');
    process.exit(0);
  }

  // 4. Create job record
  const { data: job } = await supabase
    .from('extraction_jobs')
    .insert({
      type: 'email_scrape',
      platform: 'all',
      status: 'running',
      input_config: { total_links: allUrls.length, external_urls: scrapableExtUrls.length, link_urls: (links || []).length },
      started_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  console.log(`Job ID: ${job.id}`);

  // 5. Launch vdrmota/contact-info-scraper
  console.log('\n=== Apify Actor 실행 ===');
  const actorId = 'vdrmota~contact-info-scraper';
  const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`;

  const res = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startUrls: allUrls.map(url => ({ url })),
      maxDepth: 1,
      maxRequestsPerStartUrl: 5,
      sameDomain: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Start error:', errText);
    await supabase.from('extraction_jobs').update({ status: 'failed' }).eq('id', job.id);
    process.exit(1);
  }

  const runData = await res.json();
  const runId = runData.data?.id;
  console.log(`Run ID: ${runId}`);
  await supabase.from('extraction_jobs').update({ apify_run_id: runId }).eq('id', job.id);

  // 6. Poll until complete
  console.log('\n=== 폴링 중... ===');
  const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`;
  let done = false;

  while (!done) {
    await new Promise(r => setTimeout(r, 15000));

    const sRes = await fetch(statusUrl);
    const sData = await sRes.json();
    const status = sData.data?.status;
    const stats = sData.data?.stats;

    console.log(`  [${new Date().toLocaleTimeString()}] ${status} | Items: ${stats?.outputItemCount ?? '?'} | ${Math.round((stats?.durationMillis ?? 0) / 1000)}s`);

    if (status === 'SUCCEEDED') {
      done = true;

      // Fetch results
      const datasetId = sData.data?.defaultDatasetId;
      const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&limit=2000`);
      const items = await itemsRes.json();
      console.log(`\n결과 아이템: ${items.length}개`);

      // Process results
      let emailsFound = 0;
      let noEmailCount = 0;
      let matchedCount = 0;
      let unmatchedCount = 0;
      const platformEmailCounts = {};

      // Build normalized URL index
      const normalizedUrlMap = new Map();
      for (const [url, meta] of urlToMeta) {
        try {
          const u = new URL(url);
          const norm = `https://${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
          normalizedUrlMap.set(norm, { url, ...meta });
        } catch {}
      }

      for (const item of items) {
        const originalStartUrl = item.originalStartUrl;
        const emails = item.emails || item.email || [];
        const emailList = Array.isArray(emails)
          ? emails.filter(e => typeof e === 'string' && e.includes('@') &&
              !e.includes('gdprlocal.com') && !e.includes('privacy@') && !e.includes('dpo.support@'))
          : (typeof emails === 'string' && emails.includes('@')) ? [emails] : [];

        if (!originalStartUrl) { unmatchedCount++; continue; }

        // Match URL
        let matched = urlToMeta.get(originalStartUrl);
        if (!matched) {
          try {
            const u = new URL(originalStartUrl);
            const norm = `https://${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
            const normMatch = normalizedUrlMap.get(norm);
            if (normMatch) matched = normMatch;
          } catch {}
        }
        // Fallback: scrapedUrls
        if (!matched && Array.isArray(item.scrapedUrls)) {
          for (const scraped of item.scrapedUrls) {
            matched = urlToMeta.get(scraped);
            if (!matched) {
              try {
                const u = new URL(scraped);
                const norm = `https://${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
                const normMatch = normalizedUrlMap.get(norm);
                if (normMatch) matched = normMatch;
              } catch {}
            }
            if (matched) break;
          }
        }

        if (!matched) { unmatchedCount++; continue; }
        matchedCount++;

        // Get influencer platform for stats
        const { data: inf } = await supabase
          .from('influencers')
          .select('email, platform')
          .eq('id', matched.influencer_id)
          .single();

        if (emailList.length > 0) {
          // Update influencer email if empty
          if (inf && !inf.email) {
            let emailSource = 'web-scraper';
            try { emailSource = `${new URL(originalStartUrl).hostname.replace('www.', '')}:${originalStartUrl}`; } catch {}

            await supabase.from('influencers').update({
              email: emailList[0],
              email_source: emailSource,
            }).eq('id', matched.influencer_id);

            emailsFound++;
            const plat = inf?.platform || 'unknown';
            platformEmailCounts[plat] = (platformEmailCounts[plat] || 0) + 1;
          }
        } else {
          noEmailCount++;
        }

        // Update influencer_links if this was a link
        if (matched.link_id) {
          await supabase.from('influencer_links').update({
            scraped: true,
            emails_found: emailList.length > 0 ? emailList : null,
            scraped_at: new Date().toISOString(),
          }).eq('id', matched.link_id);
        }
      }

      // Mark remaining unscraped links as scraped
      if (links && links.length > 0) {
        const processedLinkIds = new Set();
        for (const item of items) {
          const startUrl = item.originalStartUrl;
          for (const [url, meta] of urlToMeta) {
            if (meta.link_id && (url === startUrl || (Array.isArray(item.scrapedUrls) && item.scrapedUrls.includes(url)))) {
              processedLinkIds.add(meta.link_id);
            }
          }
        }
        const unprocessedLinks = links.filter(l => !processedLinkIds.has(l.id));
        for (const link of unprocessedLinks) {
          await supabase.from('influencer_links').update({
            scraped: true,
            scraped_at: new Date().toISOString(),
          }).eq('id', link.id);
        }
      }

      // Update job
      await supabase.from('extraction_jobs').update({
        status: 'completed',
        total_extracted: matchedCount,
        new_extracted: emailsFound,
        completed_at: new Date().toISOString(),
      }).eq('id', job.id);

      // Final report
      console.log('\n================================');
      console.log('이메일 스크래핑 결과');
      console.log('================================');
      console.log(`총 URL: ${allUrls.length}개`);
      console.log(`매칭됨: ${matchedCount}개`);
      console.log(`매칭 안 됨: ${unmatchedCount}개`);
      console.log(`이메일 발견: ${emailsFound}건`);
      console.log(`이메일 없음: ${noEmailCount}건`);
      console.log('\n[플랫폼별 이메일 발견]');
      for (const [plat, count] of Object.entries(platformEmailCounts)) {
        console.log(`  ${plat}: ${count}건`);
      }

      // Overall email stats
      for (const platform of ['instagram', 'tiktok', 'youtube', 'twitter']) {
        const { count } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', platform).not('email', 'is', null);
        console.log(`\n[${platform}] 이메일 보유: ${count}명`);
      }

    } else if (status === 'FAILED' || status === 'ABORTED') {
      done = true;
      console.log(`\n스크래핑 ${status}`);
      await supabase.from('extraction_jobs').update({ status: 'failed' }).eq('id', job.id);
    }
  }
}

main().catch(e => console.error(e));
