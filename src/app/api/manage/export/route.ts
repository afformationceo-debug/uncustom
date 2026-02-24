import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FUNNEL_STATUSES, INFLUENCER_PAYMENT_STATUSES, CLIENT_PAYMENT_STATUSES } from "@/types/platform";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");

    // Fetch all records (optionally filtered by campaign)
    let query = supabase
      .from("campaign_influencers")
      .select(`
        *,
        influencer:influencers(username, display_name, email, platform, follower_count, profile_url),
        campaign:campaigns(name)
      `)
      .order("created_at", { ascending: false });

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const items = (data ?? []) as unknown as Array<{
      id: string;
      funnel_status: string;
      outreach_round: number;
      last_outreach_at: string | null;
      reply_channel: string | null;
      reply_date: string | null;
      reply_summary: string | null;
      interest_confirmed: boolean;
      client_approved: boolean;
      client_note: string | null;
      final_confirmed: boolean;
      payment_amount: number | null;
      payment_currency: string;
      invoice_amount: number | null;
      invoice_currency: string;
      guideline_url: string | null;
      guideline_sent: boolean;
      crm_registered: boolean;
      crm_note: string | null;
      visit_scheduled_date: string | null;
      visit_completed: boolean;
      upload_deadline: string | null;
      actual_upload_date: string | null;
      upload_url: string | null;
      influencer_payment_status: string;
      influencer_paid_amount: number | null;
      client_payment_status: string;
      client_paid_amount: number | null;
      notes: string | null;
      influencer: {
        username: string | null;
        display_name: string | null;
        email: string | null;
        platform: string;
        follower_count: number | null;
        profile_url: string | null;
      };
      campaign: { name: string } | null;
    }>;

    const funnelLabel = (v: string) => FUNNEL_STATUSES.find((s) => s.value === v)?.label ?? v;
    const ipLabel = (v: string) => INFLUENCER_PAYMENT_STATUSES.find((s) => s.value === v)?.label ?? v;
    const cpLabel = (v: string) => CLIENT_PAYMENT_STATUSES.find((s) => s.value === v)?.label ?? v;

    // Build CSV
    const headers = [
      "캠페인", "이름", "유저네임", "이메일", "플랫폼", "팔로워",
      "퍼널상태", "발송N차", "마지막발송", "회신채널", "회신일", "회신요약",
      "희망회신", "거래처컨펌", "거래처메모", "최종확정",
      "지급원고료", "통화", "청구원고료", "통화",
      "가이드라인URL", "가이드전달", "CRM등록", "CRM메모",
      "방문예정일", "방문완료", "업로드마감", "실제업로드", "업로드URL",
      "인플정산상태", "인플지급액", "거래처정산상태", "거래처수금액",
      "메모", "프로필URL",
    ];

    const rows = items.map((item) => {
      const inf = item.influencer;
      return [
        item.campaign?.name ?? "",
        inf?.display_name ?? "",
        inf?.username ?? "",
        inf?.email ?? "",
        inf?.platform ?? "",
        inf?.follower_count ?? "",
        funnelLabel(item.funnel_status),
        item.outreach_round,
        item.last_outreach_at ? new Date(item.last_outreach_at).toLocaleDateString("ko-KR") : "",
        item.reply_channel ?? "",
        item.reply_date ? new Date(item.reply_date).toLocaleDateString("ko-KR") : "",
        item.reply_summary ?? "",
        item.interest_confirmed ? "Y" : "N",
        item.client_approved ? "Y" : "N",
        item.client_note ?? "",
        item.final_confirmed ? "Y" : "N",
        item.payment_amount ?? "",
        item.payment_currency,
        item.invoice_amount ?? "",
        item.invoice_currency,
        item.guideline_url ?? "",
        item.guideline_sent ? "Y" : "N",
        item.crm_registered ? "Y" : "N",
        item.crm_note ?? "",
        item.visit_scheduled_date ?? "",
        item.visit_completed ? "Y" : "N",
        item.upload_deadline ?? "",
        item.actual_upload_date ?? "",
        item.upload_url ?? "",
        ipLabel(item.influencer_payment_status),
        item.influencer_paid_amount ?? "",
        cpLabel(item.client_payment_status),
        item.client_paid_amount ?? "",
        (item.notes ?? "").replace(/[\r\n]+/g, " "),
        inf?.profile_url ?? "",
      ].map((v) => {
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      });
    });

    const bom = "\uFEFF";
    const csv = bom + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="campaign-manage-export.csv"`,
      },
    });
  } catch (err) {
    console.error("GET /api/manage/export error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
