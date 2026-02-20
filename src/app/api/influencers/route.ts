import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const platform = searchParams.get("platform");
    const minFollowers = searchParams.get("min_followers");
    const maxFollowers = searchParams.get("max_followers");
    const hasEmail = searchParams.get("has_email");
    const campaignId = searchParams.get("campaign_id");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") ?? "0");
    const limit = parseInt(searchParams.get("limit") ?? "50");

    let query = supabase.from("influencers").select("*", { count: "exact" });

    if (platform) query = query.eq("platform", platform);
    if (minFollowers) query = query.gte("follower_count", parseInt(minFollowers));
    if (maxFollowers) query = query.lte("follower_count", parseInt(maxFollowers));
    if (hasEmail === "true") query = query.not("email", "is", null);
    if (search) {
      query = query.or(
        `username.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    if (campaignId) {
      const { data: ciData } = await supabase
        .from("campaign_influencers")
        .select("influencer_id")
        .eq("campaign_id", campaignId);

      if (ciData && ciData.length > 0) {
        query = query.in("id", ciData.map((ci) => ci.influencer_id));
      } else {
        return NextResponse.json({ data: [], total: 0, page, limit });
      }
    }

    query = query
      .order("follower_count", { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    const { data, error, count } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data, total: count, page, limit });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
