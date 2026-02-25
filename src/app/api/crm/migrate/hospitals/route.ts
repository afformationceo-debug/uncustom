import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { migrateHospitals } from "@/lib/crm/migration";

export async function POST() {
  try {
    const supabase = await createClient();

    // Get current user's team
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: member } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .single();

    if (!member) return NextResponse.json({ error: "No team found" }, { status: 400 });

    const result = await migrateHospitals(supabase, member.team_id);

    return NextResponse.json({
      phase: "hospitals",
      ...result,
      total: result.created + result.skipped,
    });
  } catch (err) {
    console.error("CRM migrate hospitals error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
