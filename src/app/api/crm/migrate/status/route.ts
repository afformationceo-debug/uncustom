import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Count migrated entities
    const { count: campaignsWithCrm } = await supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .not("crm_hospital_id", "is", null);

    const { count: influencersWithCrm } = await supabase
      .from("influencers")
      .select("*", { count: "exact", head: true })
      .not("crm_user_id", "is", null);

    const { count: ciWithCrm } = await supabase
      .from("campaign_influencers")
      .select("*", { count: "exact", head: true })
      .not("crm_reservation_id", "is", null);

    const { count: proceduresCount } = await supabase
      .from("crm_procedures")
      .select("*", { count: "exact", head: true });

    // Recent sync logs
    const { data: recentLogs } = await supabase
      .from("crm_sync_log")
      .select("*")
      .order("synced_at", { ascending: false })
      .limit(20);

    // Sync log aggregation by entity_type + action
    const { data: allLogs } = await supabase
      .from("crm_sync_log")
      .select("entity_type, action");

    const summary: Record<string, Record<string, number>> = {};
    for (const log of allLogs ?? []) {
      if (!summary[log.entity_type]) summary[log.entity_type] = {};
      summary[log.entity_type][log.action] = (summary[log.entity_type][log.action] ?? 0) + 1;
    }

    return NextResponse.json({
      migrated: {
        campaigns: campaignsWithCrm ?? 0,
        influencers: influencersWithCrm ?? 0,
        campaign_influencers: ciWithCrm ?? 0,
        procedures: proceduresCount ?? 0,
      },
      syncLogSummary: summary,
      recentLogs,
    });
  } catch (err) {
    console.error("CRM migrate status error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
