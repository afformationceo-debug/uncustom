import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncStatusToCrm } from "@/lib/crm/register";

type SyncField = "visit_completed" | "upload_url" | "influencer_payment_status" | "client_payment_status" | "guideline_sent" | "notes" | "crm_procedure" | "interpreter_needed";

const ALLOWED_FIELDS: SyncField[] = [
  "visit_completed",
  "upload_url",
  "influencer_payment_status",
  "client_payment_status",
  "guideline_sent",
  "notes",
  "crm_procedure",
  "interpreter_needed",
];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { campaign_influencer_id, field, value } = await request.json();

    if (!campaign_influencer_id || !field) {
      return NextResponse.json(
        { error: "campaign_influencer_id and field required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_FIELDS.includes(field)) {
      return NextResponse.json(
        { error: `field must be one of: ${ALLOWED_FIELDS.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await syncStatusToCrm(supabase, campaign_influencer_id, field, value);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("CRM sync error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
