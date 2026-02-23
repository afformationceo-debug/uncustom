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
const supabase = createClient(supabaseUrl, supabaseKey);

// ── Step 1: Get unscraped links ──
console.log('=== Finding unscraped links ===');

const { data: links, count } = await supabase
  .from('influencer_links')
  .select('id, influencer_id, url', { count: 'exact' })
  .eq('scraped', false)
  .limit(1000);

console.log(`Unscraped links: ${count}`);
console.log(`Processing: ${links.length}`);

if (!links || links.length === 0) {
  console.log('No links to process');
  process.exit(0);
}

// Build link map and startUrls
const linkMap = {};
const startUrls = [];
const seenUrls = new Set();

for (const link of links) {
  if (seenUrls.has(link.url)) continue;
  seenUrls.add(link.url);
  linkMap[link.url] = { link_id: link.id, influencer_id: link.influencer_id };
  startUrls.push({ url: link.url });
}

console.log(`Unique URLs: ${startUrls.length}`);

// ── Step 2: Create job record ──
const { data: job } = await supabase
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

console.log(`Job ID: ${job.id}`);

// ── Step 3: Launch Email Extractor with startUrls format ──
console.log('\n=== Launching Email Extractor ===');

const actorId = 'vdrmota~contact-info-scraper';
const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`;

const res = await fetch(startUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ startUrls, maxDepth: 1, maxRequestsPerStartUrl: 5, sameDomain: true }),
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

// ── Step 4: Poll ──
console.log('\n=== Polling... ===');
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

    console.log(`\nResults: ${items.length}`);

    let emailsFound = 0;
    let linksProcessed = 0;

    // Build normalized URL index for faster matching
    const normalizedLinkMap = new Map();
    for (const [mapUrl, mapInfo] of Object.entries(linkMap)) {
      try {
        const mu = new URL(mapUrl);
        const normMap = `https://${mu.hostname.replace(/^www\./, '')}${mu.pathname.replace(/\/+$/, '')}`.toLowerCase();
        normalizedLinkMap.set(normMap, mapInfo);
      } catch {}
    }

    for (const item of items) {
      // vdrmota/contact-info-scraper returns one item per start URL:
      //   originalStartUrl, scrapedUrls[], emails[], phones[]
      const originalStartUrl = item.originalStartUrl;
      const emails = item.emails || item.email || [];
      const emailList = Array.isArray(emails)
        ? emails.filter(e => typeof e === 'string' && e.includes('@') &&
            !e.includes('gdprlocal.com') && !e.includes('privacy@') && !e.includes('dpo.support@'))
        : (typeof emails === 'string' && emails.includes('@')) ? [emails] : [];

      if (!originalStartUrl) continue;

      // Match by originalStartUrl
      let matched = linkMap[originalStartUrl];
      if (!matched) {
        try {
          const u = new URL(originalStartUrl);
          const norm = `https://${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
          matched = normalizedLinkMap.get(norm);
        } catch {}
      }
      // Fallback: try scrapedUrls
      if (!matched && Array.isArray(item.scrapedUrls)) {
        for (const scraped of item.scrapedUrls) {
          matched = linkMap[scraped];
          if (!matched) {
            try {
              const u = new URL(scraped);
              const norm = `https://${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
              matched = normalizedLinkMap.get(norm);
            } catch {}
          }
          if (matched) break;
        }
      }

      if (!matched) continue;
      linksProcessed++;

      // Update link
      await supabase.from('influencer_links').update({
        scraped: true,
        emails_found: emailList.length > 0 ? emailList : null,
        scraped_at: new Date().toISOString(),
      }).eq('id', matched.link_id);

      // Update influencer email
      if (emailList.length > 0) {
        const { data: inf } = await supabase
          .from('influencers')
          .select('email')
          .eq('id', matched.influencer_id)
          .single();

        if (inf && !inf.email) {
          const sourceUrl = originalStartUrl;
          let emailSource = 'web-scraper';
          try {
            emailSource = `${new URL(sourceUrl).hostname.replace('www.', '')}:${sourceUrl}`;
          } catch {}

          await supabase.from('influencers').update({
            email: emailList[0],
            email_source: emailSource,
          }).eq('id', matched.influencer_id);

          emailsFound++;
        }
      }
    }

    // Mark remaining unprocessed links as scraped (no email found)
    const processedLinkIds = new Set();
    for (const item of items) {
      const startUrl = item.originalStartUrl;
      if (startUrl && linkMap[startUrl]) processedLinkIds.add(linkMap[startUrl].link_id);
      if (startUrl) {
        try {
          const u = new URL(startUrl);
          const norm = `https://${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
          const m = normalizedLinkMap.get(norm);
          if (m) processedLinkIds.add(m.link_id);
        } catch {}
      }
      if (Array.isArray(item.scrapedUrls)) {
        for (const scraped of item.scrapedUrls) {
          if (linkMap[scraped]) processedLinkIds.add(linkMap[scraped].link_id);
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

    await supabase.from('extraction_jobs').update({
      status: 'completed',
      total_extracted: linksProcessed,
      new_extracted: emailsFound,
      completed_at: new Date().toISOString(),
    }).eq('id', job.id);

    console.log('\n============================');
    console.log('LINK EMAIL EXTRACTION RESULTS');
    console.log('============================');
    console.log(`Links processed: ${linksProcessed}`);
    console.log(`Emails found: ${emailsFound}`);

  } else if (status === 'FAILED' || status === 'ABORTED') {
    done = true;
    console.log(`Email extraction ${status}`);
    await supabase.from('extraction_jobs').update({ status: 'failed' }).eq('id', job.id);
  }
}

// Final stats
const { count: withEmail } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').not('email', 'is', null);
console.log(`\nTotal Instagram with email: ${withEmail}`);
