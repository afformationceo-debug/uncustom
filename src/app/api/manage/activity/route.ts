import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const campaignInfluencerId = searchParams.get("campaign_influencer_id");
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));

    if (!campaignInfluencerId) {
      return NextResponse.json({ error: "campaign_influencer_id is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("funnel_activity_log")
      .select("*")
      .eq("campaign_influencer_id", campaignInfluencerId)
      .order("performed_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error("GET /api/manage/activity error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
