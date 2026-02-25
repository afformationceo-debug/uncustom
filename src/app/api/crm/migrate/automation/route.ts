import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { migrateAutomationData } from "@/lib/crm/migration";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: member } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .single();

    if (!member) return NextResponse.json({ error: "No team found" }, { status: 400 });

    const { defaultCampaignId } = await request.json().catch(() => ({ defaultCampaignId: null }));

    if (!defaultCampaignId) {
      return NextResponse.json(
        { error: "defaultCampaignId required — pick a campaign for DM accounts/templates" },
        { status: 400 }
      );
    }

    const result = await migrateAutomationData(supabase, member.team_id, defaultCampaignId);

    return NextResponse.json({ phase: "automation", ...result });
  } catch (err) {
    console.error("CRM migrate automation error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
