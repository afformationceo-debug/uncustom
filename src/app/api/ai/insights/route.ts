import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const pageContext = searchParams.get("page_context");
    const campaignId = searchParams.get("campaign_id");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: member } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!member)
      return NextResponse.json({ error: "No team" }, { status: 403 });

    let query = supabase
      .from("ai_insights")
      .select("*")
      .eq("team_id", member.team_id)
      .eq("dismissed", false)
      .order("created_at", { ascending: false })
      .limit(10);

    if (pageContext) query = query.eq("page_context", pageContext);
    if (campaignId) query = query.eq("campaign_id", campaignId);

    const { data, error } = await query;
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
