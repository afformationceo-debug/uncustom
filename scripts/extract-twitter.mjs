#!/usr/bin/env node
/**
 * Twitter 韓国美容 추출 스크립트
 * - Apify Twitter scraper 실행 → 결과 변환 → Supabase 저장 → CSV 내보내기
 */
import { config } from "dotenv";
import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

config({ path: ".env.local" });

const apify = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const KEYWORD = "韓国美容";
const ACTOR_ID = "apidojo/tweet-scraper";
const MAX_ITEMS = 100;

// Email regex
const EMAIL_RE = /[a-zA-Z0-9][\w.-]*[a-zA-Z0-9]@[a-zA-Z0-9][\w.-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}/g;

function toNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function transformTwitter(item) {
  const author = item.author || {};
  const username = author.userName || author.username || item.userName || item.username || "";
  const platformId = String(author.id || author.restId || item.authorId || item.id || "");
  if (!username && !platformId) return null;

  const bio = (author.description || author.bio || item.description || "");
  const bioEmail = bio ? (bio.match(EMAIL_RE)?.[0] || null) : null;
  const rawLocation = author.location || item.location || null;
  const locationEmail = rawLocation ? (rawLocation.match(EMAIL_RE)?.[0] || null) : null;
  const finalEmail = bioEmail || locationEmail || null;
  const emailSource = finalEmail ? (bioEmail ? "bio" : "location") : null;

  const followers = toNumber(author.followers || author.followersCount);
  const favoriteCount = toNumber(item.favoriteCount || item.likeCount || item.likes);
  const retweetCount = toNumber(item.retweetCount || item.retweets);
  const replyCount = toNumber(item.replyCount || item.replies);
  const viewCount = toNumber(item.viewCount || item.views);

  let engagement = null;
  if (followers && followers > 0 && (favoriteCount !== null || retweetCount !== null)) {
    engagement = ((favoriteCount || 0) + (retweetCount || 0)) / followers;
  }

  return {
    platform: "twitter",
    platform_id: platformId,
    username,
    display_name: author.name || author.displayName || "",
    profile_url: username ? `https://x.com/${username}` : "",
    profile_image_url: author.profilePicture || author.profileImageUrl || "",
    bio,
    follower_count: followers,
    following_count: toNumber(author.following || author.followingCount),
    post_count: toNumber(author.statusesCount),
    engagement_rate: engagement,
    email: finalEmail,
    email_source: emailSource,
    country: null,
    language: null,
    is_blue_verified: author.isBlueVerified || null,
    verified_type: author.verifiedType || null,
    location: rawLocation,
    external_url: author.website || null,
    avg_likes: favoriteCount,
    avg_comments: replyCount,
    avg_shares: retweetCount,
    avg_views: viewCount,
    raw_data: item,
  };
}

async function main() {
  console.log(`\n🚀 Twitter 추출 시작: "${KEYWORD}" (최대 ${MAX_ITEMS}개)\n`);

  // 1. Apify Actor 실행
  console.log("1️⃣  Apify Actor 시작...");
  const run = await apify.actor(ACTOR_ID).start({
    searchTerms: [KEYWORD],
    maxItems: MAX_ITEMS,
    sort: "Latest",
  });
  console.log(`   Run ID: ${run.id}`);

  // 2. 폴링 (완료 대기)
  console.log("2️⃣  완료 대기 중...");
  let status;
  let elapsed = 0;
  do {
    await new Promise((r) => setTimeout(r, 5000));
    elapsed += 5;
    status = await apify.run(run.id).get();
    process.stdout.write(`   ${elapsed}초... (${status.status})\r`);
  } while (status.status === "RUNNING" || status.status === "READY");
  console.log(`\n   완료! 상태: ${status.status}`);

  if (status.status !== "SUCCEEDED") {
    console.error("❌ Actor 실패:", status.status);
    process.exit(1);
  }

  // 3. 결과 가져오기
  console.log("3️⃣  결과 데이터 가져오기...");
  const { items } = await apify.dataset(status.defaultDatasetId).listItems();
  console.log(`   총 ${items.length}개 트윗 수집`);

  // 4. 변환 + 중복 제거
  console.log("4️⃣  변환 & 중복 제거...");
  const uniqueMap = new Map();
  for (const item of items) {
    const transformed = transformTwitter(item);
    if (!transformed) continue;
    const key = `twitter:${transformed.platform_id}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, transformed);
    }
  }
  const influencers = Array.from(uniqueMap.values());
  console.log(`   고유 인플루언서: ${influencers.length}명`);

  // 5. Supabase 저장
  console.log("5️⃣  Supabase 저장...");
  const BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < influencers.length; i += BATCH) {
    const batch = influencers.slice(i, i + BATCH);
    const { error, data } = await supabase
      .from("influencers")
      .upsert(batch, { onConflict: "platform,platform_id" })
      .select("id");
    if (error) {
      console.error(`   배치 에러:`, error.message);
    } else {
      upserted += data.length;
    }
  }
  console.log(`   ✅ ${upserted}명 저장/업데이트 완료`);

  // 6. 이메일 통계
  const withEmail = influencers.filter((i) => i.email);
  console.log(`   📧 이메일 보유: ${withEmail.length}명`);

  // 7. DB 검증
  console.log("6️⃣  DB 검증...");
  const { count } = await supabase
    .from("influencers")
    .select("*", { count: "exact", head: true })
    .eq("platform", "twitter");
  console.log(`   Twitter 전체 인플루언서: ${count}명`);

  const { data: recentData } = await supabase
    .from("influencers")
    .select("username, display_name, follower_count, email, is_blue_verified, location, avg_likes, avg_views")
    .eq("platform", "twitter")
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("\n   📋 최근 저장된 5명:");
  for (const r of recentData || []) {
    console.log(`   @${r.username} | ${r.display_name} | 팔로워: ${r.follower_count?.toLocaleString() || "-"} | 이메일: ${r.email || "-"} | Blue: ${r.is_blue_verified || false}`);
  }

  // 8. CSV 내보내기
  console.log("\n7️⃣  CSV 내보내기...");
  const csvHeaders = [
    "platform", "username", "display_name", "profile_url", "follower_count",
    "following_count", "post_count", "engagement_rate", "email", "email_source",
    "bio", "is_blue_verified", "verified_type", "location", "external_url",
    "avg_likes", "avg_comments", "avg_shares", "avg_views",
  ];
  const BOM = "\uFEFF";
  const csvLines = [csvHeaders.join(",")];
  for (const inf of influencers) {
    const row = csvHeaders.map((h) => {
      const val = inf[h];
      if (val === null || val === undefined) return "";
      const str = String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    });
    csvLines.push(row.join(","));
  }
  const csvPath = "twitter_韓国美容_results.csv";
  writeFileSync(csvPath, BOM + csvLines.join("\n"), "utf-8");
  console.log(`   ✅ CSV 저장: ${csvPath} (${influencers.length}행)`);

  // 요약
  console.log("\n" + "=".join ? "═".repeat(50) : "=".repeat(50));
  console.log("📊 추출 완료 요약");
  console.log("═".repeat(50));
  console.log(`키워드:        ${KEYWORD}`);
  console.log(`플랫폼:        Twitter`);
  console.log(`총 트윗 수집:   ${items.length}개`);
  console.log(`고유 인플루언서: ${influencers.length}명`);
  console.log(`이메일 보유:    ${withEmail.length}명`);
  console.log(`DB 저장:       ${upserted}명`);
  console.log(`CSV 파일:      ${csvPath}`);
  console.log("═".repeat(50));
}

main().catch((err) => {
  console.error("❌ 에러:", err);
  process.exit(1);
});
