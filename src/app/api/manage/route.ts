import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const campaignId = searchParams.get("campaign_id");

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
    const sortBy = searchParams.get("sort_by") ?? "created_at";
    const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

    // Filters
    const funnelStatus = searchParams.get("funnel_status");
    const platform = searchParams.get("platform");
    const interestConfirmed = searchParams.get("interest_confirmed");
    const clientApproved = searchParams.get("client_approved");
    const finalConfirmed = searchParams.get("final_confirmed");
    const visitCompleted = searchParams.get("visit_completed");
    const guidelineSent = searchParams.get("guideline_sent");
    const crmRegistered = searchParams.get("crm_registered");
    const influencerPaymentStatus = searchParams.get("influencer_payment_status");
    const clientPaymentStatus = searchParams.get("client_payment_status");
    const hasEmail = searchParams.get("has_email");
    const hasUploadUrl = searchParams.get("has_upload_url");
    const search = searchParams.get("search");
    const visitDateFrom = searchParams.get("visit_date_from");
    const visitDateTo = searchParams.get("visit_date_to");
    const uploadDeadlineFrom = searchParams.get("upload_deadline_from");
    const uploadDeadlineTo = searchParams.get("upload_deadline_to");

    // Build query with join — include campaign name for all-campaigns mode
    // Use explicit FK hint because campaign_influencers has two FKs to campaigns (campaign_id + second_funnel_campaign_id)
    let query = supabase
      .from("campaign_influencers")
      .select(
        `*,
        influencer:influencers!inner(id, username, display_name, email, platform, follower_count, profile_image_url, profile_url),
        campaign:campaigns!campaign_id(id, name, campaign_type)`,
        { count: "exact" }
      );

    // Filter by campaign if specified
    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    // Funnel status filter (comma-separated)
    if (funnelStatus) {
      const statuses = funnelStatus.split(",").filter(Boolean);
      if (statuses.length === 1) {
        query = query.eq("funnel_status", statuses[0]);
      } else if (statuses.length > 1) {
        query = query.in("funnel_status", statuses);
      }
    }

    // Platform filter (on joined influencers)
    if (platform) {
      const platforms = platform.split(",").filter(Boolean);
      if (platforms.length === 1) {
        query = query.eq("influencer.platform", platforms[0]);
      } else if (platforms.length > 1) {
        query = query.in("influencer.platform", platforms);
      }
    }

    // Boolean filters
    if (interestConfirmed === "true") query = query.eq("interest_confirmed", true);
    if (interestConfirmed === "false") query = query.eq("interest_confirmed", false);
    if (clientApproved === "true") query = query.eq("client_approved", true);
    if (clientApproved === "false") query = query.eq("client_approved", false);
    if (finalConfirmed === "true") query = query.eq("final_confirmed", true);
    if (finalConfirmed === "false") query = query.eq("final_confirmed", false);
    if (visitCompleted === "true") query = query.eq("visit_completed", true);
    if (visitCompleted === "false") query = query.eq("visit_completed", false);
    if (guidelineSent === "true") query = query.eq("guideline_sent", true);
    if (guidelineSent === "false") query = query.eq("guideline_sent", false);
    if (crmRegistered === "true") query = query.eq("crm_registered", true);
    if (crmRegistered === "false") query = query.eq("crm_registered", false);

    // Payment status filters
    if (influencerPaymentStatus) {
      const statuses = influencerPaymentStatus.split(",").filter(Boolean);
      if (statuses.length === 1) {
        query = query.eq("influencer_payment_status", statuses[0]);
      } else if (statuses.length > 1) {
        query = query.in("influencer_payment_status", statuses);
      }
    }
    if (clientPaymentStatus) {
      const statuses = clientPaymentStatus.split(",").filter(Boolean);
      if (statuses.length === 1) {
        query = query.eq("client_payment_status", statuses[0]);
      } else if (statuses.length > 1) {
        query = query.in("client_payment_status", statuses);
      }
    }

    // Has email / upload URL
    if (hasEmail === "true") query = query.not("influencer.email", "is", null);
    if (hasUploadUrl === "true") query = query.not("upload_url", "is", null);
    if (hasUploadUrl === "false") query = query.is("upload_url", null);

    // Date range filters
    if (visitDateFrom) query = query.gte("visit_scheduled_date", visitDateFrom);
    if (visitDateTo) query = query.lte("visit_scheduled_date", visitDateTo);
    if (uploadDeadlineFrom) query = query.gte("upload_deadline", uploadDeadlineFrom);
    if (uploadDeadlineTo) query = query.lte("upload_deadline", uploadDeadlineTo);

    // Text search (name/username/email)
    if (search) {
      query = query.or(
        `influencer.username.ilike.%${search}%,influencer.display_name.ilike.%${search}%,influencer.email.ilike.%${search}%`
      );
    }

    // Sort & paginate
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Sort by campaign_influencers fields directly
    const ciFields = [
      "funnel_status", "created_at", "outreach_round", "outreach_type", "last_outreach_at",
      "reply_date", "reply_channel", "interest_confirmed_at", "client_approved_at", "final_confirmed_at",
      "payment_amount", "invoice_amount", "visit_scheduled_date", "upload_deadline",
      "actual_upload_date", "influencer_payment_status", "client_payment_status",
    ];
    if (ciFields.includes(sortBy)) {
      query = query.order(sortBy, { ascending: sortOrder });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    console.error("GET /api/manage error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
