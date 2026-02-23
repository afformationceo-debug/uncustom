/**
 * Fix: is_verified was never set because code checked record.isVerified
 * but Profile Scraper returns record.verified
 * Also fix category "None,..." prefix issue
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
readFileSync('.env.local','utf-8').split('\n').forEach(l => { const m = l.match(/^([^=]+)=(.*)$/); if(m) env[m[1].trim()]=m[2].trim(); });
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Get all enriched IG influencers with raw_data
const { data, count } = await sb.from('influencers')
  .select('id, username, raw_data, is_verified, is_business, category, engagement_rate, follower_count', { count: 'exact' })
  .eq('platform', 'instagram')
  .not('bio', 'is', null)
  .limit(3000);

console.log(`Enriched influencers to fix: ${count}`);

let fixedVerified = 0;
let fixedBusiness = 0;
let fixedCategory = 0;
let fixedEngagement = 0;

for (const inf of (data || [])) {
  const raw = inf.raw_data;
  if (!raw) continue;

  const updates = {};

  // Fix is_verified from raw_data.verified
  if (raw.verified === true && inf.is_verified !== true) {
    updates.is_verified = true;
    fixedVerified++;
  } else if (raw.verified === false && inf.is_verified !== false) {
    updates.is_verified = false;
  }

  // Fix is_business
  if (raw.isBusinessAccount === true && inf.is_business !== true) {
    updates.is_business = true;
    fixedBusiness++;
  }

  // Fix category - remove "None," prefix
  if (raw.businessCategoryName) {
    let cat = String(raw.businessCategoryName);
    if (cat.startsWith('None,')) cat = cat.replace('None,', '').trim();
    if (cat && cat !== 'None' && inf.category !== cat) {
      updates.category = cat;
      fixedCategory++;
    }
  }

  // Fix engagement_rate from latestPosts if missing
  if (inf.engagement_rate === null && inf.follower_count > 0 && Array.isArray(raw.latestPosts) && raw.latestPosts.length > 0) {
    const posts = raw.latestPosts.slice(0, 12);
    let totalEng = 0;
    for (const p of posts) {
      totalEng += (Number(p.likesCount) || 0) + (Number(p.commentsCount) || 0);
    }
    const avg = totalEng / posts.length;
    const rate = Math.round((avg / inf.follower_count) * 10000) / 10000;
    if (rate > 0) {
      updates.engagement_rate = rate;
      fixedEngagement++;
    }
  }

  if (Object.keys(updates).length > 0) {
    await sb.from('influencers').update(updates).eq('id', inf.id);
  }
}

console.log(`\nFixed verified: ${fixedVerified}`);
console.log(`Fixed business: ${fixedBusiness}`);
console.log(`Fixed category: ${fixedCategory}`);
console.log(`Fixed engagement: ${fixedEngagement}`);

// Verify
const { count: v } = await sb.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').eq('is_verified', true);
const { count: b } = await sb.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').eq('is_business', true);
const { count: c } = await sb.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').not('category', 'is', null);
const { count: e } = await sb.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', 'instagram').not('engagement_rate', 'is', null);
console.log(`\nAfter fix - verified: ${v}, business: ${b}, category: ${c}, engagement: ${e}`);
