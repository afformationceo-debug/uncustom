import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");
    const platform = searchParams.get("platform");
    const industry = searchParams.get("industry");

    let query = supabase
      .from("brand_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }
    if (platform) {
      query = query.eq("platform", platform);
    }
    if (industry) {
      query = query.eq("industry", industry);
    }

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
    const {
      team_id, campaign_id, platform, username,
      brand_name, industry, sub_category, target_countries, notes,
    } = body;

    if (!team_id || !platform || !username) {
      return NextResponse.json(
        { error: "team_id, platform, and username are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("brand_accounts")
      .insert({
        team_id,
        campaign_id: campaign_id || null,
        platform,
        username: username.replace(/^@/, ""),
        brand_name: brand_name || null,
        industry: industry || null,
        sub_category: sub_category || null,
        target_countries: target_countries || [],
        notes: notes || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase.from("brand_accounts").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
