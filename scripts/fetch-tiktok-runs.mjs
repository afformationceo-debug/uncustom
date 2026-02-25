/**
 * TikTok 과거 Apify Run 전체 수집 → 인플루언서 마스터 CSV 생성
 *
 * 파이프라인:
 * 1. clockworks/tiktok-scraper 전체 run 목록 조회 (SUCCEEDED만)
 * 2. 각 run의 input 키워드 + dataset items 수집 → 실시간 인플루언서 맵 누적
 * 3. 국가 매핑 (키워드 언어 + textLanguage 최빈값)
 * 4. 인플루언서 중복 제거 (authorMeta.name 기준)
 * 5. 이메일/외부링크 추출
 * 6. 최종 CSV + 통계 JSON 생성
 *
 * 사용법: node scripts/fetch-tiktok-runs.mjs
 *
 * NOTE: 아이템을 파일에 저장하지 않고 실시간으로 인플루언서 맵에 누적합니다.
 * 진행 상태(처리된 run ID 목록)만 파일에 저장하여 재시작 가능.
 */

import { config } from "dotenv";
import { ApifyClient } from "apify-client";
import { writeFileSync, readFileSync, existsSync } from "fs";

config({ path: ".env.local" });

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
const ACTOR_ID = "clockworks/tiktok-scraper";
const PROGRESS_FILE = "tiktok-progress.json";
const BATCH_SIZE = 5;

// ─── 국가 매핑 ───────────────────────────────────────────

function detectKeywordCountry(keyword) {
  if (!keyword) return "US";
  if (/[ㄱ-ㅎ가-힣]/.test(keyword)) return "KR";
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(keyword)) return "JP";
  if (/[\u0E00-\u0E7F]/.test(keyword)) return "TH";
  if (/[ơưăđĐ]/.test(keyword)) return "VN";
  if (/[ắằẳẵặấầẩẫậếềểễệốồổỗộứừửữự]/.test(keyword)) return "VN";
  if (/[\u0600-\u06FF]/.test(keyword)) return "SA";
  if (/[\u4E00-\u9FFF]/.test(keyword) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(keyword)) return "CN";
  return "US";
}

const TEXT_LANG_TO_COUNTRY = {
  ko: "KR", ja: "JP", zh: "CN", "zh-Hans": "CN", "zh-Hant": "TW",
  th: "TH", vi: "VN", ar: "SA", es: "ES", pt: "BR", "pt-BR": "BR",
  id: "ID", ms: "MY", en: "US", fr: "FR", de: "DE", it: "IT",
  ru: "RU", tr: "TR", pl: "PL", nl: "NL", sv: "SE", hi: "IN",
  bn: "BD", tl: "PH", uk: "UA", ro: "RO", cs: "CZ", el: "GR",
  he: "IL", fa: "IR", ur: "PK", my: "MM",
};

function langToCountry(lang) {
  if (!lang) return null;
  return TEXT_LANG_TO_COUNTRY[lang] || TEXT_LANG_TO_COUNTRY[lang.split("-")[0]] || null;
}

function getMode(arr) {
  if (!arr || arr.length === 0) return null;
  const freq = {};
  for (const v of arr) if (v) freq[v] = (freq[v] || 0) + 1;
  let maxCount = 0, mode = null;
  for (const [val, count] of Object.entries(freq)) {
    if (count > maxCount) { maxCount = count; mode = val; }
  }
  return mode;
}

// ─── 이메일 & 링크 추출 ─────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9][\w.-]*[a-zA-Z0-9]@[a-zA-Z0-9][\w.-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}/g;

const SKIP_DOMAINS = [
  "youtube.com", "youtu.be", "tiktok.com", "twitter.com", "x.com",
  "instagram.com", "facebook.com", "threads.net", "snapchat.com", "pinterest.com",
  "line.me", "lin.ee", "liff.line.me",
  "wa.me", "whatsapp.com", "api.whatsapp.com",
  "t.me", "telegram.org", "m.me",
  "discord.gg", "discord.com",
  "kakao.com", "open.kakao.com", "pf.kakao.com",
  "wechat.com", "weixin.qq.com", "signal.org",
  "amazon.com", "amzn.to", "amazon.co.jp", "amazon.co.uk",
  "rakuten.co.jp", "shopee", "lazada", "qoo10", "coupang.com",
  "naver.com", "google.com", "apple.com",
  "spotify.com", "music.apple.com", "open.spotify.com", "soundcloud.com",
];

function extractEmail(bio) {
  if (!bio) return null;
  return bio.match(EMAIL_REGEX)?.[0] ?? null;
}

function extractBioLinks(bio, bioLink) {
  const links = [];
  if (bioLink) {
    const url = typeof bioLink === "object" && bioLink !== null ? bioLink.link : typeof bioLink === "string" ? bioLink : null;
    if (url && url.trim()) links.push(url.trim());
  }
  if (bio) {
    const bioUrls = bio.match(/https?:\/\/[^\s,)}\]]+/g);
    if (bioUrls) for (const url of bioUrls) if (!links.includes(url)) links.push(url);
  }
  return links.filter((url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return !SKIP_DOMAINS.some((d) => host.includes(d));
    } catch { return false; }
  });
}

// ─── CSV 유틸 ────────────────────────────────────────────

const BOM = "\uFEFF";
function escapeCsv(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r"))
    return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function avg(arr) {
  const nums = arr.filter((v) => v !== null && v !== undefined);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ─── KV Store에서 키워드 가져오기 ────────────────────────

async function getKeywordFromKvStore(kvStoreId) {
  if (!kvStoreId) return "";
  try {
    const record = await client.keyValueStore(kvStoreId).getRecord("INPUT");
    const input = record?.value || {};
    return (
      (Array.isArray(input.searchQueries) ? input.searchQueries[0] : null) ||
      (Array.isArray(input.hashtags) ? input.hashtags[0] : null) ||
      input.searchQuery || input.hashtag || input.keyword || ""
    );
  } catch { return ""; }
}

// ─── 인플루언서 맵에 아이템 누적 ─────────────────────────

// influencerMap: Map<username, { authorMeta, contents[], keywords[], latestDate }>
const influencerMap = new Map();
let totalItems = 0;
let skippedNoAuthor = 0;

function accumulateItems(items, keyword, keywordCountry) {
  for (const item of items) {
    totalItems++;
    const authorMeta = item.authorMeta;
    const username = authorMeta?.name || item.author || "";
    if (!username) { skippedNoAuthor++; continue; }

    const contentData = {
      textLanguage: item.textLanguage || null,
      diggCount: toNum(item.diggCount ?? item.likes),
      commentCount: toNum(item.commentCount ?? item.comments),
      shareCount: toNum(item.shareCount ?? item.shares),
      playCount: toNum(item.playCount ?? item.plays),
      collectCount: toNum(item.collectCount),
      keywordCountry,
    };

    const existing = influencerMap.get(username);
    if (existing) {
      existing.contents.push(contentData);
      if (keyword && !existing.keywords.includes(keyword)) existing.keywords.push(keyword);
      const newDate = item.createTimeISO || "";
      if (newDate > (existing.latestDate || "")) {
        existing.authorMeta = authorMeta || existing.authorMeta;
        existing.latestDate = newDate;
        existing.rawItem = item;
      }
    } else {
      influencerMap.set(username, {
        username,
        authorMeta: authorMeta || {},
        rawItem: item,
        contents: [contentData],
        keywords: keyword ? [keyword] : [],
        latestDate: item.createTimeISO || "",
      });
    }
  }
}

// ─── 진행 상태 관리 ──────────────────────────────────────

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { processedRunIds: new Set(), runMeta: [] };
  try {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    return {
      processedRunIds: new Set(data.processedRunIds || []),
      runMeta: data.runMeta || [],
    };
  } catch {
    return { processedRunIds: new Set(), runMeta: [] };
  }
}

function saveProgress(processedRunIds, runMeta) {
  writeFileSync(PROGRESS_FILE, JSON.stringify({
    processedRunIds: [...processedRunIds],
    runMeta, // [{runId, keyword, keywordCountry, itemCount}]
    savedAt: new Date().toISOString(),
  }), "utf-8");
}

// ─── 메인 파이프라인 ─────────────────────────────────────

async function main() {
  console.log("═".repeat(60));
  console.log("  TikTok 과거 Apify Run 전체 수집 → 마스터 CSV 생성");
  console.log("═".repeat(60));
  const startTime = Date.now();

  // 진행 상태 로드
  let { processedRunIds, runMeta } = loadProgress();
  if (processedRunIds.size > 0) {
    console.log(`📂 진행 상태 파일 발견 — ${processedRunIds.size}개 run 이미 처리됨`);
  }

  // 전체 run 목록 조회
  console.log(`\n🔍 ${ACTOR_ID} 전체 run 목록 조회 중...`);
  let allRuns = [];
  let offset = 0;
  while (true) {
    const result = await client.actor(ACTOR_ID).runs().list({ limit: 1000, offset });
    allRuns = allRuns.concat(result.items || []);
    console.log(`  가져옴: ${allRuns.length}개 (offset: ${offset})`);
    if ((result.items || []).length < 1000) break;
    offset += 1000;
  }

  const succeededRuns = allRuns.filter((r) => r.status === "SUCCEEDED");
  console.log(`\n📊 전체 run: ${allRuns.length}개 / SUCCEEDED: ${succeededRuns.length}개`);

  const pendingRuns = succeededRuns.filter((r) => !processedRunIds.has(r.id));
  console.log(`  이미 처리: ${processedRunIds.size}개 / 남은 처리: ${pendingRuns.length}개\n`);

  // ─── Phase 1: 이미 처리된 run의 데이터 재수집 (재시작 시) ───
  if (processedRunIds.size > 0 && pendingRuns.length > 0) {
    console.log("🔄 이미 처리된 run들의 데이터를 재수집합니다...");
    const processedList = succeededRuns.filter((r) => processedRunIds.has(r.id));
    // runMeta에서 keyword 매핑
    const metaMap = new Map(runMeta.map((m) => [m.runId, m]));

    for (let i = 0; i < processedList.length; i += BATCH_SIZE) {
      const batch = processedList.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (run) => {
          const meta = metaMap.get(run.id);
          const keyword = meta?.keyword || "";
          const keywordCountry = meta?.keywordCountry || detectKeywordCountry(keyword);
          if (!run.defaultDatasetId) return;
          try {
            const result = await client.dataset(run.defaultDatasetId).listItems();
            accumulateItems(result.items || [], keyword, keywordCountry);
          } catch {}
        })
      );
      if ((i + BATCH_SIZE) % 50 < BATCH_SIZE) {
        console.log(`  재수집: ${Math.min(i + BATCH_SIZE, processedList.length)}/${processedList.length} — 인플루언서: ${influencerMap.size.toLocaleString()}`);
      }
      if (i + BATCH_SIZE < processedList.length) await new Promise((r) => setTimeout(r, 300));
    }
    console.log(`  ✅ 재수집 완료: ${influencerMap.size.toLocaleString()}명 인플루언서\n`);
  }

  // ─── Phase 2: 새 run 처리 ───
  if (pendingRuns.length > 0) {
    const totalTarget = processedRunIds.size + pendingRuns.length;

    for (let i = 0; i < pendingRuns.length; i += BATCH_SIZE) {
      const batch = pendingRuns.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (run) => {
          const runId = run.id;
          const datasetId = run.defaultDatasetId;
          const kvStoreId = run.defaultKeyValueStoreId;
          const keyword = await getKeywordFromKvStore(kvStoreId);
          const keywordCountry = detectKeywordCountry(keyword);

          let itemCount = 0;
          if (datasetId) {
            try {
              const result = await client.dataset(datasetId).listItems();
              const items = result.items || [];
              itemCount = items.length;
              accumulateItems(items, keyword, keywordCountry);
            } catch {}
          }

          return { runId, keyword, keywordCountry, itemCount };
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          const r = result.value;
          processedRunIds.add(r.runId);
          runMeta.push(r);
          const idx = processedRunIds.size;
          console.log(
            `  [${idx}/${totalTarget}] Run ${r.runId.slice(0, 8)}... — keyword: "${r.keyword}" (${r.keywordCountry}) — ${r.itemCount} items — total: ${influencerMap.size.toLocaleString()}명`
          );
        } else {
          console.error(`  ❌ 실패:`, result.reason?.message?.slice(0, 100));
        }
      }

      // 진행 상태 저장 (매 50개)
      if (processedRunIds.size % 50 < BATCH_SIZE || i + BATCH_SIZE >= pendingRuns.length) {
        saveProgress(processedRunIds, runMeta);
        console.log(`  💾 진행 저장: ${processedRunIds.size}개 run\n`);
      }

      if (i + BATCH_SIZE < pendingRuns.length) await new Promise((r) => setTimeout(r, 500));
    }

    saveProgress(processedRunIds, runMeta);
  }

  // ─── Phase 3: 최종 인플루언서 데이터 생성 ───
  console.log("\n🔄 최종 인플루언서 데이터 생성 중...");
  console.log(`  총 raw items: ${totalItems.toLocaleString()}`);
  console.log(`  author 없어 스킵: ${skippedNoAuthor.toLocaleString()}`);
  console.log(`  고유 인플루언서: ${influencerMap.size.toLocaleString()}`);

  const influencers = [];
  let emailCount = 0, linkCount = 0;
  const countryDist = {}, keywordDist = {};

  for (const [username, inf] of influencerMap) {
    const am = inf.authorMeta;
    const bio = am.signature || "";
    const bioLink = am.bioLink;

    const email = extractEmail(bio);
    if (email) emailCount++;

    const bioLinks = extractBioLinks(bio, bioLink);
    if (bioLinks.length > 0) linkCount++;

    const contents = inf.contents;
    const avgLikes = avg(contents.map((c) => c.diggCount));
    const avgComments = avg(contents.map((c) => c.commentCount));
    const avgShares = avg(contents.map((c) => c.shareCount));
    const avgViews = avg(contents.map((c) => c.playCount));

    let engagementRate = null;
    if (avgViews && avgViews > 0) {
      engagementRate = ((avgLikes || 0) + (avgComments || 0) + (avgShares || 0)) / avgViews;
    }

    const langCountries = contents.map((c) => langToCountry(c.textLanguage)).filter(Boolean);
    const keywordCountries = contents.map((c) => c.keywordCountry).filter(Boolean);
    const country = getMode(langCountries) || getMode(keywordCountries) || "US";

    countryDist[country] = (countryDist[country] || 0) + 1;
    for (const kw of inf.keywords) keywordDist[kw] = (keywordDist[kw] || 0) + 1;

    const textLanguages = contents.map((c) => c.textLanguage).filter(Boolean);
    const regionCode = inf.rawItem?.regionCode || inf.rawItem?.region || null;
    const externalUrl = typeof bioLink === "object" && bioLink !== null
      ? (bioLink.link || null) : typeof bioLink === "string" ? bioLink : null;

    influencers.push({
      platform: "tiktok",
      username,
      display_name: am.nickName || "",
      profile_url: `https://www.tiktok.com/@${username}`,
      profile_image_url: am.avatar || "",
      email: email || "",
      email_source: email ? "bio" : "",
      bio,
      follower_count: toNum(am.fans) ?? "",
      following_count: toNum(am.following) ?? "",
      post_count: toNum(am.video) ?? "",
      engagement_rate: engagementRate !== null ? engagementRate.toFixed(6) : "",
      country,
      language: getMode(textLanguages) || "",
      is_verified: am.verified === true ? "TRUE" : "FALSE",
      external_url: externalUrl || "",
      location: regionCode ? regionCode.toUpperCase() : "",
      heart_count: toNum(am.heart) ?? "",
      share_count: "",
      avg_likes: avgLikes !== null ? Math.round(avgLikes) : "",
      avg_comments: avgComments !== null ? Math.round(avgComments) : "",
      avg_shares: avgShares !== null ? Math.round(avgShares) : "",
      avg_views: avgViews !== null ? Math.round(avgViews) : "",
      is_private: am.privateAccount === true ? "TRUE" : "FALSE",
      bookmark_count: avg(contents.map((c) => c.collectCount)) !== null ? Math.round(avg(contents.map((c) => c.collectCount))) : "",
      favourites_count: toNum(am.digg) ?? "",
      extracted_keywords: inf.keywords.join("; "),
      content_count: contents.length,
      bio_links: bioLinks.join("; "),
    });
  }

  // 팔로워 내림차순 정렬
  influencers.sort((a, b) => (toNum(b.follower_count) || 0) - (toNum(a.follower_count) || 0));

  // ─── Phase 4: CSV + 통계 출력 ───
  const columns = [
    "platform", "username", "display_name", "profile_url", "profile_image_url",
    "email", "email_source", "bio", "follower_count", "following_count", "post_count",
    "engagement_rate", "country", "language", "is_verified", "external_url", "location",
    "heart_count", "share_count", "avg_likes", "avg_comments", "avg_shares", "avg_views",
    "is_private", "bookmark_count", "favourites_count",
    "extracted_keywords", "content_count", "bio_links",
  ];

  const koreanLabels = {
    platform: "플랫폼", username: "유저네임", display_name: "표시명",
    profile_url: "프로필URL", profile_image_url: "프로필이미지",
    email: "이메일", email_source: "이메일출처", bio: "바이오",
    follower_count: "팔로워수", following_count: "팔로잉수", post_count: "게시물수",
    engagement_rate: "참여율", country: "국가", language: "언어",
    is_verified: "인증여부", external_url: "외부URL", location: "위치",
    heart_count: "총좋아요", share_count: "공유수",
    avg_likes: "평균좋아요", avg_comments: "평균댓글", avg_shares: "평균공유", avg_views: "평균조회",
    is_private: "비공개계정", bookmark_count: "북마크수", favourites_count: "좋아요한수",
    extracted_keywords: "발견키워드", content_count: "콘텐츠수", bio_links: "바이오링크",
  };

  const koreanRow = columns.map((c) => koreanLabels[c] || c);
  const csvLines = [koreanRow.map(escapeCsv).join(","), columns.map(escapeCsv).join(",")];
  for (const inf of influencers) {
    csvLines.push(columns.map((c) => escapeCsv(inf[c])).join(","));
  }

  const csvFileName = `tiktok-master-all-${influencers.length}명.csv`;
  writeFileSync(csvFileName, BOM + csvLines.join("\n"), "utf-8");
  console.log(`\n📄 CSV 생성: ${csvFileName}`);

  const stats = {
    totalRuns: processedRunIds.size,
    totalRawItems: totalItems,
    uniqueInfluencers: influencers.length,
    skippedNoAuthor,
    emailCount, emailRate: ((emailCount / influencers.length) * 100).toFixed(1) + "%",
    linkCount, linkRate: ((linkCount / influencers.length) * 100).toFixed(1) + "%",
    countryDistribution: Object.fromEntries(Object.entries(countryDist).sort((a, b) => b[1] - a[1])),
    keywordDistribution: Object.fromEntries(Object.entries(keywordDist).sort((a, b) => b[1] - a[1]).slice(0, 50)),
    generatedAt: new Date().toISOString(),
  };
  writeFileSync("tiktok-master-stats.json", JSON.stringify(stats, null, 2), "utf-8");
  console.log(`📊 통계 저장: tiktok-master-stats.json`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n" + "═".repeat(60));
  console.log("  ✅ 완료!");
  console.log("═".repeat(60));
  console.log(`  총 run:        ${stats.totalRuns}개`);
  console.log(`  총 raw items:  ${stats.totalRawItems.toLocaleString()}개`);
  console.log(`  고유 인플루언서: ${stats.uniqueInfluencers.toLocaleString()}명`);
  console.log(`  이메일 보유:    ${stats.emailCount}명 (${stats.emailRate})`);
  console.log(`  외부링크 보유:  ${stats.linkCount}명 (${stats.linkRate})`);
  console.log(`  소요 시간:      ${elapsed}초`);
  console.log(`\n  국가별 분포 (상위 15):`);
  for (const [c, n] of Object.entries(stats.countryDistribution).slice(0, 15)) {
    console.log(`    ${c}: ${n.toLocaleString()}명`);
  }
  console.log(`\n  📄 ${csvFileName}`);
  console.log(`  📊 tiktok-master-stats.json`);
  console.log("═".repeat(60));
}

main().catch((err) => {
  console.error("\n❌ 치명적 오류:", err);
  process.exit(1);
});
