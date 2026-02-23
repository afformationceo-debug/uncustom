import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log("═".repeat(60));
console.log("  백필 결과 확인 + CSV 내보내기");
console.log("═".repeat(60));

// 1. 플랫폼별 백필 확인
for (const platform of ["twitter", "instagram", "tiktok", "youtube"]) {
  const { count: total } = await supabase
    .from("influencers")
    .select("*", { count: "exact", head: true })
    .eq("platform", platform);

  const { count: withUrl } = await supabase
    .from("influencers")
    .select("*", { count: "exact", head: true })
    .eq("platform", platform)
    .not("source_content_url", "is", null);

  const { count: withLang } = await supabase
    .from("influencers")
    .select("*", { count: "exact", head: true })
    .eq("platform", platform)
    .not("content_language", "is", null);

  const { count: withAcct } = await supabase
    .from("influencers")
    .select("*", { count: "exact", head: true })
    .eq("platform", platform)
    .not("account_created_at", "is", null);

  console.log(`\n[${platform.toUpperCase()}] 총: ${total}명`);
  console.log(`  source_content_url: ${withUrl}명 (${total > 0 ? Math.round(withUrl / total * 100) : 0}%)`);
  console.log(`  content_language:   ${withLang}명`);
  console.log(`  account_created_at: ${withAcct}명`);

  // 샘플 1건
  const { data: sample } = await supabase
    .from("influencers")
    .select("username, source_content_url, source_content_text, content_language, account_created_at, bookmark_count, video_title, video_duration")
    .eq("platform", platform)
    .not("source_content_url", "is", null)
    .limit(1);
  if (sample?.[0]) {
    const s = sample[0];
    console.log(`  샘플: @${s.username}`);
    console.log(`    URL: ${(s.source_content_url || "").substring(0, 70)}`);
    console.log(`    텍스트: ${(s.source_content_text || "").substring(0, 50)}...`);
    console.log(`    언어: ${s.content_language || "-"}, 계정생성: ${s.account_created_at || "-"}`);
    if (s.bookmark_count) console.log(`    북마크: ${s.bookmark_count}`);
    if (s.video_title) console.log(`    영상: ${s.video_title.substring(0, 50)}`);
    if (s.video_duration) console.log(`    길이: ${s.video_duration}초`);
  }
}

// 2. Twitter CSV 내보내기 (확장 컬럼 포함)
console.log("\n" + "─".repeat(60));
console.log("  Twitter CSV 내보내기 (확장 컬럼 포함)");
console.log("─".repeat(60));

const headers = [
  "platform", "username", "display_name", "profile_url", "follower_count",
  "following_count", "post_count", "engagement_rate", "email", "email_source",
  "bio", "is_blue_verified", "verified_type", "location", "external_url",
  "avg_likes", "avg_comments", "avg_shares", "avg_views",
  // 새 컬럼
  "source_content_url", "source_content_text", "source_content_created_at",
  "content_language", "account_created_at", "cover_image_url",
  "bookmark_count", "quote_count", "favourites_count",
];

const { data: allTwitter } = await supabase
  .from("influencers")
  .select(headers.join(","))
  .eq("platform", "twitter")
  .order("follower_count", { ascending: false });

const BOM = "\uFEFF";
const csvLines = [headers.join(",")];
for (const inf of allTwitter || []) {
  const row = headers.map(h => {
    const val = inf[h];
    if (val === null || val === undefined) return "";
    const str = String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"` : str;
  });
  csvLines.push(row.join(","));
}

const csvPath = "twitter_韓国美容_full.csv";
writeFileSync(csvPath, BOM + csvLines.join("\n"), "utf-8");
console.log(`✅ ${csvPath} — ${(allTwitter || []).length}행, ${headers.length}컬럼`);

console.log("\n" + "═".repeat(60));
console.log("  완료!");
console.log("═".repeat(60));
