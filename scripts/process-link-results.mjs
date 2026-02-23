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

const runId = 'mHeSVxhmiMz8C3eW9';
const jobId = 'e70218d4-f8a1-43ab-9760-5fb6d7d4fae3';

// ── Step 1: Poll until done ──
console.log('=== Waiting for Email Extractor to finish ===');
const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`;
let done = false;

while (!done) {
  const sRes = await fetch(statusUrl);
  const sData = await sRes.json();
  const status = sData.data?.status;
  const duration = Math.round((sData.data?.stats?.durationMillis ?? 0) / 1000);

  // Check dataset count
  const dsId = sData.data?.defaultDatasetId;
  let itemCount = '?';
  if (dsId) {
    try {
      const countRes = await fetch(`https://api.apify.com/v2/datasets/${dsId}?token=${apifyToken}`);
      const countData = await countRes.json();
      itemCount = countData.data?.itemCount ?? '?';
    } catch {}
  }

  console.log(`  [${new Date().toLocaleTimeString()}] ${status} | Items: ${itemCount} | ${duration}s`);

  if (status === 'SUCCEEDED') {
    done = true;

    // ── Step 2: Fetch all results ──
    const datasetId = sData.data?.defaultDatasetId;
    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&limit=2000`);
    const items = await itemsRes.json();
    console.log(`\nTotal results: ${items.length}`);

    // ── Step 3: Get unscraped links from DB ──
    const { data: links } = await supabase
      .from('influencer_links')
      .select('id, influencer_id, url')
      .eq('scraped', false)
      .limit(1000);

    console.log(`Unscraped links in DB: ${links?.length ?? 0}`);

    // Build link map with URL normalization
    const linkMap = {};
    const normalizedMap = {};
    for (const link of (links || [])) {
      linkMap[link.url] = { link_id: link.id, influencer_id: link.influencer_id };
      try {
        const u = new URL(link.url);
        const norm = `https://${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
        normalizedMap[norm] = { link_id: link.id, influencer_id: link.influencer_id, original_url: link.url };
      } catch {}
    }

    // ── Step 4: Process results ──
    let emailsFound = 0;
    let linksProcessed = 0;
    const processedLinkIds = new Set();

    for (const item of items) {
      // Use sourceUrl (correct field from this actor)
      const scrapedUrl = item.sourceUrl || item.url || item.inputUrl || item.link;
      const emails = item.emails || item.email || [];
      const emailList = Array.isArray(emails)
        ? emails.filter(e => typeof e === 'string' && e.includes('@'))
        : (typeof emails === 'string' && emails.includes('@')) ? [emails] : [];

      if (!scrapedUrl) continue;

      // Match URL (exact first, then normalized)
      let matched = linkMap[scrapedUrl];
      if (!matched) {
        try {
          const u = new URL(scrapedUrl);
          const norm = `https://${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
          matched = normalizedMap[norm];
        } catch {}
      }

      if (!matched) continue;
      linksProcessed++;
      processedLinkIds.add(matched.link_id);

      // Update link as scraped
      await supabase.from('influencer_links').update({
        scraped: true,
        emails_found: emailList.length > 0 ? emailList : null,
        scraped_at: new Date().toISOString(),
      }).eq('id', matched.link_id);

      // Update influencer email if found and they don't have one
      if (emailList.length > 0) {
        // Filter out generic site emails
        const genericDomains = ['29cm.co.kr', 'liketoknow.it', 'amazon.com', 'tiktok.com', 'youtube.com', 'instagram.com'];
        const personalEmails = emailList.filter(e => !genericDomains.some(d => e.endsWith(`@${d}`)));

        if (personalEmails.length > 0) {
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
              email: personalEmails[0],
              email_source: emailSource,
            }).eq('id', matched.influencer_id);

            emailsFound++;
            console.log(`  Email: ${personalEmails[0]} ← ${scrapedUrl.substring(0, 50)}`);
          }
        }
      }
    }

    // Mark remaining unprocessed links as scraped (no email found)
    const unprocessedLinks = (links || []).filter(l => !processedLinkIds.has(l.id));
    for (const link of unprocessedLinks) {
      await supabase.from('influencer_links').update({
        scraped: true,
        scraped_at: new Date().toISOString(),
      }).eq('id', link.id);
    }

    // Update job
    await supabase.from('extraction_jobs').update({
      status: 'completed',
      total_extracted: linksProcessed,
      new_extracted: emailsFound,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);

    console.log('\n============================');
    console.log('LINK EMAIL EXTRACTION RESULTS');
    console.log('============================');
    console.log(`Total scraped items: ${items.length}`);
    console.log(`Links matched: ${linksProcessed}`);
    console.log(`New emails found: ${emailsFound}`);
    console.log(`Unprocessed links marked scraped: ${unprocessedLinks.length}`);

  } else if (status === 'FAILED' || status === 'ABORTED') {
    done = true;
    console.log(`Email extraction ${status}`);
    await supabase.from('extraction_jobs').update({ status: 'failed' }).eq('id', jobId);
  } else {
    await new Promise(r => setTimeout(r, 30000)); // poll every 30s
  }
}

// ── Final stats ──
const { count: totalIG } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram');
const { count: withEmail } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').not('email', 'is', null);
const { count: enriched } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').not('bio', 'is', null);
const { count: verified } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').eq('is_verified', true);
const { count: business } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').eq('is_business', true);

console.log('\n============================');
console.log('OVERALL DATABASE STATS');
console.log('============================');
console.log(`Total Instagram influencers: ${totalIG}`);
console.log(`Enriched (has bio): ${enriched}`);
console.log(`With email: ${withEmail}`);
console.log(`Verified: ${verified}`);
console.log(`Business accounts: ${business}`);
