import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import crypto from "crypto";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's team
    const { data: member } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaign_id");

    let query = supabase
      .from("proposals")
      .select("*")
      .eq("team_id", member.team_id)
      .order("created_at", { ascending: false });

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // For each proposal, get response count
    const proposals = (data as Tables<"proposals">[]) ?? [];
    const proposalsWithCounts = await Promise.all(
      proposals.map(async (proposal) => {
        const { count } = await supabase
          .from("proposal_responses")
          .select("*", { count: "exact", head: true })
          .eq("proposal_id", proposal.id);
        return { ...proposal, response_count: count ?? 0 };
      })
    );

    return NextResponse.json(proposalsWithCounts);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's team
    const { data: member } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const body = await request.json();

    const {
      campaign_id,
      title,
      language = "ko",
      hero_image_url,
      mission_html,
      mission_images,
      products,
      required_tags,
      rewards_html,
      collect_instagram = true,
      collect_paypal = false,
      collect_basic_info = true,
      collect_shipping = false,
      allowed_countries,
      cs_channel,
      cs_account,
      notice_html,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (!campaign_id) {
      return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
    }

    const slug = crypto.randomUUID().slice(0, 8);

    const { data, error } = await supabase
      .from("proposals")
      .insert({
        campaign_id,
        team_id: member.team_id,
        slug,
        title,
        language,
        hero_image_url: hero_image_url || null,
        mission_html: mission_html || null,
        mission_images: mission_images || null,
        products: products || [],
        required_tags: required_tags || null,
        rewards_html: rewards_html || null,
        collect_instagram,
        collect_paypal,
        collect_basic_info,
        collect_shipping,
        allowed_countries: allowed_countries || null,
        cs_channel: cs_channel || null,
        cs_account: cs_account || null,
        notice_html: notice_html || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
