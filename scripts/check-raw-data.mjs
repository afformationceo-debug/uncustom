import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data } = await supabase
  .from("influencers")
  .select("username, raw_data")
  .eq("platform", "twitter")
  .not("raw_data", "is", null)
  .order("follower_count", { ascending: false })
  .limit(1);

if (!data?.[0]) { console.log("데이터 없음"); process.exit(0); }

const raw = data[0].raw_data;
console.log("=== @" + data[0].username + " Apify raw_data 전체 구조 ===\n");

function printObj(obj, indent = 0) {
  const pad = "  ".repeat(indent);
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) {
      console.log(`${pad}${key}: null`);
    } else if (Array.isArray(val)) {
      console.log(`${pad}${key}: Array[${val.length}]`);
      if (val.length > 0 && typeof val[0] === "object") {
        console.log(`${pad}  [0] keys: ${Object.keys(val[0]).join(", ")}`);
      } else if (val.length > 0) {
        console.log(`${pad}  [0]: ${JSON.stringify(val[0]).substring(0, 100)}`);
      }
    } else if (typeof val === "object") {
      console.log(`${pad}${key}: {`);
      printObj(val, indent + 1);
      console.log(`${pad}}`);
    } else {
      const str = String(val);
      console.log(`${pad}${key}: ${str.length > 80 ? str.substring(0, 80) + "..." : str}`);
    }
  }
}

printObj(raw);

// DB에 저장된 컬럼 vs raw_data 키 비교
console.log("\n=== 우리 DB에 매핑되지 않은 주요 필드 ===");
const MAPPED_AUTHOR_KEYS = new Set([
  "userName", "username", "name", "displayName", "id", "restId",
  "profilePicture", "profileImageUrl", "profile_image_url_https",
  "followers", "followersCount", "following", "followingCount",
  "statusesCount", "description", "bio", "location",
  "isBlueVerified", "verifiedType", "website",
]);
const MAPPED_TOP_KEYS = new Set([
  "author", "favoriteCount", "likeCount", "likes",
  "retweetCount", "retweets", "replyCount", "replies",
  "viewCount", "views",
]);

const author = raw.author || {};
const unmappedAuthor = Object.keys(author).filter(k => !MAPPED_AUTHOR_KEYS.has(k));
const unmappedTop = Object.keys(raw).filter(k => !MAPPED_TOP_KEYS.has(k));

console.log("\n미매핑 top-level 키:", unmappedTop.join(", "));
console.log("\n미매핑 author 키:", unmappedAuthor.join(", "));

// 특히 컨텐츠 관련 필드
console.log("\n=== 컨텐츠/트윗 관련 주요 미매핑 필드 ===");
const contentFields = ["url", "tweetUrl", "link", "text", "fullText", "id", "conversationId",
  "createdAt", "media", "photos", "videos", "hashtags", "mentionedUsers",
  "isRetweet", "isReply", "isQuote", "quotedTweet", "bookmarkCount"];
for (const f of contentFields) {
  if (raw[f] !== undefined) {
    const val = raw[f];
    if (typeof val === "object") {
      console.log(`  ${f}: ${JSON.stringify(val).substring(0, 150)}`);
    } else {
      console.log(`  ${f}: ${String(val).substring(0, 150)}`);
    }
  }
}
