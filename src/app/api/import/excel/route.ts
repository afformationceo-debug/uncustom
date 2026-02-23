import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

// Sheet name → country code mapping
const SHEET_COUNTRY_MAP: Record<string, string> = {
  "홍콩": "HK",
  "말레이시아": "MY",
  "싱가포르": "SG",
  "대만": "TW",
  "일본": "JP",
  "영미권": "EN",
  "한국": "KR",
};

type ParsedRow = {
  username: string;
  follower_count: number | null;
  profile_url: string | null;
  country: string;
};

function parseFollowerCount(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  return isNaN(num) ? null : Math.floor(num);
}

function extractUsername(val: unknown): string | null {
  if (!val || typeof val !== "string") return null;
  // If it's a URL like https://instagram.com/username, extract username
  const urlMatch = val.match(/instagram\.com\/([^/?]+)/);
  if (urlMatch) return urlMatch[1].replace(/^@/, "");
  return val.replace(/^@/, "").trim();
}

function extractProfileUrl(linkVal: unknown, usernameVal: unknown): string | null {
  // If link column has a URL, use it
  if (linkVal && typeof linkVal === "string" && linkVal.startsWith("http")) {
    return linkVal;
  }
  // Otherwise construct from username
  const username = extractUsername(usernameVal);
  if (username) return `https://instagram.com/${username}`;
  return null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Parse Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const allRows: ParsedRow[] = [];
    const sheetStats: { sheet: string; country: string; rows: number }[] = [];

    for (const sheetName of workbook.SheetNames) {
      const country = SHEET_COUNTRY_MAP[sheetName] ?? sheetName.toUpperCase().slice(0, 2);
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      let sheetRowCount = 0;
      for (const row of jsonData) {
        // Try common column names for username
        const usernameRaw = row["아이디"] ?? row["username"] ?? row["Username"] ?? row["ID"];
        const username = extractUsername(usernameRaw);
        if (!username) continue;

        // Try common column names for follower count
        const followerRaw = row["총 팔로워 수"] ?? row["팔로워"] ?? row["followers"] ?? row["follower_count"];
        const follower_count = parseFollowerCount(followerRaw);

        // Try common column names for profile URL
        const linkRaw = row["링크 이동"] ?? row["링크"] ?? row["link"] ?? row["profile_url"] ?? row["URL"];
        const profile_url = extractProfileUrl(linkRaw, usernameRaw);

        allRows.push({ username, follower_count, profile_url, country });
        sheetRowCount++;
      }

      sheetStats.push({ sheet: sheetName, country, rows: sheetRowCount });
    }

    // Deduplicate by username (keep highest follower_count)
    const usernameMap = new Map<string, ParsedRow>();
    for (const row of allRows) {
      const key = row.username.toLowerCase();
      const existing = usernameMap.get(key);
      if (!existing || (row.follower_count ?? 0) > (existing.follower_count ?? 0)) {
        usernameMap.set(key, row);
      }
    }
    const uniqueRows = Array.from(usernameMap.values());

    // Batch upsert in chunks of 500
    const BATCH_SIZE = 500;
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
      const batch = uniqueRows.slice(i, i + BATCH_SIZE);
      const upsertRows = batch.map((row) => ({
        platform: "instagram" as const,
        platform_id: row.username, // Will be updated by Profile Scraper with real numeric ID
        username: row.username,
        profile_url: row.profile_url,
        follower_count: row.follower_count,
        country: row.country,
        import_source: `excel:${row.country}`,
      }));

      const { data, error } = await supabase
        .from("influencers")
        .upsert(upsertRows, {
          onConflict: "platform,platform_id",
          ignoreDuplicates: false,
        })
        .select("id");

      if (error) {
        console.error(`[import/excel] Batch ${i / BATCH_SIZE + 1} error:`, error.message);
        errors += batch.length;
      } else {
        inserted += data?.length ?? 0;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        total_parsed: allRows.length,
        duplicates_removed: allRows.length - uniqueRows.length,
        unique_rows: uniqueRows.length,
        upserted: inserted,
        errors,
        sheets: sheetStats,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[import/excel] Error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
