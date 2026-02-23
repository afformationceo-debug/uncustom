import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");
    const global = searchParams.get("global");

    let query = supabase
      .from("keywords")
      .select("*")
      .order("created_at", { ascending: false });

    if (global === "true") {
      query = query.is("campaign_id", null);
    } else if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Support bulk insert
    if (Array.isArray(body)) {
      const rows = body.map((item) => ({
        campaign_id: item.campaign_id ?? null,
        keyword: item.keyword,
        platform: item.platform ?? "all",
        target_country: item.target_country ?? "ALL",
        country: item.country ?? null,
      }));

      const { data, error } = await supabase
        .from("keywords")
        .insert(rows)
        .select();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json(data, { status: 201 });
    }

    // Single insert
    const { campaign_id, keyword, platform, target_country, country } = body;

    if (!keyword) {
      return NextResponse.json({ error: "keyword is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("keywords")
      .insert({
        campaign_id: campaign_id ?? null,
        keyword,
        platform: platform ?? "all",
        target_country: target_country ?? "ALL",
        country: country ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
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

    const { error } = await supabase.from("keywords").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
