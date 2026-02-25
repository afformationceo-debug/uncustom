import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const influencerId = searchParams.get("influencer_id");
    const sortBy = searchParams.get("sort_by") || "total_revenue";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    let query = supabase
      .from("influencer_commerce")
      .select(
        "*, influencers(username, display_name, platform, profile_image_url, follower_count)"
      );

    if (influencerId) {
      query = query.eq("influencer_id", influencerId);
    }

    const validSortFields = [
      "total_revenue",
      "total_orders",
      "roas",
      "conversion_rate",
      "total_clicks",
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "total_revenue";
    query = query.order(sortField, { ascending: false, nullsFirst: false });
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { influencer_id, ...commerceData } = body;
    if (!influencer_id) {
      return NextResponse.json({ error: "influencer_id is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("influencer_commerce")
      .upsert(
        {
          influencer_id,
          ...commerceData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "influencer_id" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Also update commerce_enabled on influencer
    await supabase
      .from("influencers")
      .update({ commerce_enabled: true })
      .eq("id", influencer_id);

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
