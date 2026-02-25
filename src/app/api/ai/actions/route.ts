import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
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

    const { data, error } = await supabase
      .from("ai_actions")
      .select("*")
      .eq("team_id", member.team_id)
      .in("status", ["pending"])
      .order("created_at", { ascending: false })
      .limit(20);

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

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action_id, status } = body;

    if (!action_id || !["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid action_id or status" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("ai_actions")
      .update({
        status,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", action_id)
      .select()
      .single();

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
