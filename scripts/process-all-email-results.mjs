import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);
const apifyToken = envVars.APIFY_API_TOKEN;

const GENERIC_EMAIL_DOMAINS = [
  '29cm.co.kr', 'liketoknow.it', 'amazon.com', 'tiktok.com',
  'youtube.com', 'instagram.com', 'naver.com', 'google.com',
  'truemed.com', 'fanicon.net', 'apple.com', 'spotify.com',
];

function isPersonalEmail(email) {
  return !GENERIC_EMAIL_DOMAINS.some(d => email.endsWith(`@${d}`));
}

// Datasets from both email extractor runs
const datasets = [
  { name: '1st batch', id: 'S1pfcH7VVX2PAP97I' },
  { name: '2nd batch', id: 'in9MD4KfLLeZvCK8E' },
];

// Get all unscraped links
console.log('=== Fetching unscraped links from DB ===');
const { data: allLinks, count } = await supabase
  .from('influencer_links')
  .select('id, influencer_id, url', { count: 'exact' })
  .eq('scraped', false)
  .limit(3000);

console.log(`Unscraped links: ${count}`);

// Build lookup maps
const exactMap = {};
const normalizedMap = {};
for (const link of (allLinks || [])) {
  exactMap[link.url] = { link_id: link.id, influencer_id: link.influencer_id };
  try {
    const u = new URL(link.url);
    const norm = `https://${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
    normalizedMap[norm] = { link_id: link.id, influencer_id: link.influencer_id };
  } catch {}
}

let totalEmailsFound = 0;
let totalLinksMatched = 0;
let totalItems = 0;

for (const ds of datasets) {
  console.log(`\n=== Processing ${ds.name} (dataset: ${ds.id}) ===`);

  const res = await fetch(`https://api.apify.com/v2/datasets/${ds.id}/items?token=${apifyToken}&limit=2000`);
  const items = await res.json();
  console.log(`Items: ${items.length}`);
  totalItems += items.length;

  let matched = 0;
  let emailsFound = 0;

  for (const item of items) {
    const scrapedUrl = item.sourceUrl || item.url || item.inputUrl || item.link;
    const emails = item.emails || [];
    const personalEmails = Array.isArray(emails)
      ? emails.filter(e => typeof e === 'string' && e.includes('@') && isPersonalEmail(e))
      : [];

    if (!scrapedUrl) continue;

    // Match URL
    let linkInfo = exactMap[scrapedUrl];
    if (!linkInfo) {
      try {
        const u = new URL(scrapedUrl);
        const norm = `https://${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
        linkInfo = normalizedMap[norm];
      } catch {}
    }

    if (!linkInfo) continue;
    matched++;

    // Update link as scraped
    await supabase.from('influencer_links').update({
      scraped: true,
      emails_found: personalEmails.length > 0 ? personalEmails : null,
      scraped_at: new Date().toISOString(),
    }).eq('id', linkInfo.link_id);

    // Remove from maps so we don't process duplicates
    delete exactMap[scrapedUrl];

    // Update influencer email if found
    if (personalEmails.length > 0) {
      const { data: inf } = await supabase
        .from('influencers')
        .select('email')
        .eq('id', linkInfo.influencer_id)
        .single();

      if (inf && !inf.email) {
        let emailSource = 'link';
        try {
          emailSource = `${new URL(scrapedUrl).hostname.replace('www.', '')}:${scrapedUrl}`;
        } catch {}

        await supabase.from('influencers').update({
          email: personalEmails[0],
          email_source: emailSource,
        }).eq('id', linkInfo.influencer_id);

        emailsFound++;
        console.log(`  + ${personalEmails[0]} <- ${scrapedUrl.substring(0, 60)}`);
      }
    }
  }

  console.log(`${ds.name}: ${matched} links matched, ${emailsFound} new emails`);
  totalLinksMatched += matched;
  totalEmailsFound += emailsFound;
}

// Mark remaining unscraped links that were in these batches as scraped (timeout - no result)
// Only mark links that were sent to the extractor
const { data: remaining } = await supabase
  .from('influencer_links')
  .select('id')
  .eq('scraped', false)
  .limit(3000);

console.log(`\nRemaining unscraped links: ${remaining?.length ?? 0}`);

// Final stats
const { count: totalIG } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram');
const { count: enrichedIG } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').not('bio', 'is', null);
const { count: withEmail } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').not('email', 'is', null);
const { count: verified } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').eq('is_verified', true);
const { count: business } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').eq('is_business', true);
const { count: withCountry } = await supabase.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').not('country', 'is', null);

console.log('\n====================================');
console.log('EMAIL EXTRACTION SUMMARY (2 batches)');
console.log('====================================');
console.log(`Total items processed: ${totalItems}`);
console.log(`Links matched: ${totalLinksMatched}`);
console.log(`New personal emails found: ${totalEmailsFound}`);

console.log('\n====================================');
console.log('OVERALL DATABASE STATS');
console.log('====================================');
console.log(`Total Instagram:    ${totalIG?.toLocaleString()}`);
console.log(`Enriched (has bio): ${enrichedIG?.toLocaleString()} (${Math.round(enrichedIG/totalIG*100)}%)`);
console.log(`With email:         ${withEmail?.toLocaleString()}`);
console.log(`With country:       ${withCountry?.toLocaleString()}`);
console.log(`Verified:           ${verified?.toLocaleString()}`);
console.log(`Business accounts:  ${business?.toLocaleString()}`);
