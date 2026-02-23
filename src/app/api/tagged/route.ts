import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");

    let query = supabase
      .from("tagged_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    } else {
      query = query.is("campaign_id", null);
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
    const { campaign_id, account_username, platform, target_country } = body;

    if (!account_username || !platform) {
      return NextResponse.json({ error: "account_username and platform are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("tagged_accounts")
      .insert({
        campaign_id: campaign_id || null,
        account_username,
        platform,
        target_country: target_country || "ALL",
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

    const { error } = await supabase.from("tagged_accounts").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
