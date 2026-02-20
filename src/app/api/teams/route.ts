import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { name, user_id } = body;

    if (!name || !user_id) {
      return NextResponse.json({ error: "name and user_id are required" }, { status: 400 });
    }

    // Create team
    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .insert({ name })
      .select()
      .single();

    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 400 });
    }

    const team = teamData as Team;

    // Add user as owner
    const { error: memberError } = await supabase
      .from("team_members")
      .insert({
        team_id: team.id,
        user_id,
        role: "owner",
      });

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 400 });
    }

    return NextResponse.json(team, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
