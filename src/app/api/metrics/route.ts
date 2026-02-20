import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");

    if (!campaignId) {
      return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
    }

    const { data: uploads } = await supabase
      .from("multi_channel_uploads")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("status", "published");

    if (!uploads || uploads.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    const uploadIds = uploads.map((u) => u.id);

    const { data, error } = await supabase
      .from("content_metrics")
      .select("*")
      .in("upload_id", uploadIds)
      .order("tracked_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { campaign_id } = body;

    if (!campaign_id) {
      return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
    }

    // TODO: Implement actual metrics fetching via Apify Social Insight Scraper
    // For now, return success
    return NextResponse.json({ success: true, message: "Metrics refresh initiated" });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
