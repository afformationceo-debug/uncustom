import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerToCrm } from "@/lib/crm/register";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { campaign_influencer_id } = body;

    if (!campaign_influencer_id) {
      return NextResponse.json({ error: "campaign_influencer_id required" }, { status: 400 });
    }

    // Pre-save additional CRM fields to campaign_influencers before registration
    const ciFields: Record<string, unknown> = {};
    if (body.crm_procedure !== undefined) ciFields.crm_procedure = body.crm_procedure;
    if (body.crm_requested_procedure !== undefined) ciFields.crm_requested_procedure = body.crm_requested_procedure;
    if (body.visit_scheduled_date !== undefined) ciFields.visit_scheduled_date = body.visit_scheduled_date;
    if (body.interpreter_needed !== undefined) ciFields.interpreter_needed = body.interpreter_needed;
    if (body.interpreter_name !== undefined) ciFields.interpreter_name = body.interpreter_name;
    if (body.notes !== undefined) ciFields.notes = body.notes;

    if (Object.keys(ciFields).length > 0) {
      await supabase
        .from("campaign_influencers")
        .update(ciFields)
        .eq("id", campaign_influencer_id);
    }

    const result = await registerToCrm(supabase, campaign_influencer_id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      crm_reservation_id: result.crmReservationId,
    });
  } catch (err) {
    console.error("CRM register error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
