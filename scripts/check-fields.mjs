import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Instagram
const { data: igData } = await supabase
  .from("influencers")
  .select("username, email, language, content_language, is_private, video_duration, is_sponsored, music_info, mentions, location, bio, external_url, product_type, raw_data")
  .eq("platform", "instagram")
  .limit(3);

console.log("=== INSTAGRAM ===");
for (const inf of (igData || [])) {
  const raw = inf.raw_data || {};
  console.log("\n--- " + inf.username + " ---");
  console.log("DB email:", inf.email);
  console.log("DB language:", inf.language);
  console.log("DB content_language:", inf.content_language);
  console.log("DB is_private:", inf.is_private);
  console.log("DB video_duration:", inf.video_duration);
  console.log("DB is_sponsored:", inf.is_sponsored);
  console.log("DB music_info:", JSON.stringify(inf.music_info)?.substring(0, 100));
  console.log("DB mentions:", JSON.stringify(inf.mentions));
  console.log("DB location:", inf.location);
  console.log("DB product_type:", inf.product_type);
  console.log("DB bio:", (inf.bio || "").substring(0, 100));
  console.log("DB external_url:", inf.external_url);
  console.log("---RAW fields---");
  console.log("raw.isSponsored:", raw.isSponsored);
  console.log("raw.musicInfo:", JSON.stringify(raw.musicInfo)?.substring(0, 120));
  console.log("raw.audio:", JSON.stringify(raw.audio)?.substring(0, 120));
  console.log("raw.mentions:", JSON.stringify(raw.mentions)?.substring(0, 120));
  console.log("raw.locationName:", raw.locationName);
  console.log("raw.location:", JSON.stringify(raw.location)?.substring(0, 120));
  console.log("raw.videoDuration:", raw.videoDuration);
  console.log("raw.videoViewCount:", raw.videoViewCount);
  console.log("raw.videoPlayCount:", raw.videoPlayCount);
  console.log("raw.private:", raw.private);
  console.log("raw.isPrivate:", raw.isPrivate);
  console.log("raw.type:", raw.type);
  console.log("raw.productType:", raw.productType);
  console.log("raw.language:", raw.language);
  console.log("raw.caption:", (raw.caption || "").toString().substring(0, 100));
  const keys = Object.keys(raw).filter(k => k !== "_collectedPosts" && k !== "latestPosts").sort();
  console.log("raw ALL KEYS:", keys.join(", "));
}

// TikTok
const { data: tkData } = await supabase
  .from("influencers")
  .select("username, email, bio, external_url, location, is_private, is_sponsored, mentions, music_info, product_type, raw_data")
  .eq("platform", "tiktok")
  .limit(3);

console.log("\n\n=== TIKTOK ===");
for (const inf of (tkData || [])) {
  const raw = inf.raw_data || {};
  console.log("\n--- " + inf.username + " ---");
  console.log("DB email:", inf.email);
  console.log("DB bio:", (inf.bio || "").substring(0, 100));
  console.log("DB external_url:", inf.external_url);
  console.log("DB location:", inf.location);
  console.log("DB is_private:", inf.is_private);
  console.log("DB is_sponsored:", inf.is_sponsored);
  console.log("DB mentions:", JSON.stringify(inf.mentions));
  console.log("DB music_info:", JSON.stringify(inf.music_info)?.substring(0, 150));
  console.log("DB product_type:", inf.product_type);
  console.log("---RAW fields---");
  console.log("raw.isAd:", raw.isAd);
  console.log("raw.locationCreated:", raw.locationCreated);
  console.log("raw.poi:", JSON.stringify(raw.poi)?.substring(0, 100));
  console.log("raw.mentions:", JSON.stringify(raw.mentions)?.substring(0, 150));
  console.log("raw.textExtra:", JSON.stringify(raw.textExtra)?.substring(0, 250));
  console.log("raw.musicMeta:", JSON.stringify(raw.musicMeta)?.substring(0, 200));
  console.log("raw.authorMeta?.private:", raw.authorMeta?.private);
  console.log("raw.authorMeta?.privateAccount:", raw.authorMeta?.privateAccount);
  console.log("raw.authorMeta?.signature:", (raw.authorMeta?.signature || "").substring(0, 100));
  console.log("raw.authorMeta?.bioLink:", JSON.stringify(raw.authorMeta?.bioLink)?.substring(0, 120));
  const keys = Object.keys(raw).filter(k => k !== "_collectedPosts").sort();
  console.log("raw ALL KEYS:", keys.join(", "));
}
