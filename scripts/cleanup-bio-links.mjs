/**
 * Cleanup influencer_links table:
 * - Remove URLs that are NOT bio-link services (Amazon, YouTube, TikTok, etc.)
 * - Only keep linktree, beacons, carrd, etc. + personal websites
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const SKIP_DOMAINS = [
  'youtube.com', 'youtu.be', 'tiktok.com', 'twitter.com', 'x.com',
  'instagram.com', 'facebook.com', 'amazon.com', 'amzn.to',
  'amazon.co.jp', 'amazon.co.uk', 'rakuten.co.jp', 'shopee',
  'lazada', 'qoo10', 'coupang.com', 'naver.com', 'google.com',
  'apple.com', 'spotify.com', 'music.apple.com', 'open.spotify.com',
  'pinterest.com', 'threads.net',
];

function shouldSkip(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SKIP_DOMAINS.some(d => host.includes(d));
  } catch {
    return false;
  }
}

// Get all unscraped links
const { data: links, count } = await supabase
  .from('influencer_links')
  .select('id, url, scraped', { count: 'exact' })
  .eq('scraped', false)
  .limit(5000);

console.log(`Total unscraped links: ${count}`);
console.log(`Fetched: ${links?.length ?? 0}`);

let toDelete = 0;
let toKeep = 0;
const deleteIds = [];

for (const link of (links || [])) {
  if (shouldSkip(link.url)) {
    deleteIds.push(link.id);
    toDelete++;
  } else {
    toKeep++;
  }
}

console.log(`\nLinks to DELETE (non-bio-link domains): ${toDelete}`);
console.log(`Links to KEEP (bio-links + personal sites): ${toKeep}`);

if (deleteIds.length > 0) {
  // Delete in batches of 100
  for (let i = 0; i < deleteIds.length; i += 100) {
    const batch = deleteIds.slice(i, i + 100);
    const { error } = await supabase
      .from('influencer_links')
      .delete()
      .in('id', batch);
    if (error) {
      console.error(`Batch ${i / 100 + 1} error:`, error.message);
    }
  }
  console.log(`\nDeleted ${deleteIds.length} non-bio-link URLs`);
}

// Final count
const { count: remaining } = await supabase
  .from('influencer_links')
  .select('id', { count: 'exact', head: true })
  .eq('scraped', false);

console.log(`Remaining unscraped links: ${remaining}`);
