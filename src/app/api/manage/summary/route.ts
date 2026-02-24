import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");

    // Get all campaign_influencers (optionally filtered by campaign)
    let query = supabase
      .from("campaign_influencers")
      .select("funnel_status, payment_amount, payment_currency, invoice_amount, invoice_currency, influencer_payment_status, influencer_paid_amount, client_payment_status, client_paid_amount, reply_date, last_outreach_at, client_approved, visit_scheduled_date, visit_completed, upload_deadline, actual_upload_date, upload_url");

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    const { data: items, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const all = items ?? [];
    const now = new Date();

    // Status counts
    const statusCounts: Record<string, number> = {};
    for (const item of all) {
      statusCounts[item.funnel_status] = (statusCounts[item.funnel_status] ?? 0) + 1;
    }

    // Financial summary (KRW only for simplicity, could extend)
    let totalPayment = 0;
    let totalInvoice = 0;
    let paidToInfluencers = 0;
    let receivedFromClients = 0;

    for (const item of all) {
      if (item.payment_amount) totalPayment += Number(item.payment_amount);
      if (item.invoice_amount) totalInvoice += Number(item.invoice_amount);
      if (item.influencer_paid_amount) paidToInfluencers += Number(item.influencer_paid_amount);
      if (item.client_paid_amount) receivedFromClients += Number(item.client_paid_amount);
    }

    // Bottlenecks
    let noReply = 0;
    let awaitingClient = 0;
    let overdueVisit = 0;
    let overdueUpload = 0;

    for (const item of all) {
      // Contacted but no reply
      if (item.funnel_status === "contacted" && item.last_outreach_at && !item.reply_date) {
        noReply++;
      }
      // Interested but not client approved
      if (item.funnel_status === "interested" && !item.client_approved) {
        awaitingClient++;
      }
      // Overdue visit
      if (item.visit_scheduled_date && !item.visit_completed && new Date(item.visit_scheduled_date) < now) {
        overdueVisit++;
      }
      // Overdue upload
      if (item.upload_deadline && !item.upload_url && new Date(item.upload_deadline) < now) {
        overdueUpload++;
      }
    }

    return NextResponse.json({
      statusCounts,
      total: all.length,
      financials: {
        totalPayment,
        totalInvoice,
        paidToInfluencers,
        receivedFromClients,
      },
      bottlenecks: {
        noReply,
        awaitingClient,
        overdueVisit,
        overdueUpload,
      },
    });
  } catch (err) {
    console.error("GET /api/manage/summary error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
