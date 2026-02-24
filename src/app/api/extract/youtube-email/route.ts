import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startActor } from "@/lib/apify/client";
import { APIFY_ACTORS } from "@/lib/apify/actors";
import type { Json } from "@/types/database";

/**
 * Manual YouTube email extraction using endspec CAPTCHA-bypassing actor.
 * Finds YouTube influencers without email and extracts business emails from channel "About" pages.
 *
 * POST /api/extract/youtube-email
 * Body: { campaign_id?: string } — optional, if omitted works globally
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { campaign_id } = body;

    // Check if there's already a running youtube_email job
    const { data: existingJob } = await supabase
      .from("extraction_jobs")
      .select("id")
      .eq("type", "youtube_email")
      .in("status", ["running", "pending"])
      .limit(1);

    if (existingJob && existingJob.length > 0) {
      return NextResponse.json({
        error: "YouTube 이메일 추출이 이미 실행 중입니다",
        existing_job_id: existingJob[0].id,
      }, { status: 409 });
    }

    // Find YouTube influencers without email
    let query = supabase
      .from("influencers")
      .select("id, username, platform_id")
      .eq("platform", "youtube")
      .is("email", null)
      .limit(50);

    // If campaign_id specified, filter to campaign influencers
    if (campaign_id) {
      const { data: ciData } = await supabase
        .from("campaign_influencers")
        .select("influencer_id")
        .eq("campaign_id", campaign_id);

      if (!ciData || ciData.length === 0) {
        return NextResponse.json({ error: "캠페인에 인플루언서가 없습니다" }, { status: 404 });
      }

      const infIds = ciData.map((ci) => ci.influencer_id);
      query = query.in("id", infIds);
    }

    const { data: influencers } = await query;
    const ytInfluencers = (influencers ?? []) as Array<{ id: string; username: string | null; platform_id: string | null }>;

    if (ytInfluencers.length === 0) {
      // Count total YouTube influencers for context
      const { count } = await supabase
        .from("influencers")
        .select("id", { count: "exact", head: true })
        .eq("platform", "youtube");

      return NextResponse.json({
        message: "이메일이 없는 YouTube 인플루언서가 없습니다",
        total_youtube: count ?? 0,
        without_email: 0,
      });
    }

    // Start endspec actor runs for each channel
    type YtEmailRun = { run_id: string; dataset_id: string; channel_handle: string; influencer_id: string };
    const runs: YtEmailRun[] = [];

    for (const inf of ytInfluencers) {
      const handle = inf.username ? `@${inf.username}` : null;
      const channelId = inf.platform_id || null;
      if (!handle && !channelId) continue;

      try {
        const input = handle
          ? { channelHandle: handle }
          : { id: channelId };

        const run = await startActor(APIFY_ACTORS.YOUTUBE_EMAIL, input);
        runs.push({
          run_id: run.id,
          dataset_id: run.defaultDatasetId,
          channel_handle: handle || channelId!,
          influencer_id: inf.id,
        });
      } catch (err) {
        console.error(`[youtube-email] Failed to start run for ${handle || channelId}:`, err);
      }
    }

    if (runs.length === 0) {
      return NextResponse.json({ error: "Apify 실행 시작 실패" }, { status: 500 });
    }

    // Create tracking job
    const { data: jobData, error: jobError } = await supabase
      .from("extraction_jobs")
      .insert({
        campaign_id: campaign_id || null,
        type: "youtube_email",
        platform: "youtube",
        status: "running",
        apify_run_id: null,
        input_config: {
          runs,
          total_channels: runs.length,
          manual: true,
        } as unknown as Json,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError || !jobData) {
      console.error("[youtube-email] Failed to create job:", jobError?.message);
      return NextResponse.json({ error: "작업 생성 실패" }, { status: 500 });
    }

    console.log(`[youtube-email] Manual job started: ${jobData.id} (${runs.length} channels)`);

    return NextResponse.json({
      job_id: jobData.id,
      total_channels: runs.length,
      total_without_email: ytInfluencers.length,
      status: "running",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[youtube-email] Error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET: Check how many YouTube influencers need email extraction */
export async function GET() {
  try {
    const supabase = await createClient();

    const { count: totalYt } = await supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("platform", "youtube");

    const { count: withEmail } = await supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("platform", "youtube")
      .not("email", "is", null);

    const { count: withoutEmail } = await supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("platform", "youtube")
      .is("email", null);

    return NextResponse.json({
      total_youtube: totalYt ?? 0,
      with_email: withEmail ?? 0,
      without_email: withoutEmail ?? 0,
      estimated_cost: ((withoutEmail ?? 0) * 0.005).toFixed(2),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
