/**
 * CRM 중복 인플루언서 병합
 * - CRM에서 들어온 row와 기존 enriched row가 같은 사람인 경우
 * - CRM 데이터(crm_user_id, line_id, gender, real_name 등)를 enriched row로 이전
 * - CRM row 삭제 (campaign_influencers 등 FK 먼저 이전)
 *
 * 또한 username 없는 CRM 인플루언서 현황 파악
 */
import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnuxbjdjkrmuibwptqzj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudXhiamRqa3JtdWlid3B0cXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2NTYwNywiZXhwIjoyMDg3MTQxNjA3fQ.42R0RE_lnhcEIzZE9fPRWfcPT4Qf4-VQuSA8aI-FsXU'
);

function extractCleanUsername(raw) {
  if (!raw) return null;
  let clean = raw
    .replace(/\s*(페이스북|유튜브|틱톡|쓰레드|트위터|facebook|youtube|tiktok|threads|twitter)\s*:?\s*/gi, ' ')
    .replace(/\s*https?:?\s*/gi, ' ')
    .replace(/\s*팔로워\s*[\d.만K]+\s*/gi, ' ')
    .replace(/\s*\([\d.만K]+\)\s*/gi, ' ')
    .trim();
  const parts = clean.split(/\s+/);
  const username = parts[0];
  if (!username || !/^[a-zA-Z0-9._]+$/.test(username)) return null;
  if (username.length < 2) return null;
  return username;
}

async function run() {
  console.log('=== CRM 중복 병합 & 현황 ===\n');

  // 1. Get all CRM IG without follower_count
  const { data: crmRows, error } = await s.from('influencers')
    .select('id, username, platform_id, display_name, crm_user_id, line_id, gender, real_name, birth_date, phone, default_settlement_info, import_source')
    .eq('platform', 'instagram')
    .is('follower_count', null)
    .limit(100);

  if (error) { console.error('Error:', error.message); return; }
  console.log(`CRM IG follower_count=null: ${crmRows.length}명\n`);

  // 2. Find those with clean usernames that match existing rows
  const dupes = [];
  const noUsername = [];

  for (const row of crmRows) {
    const clean = extractCleanUsername(row.username);
    if (clean) {
      // Check if a different row with this username exists and has followers
      const { data: existing } = await s.from('influencers')
        .select('id, username, follower_count, crm_user_id')
        .eq('platform', 'instagram')
        .eq('username', clean)
        .not('id', 'eq', row.id)
        .limit(1);

      if (existing && existing.length > 0 && existing[0].follower_count) {
        dupes.push({ crmRow: row, enrichedRow: existing[0], cleanUsername: clean });
      }
    } else {
      noUsername.push(row);
    }
  }

  console.log(`중복 (병합 대상): ${dupes.length}명`);
  console.log(`username 없음: ${noUsername.length}명`);

  // 3. Merge duplicates
  console.log('\n--- 중복 병합 ---');
  let mergedCount = 0;

  for (const { crmRow, enrichedRow, cleanUsername } of dupes) {
    console.log(`  병합: ${crmRow.username} (CRM) → ${enrichedRow.username} (기존)`);

    // Transfer CRM fields to enriched row
    const crmFields = {};
    if (crmRow.crm_user_id && !enrichedRow.crm_user_id) crmFields.crm_user_id = crmRow.crm_user_id;
    if (crmRow.line_id) crmFields.line_id = crmRow.line_id;
    if (crmRow.gender) crmFields.gender = crmRow.gender;
    if (crmRow.real_name) crmFields.real_name = crmRow.real_name;
    if (crmRow.birth_date) crmFields.birth_date = crmRow.birth_date;
    if (crmRow.phone) crmFields.phone = crmRow.phone;
    if (crmRow.default_settlement_info) crmFields.default_settlement_info = crmRow.default_settlement_info;

    if (Object.keys(crmFields).length > 0) {
      const { error: mergeErr } = await s.from('influencers')
        .update(crmFields)
        .eq('id', enrichedRow.id);
      if (mergeErr) {
        console.log(`    ❌ CRM 필드 이전 실패: ${mergeErr.message}`);
        continue;
      }
      console.log(`    ✅ CRM 필드 이전: ${Object.keys(crmFields).join(', ')}`);
    }

    // Transfer campaign_influencers FK
    const { data: ciRows } = await s.from('campaign_influencers')
      .select('id, campaign_id')
      .eq('influencer_id', crmRow.id);

    if (ciRows && ciRows.length > 0) {
      for (const ci of ciRows) {
        // Check if enriched row already has this campaign
        const { data: existing } = await s.from('campaign_influencers')
          .select('id')
          .eq('campaign_id', ci.campaign_id)
          .eq('influencer_id', enrichedRow.id)
          .limit(1);

        if (existing && existing.length > 0) {
          // Already exists, delete the CRM one
          await s.from('campaign_influencers').delete().eq('id', ci.id);
        } else {
          // Transfer
          await s.from('campaign_influencers').update({ influencer_id: enrichedRow.id }).eq('id', ci.id);
        }
      }
      console.log(`    ✅ campaign_influencers ${ciRows.length}건 이전`);
    }

    // Transfer influencer_links FK
    const { data: links } = await s.from('influencer_links')
      .select('id')
      .eq('influencer_id', crmRow.id);
    if (links && links.length > 0) {
      for (const link of links) {
        await s.from('influencer_links').update({ influencer_id: enrichedRow.id }).eq('id', link.id);
      }
      console.log(`    ✅ influencer_links ${links.length}건 이전`);
    }

    // Delete CRM row
    const { error: delErr } = await s.from('influencers').delete().eq('id', crmRow.id);
    if (delErr) {
      console.log(`    ❌ 삭제 실패: ${delErr.message}`);
    } else {
      mergedCount++;
      console.log(`    ✅ CRM row 삭제 완료`);
    }
  }

  console.log(`\n병합 완료: ${mergedCount}건`);

  // 4. Handle username-less CRM rows
  console.log(`\n--- username 없는 CRM 인플루언서 (${noUsername.length}명) ---`);
  console.log('이들은 CRM에서 가져왔으나 IG username이 없어 프로필 보강 불가.');
  console.log('CRM 데이터만 유지 (crm_user_id 등).\n');

  // Check their CRM data completeness
  let hasCrmId = 0, hasRealName = 0, hasPhone = 0;
  for (const row of noUsername) {
    if (row.crm_user_id) hasCrmId++;
    if (row.real_name) hasRealName++;
    if (row.phone) hasPhone++;
  }
  console.log(`  crm_user_id: ${hasCrmId}/${noUsername.length}`);
  console.log(`  real_name: ${hasRealName}/${noUsername.length}`);
  console.log(`  phone: ${hasPhone}/${noUsername.length}`);

  // Show sample
  console.log('\n  샘플:');
  noUsername.slice(0, 5).forEach(r => {
    console.log(`    id:${r.id.substring(0,8)} | name:${r.display_name || r.real_name || '-'} | crm:${r.crm_user_id || '-'} | user:${r.username || '-'}`);
  });

  // Final count
  const { count: finalNeed } = await s.from('influencers')
    .select('id', { count: 'exact', head: true })
    .eq('platform', 'instagram')
    .is('follower_count', null);
  console.log(`\n=== 최종 잔여: IG follower_count=null → ${finalNeed}명 ===`);
  console.log('(대부분 CRM 전용 레코드 — IG username 없어 보강 불가)');
}

run().catch(console.error);
