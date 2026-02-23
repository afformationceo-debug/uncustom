import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
readFileSync('.env.local','utf-8').split('\n').forEach(l => { const m = l.match(/^([^=]+)=(.*)$/); if(m) env[m[1].trim()]=m[2].trim(); });
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Check enriched influencers
const {data} = await sb.from('influencers')
  .select('id,username,platform,follower_count,following_count,post_count,engagement_rate,bio,email,email_source,country,language,is_verified,is_business,category,import_source,profile_image_url')
  .eq('platform','instagram').not('bio','is',null).limit(5);

for (const d2 of (data || [])) {
  const hasPic = Boolean(d2.profile_image_url && d2.profile_image_url.startsWith('http'));
  let picDomain = null;
  try { picDomain = d2.profile_image_url ? new URL(d2.profile_image_url).hostname : null; } catch {}
  console.log(JSON.stringify({
    username: d2.username,
    follower_count: d2.follower_count,
    following_count: d2.following_count,
    post_count: d2.post_count,
    engagement_rate: d2.engagement_rate,
    bio: d2.bio?.slice(0,40),
    email: d2.email,
    email_source: d2.email_source,
    country: d2.country,
    language: d2.language,
    is_verified: d2.is_verified,
    is_business: d2.is_business,
    category: d2.category,
    import_source: d2.import_source,
    has_profile_pic: hasPic,
    profile_pic_domain: picDomain,
  }));
}

// Count stats
const q = (filter) => sb.from('influencers').select('id',{count:'exact',head:true}).eq('platform','instagram');
const {count:total} = await q();
const {count:enriched} = await sb.from('influencers').select('id',{count:'exact',head:true}).eq('platform','instagram').not('bio','is',null);
const {count:hasEmail} = await sb.from('influencers').select('id',{count:'exact',head:true}).eq('platform','instagram').not('email','is',null);
const {count:hasCountry} = await sb.from('influencers').select('id',{count:'exact',head:true}).eq('platform','instagram').not('country','is',null);
const {count:hasEngagement} = await sb.from('influencers').select('id',{count:'exact',head:true}).eq('platform','instagram').not('engagement_rate','is',null);
const {count:hasCategory} = await sb.from('influencers').select('id',{count:'exact',head:true}).eq('platform','instagram').not('category','is',null);
const {count:verified} = await sb.from('influencers').select('id',{count:'exact',head:true}).eq('platform','instagram').eq('is_verified',true);
const {count:business} = await sb.from('influencers').select('id',{count:'exact',head:true}).eq('platform','instagram').eq('is_business',true);
const {count:hasProfilePic} = await sb.from('influencers').select('id',{count:'exact',head:true}).eq('platform','instagram').not('profile_image_url','is',null).neq('profile_image_url','');

console.log('\n=== INSTAGRAM STATS ===');
console.log(`Total: ${total}`);
console.log(`Enriched (has bio): ${enriched} (${Math.round(enriched/total*100)}%)`);
console.log(`Has email: ${hasEmail}`);
console.log(`Has country: ${hasCountry}`);
console.log(`Has engagement_rate: ${hasEngagement}`);
console.log(`Has category: ${hasCategory}`);
console.log(`Verified: ${verified}`);
console.log(`Business: ${business}`);
console.log(`Has profile pic: ${hasProfilePic}`);

// Check raw_data for latestPosts
const {data: sample} = await sb.from('influencers')
  .select('username, raw_data')
  .eq('platform','instagram').not('bio','is',null).limit(1);
if (sample?.[0]) {
  const raw = sample[0].raw_data;
  console.log(`\n=== SAMPLE raw_data keys: ${sample[0].username} ===`);
  console.log('Keys:', Object.keys(raw));
  if (raw.latestPosts) console.log('latestPosts count:', raw.latestPosts.length);
  if (raw._collectedPosts) console.log('_collectedPosts count:', raw._collectedPosts.length);
  if (raw.latestPosts?.[0]) {
    console.log('latestPosts[0] keys:', Object.keys(raw.latestPosts[0]));
    const p = raw.latestPosts[0];
    console.log('  displayUrl:', p.displayUrl?.slice(0,60));
    console.log('  thumbnailSrc:', p.thumbnailSrc?.slice(0,60));
  }
}
