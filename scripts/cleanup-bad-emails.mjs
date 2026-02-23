import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Get all web-scraped emails from Linktree
  const { data } = await sb
    .from('influencers')
    .select('id, username, email, email_source')
    .like('email_source', 'linktr.ee:%');

  console.log('Linktree 소스 이메일:', (data || []).length, '개\n');

  let cleanCount = 0;
  for (const inf of (data || [])) {
    const email = inf.email || '';
    const emailLocal = email.split('@')[0].toLowerCase();
    const emailDomain = (email.split('@')[1] || '').toLowerCase();
    const username = (inf.username || '').toLowerCase().replace(/[_.-]/g, '');

    // Check if email seems related to the influencer
    const usernameShort = username.substring(0, 4);
    const emailShort = emailLocal.substring(0, 4);
    const isRelated =
      (usernameShort.length >= 4 && emailLocal.includes(usernameShort)) ||
      (emailShort.length >= 4 && username.includes(emailShort)) ||
      (usernameShort.length >= 4 && emailDomain.includes(usernameShort));

    if (isRelated) {
      console.log('  KEEP:   ' + inf.username + ' -> ' + inf.email);
    } else {
      console.log('  DELETE: ' + inf.username + ' -> ' + inf.email + ' (unrelated)');
      await sb.from('influencers').update({ email: null, email_source: null }).eq('id', inf.id);
      cleanCount++;
    }
  }

  // Also clean obviously bad emails from other sources
  const { data: allWebScraped } = await sb
    .from('influencers')
    .select('id, username, email, email_source')
    .like('email_source', '%:%')
    .not('email_source', 'eq', 'bio')
    .not('email_source', 'like', 'linktr.ee%');

  for (const inf of (allWebScraped || [])) {
    const email = inf.email || '';
    // Remove clearly invalid emails
    if (email.includes('/@') || email.split('@').length !== 2 ||
        email.includes('pixabay.com') || email.includes('gdprlocal.com') ||
        email.includes('privacy@') || email.includes('dpo.support@')) {
      console.log('  DELETE: ' + inf.username + ' -> ' + inf.email + ' (invalid)');
      await sb.from('influencers').update({ email: null, email_source: null }).eq('id', inf.id);
      cleanCount++;
    }
  }

  console.log('\n삭제된 잘못된 이메일: ' + cleanCount + '개');

  // Final stats
  for (const platform of ['instagram', 'tiktok', 'youtube', 'twitter']) {
    const { count } = await sb.from('influencers').select('id', { count: 'exact', head: true }).eq('platform', platform).not('email', 'is', null);
    console.log(`[${platform}] 이메일 보유: ${count}명`);
  }
}

main().catch(e => console.error(e));
