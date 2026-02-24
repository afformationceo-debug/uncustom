import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_FIELDS = new Set([
  "real_name",
  "birth_date",
  "phone",
  "email",
  "display_name",
]);

/**
 * GET /api/influencers/[id]?include=history
 * Returns influencer collaboration history across all campaigns.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const include = searchParams.get("include");

    if (include === "history") {
      // Fetch all campaign_influencers for this influencer with campaign info
      const { data: history, error } = await supabase
        .from("campaign_influencers")
        .select(`
          id,
          campaign_id,
          funnel_status,
          status,
          outreach_round,
          last_outreach_at,
          reply_channel,
          reply_date,
          interest_confirmed,
          interest_confirmed_at,
          client_approved,
          client_approved_at,
          final_confirmed,
          final_confirmed_at,
          payment_amount,
          payment_currency,
          invoice_amount,
          invoice_currency,
          guideline_sent,
          guideline_sent_at,
          crm_registered,
          visit_scheduled_date,
          visit_completed,
          visit_completed_at,
          upload_deadline,
          actual_upload_date,
          upload_url,
          influencer_payment_status,
          influencer_paid_at,
          client_payment_status,
          client_invoiced_at,
          client_paid_at,
          notes,
          created_at,
          campaign:campaigns!campaign_id(id, name, campaign_type, status, target_platforms, target_countries)
        `)
        .eq("influencer_id", id)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Fetch recent activity logs for this influencer
      const { data: activities } = await supabase
        .from("funnel_activity_log")
        .select("*")
        .eq("influencer_id", id)
        .order("performed_at", { ascending: false })
        .limit(20);

      return NextResponse.json({
        data: {
          campaigns: history ?? [],
          recentActivities: activities ?? [],
        },
      });
    }

    // Default: return basic influencer info
    const { data, error } = await supabase
      .from("influencers")
      .select("id, username, display_name, email, platform, follower_count, profile_image_url, real_name, birth_date, phone")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/influencers/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    // Only allow specific fields to be updated
    const updatePayload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        updatePayload[key] = value;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("influencers")
      .update(updatePayload)
      .eq("id", id)
      .select("id, real_name, birth_date, phone, email, display_name, username")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("PATCH /api/influencers/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
