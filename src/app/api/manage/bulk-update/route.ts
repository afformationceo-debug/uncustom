import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FUNNEL_TO_LEGACY_STATUS } from "@/types/platform";
import type { FunnelStatus } from "@/types/platform";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { ids, updates } = body as {
      ids: string[];
      updates: Record<string, unknown>;
    };

    if (!ids?.length || !updates || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "ids and updates are required" }, { status: 400 });
    }

    if (ids.length > 500) {
      return NextResponse.json({ error: "Maximum 500 items per bulk update" }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Build update payload
    const updatePayload: Record<string, unknown> = { ...updates };

    // Sync funnel_status → legacy status
    if (updatePayload.funnel_status) {
      const legacyStatus = FUNNEL_TO_LEGACY_STATUS[updatePayload.funnel_status as FunnelStatus];
      if (legacyStatus) {
        updatePayload.status = legacyStatus;
      }
    }

    // Boolean timestamp auto-set
    const boolTsMap: Record<string, string> = {
      interest_confirmed: "interest_confirmed_at",
      client_approved: "client_approved_at",
      final_confirmed: "final_confirmed_at",
      guideline_sent: "guideline_sent_at",
      crm_registered: "crm_registered_at",
      visit_completed: "visit_completed_at",
    };
    for (const [boolField, tsField] of Object.entries(boolTsMap)) {
      if (typeof updatePayload[boolField] === "boolean") {
        updatePayload[tsField] = updatePayload[boolField] ? new Date().toISOString() : null;
      }
    }

    const { error } = await supabase
      .from("campaign_influencers")
      .update(updatePayload)
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Insert audit logs for bulk action
    // Get campaign_id from first record
    const { data: firstRecord } = await supabase
      .from("campaign_influencers")
      .select("campaign_id, influencer_id")
      .in("id", ids)
      .limit(1)
      .single();

    if (firstRecord) {
      const logEntries = Object.entries(updates).flatMap(([key, value]) =>
        ids.map((ciId) => ({
          campaign_influencer_id: ciId,
          campaign_id: firstRecord.campaign_id,
          influencer_id: null as string | null,
          action: "bulk_update",
          field_name: key,
          old_value: null as string | null,
          new_value: value != null ? String(value) : null,
          performed_by: user?.id ?? null,
        }))
      );

      // Insert in batches of 500
      for (let i = 0; i < logEntries.length; i += 500) {
        await supabase.from("funnel_activity_log").insert(logEntries.slice(i, i + 500));
      }
    }

    return NextResponse.json({ success: true, updated: ids.length });
  } catch (err) {
    console.error("POST /api/manage/bulk-update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
