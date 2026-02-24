import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FUNNEL_TO_LEGACY_STATUS } from "@/types/platform";
import type { FunnelStatus } from "@/types/platform";
import type { Tables } from "@/types/database";

// Boolean fields that auto-set timestamps
const BOOLEAN_TIMESTAMP_MAP: Record<string, string> = {
  interest_confirmed: "interest_confirmed_at",
  client_approved: "client_approved_at",
  final_confirmed: "final_confirmed_at",
  guideline_sent: "guideline_sent_at",
  crm_registered: "crm_registered_at",
  visit_completed: "visit_completed_at",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    // Get current record for audit log
    const { data: current, error: fetchError } = await supabase
      .from("campaign_influencers")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const record = current as Tables<"campaign_influencers">;

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Build update payload
    const updatePayload: Record<string, unknown> = {};
    const logs: { field_name: string; old_value: string | null; new_value: string | null; action: string }[] = [];

    for (const [key, value] of Object.entries(body)) {
      const oldVal = (record as unknown as Record<string, unknown>)[key];
      if (JSON.stringify(oldVal) === JSON.stringify(value)) continue;

      updatePayload[key] = value;

      // Auto-set timestamp for boolean toggles
      if (BOOLEAN_TIMESTAMP_MAP[key] && typeof value === "boolean") {
        const tsField = BOOLEAN_TIMESTAMP_MAP[key];
        updatePayload[tsField] = value ? new Date().toISOString() : null;
      }

      logs.push({
        field_name: key,
        old_value: oldVal != null ? String(oldVal) : null,
        new_value: value != null ? String(value) : null,
        action: key === "funnel_status" ? "status_change" : key === "notes" ? "note_added" : "field_update",
      });
    }

    // Sync funnel_status → legacy status
    if (updatePayload.funnel_status) {
      const legacyStatus = FUNNEL_TO_LEGACY_STATUS[updatePayload.funnel_status as FunnelStatus];
      if (legacyStatus) {
        updatePayload.status = legacyStatus;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ data: current });
    }

    // Update
    const { data: updated, error: updateError } = await supabase
      .from("campaign_influencers")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Insert audit logs
    if (logs.length > 0) {
      await supabase.from("funnel_activity_log").insert(
        logs.map((log) => ({
          campaign_influencer_id: id,
          campaign_id: record.campaign_id,
          influencer_id: record.influencer_id,
          ...log,
          performed_by: user?.id ?? null,
        }))
      );
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PATCH /api/manage/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
