#!/usr/bin/env node
/**
 * TikTok 마스터 CSV → Supabase influencers 테이블 Import
 * 대상: CN, TW, JP, US (9,798명)
 *
 * Usage: node scripts/import-tiktok-to-supabase.mjs
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── ENV ────────────────────────────────────────────
const dotenv = fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8");
const env = {};
for (const line of dotenv.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── CSV Parser ─────────────────────────────────────
function parseCSV(text) {
  const rows = [];
  let current = "", inQuotes = false, row = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      row.push(current); current = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(current); current = "";
      if (row.length > 1 || row[0].trim()) rows.push(row);
      row = [];
    } else current += ch;
  }
  if (current || row.length) { row.push(current); rows.push(row); }
  return rows;
}

// ─── Quality Filters ────────────────────────────────
const TARGET_COUNTRIES = new Set(["CN", "TW", "JP", "US"]);

const NEWS_MEDIA_PATTERN = /^(bbc|cnn|nbcnews|abcnews|cbsnews|foxnews|reuters|ap_|associated_?press|nytimes|washingtonpost|guardian|aljazeer|nhk|tv_asahi|tbs_|fuji_tv|nippon_tv|olympics|paralympics|fifa|nba|nfl|nhl|mlb|espn|bleacher|suno_news)/i;
const SPAM_PATTERN = /casino|betting|slot|forex|crypto.*profit|earn.*\$|make.*money|gambling/i;
const BOT_NAME_PATTERN = /^\d{8,}$|^user\d+$/i;

function shouldRemove(row, idx) {
  const u = row[idx.username] || "";
  const f = parseFloat(row[idx.follower_count]) || 0;
  const al = parseFloat(row[idx.avg_likes]) || 0;
  const av = parseFloat(row[idx.avg_views]) || 0;
  const ac = parseFloat(row[idx.avg_comments]) || 0;
  const bio = row[idx.bio] || "";

  // Ghost followers: 50K+ 팔로워, 좋아요 < 0.3%
  if (f >= 50000 && al < f * 0.003) return "ghost";
  // Bot name
  if (BOT_NAME_PATTERN.test(u)) return "bot_name";
  // No comments + high views (fake engagement)
  if (ac === 0 && av > 50000) return "no_comments";
  // News/media
  if (NEWS_MEDIA_PATTERN.test(u)) return "news_media";
  // Spam bio
  if (SPAM_PATTERN.test(bio)) return "spam";

  return null;
}

// ─── Map CSV row → Supabase influencers row ─────────
function toSupabaseRow(row, idx) {
  const username = (row[idx.username] || "").trim();
  if (!username) return null;

  const followerCount = parseInt(row[idx.follower_count]) || null;
  const followingCount = parseInt(row[idx.following_count]) || null;
  const postCount = parseInt(row[idx.post_count]) || null;
  const heartCount = parseInt(row[idx.heart_count]) || null;
  const shareCount = parseInt(row[idx.share_count]) || null;
  const avgLikes = parseFloat(row[idx.avg_likes]) || null;
  const avgComments = parseFloat(row[idx.avg_comments]) || null;
  const avgShares = parseFloat(row[idx.avg_shares]) || null;
  const avgViews = parseFloat(row[idx.avg_views]) || null;
  const engagementRate = parseFloat(row[idx.engagement_rate]) || null;

  const email = (row[idx.email] || "").trim() || null;
  const emailSource = email ? (row[idx.email_source] || "bio").trim() : null;
  const bio = (row[idx.bio] || "").trim() || null;
  const displayName = (row[idx.display_name] || "").trim() || null;
  const profileUrl = (row[idx.profile_url] || "").trim() || `https://www.tiktok.com/@${username}`;
  const profileImageUrl = (row[idx.profile_image_url] || "").trim() || null;
  const country = (row[idx.country] || "").trim() || null;
  const language = (row[idx.language] || "").trim() || null;
  const externalUrl = (row[idx.external_url] || "").trim() || null;
  const isVerified = row[idx.is_verified] === "true";
  const isPrivate = row[idx.is_private] === "true";

  // extracted_keywords → TEXT[] array
  const kwStr = (row[idx.extracted_keywords] || "").trim();
  const extractedKeywords = kwStr ? kwStr.split(";").map((k) => k.trim()).filter(Boolean) : [];

  // bio_links → external_url (첫번째 링크)
  const bioLinks = (row[idx.bio_links] || "").trim();
  const finalExternalUrl = externalUrl || (bioLinks ? bioLinks.split(";")[0].trim() : null);

  return {
    platform: "tiktok",
    platform_id: username, // TikTok username as platform_id
    username,
    display_name: displayName,
    profile_url: profileUrl,
    profile_image_url: profileImageUrl,
    email,
    email_source: emailSource,
    bio,
    follower_count: followerCount,
    following_count: followingCount,
    post_count: postCount,
    engagement_rate: engagementRate,
    country,
    language,
    is_verified: isVerified,
    is_private: isPrivate,
    external_url: finalExternalUrl,
    heart_count: heartCount,
    share_count: shareCount,
    avg_likes: avgLikes,
    avg_comments: avgComments,
    avg_shares: avgShares,
    avg_views: avgViews,
    extracted_keywords: extractedKeywords,
    import_source: "script:tiktok_master",
  };
}

// ─── Main ───────────────────────────────────────────
async function main() {
  const csvPath = path.join(ROOT, "tiktok-master-filtered-14945명.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("CSV 파일을 찾을 수 없습니다:", csvPath);
    process.exit(1);
  }

  console.log("CSV 파일 읽는 중...");
  const csv = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(csv);
  const header = rows[1]; // DB column headers (skip BOM Korean headers)
  const data = rows.slice(2);

  // Build index
  const idx = {};
  for (let i = 0; i < header.length; i++) idx[header[i]] = i;

  console.log(`총 CSV 행: ${data.length}`);

  // Step 1: Filter 4 countries
  const countryFiltered = data.filter((r) => TARGET_COUNTRIES.has(r[idx.country]));
  console.log(`4개국(CN/TW/JP/US) 필터: ${countryFiltered.length}명`);

  // Step 2: Quality filter
  const removed = { ghost: 0, bot_name: 0, no_comments: 0, news_media: 0, spam: 0 };
  const qualified = [];
  for (const row of countryFiltered) {
    const reason = shouldRemove(row, idx);
    if (reason) {
      removed[reason]++;
    } else {
      qualified.push(row);
    }
  }
  console.log(`품질 필터 제거: ${countryFiltered.length - qualified.length}명`);
  for (const [r, c] of Object.entries(removed)) {
    if (c > 0) console.log(`  ${r}: ${c}`);
  }
  console.log(`최종 import 대상: ${qualified.length}명`);

  // Step 3: Convert to Supabase rows
  const supabaseRows = [];
  let skipped = 0;
  for (const row of qualified) {
    const mapped = toSupabaseRow(row, idx);
    if (mapped) supabaseRows.push(mapped);
    else skipped++;
  }
  if (skipped > 0) console.log(`매핑 실패 (username 없음): ${skipped}명`);

  // Step 4: Batch upsert (500 per batch)
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(supabaseRows.length / BATCH_SIZE);
  let upserted = 0;
  let errors = 0;

  console.log(`\nSupabase upsert 시작 (${totalBatches} batches × ${BATCH_SIZE})...\n`);

  for (let i = 0; i < supabaseRows.length; i += BATCH_SIZE) {
    const batch = supabaseRows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { data: result, error } = await supabase
      .from("influencers")
      .upsert(batch, {
        onConflict: "platform,platform_id",
        ignoreDuplicates: false,
      })
      .select("id");

    if (error) {
      console.error(`[${batchNum}/${totalBatches}] ERROR:`, error.message);
      errors += batch.length;
    } else {
      upserted += result.length;
      const pct = ((upserted / supabaseRows.length) * 100).toFixed(1);
      process.stdout.write(`\r[${batchNum}/${totalBatches}] ${upserted.toLocaleString()} upserted (${pct}%)`);
    }
  }

  console.log("\n");

  // Step 5: Summary
  const emailCount = supabaseRows.filter((r) => r.email).length;
  const byCountry = {};
  for (const r of supabaseRows) {
    byCountry[r.country] = (byCountry[r.country] || 0) + 1;
  }

  console.log("═══════════════════════════════════════");
  console.log("  Import 완료");
  console.log("═══════════════════════════════════════");
  console.log(`  Upserted: ${upserted.toLocaleString()}명`);
  console.log(`  Errors: ${errors}`);
  console.log(`  이메일 보유: ${emailCount}명 (${((emailCount / supabaseRows.length) * 100).toFixed(1)}%)`);
  console.log("");
  console.log("  국가별:");
  for (const [c, n] of Object.entries(byCountry).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${c}: ${n.toLocaleString()}명`);
  }
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
