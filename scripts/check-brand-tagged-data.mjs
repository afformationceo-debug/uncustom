import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnuxbjdjkrmuibwptqzj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudXhiamRqa3JtdWlid3B0cXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2NTYwNywiZXhwIjoyMDg3MTQxNjA3fQ.42R0RE_lnhcEIzZE9fPRWfcPT4Qf4-VQuSA8aI-FsXU'
);

async function run() {
  // 1. Check brand_tagged influencers specifically
  console.log('=== brand_tagged 인플루언서 데이터 확인 ===\n');
  
  const { data: btInfluencers, error } = await s.from('influencers')
    .select('id, username, platform, import_source, follower_count, avg_likes, avg_comments, avg_views, language, location, influence_score, extracted_keywords, extracted_from_tags, raw_data')
    .eq('import_source', 'brand_tagged')
    .limit(5);
  
  if (error) { console.error('Error:', error.message); return; }
  
  console.log(`brand_tagged 샘플 ${btInfluencers.length}건:\n`);
  for (const r of btInfluencers) {
    console.log(`--- ${r.username} (${r.platform}) ---`);
    console.log(`  follower_count: ${r.follower_count}`);
    console.log(`  avg_likes: ${r.avg_likes}`);
    console.log(`  avg_comments: ${r.avg_comments}`);
    console.log(`  avg_views: ${r.avg_views}`);
    console.log(`  language: ${r.language}`);
    console.log(`  location: ${r.location}`);
    console.log(`  influence_score: ${r.influence_score}`);
    console.log(`  extracted_keywords: ${JSON.stringify(r.extracted_keywords)}`);
    console.log(`  extracted_from_tags: ${JSON.stringify(r.extracted_from_tags)}`);
    
    // Check raw_data for nested values
    const rd = r.raw_data;
    if (rd) {
      console.log(`  raw_data keys: ${Object.keys(rd).slice(0, 20).join(', ')}`);
      console.log(`  raw_data.likesCount: ${rd.likesCount}`);
      console.log(`  raw_data.commentsCount: ${rd.commentsCount}`);
      console.log(`  raw_data.videoPlayCount: ${rd.videoPlayCount}`);
      console.log(`  raw_data.hashtags: ${JSON.stringify(rd.hashtags)}`);
      console.log(`  raw_data.caption: ${rd.caption?.substring(0, 80)}`);
      console.log(`  raw_data.musicInfo: ${rd.musicInfo ? 'YES' : 'NO'}`);
      console.log(`  raw_data.isAd: ${rd.isAd}`);
      console.log(`  raw_data.locationName: ${rd.locationName}`);
    } else {
      console.log(`  raw_data: NULL`);
    }
    console.log('');
  }

  // 2. Check enriched influencers for comparison (ones that DO have values)
  console.log('\n=== 보강 완료된 인플루언서 샘플 (값이 있는) ===\n');
  const { data: enriched } = await s.from('influencers')
    .select('id, username, platform, import_source, follower_count, avg_likes, avg_comments, avg_views, language, location, influence_score, raw_data')
    .eq('platform', 'instagram')
    .not('follower_count', 'is', null)
    .gt('follower_count', 1000)
    .not('avg_likes', 'is', null)
    .limit(3);
  
  for (const r of (enriched || [])) {
    console.log(`--- ${r.username} (${r.platform}, src=${r.import_source}) ---`);
    console.log(`  follower_count: ${r.follower_count}, avg_likes: ${r.avg_likes}, avg_comments: ${r.avg_comments}, avg_views: ${r.avg_views}`);
    console.log(`  language: ${r.language}, location: ${r.location}, influence_score: ${r.influence_score}`);
    const rd = r.raw_data;
    if (rd) {
      console.log(`  raw_data.latestPosts length: ${rd.latestPosts?.length || 0}`);
    }
    console.log('');
  }

  // 3. Check overall stats for these columns
  console.log('\n=== 전체 컬럼 채워짐 현황 ===\n');
  const { data: all } = await s.from('influencers')
    .select('avg_likes, avg_comments, avg_views, language, location, influence_score')
    .not('avg_likes', 'is', null);
  console.log(`avg_likes NOT NULL: ${all?.length || 0}`);

  const { data: langFilled } = await s.from('influencers')
    .select('id')
    .not('language', 'is', null)
    .limit(1);
  
  const { count: langCount } = await s.from('influencers')
    .select('id', { count: 'exact', head: true })
    .not('language', 'is', null);
  console.log(`language NOT NULL: ${langCount}`);

  const { count: locCount } = await s.from('influencers')
    .select('id', { count: 'exact', head: true })
    .not('location', 'is', null);
  console.log(`location NOT NULL: ${locCount}`);

  const { count: infCount } = await s.from('influencers')
    .select('id', { count: 'exact', head: true })
    .not('influence_score', 'is', null);
  console.log(`influence_score NOT NULL: ${infCount}`);

  const { count: avgLikesCount } = await s.from('influencers')
    .select('id', { count: 'exact', head: true })
    .not('avg_likes', 'is', null);
  console.log(`avg_likes NOT NULL: ${avgLikesCount}`);

  const { count: avgCommCount } = await s.from('influencers')
    .select('id', { count: 'exact', head: true })
    .not('avg_comments', 'is', null);
  console.log(`avg_comments NOT NULL: ${avgCommCount}`);

  const { count: avgViewsCount } = await s.from('influencers')
    .select('id', { count: 'exact', head: true })
    .not('avg_views', 'is', null);
  console.log(`avg_views NOT NULL: ${avgViewsCount}`);
}

run().catch(console.error);
