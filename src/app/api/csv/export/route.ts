import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSchemaForPlatform } from "@/lib/csv/platform-schemas";

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") ?? "all";
    const search = searchParams.get("search") ?? "";
    const emailFilter = searchParams.get("email") ?? "all";
    const country = searchParams.get("country") ?? "";
    const verified = searchParams.get("verified") ?? "all";
    const followerMin = searchParams.get("follower_min") ?? "";
    const followerMax = searchParams.get("follower_max") ?? "";

    const supabase = await createClient();

    let query = supabase.from("influencers").select("*");

    if (platform !== "all") query = query.eq("platform", platform);
    if (search) {
      query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (emailFilter === "with") query = query.not("email", "is", null);
    else if (emailFilter === "without") query = query.is("email", null);
    if (country) query = query.ilike("country", `%${country}%`);
    if (verified === "yes") query = query.eq("is_verified", true);
    else if (verified === "no") query = query.eq("is_verified", false);
    if (followerMin) query = query.gte("follower_count", parseInt(followerMin));
    if (followerMax) query = query.lte("follower_count", parseInt(followerMax));

    query = query.order("follower_count", { ascending: false, nullsFirst: false }).limit(10000);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const influencers = (data ?? []) as Record<string, unknown>[];
    const schema = getSchemaForPlatform(platform);

    // Build CSV
    const BOM = "\uFEFF";
    const koreanRow = schema.map((col) => escapeCsvField(col.koreanLabel)).join(",");
    const dbRow = schema.map((col) => col.dbColumn).join(",");

    const dataRows = influencers.map((inf) =>
      schema.map((col) => escapeCsvField(inf[col.dbColumn])).join(",")
    );

    const csvContent = BOM + koreanRow + "\n" + dbRow + "\n" + dataRows.join("\n") + "\n";

    const filename = `influencers_${platform}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[csv/export] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
