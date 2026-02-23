import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BOM = "\uFEFF";

function escapeCsv(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r"))
    return `"${str.replace(/"/g, '""')}"`;
  return str;
}

const PLATFORM_SCHEMAS = {
  instagram: [
    "platform", "username", "display_name", "profile_url", "profile_image_url",
    "email", "email_source", "bio", "follower_count", "following_count", "post_count",
    "engagement_rate", "country", "language", "is_verified", "is_business", "category",
    "external_url", "location", "avg_likes", "avg_comments", "avg_views",
    "source_content_url", "source_content_text", "source_content_created_at",
    "content_language", "content_hashtags", "is_private", "video_duration",
    "is_sponsored", "mentions", "music_info", "product_type",
  ],
  tiktok: [
    "platform", "username", "display_name", "profile_url", "profile_image_url",
    "email", "email_source", "bio", "follower_count", "following_count", "post_count",
    "engagement_rate", "country", "language", "is_verified", "external_url", "location",
    "heart_count", "share_count", "avg_likes", "avg_comments", "avg_shares", "avg_views",
    "source_content_url", "source_content_text", "source_content_created_at",
    "content_language", "content_hashtags", "is_private",
    "bookmark_count", "quote_count", "favourites_count", "video_duration",
    "is_sponsored", "mentions", "music_info", "product_type",
  ],
  youtube: [
    "platform", "username", "display_name", "profile_url", "profile_image_url",
    "email", "email_source", "bio", "follower_count", "post_count",
    "engagement_rate", "country", "language", "external_url",
    "total_views", "channel_joined_date", "is_monetized", "location",
    "avg_likes", "avg_comments", "avg_views",
    "source_content_url", "source_content_text", "source_content_created_at",
    "content_language", "content_hashtags", "account_created_at",
    "video_title", "video_duration", "product_type",
  ],
  twitter: [
    "platform", "username", "display_name", "profile_url", "profile_image_url",
    "email", "email_source", "bio", "follower_count", "following_count", "post_count",
    "engagement_rate", "country", "language", "external_url",
    "is_blue_verified", "verified_type", "location", "category", "cover_image_url",
    "avg_likes", "avg_comments", "avg_shares", "avg_views",
    "source_content_url", "source_content_text", "source_content_created_at",
    "content_language", "content_hashtags", "account_created_at",
    "bookmark_count", "quote_count", "favourites_count",
    "listed_count", "media_count", "is_retweet", "is_reply", "mentions",
  ],
};

const KOREAN_LABELS = {
  platform: "플랫폼", username: "유저네임", display_name: "표시명",
  profile_url: "프로필URL", profile_image_url: "프로필이미지",
  email: "이메일", email_source: "이메일출처", bio: "바이오",
  follower_count: "팔로워수", following_count: "팔로잉수", post_count: "게시물수",
  engagement_rate: "참여율", country: "국가", language: "언어",
  is_verified: "인증여부", is_business: "비즈니스계정", category: "카테고리",
  external_url: "외부URL", avg_likes: "평균좋아요", avg_comments: "평균댓글",
  avg_shares: "평균공유/RT", avg_views: "평균조회",
  heart_count: "총좋아요", share_count: "공유수", total_views: "총조회수",
  channel_joined_date: "채널생성일", is_monetized: "수익화", location: "위치",
  is_blue_verified: "TwitterBlue", verified_type: "인증유형",
  cover_image_url: "커버이미지", source_content_url: "콘텐츠URL",
  source_content_text: "콘텐츠텍스트", source_content_created_at: "콘텐츠날짜",
  content_language: "콘텐츠언어", content_hashtags: "해시태그",
  account_created_at: "계정생성일", is_private: "비공개계정",
  bookmark_count: "북마크수", quote_count: "인용수",
  favourites_count: "좋아요한수", video_duration: "영상길이(초)",
  video_title: "영상제목",
  listed_count: "리스트수", media_count: "미디어수",
  is_sponsored: "광고여부", is_retweet: "RT여부", is_reply: "답글여부",
  mentions: "멘션", music_info: "음악정보", product_type: "유형",
};

for (const [platform, columns] of Object.entries(PLATFORM_SCHEMAS)) {
  console.log(`\n📦 ${platform.toUpperCase()} 내보내기...`);

  // Fetch all data (paginated for large datasets)
  let allData = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("influencers")
      .select(columns.join(","))
      .eq("platform", platform)
      .order("follower_count", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) { console.error(`  에러: ${error.message}`); break; }
    if (!data?.length) break;
    allData = allData.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Korean label header + DB column header + data
  const koreanRow = columns.map(c => KOREAN_LABELS[c] || c);
  const csvLines = [koreanRow.map(escapeCsv).join(","), columns.join(",")];

  for (const row of allData) {
    const line = columns.map(c => {
      let val = row[c];
      // Handle arrays
      if (Array.isArray(val)) val = val.join("; ");
      return escapeCsv(val);
    });
    csvLines.push(line.join(","));
  }

  const fileName = `${platform}_전체_${allData.length}명.csv`;
  writeFileSync(fileName, BOM + csvLines.join("\n"), "utf-8");
  console.log(`  ✅ ${fileName} — ${allData.length}행, ${columns.length}컬럼`);
}

console.log("\n" + "═".repeat(50));
console.log("  전체 내보내기 완료!");
console.log("═".repeat(50));
