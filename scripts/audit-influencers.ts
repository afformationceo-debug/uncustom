/**
 * Influencer Data Completeness Audit
 * Uses postgres.js for direct SQL — fast and reliable.
 * Run with: npx tsx scripts/audit-influencers.ts
 */

import postgres from "postgres";

const DATABASE_URL = "postgresql://postgres:djvhapdltus1@db.cnuxbjdjkrmuibwptqzj.supabase.co:5432/postgres";

const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  idle_timeout: 30,
  connect_timeout: 30,
});

// --- Helpers ---
function pct(n: number, total: number): string {
  if (total === 0) return "0.0%";
  return ((n / total) * 100).toFixed(1) + "%";
}
function pad(s: string, len: number) { return s.padEnd(len); }
function padL(s: string, len: number) { return s.padStart(len); }
function ln(c = "-", len = 110) { return c.repeat(len); }
function section(title: string) {
  console.log("\n" + ln("="));
  console.log(`  ${title}`);
  console.log(ln("="));
}

// ====================================================================
// 1. Overall Counts by Platform
// ====================================================================
async function auditOverallCounts(): Promise<Map<string, number>> {
  section("1. OVERALL COUNTS BY PLATFORM");

  const rows = await sql`
    SELECT platform, count(*)::int as cnt
    FROM influencers
    GROUP BY platform
    ORDER BY cnt DESC
  `;

  const total = rows.reduce((s, r) => s + r.cnt, 0);
  const platformCounts = new Map<string, number>();

  console.log(`\n  ${pad("Platform", 18)} ${padL("Count", 10)} ${padL("Share", 8)}`);
  console.log(`  ${ln("-", 36)}`);
  for (const r of rows) {
    const p = r.platform || "(null)";
    platformCounts.set(p, r.cnt);
    console.log(`  ${pad(p, 18)} ${padL(r.cnt.toLocaleString(), 10)} ${padL(pct(r.cnt, total), 8)}`);
  }
  console.log(`  ${ln("-", 36)}`);
  console.log(`  ${pad("TOTAL", 18)} ${padL(total.toLocaleString(), 10)} ${padL("100%", 8)}`);

  return platformCounts;
}

// ====================================================================
// 2. Per-Platform Field Completeness
// ====================================================================
async function auditFieldCompleteness(platformCounts: Map<string, number>): Promise<Map<string, Map<string, number>>> {
  section("2. PER-PLATFORM FIELD COMPLETENESS");

  const completenessMap = new Map<string, Map<string, number>>();

  // Single query to get all field counts per platform
  const rows = await sql`
    SELECT
      platform,
      count(*)::int as total,
      count(CASE WHEN username IS NOT NULL AND username != '' THEN 1 END)::int as has_username,
      count(CASE WHEN display_name IS NOT NULL AND display_name != '' THEN 1 END)::int as has_display_name,
      count(CASE WHEN profile_url IS NOT NULL AND profile_url != '' THEN 1 END)::int as has_profile_url,
      count(CASE WHEN profile_image_url IS NOT NULL AND profile_image_url != '' THEN 1 END)::int as has_profile_image_url,
      count(CASE WHEN follower_count IS NOT NULL AND follower_count > 0 THEN 1 END)::int as has_follower_count,
      count(CASE WHEN following_count IS NOT NULL THEN 1 END)::int as has_following_count,
      count(CASE WHEN post_count IS NOT NULL THEN 1 END)::int as has_post_count,
      count(CASE WHEN bio IS NOT NULL AND bio != '' THEN 1 END)::int as has_bio,
      count(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END)::int as has_email,
      count(CASE WHEN engagement_rate IS NOT NULL AND engagement_rate > 0 THEN 1 END)::int as has_engagement_rate,
      count(CASE WHEN country IS NOT NULL AND country != '' THEN 1 END)::int as has_country,
      count(CASE WHEN language IS NOT NULL AND language != '' THEN 1 END)::int as has_language,
      count(CASE WHEN category IS NOT NULL AND category != '' THEN 1 END)::int as has_category,
      count(CASE WHEN external_url IS NOT NULL AND external_url != '' THEN 1 END)::int as has_external_url,
      count(CASE WHEN raw_data IS NOT NULL THEN 1 END)::int as has_raw_data,
      count(CASE WHEN platform_id IS NOT NULL AND platform_id != '' THEN 1 END)::int as has_platform_id
    FROM influencers
    GROUP BY platform
    ORDER BY count(*) DESC
  `;

  const fields = [
    "username", "display_name", "profile_url", "profile_image_url",
    "follower_count", "following_count", "post_count", "bio",
    "email", "engagement_rate", "country", "language",
    "category", "external_url", "raw_data", "platform_id"
  ];

  for (const r of rows) {
    const platform = r.platform || "(null)";
    const total = r.total;
    if (platform === "(null)") continue;

    console.log(`\n  --- ${platform.toUpperCase()} (${total.toLocaleString()}) ---`);
    console.log(`  ${pad("Field", 22)} ${padL("Has Data", 10)} ${padL("Missing", 10)} ${padL("Complete%", 10)}`);
    console.log(`  ${ln("-", 52)}`);

    const fieldMap = new Map<string, number>();

    for (const field of fields) {
      const has = r[`has_${field}`] as number;
      fieldMap.set(field, has);
      const missing = total - has;
      const icon = has / total >= 0.9 ? "  " : has / total >= 0.5 ? "* " : "!!";
      console.log(
        `  ${icon}${pad(field, 20)} ${padL(has.toLocaleString(), 10)} ${padL(missing.toLocaleString(), 10)} ${padL(pct(has, total), 10)}`
      );
    }

    completenessMap.set(platform, fieldMap);
  }

  return completenessMap;
}

// ====================================================================
// 3. Empty Shell Influencers
// ====================================================================
async function auditEmptyShells(): Promise<number> {
  section("3. EMPTY SHELL INFLUENCERS (no follower_count, bio, profile_image_url, email)");

  const rows = await sql`
    SELECT platform, import_source, count(*)::int as cnt
    FROM influencers
    WHERE follower_count IS NULL
      AND bio IS NULL
      AND profile_image_url IS NULL
      AND email IS NULL
    GROUP BY platform, import_source
    ORDER BY cnt DESC
  `;

  const totalShells = rows.reduce((s, r) => s + r.cnt, 0);

  console.log(`\n  Total empty shells: ${totalShells.toLocaleString()}`);
  console.log(`\n  ${pad("Platform", 18)} ${pad("Import Source", 45)} ${padL("Count", 10)}`);
  console.log(`  ${ln("-", 73)}`);

  for (const r of rows) {
    console.log(`  ${pad(r.platform || "(null)", 18)} ${pad(r.import_source || "(null)", 45)} ${padL(r.cnt.toLocaleString(), 10)}`);
  }

  return totalShells;
}

// ====================================================================
// 4. Duplicate Check
// ====================================================================
async function auditDuplicates(): Promise<number> {
  section("4. DUPLICATE CHECK (same platform + username)");

  const dupes = await sql`
    SELECT platform, username, count(*)::int as cnt
    FROM influencers
    WHERE username IS NOT NULL
    GROUP BY platform, username
    HAVING count(*) > 1
    ORDER BY cnt DESC
    LIMIT 30
  `;

  const totalDupeGroups = await sql`
    SELECT count(*)::int as cnt FROM (
      SELECT platform, username
      FROM influencers
      WHERE username IS NOT NULL
      GROUP BY platform, username
      HAVING count(*) > 1
    ) sub
  `;

  const totalExcess = await sql`
    SELECT coalesce(sum(cnt - 1), 0)::int as excess FROM (
      SELECT platform, username, count(*)::int as cnt
      FROM influencers
      WHERE username IS NOT NULL
      GROUP BY platform, username
      HAVING count(*) > 1
    ) sub
  `;

  const groupCount = totalDupeGroups[0]?.cnt || 0;
  const excess = totalExcess[0]?.excess || 0;

  console.log(`\n  Unique duplicate groups: ${groupCount}`);
  console.log(`  Excess copies (removable): ${excess}`);

  if (dupes.length > 0) {
    console.log(`\n  Top duplicates:`);
    console.log(`  ${pad("Platform", 15)} ${pad("Username", 35)} ${padL("Copies", 8)}`);
    console.log(`  ${ln("-", 58)}`);

    for (const r of dupes) {
      console.log(`  ${pad(r.platform, 15)} ${pad(r.username, 35)} ${padL(r.cnt.toString(), 8)}`);
    }
    if (groupCount > 30) console.log(`  ... and ${groupCount - 30} more groups`);

    // By platform
    const byPlatform = await sql`
      SELECT platform, sum(cnt - 1)::int as excess FROM (
        SELECT platform, username, count(*)::int as cnt
        FROM influencers
        WHERE username IS NOT NULL
        GROUP BY platform, username
        HAVING count(*) > 1
      ) sub
      GROUP BY platform
      ORDER BY excess DESC
    `;

    console.log(`\n  Excess copies by platform:`);
    for (const r of byPlatform) {
      console.log(`    ${pad(r.platform, 18)} ${r.excess.toLocaleString()} excess`);
    }
  } else {
    console.log("  No duplicates found.");
  }

  return groupCount;
}

// ====================================================================
// 5. Zero Followers
// ====================================================================
async function auditZeroFollowers(): Promise<number> {
  section("5. SUSPICIOUS: follower_count = 0");

  const rows = await sql`
    SELECT platform, import_source, count(*)::int as cnt
    FROM influencers
    WHERE follower_count = 0
    GROUP BY platform, import_source
    ORDER BY cnt DESC
  `;

  const total = rows.reduce((s, r) => s + r.cnt, 0);
  console.log(`\n  Total with follower_count = 0: ${total.toLocaleString()}`);

  if (total > 0) {
    console.log(`\n  ${pad("Platform", 18)} ${pad("Import Source", 45)} ${padL("Count", 10)}`);
    console.log(`  ${ln("-", 73)}`);

    for (const r of rows) {
      console.log(`  ${pad(r.platform || "(null)", 18)} ${pad(r.import_source || "(null)", 45)} ${padL(r.cnt.toLocaleString(), 10)}`);
    }

    if (total <= 30) {
      const samples = await sql`
        SELECT platform, username FROM influencers WHERE follower_count = 0 LIMIT 30
      `;
      console.log(`\n  All usernames:`);
      for (const r of samples) {
        console.log(`    ${r.platform}: @${r.username}`);
      }
    }
  }

  return total;
}

// ====================================================================
// 6. Import Source Distribution
// ====================================================================
async function auditImportSources(): Promise<void> {
  section("6. IMPORT SOURCE DISTRIBUTION");

  const rows = await sql`
    SELECT import_source, platform, count(*)::int as cnt
    FROM influencers
    GROUP BY import_source, platform
    ORDER BY cnt DESC
  `;

  console.log(`\n  ${pad("Import Source", 50)} ${pad("Platform", 15)} ${padL("Count", 10)}`);
  console.log(`  ${ln("-", 75)}`);

  for (const r of rows) {
    console.log(`  ${pad(r.import_source || "(null)", 50)} ${pad(r.platform || "(null)", 15)} ${padL(r.cnt.toLocaleString(), 10)}`);
  }
}

// ====================================================================
// 7. CRM-Origin
// ====================================================================
async function auditCrmOrigin(): Promise<number> {
  section("7. CRM-ORIGIN INFLUENCERS");

  const crmTotal = await sql`
    SELECT count(*)::int as cnt FROM influencers WHERE import_source ILIKE '%crm%'
  `;

  const crmCount = crmTotal[0]?.cnt || 0;

  if (crmCount === 0) {
    console.log("\n  No CRM-origin influencers found.");
    return 0;
  }

  console.log(`\n  Total CRM-origin: ${crmCount.toLocaleString()}`);

  // Platform breakdown
  const byPlatform = await sql`
    SELECT platform, count(*)::int as cnt
    FROM influencers
    WHERE import_source ILIKE '%crm%'
    GROUP BY platform
    ORDER BY cnt DESC
  `;

  console.log(`\n  By platform:`);
  for (const r of byPlatform) {
    console.log(`    ${pad(r.platform || "(null)", 18)} ${r.cnt.toLocaleString()}`);
  }

  // Field completeness
  const crmFields = await sql`
    SELECT
      count(*)::int as total,
      count(CASE WHEN username IS NOT NULL AND username != '' THEN 1 END)::int as has_username,
      count(CASE WHEN display_name IS NOT NULL AND display_name != '' THEN 1 END)::int as has_display_name,
      count(CASE WHEN profile_url IS NOT NULL AND profile_url != '' THEN 1 END)::int as has_profile_url,
      count(CASE WHEN profile_image_url IS NOT NULL AND profile_image_url != '' THEN 1 END)::int as has_profile_image_url,
      count(CASE WHEN follower_count IS NOT NULL AND follower_count > 0 THEN 1 END)::int as has_follower_count,
      count(CASE WHEN following_count IS NOT NULL THEN 1 END)::int as has_following_count,
      count(CASE WHEN post_count IS NOT NULL THEN 1 END)::int as has_post_count,
      count(CASE WHEN bio IS NOT NULL AND bio != '' THEN 1 END)::int as has_bio,
      count(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END)::int as has_email,
      count(CASE WHEN engagement_rate IS NOT NULL AND engagement_rate > 0 THEN 1 END)::int as has_engagement_rate,
      count(CASE WHEN country IS NOT NULL AND country != '' THEN 1 END)::int as has_country,
      count(CASE WHEN language IS NOT NULL AND language != '' THEN 1 END)::int as has_language,
      count(CASE WHEN category IS NOT NULL AND category != '' THEN 1 END)::int as has_category,
      count(CASE WHEN external_url IS NOT NULL AND external_url != '' THEN 1 END)::int as has_external_url,
      count(CASE WHEN raw_data IS NOT NULL THEN 1 END)::int as has_raw_data,
      count(CASE WHEN platform_id IS NOT NULL AND platform_id != '' THEN 1 END)::int as has_platform_id
    FROM influencers
    WHERE import_source ILIKE '%crm%'
  `;

  const r = crmFields[0];
  const fields = [
    "username", "display_name", "profile_url", "profile_image_url",
    "follower_count", "following_count", "post_count", "bio",
    "email", "engagement_rate", "country", "language",
    "category", "external_url", "raw_data", "platform_id"
  ];

  console.log(`\n  CRM Data Completeness:`);
  console.log(`  ${pad("Field", 22)} ${padL("Has Data", 10)} ${padL("Missing", 10)} ${padL("Complete%", 10)}`);
  console.log(`  ${ln("-", 52)}`);

  for (const field of fields) {
    const has = r[`has_${field}`] as number;
    const missing = crmCount - has;
    const icon = has / crmCount >= 0.9 ? "  " : has / crmCount >= 0.5 ? "* " : "!!";
    console.log(
      `  ${icon}${pad(field, 20)} ${padL(has.toLocaleString(), 10)} ${padL(missing.toLocaleString(), 10)} ${padL(pct(has, crmCount), 10)}`
    );
  }

  return crmCount;
}

// ====================================================================
// 8. Profile URL Consistency
// ====================================================================
async function auditProfileUrls(): Promise<void> {
  section("8. PROFILE URL CONSISTENCY CHECK");

  const expectedPatterns: Record<string, RegExp> = {
    instagram: /^https?:\/\/(www\.)?instagram\.com\//i,
    tiktok: /^https?:\/\/(www\.)?tiktok\.com\/@/i,
    youtube: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i,
    twitter: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i,
    xiaohongshu: /^https?:\/\/(www\.)?xiaohongshu\.com\//i,
    threads: /^https?:\/\/(www\.)?threads\.net\//i,
    facebook: /^https?:\/\/(www\.)?facebook\.com\//i,
  };

  for (const [platform, pattern] of Object.entries(expectedPatterns)) {
    // Count total and missing profile_url
    const stats = await sql`
      SELECT
        count(*)::int as total,
        count(CASE WHEN profile_url IS NULL OR profile_url = '' THEN 1 END)::int as no_url
      FROM influencers
      WHERE platform = ${platform}
    `;

    const total = stats[0]?.total || 0;
    if (total === 0) continue;
    const noUrl = stats[0]?.no_url || 0;

    // Get sample of URLs to check format (limit to 2000 for efficiency)
    const urls = await sql`
      SELECT username, profile_url
      FROM influencers
      WHERE platform = ${platform}
        AND profile_url IS NOT NULL
        AND profile_url != ''
      LIMIT 5000
    `;

    const wrongFormat = urls.filter((r: any) => !pattern.test(r.profile_url));

    console.log(`\n  --- ${platform.toUpperCase()} (${total.toLocaleString()} total) ---`);
    console.log(`    Missing profile_url:  ${noUrl.toLocaleString()} (${pct(noUrl, total)})`);
    console.log(`    Wrong URL format:     ${wrongFormat.length.toLocaleString()} (${pct(wrongFormat.length, total)})`);

    if (wrongFormat.length > 0) {
      console.log(`    Samples of wrong format (up to 10):`);
      for (const r of wrongFormat.slice(0, 10)) {
        console.log(`      @${r.username} -> ${r.profile_url}`);
      }
    }
  }
}

// ====================================================================
// 9. Additional: Created date distribution
// ====================================================================
async function auditCreatedDateDistribution(): Promise<void> {
  section("9. CREATION DATE DISTRIBUTION (last 30 days)");

  const rows = await sql`
    SELECT
      date_trunc('day', created_at)::date as day,
      count(*)::int as cnt
    FROM influencers
    WHERE created_at >= now() - interval '30 days'
    GROUP BY day
    ORDER BY day DESC
  `;

  if (rows.length === 0) {
    console.log("\n  No influencers created in the last 30 days.");
    return;
  }

  console.log(`\n  ${pad("Date", 15)} ${padL("Added", 10)}`);
  console.log(`  ${ln("-", 25)}`);

  for (const r of rows) {
    const dateStr = r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day);
    console.log(`  ${pad(dateStr, 15)} ${padL(r.cnt.toLocaleString(), 10)}`);
  }
}

// ====================================================================
// SUMMARY
// ====================================================================
function printSummary(
  platformCounts: Map<string, number>,
  completenessMap: Map<string, Map<string, number>>,
  emptyShellCount: number,
  dupeGroupCount: number,
  zeroFollowerCount: number,
  crmCount: number
): void {
  section("SUMMARY & RECOMMENDATIONS");

  const totalInfluencers = [...platformCounts.values()].reduce((a, b) => a + b, 0);

  console.log(`\n  TOTAL INFLUENCERS: ${totalInfluencers.toLocaleString()}`);
  console.log(`  EMPTY SHELLS:     ${emptyShellCount.toLocaleString()} (${pct(emptyShellCount, totalInfluencers)})`);
  console.log(`  DUPLICATE GROUPS: ${dupeGroupCount.toLocaleString()}`);
  console.log(`  ZERO FOLLOWERS:   ${zeroFollowerCount.toLocaleString()}`);
  console.log(`  CRM-ORIGIN:       ${crmCount.toLocaleString()}`);

  // Needs enrichment
  console.log(`\n  NEEDS ENRICHMENT BY PLATFORM (missing follower_count OR bio):`);
  console.log(`  ${pad("Platform", 18)} ${padL("Total", 10)} ${padL("Needs Enrich", 14)} ${padL("Pct", 8)}`);
  console.log(`  ${ln("-", 50)}`);

  let totalNeedsEnrich = 0;
  for (const [platform, fieldMap] of [...completenessMap.entries()].sort((a, b) => (platformCounts.get(b[0]) || 0) - (platformCounts.get(a[0]) || 0))) {
    const total = platformCounts.get(platform) || 0;
    const hasFollower = fieldMap.get("follower_count") || 0;
    const hasBio = fieldMap.get("bio") || 0;
    const enriched = Math.min(hasFollower, hasBio);
    const needsEnrich = total - enriched;
    totalNeedsEnrich += needsEnrich;
    console.log(
      `  ${pad(platform, 18)} ${padL(total.toLocaleString(), 10)} ${padL(needsEnrich.toLocaleString(), 14)} ${padL(pct(needsEnrich, total), 8)}`
    );
  }
  console.log(`  ${ln("-", 50)}`);
  console.log(
    `  ${pad("TOTAL", 18)} ${padL(totalInfluencers.toLocaleString(), 10)} ${padL(totalNeedsEnrich.toLocaleString(), 14)} ${padL(pct(totalNeedsEnrich, totalInfluencers), 8)}`
  );

  // Heatmap
  console.log(`\n  COMPLETENESS HEATMAP (% with data):`);
  const platformList = [...completenessMap.keys()].sort((a, b) => (platformCounts.get(b) || 0) - (platformCounts.get(a) || 0));

  const fields = [
    "username", "display_name", "profile_url", "profile_image_url",
    "follower_count", "following_count", "post_count", "bio",
    "email", "engagement_rate", "country", "language",
    "category", "external_url", "raw_data", "platform_id"
  ];

  let header = `  ${pad("Field", 22)}`;
  for (const p of platformList) header += padL(p.slice(0, 12), 13);
  console.log(header);
  console.log(`  ${ln("-", 22 + platformList.length * 13)}`);

  for (const field of fields) {
    let row = `  ${pad(field, 22)}`;
    for (const platform of platformList) {
      const total = platformCounts.get(platform) || 0;
      const has = completenessMap.get(platform)?.get(field) || 0;
      row += padL(total > 0 ? pct(has, total) : "N/A", 13);
    }
    console.log(row);
  }

  // Recommendations
  console.log(`\n  ${ln("-", 80)}`);
  console.log(`  RECOMMENDATIONS:`);
  console.log(`  ${ln("-", 80)}`);

  const recs: string[] = [];
  let n = 1;

  if (emptyShellCount > 0) {
    recs.push(`${n++}. ENRICH ${emptyShellCount.toLocaleString()} empty shell influencers (no follower_count, bio, image, email). Run profile enrichment or remove them.`);
  }
  if (dupeGroupCount > 0) {
    recs.push(`${n++}. DEDUPLICATE ${dupeGroupCount} duplicate groups. Merge data and remove extras.`);
  }
  if (zeroFollowerCount > 0) {
    recs.push(`${n++}. INVESTIGATE ${zeroFollowerCount.toLocaleString()} with follower_count=0. May be private/deleted or data errors.`);
  }
  if (crmCount > 0) {
    recs.push(`${n++}. REVIEW ${crmCount.toLocaleString()} CRM-origin influencers. Verify migration and enrichment status.`);
  }

  for (const [platform, fieldMap] of completenessMap) {
    const total = platformCounts.get(platform) || 0;
    if (total <= 100) continue;
    const hasEmail = fieldMap.get("email") || 0;
    if (hasEmail / total < 0.1) {
      recs.push(`${n++}. EMAIL GAP [${platform}]: only ${pct(hasEmail, total)} have emails (${(total - hasEmail).toLocaleString()} missing).`);
    }
  }

  for (const [platform, fieldMap] of completenessMap) {
    const total = platformCounts.get(platform) || 0;
    if (total <= 100) continue;
    const hasRaw = fieldMap.get("raw_data") || 0;
    if (hasRaw / total < 0.5) {
      recs.push(`${n++}. RAW DATA MISSING [${platform}]: ${pct(total - hasRaw, total)} lack raw_data. Limits re-enrichment.`);
    }
  }

  for (const [platform, fieldMap] of completenessMap) {
    const total = platformCounts.get(platform) || 0;
    if (total <= 100) continue;
    const hasPid = fieldMap.get("platform_id") || 0;
    if (hasPid / total < 0.5) {
      recs.push(`${n++}. PLATFORM_ID MISSING [${platform}]: ${pct(total - hasPid, total)} lack platform_id. May cause dedup issues.`);
    }
  }

  for (const [platform, fieldMap] of completenessMap) {
    const total = platformCounts.get(platform) || 0;
    if (total <= 100) continue;
    const hasCountry = fieldMap.get("country") || 0;
    if (hasCountry / total < 0.3) {
      recs.push(`${n++}. COUNTRY MISSING [${platform}]: ${pct(total - hasCountry, total)} lack country data. Limits geographic targeting.`);
    }
  }

  for (const [platform, fieldMap] of completenessMap) {
    const total = platformCounts.get(platform) || 0;
    if (total <= 100) continue;
    const hasEngagement = fieldMap.get("engagement_rate") || 0;
    if (hasEngagement / total < 0.3) {
      recs.push(`${n++}. ENGAGEMENT RATE MISSING [${platform}]: ${pct(total - hasEngagement, total)} lack engagement_rate. Limits quality filtering.`);
    }
  }

  if (recs.length === 0) recs.push("All data looks healthy! No major issues found.");
  for (const rec of recs) console.log(`\n  ${rec}`);
}

// ====================================================================
// MAIN
// ====================================================================
async function main(): Promise<void> {
  console.log(ln("="));
  console.log("  INFLUENCER DATA COMPLETENESS AUDIT");
  console.log(`  Run at: ${new Date().toISOString()}`);
  console.log(ln("="));

  try {
    const platformCounts = await auditOverallCounts();
    const completenessMap = await auditFieldCompleteness(platformCounts);
    const emptyShellCount = await auditEmptyShells();
    const dupeGroupCount = await auditDuplicates();
    const zeroFollowerCount = await auditZeroFollowers();
    await auditImportSources();
    const crmCount = await auditCrmOrigin();
    await auditProfileUrls();
    await auditCreatedDateDistribution();
    printSummary(platformCounts, completenessMap, emptyShellCount, dupeGroupCount, zeroFollowerCount, crmCount);

    console.log(`\n${ln("=")}`);
    console.log("  AUDIT COMPLETE");
    console.log(ln("=") + "\n");
  } catch (error) {
    console.error("AUDIT FAILED:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
