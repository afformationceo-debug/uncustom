import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
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

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from("ai_token_usage")
      .select("input_tokens, output_tokens, cost_usd, created_at")
      .eq("team_id", member.team_id)
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    const totals = (data || []).reduce(
      (acc, row) => ({
        input_tokens: acc.input_tokens + row.input_tokens,
        output_tokens: acc.output_tokens + row.output_tokens,
        cost_usd: acc.cost_usd + Number(row.cost_usd),
        requests: acc.requests + 1,
      }),
      { input_tokens: 0, output_tokens: 0, cost_usd: 0, requests: 0 }
    );

    return NextResponse.json({ ...totals, period: "30d" });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
