import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");
    const dateFrom = searchParams.get("date_from"); // ISO date string
    const dateTo = searchParams.get("date_to");     // ISO date string

    // Get all campaign_influencers (optionally filtered by campaign)
    let query = supabase
      .from("campaign_influencers")
      .select("funnel_status, payment_amount, payment_currency, invoice_amount, invoice_currency, influencer_payment_status, influencer_paid_amount, client_payment_status, client_paid_amount, reply_date, last_outreach_at, client_approved, visit_scheduled_date, visit_completed, upload_deadline, actual_upload_date, upload_url, created_at, campaign_id");

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    // Date range filter on created_at (when was this influencer assigned)
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      // End of day
      query = query.lte("created_at", dateTo + "T23:59:59.999Z");
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

    // Financial summary
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
      if (item.funnel_status === "contacted" && item.last_outreach_at && !item.reply_date) {
        noReply++;
      }
      if (item.funnel_status === "interested" && !item.client_approved) {
        awaitingClient++;
      }
      if (item.visit_scheduled_date && !item.visit_completed && new Date(item.visit_scheduled_date) < now) {
        overdueVisit++;
      }
      if (item.upload_deadline && !item.upload_url && new Date(item.upload_deadline) < now) {
        overdueUpload++;
      }
    }

    // Per-campaign breakdown (when viewing all campaigns)
    const campaignBreakdown: Record<string, { total: number; statusCounts: Record<string, number> }> = {};
    if (!campaignId) {
      for (const item of all) {
        const cid = item.campaign_id;
        if (!cid) continue;
        if (!campaignBreakdown[cid]) {
          campaignBreakdown[cid] = { total: 0, statusCounts: {} };
        }
        campaignBreakdown[cid].total++;
        campaignBreakdown[cid].statusCounts[item.funnel_status] =
          (campaignBreakdown[cid].statusCounts[item.funnel_status] ?? 0) + 1;
      }
    }

    // Daily counts for timeline (last 30 days or within date range)
    const dailyCounts: Record<string, Record<string, number>> = {};
    for (const item of all) {
      if (!item.created_at) continue;
      const day = item.created_at.slice(0, 10); // YYYY-MM-DD
      if (!dailyCounts[day]) dailyCounts[day] = {};
      dailyCounts[day][item.funnel_status] = (dailyCounts[day][item.funnel_status] ?? 0) + 1;
    }

    // Outreach activity: count items by last_outreach_at date
    const outreachDaily: Record<string, number> = {};
    for (const item of all) {
      if (!item.last_outreach_at) continue;
      const day = item.last_outreach_at.slice(0, 10);
      outreachDaily[day] = (outreachDaily[day] ?? 0) + 1;
    }

    // Reply activity: count items by reply_date
    const replyDaily: Record<string, number> = {};
    for (const item of all) {
      if (!item.reply_date) continue;
      const day = typeof item.reply_date === "string" ? item.reply_date.slice(0, 10) : "";
      if (day) replyDaily[day] = (replyDaily[day] ?? 0) + 1;
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
      campaignBreakdown,
      dailyCounts,
      outreachDaily,
      replyDaily,
      dateRange: { from: dateFrom, to: dateTo },
    });
  } catch (err) {
    console.error("GET /api/manage/summary error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
