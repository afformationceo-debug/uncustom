import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = readFileSync('.env.local', 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const SKIP_DOMAINS = [
  // SNS
  'instagram.com', 'youtube.com', 'youtu.be', 'tiktok.com',
  'twitter.com', 'x.com', 'facebook.com', 'fb.com',
  'threads.net', 'snapchat.com', 'pinterest.com',
  // Messenger
  'line.me', 'lin.ee', 'liff.line.me',
  'wa.me', 'whatsapp.com', 'api.whatsapp.com',
  't.me', 'telegram.org', 'm.me',
  'discord.gg', 'discord.com',
  'kakao.com', 'open.kakao.com', 'pf.kakao.com',
  'wechat.com', 'weixin.qq.com', 'signal.org',
  // Shopping / platforms
  'amazon.com', 'amzn.to', 'music.apple.com', 'spotify.com',
  'soundcloud.com', 'open.spotify.com', 'apple.com',
];

function isScrapableUrl(url) {
  if (!url || !url.startsWith('http')) return false;
  try {
    const host = new URL(url).hostname.replace('www.', '').toLowerCase();
    return !SKIP_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch { return false; }
}

async function main() {
  console.log('=== 실제 스크래핑 가능한 external_url 현황 ===\n');

  let grandTotal = 0;

  for (const platform of ['instagram', 'tiktok', 'youtube', 'twitter']) {
    const { data } = await supabase
      .from('influencers')
      .select('id, username, external_url')
      .eq('platform', platform)
      .is('email', null)
      .not('external_url', 'is', null)
      .neq('external_url', '')
      .limit(1000);

    const scrapable = (data || []).filter(inf => isScrapableUrl(inf.external_url));
    grandTotal += scrapable.length;

    const skipped = (data || []).length - scrapable.length;

    console.log(`[${platform.toUpperCase()}]`);
    console.log(`  external_url 보유 (이메일 없음): ${(data || []).length}`);
    console.log(`  SNS URL 제외: -${skipped}`);
    console.log(`  실제 스크래핑 대상: ${scrapable.length}명`);

    if (scrapable.length > 0) {
      const domainCounts = {};
      for (const inf of scrapable) {
        try {
          const host = new URL(inf.external_url).hostname.replace('www.', '');
          domainCounts[host] = (domainCounts[host] || 0) + 1;
        } catch {}
      }
      const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      console.log('  주요 도메인:');
      for (const [domain, count] of sorted) {
        console.log(`    ${domain}: ${count}개`);
      }
    }
    console.log('');
  }

  // 기존 influencer_links unscraped
  const { count: unscrapedLinks } = await supabase
    .from('influencer_links')
    .select('id', { count: 'exact', head: true })
    .eq('scraped', false);

  console.log('=================================');
  console.log(`external_url 스크래핑 대상: ${grandTotal}명`);
  console.log(`기존 influencer_links unscraped: ${unscrapedLinks}개`);
  console.log('');

  const totalUrls = grandTotal + (unscrapedLinks || 0);
  console.log('=== 예상 비용 ===');
  console.log(`총 URL: ~${totalUrls}개`);
  console.log(`vdrmota/contact-info-scraper 예상: $0.005 + ${totalUrls} × $0.002 = ~$${(0.005 + totalUrls * 0.002).toFixed(2)}`);
}

main().catch(e => console.error(e));
