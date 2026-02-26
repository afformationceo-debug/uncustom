import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnuxbjdjkrmuibwptqzj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudXhiamRqa3JtdWlid3B0cXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2NTYwNywiZXhwIjoyMDg3MTQxNjA3fQ.42R0RE_lnhcEIzZE9fPRWfcPT4Qf4-VQuSA8aI-FsXU'
);

async function run() {
  // 1. import_source별 보강 현황 — paginated fetch
  let allRows = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await s.from('influencers')
      .select('import_source, follower_count, bio, email, engagement_rate, country, platform, crm_user_id, real_name, gender, birth_date, phone, line_id')
      .range(from, from + PAGE - 1);
    if (error) { console.error('Error:', error.message); break; }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    from += PAGE;
    if (data.length < PAGE) break;
  }

  console.log(`Total influencers fetched: ${allRows.length}`);

  const bySource = {};
  const byPlatform = {};
  let crmRows = [];

  for (const r of allRows) {
    const src = r.import_source || 'null';
    if (!bySource[src]) bySource[src] = { total: 0, needs_enrich: 0, no_bio: 0, no_email: 0, no_engagement: 0, no_country: 0 };
    bySource[src].total++;
    if (!r.follower_count || r.follower_count === 0) bySource[src].needs_enrich++;
    if (!r.bio) bySource[src].no_bio++;
    if (!r.email) bySource[src].no_email++;
    if (!r.engagement_rate) bySource[src].no_engagement++;
    if (!r.country) bySource[src].no_country++;

    const p = r.platform || 'null';
    if (!byPlatform[p]) byPlatform[p] = { total: 0, needs_enrich: 0, no_bio: 0, no_email: 0 };
    byPlatform[p].total++;
    if (!r.follower_count || r.follower_count === 0) byPlatform[p].needs_enrich++;
    if (!r.bio) byPlatform[p].no_bio++;
    if (!r.email) byPlatform[p].no_email++;

    if (r.crm_user_id || (r.import_source && r.import_source.includes('crm'))) {
      crmRows.push(r);
    }
  }

  console.log('\n=== BY IMPORT SOURCE ===');
  console.log('source | total | needs_enrich | no_bio | no_email | no_engage | no_country');
  const sorted = Object.entries(bySource).sort((a, b) => b[1].total - a[1].total);
  for (const [src, v] of sorted) {
    console.log(`${src} | ${v.total} | ${v.needs_enrich} | ${v.no_bio} | ${v.no_email} | ${v.no_engagement} | ${v.no_country}`);
  }

  console.log('\n=== BY PLATFORM ===');
  for (const [p, v] of Object.entries(byPlatform).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`${p} | ${v.total} | enrich:${v.needs_enrich} | no_bio:${v.no_bio} | no_email:${v.no_email}`);
  }

  // 2. CRM 인플루언서 필드 분석
  console.log(`\n=== CRM INFLUENCERS (${crmRows.length}) ===`);
  let crmStats = {
    has_real_name: 0, has_gender: 0, has_birth: 0, has_phone: 0,
    has_line: 0, has_crm_id: 0, has_followers: 0, has_email: 0, has_bio: 0
  };
  for (const r of crmRows) {
    if (r.real_name) crmStats.has_real_name++;
    if (r.gender) crmStats.has_gender++;
    if (r.birth_date) crmStats.has_birth++;
    if (r.phone) crmStats.has_phone++;
    if (r.line_id) crmStats.has_line++;
    if (r.crm_user_id) crmStats.has_crm_id++;
    if (r.follower_count && r.follower_count > 0) crmStats.has_followers++;
    if (r.email) crmStats.has_email++;
    if (r.bio) crmStats.has_bio++;
  }
  console.log(JSON.stringify(crmStats, null, 2));

  // 3. campaign_influencers 필드 채워짐
  let ciRows = [];
  from = 0;
  while (true) {
    const { data, error } = await s.from('campaign_influencers')
      .select('funnel_status, outreach_type, last_outreach_at, reply_channel, upload_url, actual_upload_date, payment_amount, influencer_payment_status, crm_registered, visit_completed, visit_scheduled_date, settlement_info, crm_procedure, interpreter_name')
      .range(from, from + PAGE - 1);
    if (error) { console.error('CI Error:', error.message); break; }
    if (!data || data.length === 0) break;
    ciRows.push(...data);
    from += PAGE;
    if (data.length < PAGE) break;
  }

  console.log(`\n=== CAMPAIGN_INFLUENCERS (${ciRows.length}) ===`);
  let ciStats = {
    has_funnel: 0, has_outreach_type: 0, has_outreach_date: 0,
    has_reply: 0, has_upload: 0, has_upload_date: 0, has_payment_amt: 0,
    has_payment_status: 0, has_crm: 0, has_visit: 0, has_visit_date: 0,
    has_settlement: 0, has_procedure: 0, has_interpreter: 0
  };
  for (const r of ciRows) {
    if (r.funnel_status) ciStats.has_funnel++;
    if (r.outreach_type) ciStats.has_outreach_type++;
    if (r.last_outreach_at) ciStats.has_outreach_date++;
    if (r.reply_channel) ciStats.has_reply++;
    if (r.upload_url) ciStats.has_upload++;
    if (r.actual_upload_date) ciStats.has_upload_date++;
    if (r.payment_amount && r.payment_amount > 0) ciStats.has_payment_amt++;
    if (r.influencer_payment_status && r.influencer_payment_status !== 'unpaid') ciStats.has_payment_status++;
    if (r.crm_registered) ciStats.has_crm++;
    if (r.visit_completed) ciStats.has_visit++;
    if (r.visit_scheduled_date) ciStats.has_visit_date++;
    if (r.settlement_info) ciStats.has_settlement++;
    if (r.crm_procedure) ciStats.has_procedure++;
    if (r.interpreter_name) ciStats.has_interpreter++;
  }
  console.log(JSON.stringify(ciStats, null, 2));

  // 4. Funnel status 분포
  const funnelDist = {};
  for (const r of ciRows) {
    const f = r.funnel_status || 'null';
    funnelDist[f] = (funnelDist[f] || 0) + 1;
  }
  console.log('\n=== FUNNEL DISTRIBUTION ===');
  for (const [f, c] of Object.entries(funnelDist).sort((a, b) => b[1] - a[1])) {
    console.log(`${f}: ${c}`);
  }
}

run().catch(console.error);
