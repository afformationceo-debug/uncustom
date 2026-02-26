import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnuxbjdjkrmuibwptqzj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudXhiamRqa3JtdWlid3B0cXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2NTYwNywiZXhwIjoyMDg3MTQxNjA3fQ.42R0RE_lnhcEIzZE9fPRWfcPT4Qf4-VQuSA8aI-FsXU'
);

async function fetchAll(query) {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function run() {
  console.log('=== 인플루언서 중복 검사 ===\n');

  const allInfluencers = await fetchAll(
    s.from('influencers')
      .select('id, username, platform, platform_id, import_source, follower_count, display_name, email')
      .order('username')
  );

  console.log(`Total influencers: ${allInfluencers.length}`);

  // 1. Group by username+platform (same platform same username = duplicate)
  console.log('\n=== 1. 같은 username+platform 중복 (핵심) ===');
  const byUsernamePlatform = {};
  for (const r of allInfluencers) {
    const u = (r.username || '').toLowerCase().trim();
    if (!u || u === 'null') continue;
    const key = `${u}::${r.platform}`;
    if (!byUsernamePlatform[key]) byUsernamePlatform[key] = [];
    byUsernamePlatform[key].push(r);
  }

  const dupes = Object.entries(byUsernamePlatform).filter(([k, v]) => v.length > 1);
  console.log(`Duplicate username+platform pairs: ${dupes.length}`);

  const totalExtraRows = dupes.reduce((sum, [k, v]) => sum + (v.length - 1), 0);
  console.log(`Total extra rows to remove: ${totalExtraRows}`);

  // Show details
  for (const [key, rows] of dupes.slice(0, 30)) {
    console.log(`\n  [${key}] ${rows.length}건:`);
    for (const r of rows) {
      console.log(`    id=${r.id} pid=${r.platform_id || '-'} src=${r.import_source} followers=${r.follower_count || 0} email=${r.email || '-'} name=${r.display_name || '-'}`);
    }
  }
  if (dupes.length > 30) console.log(`  ... 외 ${dupes.length - 30}건 더`);

  // 2. Duplicate by platform_id+platform
  console.log('\n\n=== 2. 같은 platform_id+platform 중복 ===');
  const byPlatformId = {};
  for (const r of allInfluencers) {
    if (!r.platform_id) continue;
    const key = `${r.platform_id}::${r.platform}`;
    if (!byPlatformId[key]) byPlatformId[key] = [];
    byPlatformId[key].push(r);
  }

  const pidDupes = Object.entries(byPlatformId).filter(([k, v]) => v.length > 1);
  console.log(`Duplicate platform_id+platform pairs: ${pidDupes.length}`);
  for (const [key, rows] of pidDupes.slice(0, 10)) {
    console.log(`  [${key}]: ${rows.map(r => `id=${r.id} user=${r.username} src=${r.import_source}`).join(' | ')}`);
  }

  // 3. Duplicate cause analysis
  console.log('\n\n=== 3. 중복 원인 분석 (import_source 조합) ===');
  const dupeSourceCombos = {};
  for (const [key, rows] of dupes) {
    const sources = rows.map(r => r.import_source || 'null').sort().join(' + ');
    dupeSourceCombos[sources] = (dupeSourceCombos[sources] || 0) + 1;
  }
  for (const [combo, cnt] of Object.entries(dupeSourceCombos).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${combo}: ${cnt}건`);
  }

  // 4. NULL checks
  console.log('\n\n=== 4. NULL/빈 값 현황 ===');
  const nullUsername = allInfluencers.filter(r => !r.username || r.username === 'null' || r.username.trim() === '');
  const nullPlatformId = allInfluencers.filter(r => !r.platform_id);
  console.log(`NULL/empty username: ${nullUsername.length}`);
  console.log(`NULL platform_id: ${nullPlatformId.length}`);

  // 5. Dedup strategy recommendation
  console.log('\n\n=== 5. 중복 제거 전략 ===');
  if (dupes.length > 0) {
    console.log('중복 제거 기준:');
    console.log('  1. follower_count가 있는 레코드 우선 유지');
    console.log('  2. email이 있는 레코드 우선 유지');
    console.log('  3. platform_id가 있는 레코드 우선 유지');
    console.log('  4. 그 외 최신(id가 큰) 레코드 유지');

    // Simulate dedup
    let canRemove = 0;
    const toDelete = [];
    for (const [key, rows] of dupes) {
      // Sort: best record first
      const sorted = [...rows].sort((a, b) => {
        // Prefer: has follower_count > has email > has platform_id > higher id
        const score = (r) => {
          let s = 0;
          if (r.follower_count && r.follower_count > 0) s += 1000;
          if (r.email) s += 100;
          if (r.platform_id) s += 10;
          s += parseInt(r.id?.substring(0, 8) || '0', 16) / 1e10; // use id as tiebreaker
          return s;
        };
        return score(b) - score(a);
      });

      // Keep first, delete rest
      const keep = sorted[0];
      const remove = sorted.slice(1);
      canRemove += remove.length;
      toDelete.push(...remove.map(r => r.id));
    }
    console.log(`\n유지: ${dupes.length}건 (최우선 레코드)`);
    console.log(`삭제 대상: ${canRemove}건`);

    // Save delete list
    const fs = await import('fs');
    fs.writeFileSync('/Users/hyunkeunji/Desktop/uncustom/dupe-delete-ids.json', JSON.stringify(toDelete, null, 2));
    console.log(`\ndupe-delete-ids.json에 삭제 대상 ID 저장 완료 (${toDelete.length}건)`);
  }
}

run().catch(console.error);
