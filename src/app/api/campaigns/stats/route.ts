import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type CampaignStats = {
  campaign_id: string;
  total: number;
  byCountry: Record<string, number>;
  byFunnel: Record<string, number>;
  byPlatform: Record<string, number>;
  emailSent: number;
  emailOpened: number;
  contacted: number;
  interested: number;
  confirmed: number;
  uploaded: number;
  completed: number;
};

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Fetch all campaign_influencers with influencer country & platform
    const { data: ciRows, error: ciErr } = await supabase
      .from("campaign_influencers")
      .select("campaign_id, funnel_status, influencer:influencers!inner(country, platform)");

    if (ciErr) {
      return NextResponse.json({ error: ciErr.message }, { status: 400 });
    }

    // 2. Fetch email_logs counts per campaign
    const { data: emailRows, error: emailErr } = await supabase
      .from("email_logs")
      .select("campaign_id, status, opened_at");

    if (emailErr) {
      return NextResponse.json({ error: emailErr.message }, { status: 400 });
    }

    // 3. Aggregate in memory
    const statsMap: Record<string, CampaignStats> = {};

    function ensureCampaign(cid: string): CampaignStats {
      if (!statsMap[cid]) {
        statsMap[cid] = {
          campaign_id: cid,
          total: 0,
          byCountry: {},
          byFunnel: {},
          byPlatform: {},
          emailSent: 0,
          emailOpened: 0,
          contacted: 0,
          interested: 0,
          confirmed: 0,
          uploaded: 0,
          completed: 0,
        };
      }
      return statsMap[cid];
    }

    // Process campaign_influencers
    for (const row of (ciRows ?? []) as unknown as {
      campaign_id: string;
      funnel_status: string;
      influencer: { country: string | null; platform: string | null };
    }[]) {
      const s = ensureCampaign(row.campaign_id);
      s.total++;

      // Country aggregation
      const country = row.influencer?.country ?? "미지정";
      s.byCountry[country] = (s.byCountry[country] ?? 0) + 1;

      // Platform aggregation
      const platform = row.influencer?.platform ?? "unknown";
      s.byPlatform[platform] = (s.byPlatform[platform] ?? 0) + 1;

      // Funnel status aggregation
      const funnel = row.funnel_status ?? "extracted";
      s.byFunnel[funnel] = (s.byFunnel[funnel] ?? 0) + 1;

      // Key milestone counts
      if (["contacted", "interested", "client_approved", "confirmed", "guideline_sent", "crm_registered", "visit_scheduled", "visited", "upload_pending", "uploaded", "completed", "settled"].includes(funnel)) {
        s.contacted++;
      }
      if (["interested", "client_approved", "confirmed", "guideline_sent", "crm_registered", "visit_scheduled", "visited", "upload_pending", "uploaded", "completed", "settled"].includes(funnel)) {
        s.interested++;
      }
      if (["confirmed", "guideline_sent", "crm_registered", "visit_scheduled", "visited", "upload_pending", "uploaded", "completed", "settled"].includes(funnel)) {
        s.confirmed++;
      }
      if (["uploaded", "completed", "settled"].includes(funnel)) {
        s.uploaded++;
      }
      if (["completed", "settled"].includes(funnel)) {
        s.completed++;
      }
    }

    // Process email_logs
    for (const row of (emailRows ?? []) as unknown as {
      campaign_id: string;
      status: string;
      opened_at: string | null;
    }[]) {
      const s = ensureCampaign(row.campaign_id);
      s.emailSent++;
      if (row.opened_at) {
        s.emailOpened++;
      }
    }

    return NextResponse.json({ data: statsMap });
  } catch (err) {
    console.error("GET /api/campaigns/stats error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
