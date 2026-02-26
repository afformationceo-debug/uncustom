import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnuxbjdjkrmuibwptqzj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudXhiamRqa3JtdWlid3B0cXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2NTYwNywiZXhwIjoyMDg3MTQxNjA3fQ.42R0RE_lnhcEIzZE9fPRWfcPT4Qf4-VQuSA8aI-FsXU'
);

async function run() {
  // Instagram에서 보강 필요한 인플루언서 (follower_count NULL or 0)
  const { data: igNeeded, error } = await s.from('influencers')
    .select('id, username, platform, import_source, follower_count, bio, email, platform_id')
    .eq('platform', 'instagram')
    .or('follower_count.is.null,follower_count.eq.0')
    .order('import_source', { ascending: true });

  if (error) { console.error('Error:', error.message); return; }

  console.log(`\n=== INSTAGRAM 보강필요: ${igNeeded.length}명 ===`);

  // import_source별 분류
  const bySource = {};
  for (const r of igNeeded) {
    const src = r.import_source || 'null';
    if (!bySource[src]) bySource[src] = [];
    bySource[src].push(r);
  }

  for (const [src, rows] of Object.entries(bySource)) {
    console.log(`\n[${src}] ${rows.length}명:`);
    for (const r of rows.slice(0, 5)) {
      console.log(`  ${r.username} (platform_id: ${r.platform_id || '-'}) bio: ${r.bio ? 'Y' : 'N'} email: ${r.email ? 'Y' : 'N'}`);
    }
    if (rows.length > 5) console.log(`  ... 외 ${rows.length - 5}명`);
  }

  // username 목록 추출 (보강용)
  const usernames = igNeeded.map(r => r.username).filter(Boolean);
  console.log(`\n총 Instagram 보강 대상 usernames: ${usernames.length}개`);

  // 다른 플랫폼
  for (const platform of ['twitter', 'youtube', 'tiktok']) {
    const { data: others } = await s.from('influencers')
      .select('id, username, platform, import_source')
      .eq('platform', platform)
      .or('follower_count.is.null,follower_count.eq.0');

    if (others && others.length > 0) {
      console.log(`\n${platform}: 보강필요 ${others.length}명`);
      const bySrc = {};
      for (const r of others) {
        const src = r.import_source || 'null';
        bySrc[src] = (bySrc[src] || 0) + 1;
      }
      for (const [src, cnt] of Object.entries(bySrc)) {
        console.log(`  ${src}: ${cnt}명`);
      }
    }
  }

  // JSON으로 저장 (API에서 사용)
  const fs = await import('fs');
  fs.writeFileSync('enrich-targets.json', JSON.stringify({
    instagram: igNeeded.map(r => ({ id: r.id, username: r.username, import_source: r.import_source })),
    total: igNeeded.length
  }, null, 2));
  console.log('\nenrich-targets.json 저장 완료');
}

run().catch(console.error);
