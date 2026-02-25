/**
 * Save Apify enrichment results back to Supabase influencers table.
 * 
 * Usage: npx tsx scripts/save-enrichment-results.ts
 */

import { createClient } from "@supabase/supabase-js";

// --- Config ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APIFY_TOKEN = process.env.APIFY_API_TOKEN!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Dataset definitions ---
interface DatasetDef {
  id: string;
  platform: string;
  label: string;
}

const DATASETS: DatasetDef[] = [
  // Instagram (4 batches)
  { id: "NsCQkPxd5ojbTTl0e", platform: "instagram", label: "IG batch 1 (200)" },
  { id: "eCN92CGkP0G66FxKW", platform: "instagram", label: "IG batch 2 (200)" },
  { id: "CtM3LU4WJcg9t1ncg", platform: "instagram", label: "IG batch 3 (200)" },
  { id: "xF9V8YofCeVMkB8VB", platform: "instagram", label: "IG batch 4 (91)" },
  // TikTok
  { id: "fPrzseFDKtXJEgwnO", platform: "tiktok", label: "TikTok (15)" },
  // YouTube
  { id: "gK4IX3DvFy8chbCAl", platform: "youtube", label: "YouTube (8)" },
  // Twitter
  { id: "DrtfOAzruiwcLLLIT", platform: "twitter", label: "Twitter (84)" },
];

// --- Helpers ---
function extractEmailFromBio(bio: string | null | undefined): string | null {
  if (!bio) return null;
  const match = bio.match(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
  );
  return match ? match[0].toLowerCase() : null;
}

function computeEngagementRate(
  latestPosts: any[] | null | undefined,
  followerCount: number | null | undefined
): number | null {
  if (!latestPosts || !Array.isArray(latestPosts) || latestPosts.length === 0)
    return null;
  if (!followerCount || followerCount === 0) return null;

  let totalEngagement = 0;
  let count = 0;
  for (const post of latestPosts) {
    const likes = post.likesCount ?? post.likes ?? 0;
    const comments = post.commentsCount ?? post.comments ?? 0;
    totalEngagement += likes + comments;
    count++;
  }
  if (count === 0) return null;
  const avgEngagement = totalEngagement / count;
  return Math.round((avgEngagement / followerCount) * 10000) / 10000;
}

function parseNumber(val: any): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const str = String(val).replace(/[,\s]/g, "");
  const multipliers: Record<string, number> = { K: 1000, M: 1000000, B: 1000000000 };
  const match = str.match(/^([\d.]+)\s*([KMBkmb])?$/);
  if (match) {
    const num = parseFloat(match[1]);
    const suffix = (match[2] || "").toUpperCase();
    return Math.round(num * (multipliers[suffix] || 1));
  }
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? null : parsed;
}

async function fetchDatasetItems(datasetId: string): Promise<any[]> {
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch dataset ${datasetId}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Transform functions per platform ---
interface EnrichedRecord {
  platform: string;
  username: string;
  updates: Record<string, any>;
}

function transformInstagram(item: any): EnrichedRecord | null {
  const username = item.username;
  if (!username) return null;

  const followerCount = item.followersCount ?? null;
  const bioEmail = extractEmailFromBio(item.biography);
  const businessEmail = item.businessEmail || null;
  const email = businessEmail || bioEmail || null;
  const emailSource = businessEmail
    ? "business"
    : bioEmail
      ? "bio"
      : null;

  const engagementRate = computeEngagementRate(item.latestPosts, followerCount);

  const updates: Record<string, any> = {
    display_name: item.fullName || null,
    follower_count: followerCount,
    following_count: item.followsCount ?? null,
    post_count: item.postsCount ?? null,
    bio: item.biography || null,
    profile_image_url: item.profilePicUrlHD || item.profilePicUrl || null,
    profile_url: `https://www.instagram.com/${username}`,
    is_verified: item.verified ?? null,
    is_business: item.isBusinessAccount ?? null,
    category: item.businessCategoryName || null,
    external_url: item.externalUrl || null,
    raw_data: item,
  };

  if (email) {
    updates.email = email;
    updates.email_source = emailSource;
  }

  if (engagementRate !== null) {
    updates.engagement_rate = engagementRate;
  }

  return { platform: "instagram", username, updates };
}

function transformTiktok(item: any): EnrichedRecord | null {
  const authorMeta = item.authorMeta;
  if (!authorMeta) return null;
  const username = authorMeta.name;
  if (!username) return null;

  const updates: Record<string, any> = {
    display_name: authorMeta.nickName || null,
    follower_count: authorMeta.fans ?? null,
    following_count: authorMeta.following ?? null,
    bio: authorMeta.signature || null,
    profile_image_url: authorMeta.avatar || null,
    heart_count: authorMeta.heart ?? null,
    is_verified: authorMeta.verified ?? null,
    profile_url: `https://www.tiktok.com/@${username}`,
    raw_data: item,
  };

  const bioEmail = extractEmailFromBio(authorMeta.signature);
  if (bioEmail) {
    updates.email = bioEmail;
    updates.email_source = "bio";
  }

  return { platform: "tiktok", username, updates };
}

function transformYoutube(item: any): EnrichedRecord | null {
  const channelName = item.channelName;
  const channelUrl = item.channelUrl;
  if (!channelUrl && !channelName) return null;

  let username = "";
  if (channelUrl) {
    const atMatch = channelUrl.match(/@([^/?\s]+)/);
    if (atMatch) {
      username = atMatch[1];
    } else {
      const chanMatch = channelUrl.match(/channel\/([^/?\s]+)/);
      if (chanMatch) {
        username = chanMatch[1];
      }
    }
  }
  if (!username && channelName) {
    username = channelName;
  }
  if (!username) return null;

  const updates: Record<string, any> = {
    display_name: channelName || null,
    follower_count: parseNumber(item.numberOfSubscribers),
    bio: item.channelDescription || null,
    profile_image_url: item.channelProfilePicture || null,
    profile_url: channelUrl || `https://www.youtube.com/@${username}`,
    raw_data: item,
  };

  const bioEmail = extractEmailFromBio(item.channelDescription);
  if (bioEmail) {
    updates.email = bioEmail;
    updates.email_source = "bio";
  }

  return { platform: "youtube", username, updates };
}

function transformTwitter(item: any): EnrichedRecord | null {
  const author = item.author;
  if (!author) return null;
  const username = author.userName;
  if (!username) return null;

  const updates: Record<string, any> = {
    display_name: author.name || null,
    follower_count: author.followers ?? null,
    following_count: author.following ?? null,
    bio: author.description || null,
    profile_image_url: author.profilePicture || null,
    is_verified: author.isBlueVerified ?? null,
    location: author.location || null,
    post_count: author.statusesCount ?? null,
    profile_url: `https://x.com/${username}`,
    raw_data: item,
  };

  const bioEmail = extractEmailFromBio(author.description);
  if (bioEmail) {
    updates.email = bioEmail;
    updates.email_source = "bio";
  }

  return { platform: "twitter", username, updates };
}

// --- Main ---
async function main() {
  console.log("=== Apify Enrichment -> Supabase Save ===\n");

  const stats: Record<string, { total: number; updated: number; notFound: number; errors: number; deduped: number }> = {};

  for (const ds of DATASETS) {
    console.log(`\n--- Fetching ${ds.label} (dataset: ${ds.id}) ---`);

    let items: any[];
    try {
      items = await fetchDatasetItems(ds.id);
      console.log(`  Fetched ${items.length} items`);
    } catch (err: any) {
      console.error(`  ERROR fetching dataset: ${err.message}`);
      continue;
    }

    // Transform items
    const transformFn =
      ds.platform === "instagram"
        ? transformInstagram
        : ds.platform === "tiktok"
          ? transformTiktok
          : ds.platform === "youtube"
            ? transformYoutube
            : transformTwitter;

    const records: EnrichedRecord[] = [];
    const seenUsernames = new Set<string>();
    let dupeCount = 0;

    for (const item of items) {
      const rec = transformFn(item);
      if (rec) {
        const key = `${rec.platform}:${rec.username.toLowerCase()}`;
        if (seenUsernames.has(key)) {
          dupeCount++;
          continue;
        }
        seenUsernames.add(key);
        records.push(rec);
      }
    }

    console.log(`  Transformed ${records.length} unique records (${dupeCount} duplicates skipped)`);

    if (!stats[ds.platform]) {
      stats[ds.platform] = { total: 0, updated: 0, notFound: 0, errors: 0, deduped: 0 };
    }
    stats[ds.platform].total += records.length;
    stats[ds.platform].deduped += dupeCount;

    // Batch update: 50 at a time
    const BATCH_SIZE = 50;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async (rec) => {
        try {
          const { data, error } = await supabase
            .from("influencers")
            .update(rec.updates)
            .eq("platform", rec.platform)
            .eq("username", rec.username)
            .select("id");

          if (error) {
            console.error(`  ERROR updating ${rec.platform}/${rec.username}: ${error.message}`);
            stats[rec.platform].errors++;
            return;
          }

          if (!data || data.length === 0) {
            // Not found with exact match - try case-insensitive
            const { data: data2, error: error2 } = await supabase
              .from("influencers")
              .update(rec.updates)
              .eq("platform", rec.platform)
              .ilike("username", rec.username)
              .select("id");

            if (error2 || !data2 || data2.length === 0) {
              stats[rec.platform].notFound++;
            } else {
              stats[rec.platform].updated += data2.length;
            }
          } else {
            stats[rec.platform].updated += data.length;
          }
        } catch (err: any) {
          console.error(`  EXCEPTION updating ${rec.platform}/${rec.username}: ${err.message}`);
          stats[rec.platform].errors++;
        }
      });

      await Promise.all(promises);

      if (i + BATCH_SIZE < records.length) {
        await sleep(200); // 200ms delay between batches
      }
    }

    console.log(`  Batch complete for ${ds.label}`);
  }

  // --- Final Report ---
  console.log("\n\n========================================");
  console.log("         ENRICHMENT SAVE REPORT         ");
  console.log("========================================\n");

  let grandTotal = 0;
  let grandUpdated = 0;
  let grandNotFound = 0;
  let grandErrors = 0;

  for (const [platform, s] of Object.entries(stats)) {
    console.log(`  ${platform.toUpperCase()}`);
    console.log(`    Total unique records: ${s.total} (${s.deduped} dupes skipped)`);
    console.log(`    Updated:    ${s.updated}`);
    console.log(`    Not found:  ${s.notFound}`);
    console.log(`    Errors:     ${s.errors}`);
    console.log();
    grandTotal += s.total;
    grandUpdated += s.updated;
    grandNotFound += s.notFound;
    grandErrors += s.errors;
  }

  console.log("  ------------------------------------");
  console.log(`  GRAND TOTAL:   ${grandTotal} records processed`);
  console.log(`  UPDATED:       ${grandUpdated}`);
  console.log(`  NOT FOUND:     ${grandNotFound}`);
  console.log(`  ERRORS:        ${grandErrors}`);
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
