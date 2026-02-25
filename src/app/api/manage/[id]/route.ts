import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FUNNEL_TO_LEGACY_STATUS } from "@/types/platform";
import type { FunnelStatus } from "@/types/platform";
import type { Tables } from "@/types/database";
import { syncStatusToCrm } from "@/lib/crm/register";

// Boolean fields that auto-set timestamps
const BOOLEAN_TIMESTAMP_MAP: Record<string, string> = {
  interest_confirmed: "interest_confirmed_at",
  client_approved: "client_approved_at",
  final_confirmed: "final_confirmed_at",
  guideline_sent: "guideline_sent_at",
  crm_registered: "crm_registered_at",
  visit_completed: "visit_completed_at",
  shipping_sent: "shipping_sent_at",
  shipping_received: "shipping_received_at",
};

// Funnel status priority order (higher index = more advanced)
const FUNNEL_ORDER: FunnelStatus[] = [
  "extracted",
  "contacted",
  "interested",
  "client_approved",
  "confirmed",
  "guideline_sent",
  "crm_registered",
  "visit_scheduled",
  "visited",
  "upload_pending",
  "uploaded",
  "completed",
  "settled",
];

/**
 * Auto-calculate funnel_status based on field values.
 * Merges current record + incoming updates, then returns the highest applicable status.
 * Works bidirectionally — status can advance or regress based on current field state.
 */
function autoCalculateFunnelStatus(merged: Record<string, unknown>): FunnelStatus {
  // Check from highest to lowest — return the first (highest) match
  if (merged.influencer_payment_status === "paid" && merged.client_payment_status === "paid") return "settled";
  if (merged.upload_url) return "uploaded";
  if (merged.actual_upload_date) return "uploaded";
  if (merged.upload_deadline) return "upload_pending";
  if (merged.shipping_received === true) return "visited";
  if (merged.visit_completed === true) return "visited";
  if (merged.shipping_sent === true) return "visit_scheduled";
  if (merged.visit_scheduled_date) return "visit_scheduled";
  if (merged.crm_registered === true) return "crm_registered";
  if (merged.guideline_sent === true) return "guideline_sent";
  if (merged.final_confirmed === true) return "confirmed";
  if (merged.client_approved === true) return "client_approved";
  if (merged.interest_confirmed === true) return "interested";
  if ((merged.outreach_round as number) > 0 || merged.last_outreach_at) return "contacted";
  return "extracted";
}

function getFunnelIndex(status: FunnelStatus): number {
  const idx = FUNNEL_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

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

    // Auto-calculate funnel_status when non-status fields change
    // Skip if the user explicitly set funnel_status in this update
    const isManualStatusChange = "funnel_status" in body;
    const isTerminalStatus = record.funnel_status === "declined" || record.funnel_status === "dropped";

    if (!isManualStatusChange && !isTerminalStatus && Object.keys(updatePayload).length > 0) {
      // Merge current record with updates
      const merged = { ...(record as unknown as Record<string, unknown>), ...updatePayload };
      const calculatedStatus = autoCalculateFunnelStatus(merged);
      const currentIndex = getFunnelIndex(record.funnel_status as FunnelStatus);
      const calculatedIndex = getFunnelIndex(calculatedStatus);

      // Bidirectional: update whenever calculated status differs from current
      if (calculatedIndex !== currentIndex) {
        updatePayload.funnel_status = calculatedStatus;
        logs.push({
          field_name: "funnel_status",
          old_value: record.funnel_status,
          new_value: calculatedStatus,
          action: "status_change",
        });
      }
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

    // Update — return with joined relations so UI stays complete
    const { data: updated, error: updateError } = await supabase
      .from("campaign_influencers")
      .update(updatePayload)
      .eq("id", id)
      .select(`*,
        influencer:influencers!inner(id, username, display_name, email, platform, follower_count, profile_image_url, profile_url, real_name, birth_date, phone, gender, line_id, country, crm_user_id, default_settlement_info),
        campaign:campaigns!campaign_id(id, name, campaign_type, crm_hospital_id, crm_hospital_code)`)
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

    // CRM sync: auto-push changes to MySQL CRM for linked records
    if (record.crm_reservation_id) {
      const CRM_SYNC_FIELDS = [
        "visit_completed", "upload_url", "influencer_payment_status", "client_payment_status",
        "guideline_sent", "notes", "crm_procedure", "interpreter_needed",
      ] as const;
      for (const field of CRM_SYNC_FIELDS) {
        if (field in updatePayload) {
          syncStatusToCrm(supabase, id, field, updatePayload[field]).catch((err) =>
            console.error(`CRM sync ${field} failed:`, err)
          );
        }
      }
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PATCH /api/manage/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
