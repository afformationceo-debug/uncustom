import { createClient } from '@supabase/supabase-js';
const s = createClient(
  'https://cnuxbjdjkrmuibwptqzj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudXhiamRqa3JtdWlid3B0cXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2NTYwNywiZXhwIjoyMDg3MTQxNjA3fQ.42R0RE_lnhcEIzZE9fPRWfcPT4Qf4-VQuSA8aI-FsXU'
);

async function run() {
  const { data, error } = await s.from('influencers')
    .select('id, username, platform_id, bio, import_source')
    .eq('platform', 'instagram')
    .is('follower_count', null)
    .limit(60);

  if (error) { console.error('Error:', error.message); return; }

  console.log(`=== IG 보강 필요 (${data.length}명) ===`);

  const withUsername = data.filter(d => d.username && d.username.trim());
  const noUsername = data.filter(d => !d.username || !d.username.trim());

  console.log('username 있음:', withUsername.length);
  console.log('username 없음:', noUsername.length);

  const sources = {};
  data.forEach(d => { sources[d.import_source || 'null'] = (sources[d.import_source || 'null'] || 0) + 1; });
  console.log('import_source:', JSON.stringify(sources));

  console.log('\n샘플:');
  withUsername.slice(0, 10).forEach(d => {
    console.log(`  ${d.username} | pid:${d.platform_id || '-'} | src:${d.import_source || '-'}`);
  });

  if (noUsername.length > 0) {
    console.log('\nusername 없는 인플루언서:');
    noUsername.slice(0, 5).forEach(d => {
      console.log(`  id:${d.id} | pid:${d.platform_id || '-'} | src:${d.import_source || '-'}`);
    });
  }

  const usernames = withUsername.map(d => d.username);
  console.log(`\n=== 보강할 username (${usernames.length}명) ===`);
  console.log(JSON.stringify(usernames));
}
run().catch(console.error);
