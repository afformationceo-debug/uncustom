import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startActor, getDatasetItems, getRunStatus } from "@/lib/apify/client";
import { APIFY_ACTORS } from "@/lib/apify/actors";
import type { Tables } from "@/types/database";

type Upload = Tables<"multi_channel_uploads">;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");

    if (!campaignId) {
      return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
    }

    const { data: uploads } = await supabase
      .from("multi_channel_uploads")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("status", "published");

    if (!uploads || uploads.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    const uploadIds = uploads.map((u) => u.id);

    const { data, error } = await supabase
      .from("content_metrics")
      .select("*")
      .in("upload_id", uploadIds)
      .order("tracked_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Start metric scraping (non-blocking, returns run_id for polling)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { campaign_id } = body;

    if (!campaign_id) {
      return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
    }

    const { data: uploadsData, error: uploadsError } = await supabase
      .from("multi_channel_uploads")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "published");

    if (uploadsError) {
      return NextResponse.json({ error: uploadsError.message }, { status: 400 });
    }

    const uploads = (uploadsData as Upload[]) ?? [];
    const scrapableUploads = uploads.filter((u) => u.platform_post_url);

    if (scrapableUploads.length === 0) {
      return NextResponse.json({ success: true, message: "No uploads with platform URLs", updated: 0 });
    }

    const urls = scrapableUploads.map((u) => u.platform_post_url as string);

    // Start the scraper (non-blocking)
    const run = await startActor(APIFY_ACTORS.SOCIAL_INSIGHT, { urls });

    return NextResponse.json({
      success: true,
      status: "running",
      apify_run_id: run.id,
      total: scrapableUploads.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT: Check metric scraping status and save results
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { campaign_id, apify_run_id } = body;

    if (!campaign_id || !apify_run_id) {
      return NextResponse.json({ error: "campaign_id and apify_run_id are required" }, { status: 400 });
    }

    const runStatus = await getRunStatus(apify_run_id);
    if (!runStatus) {
      return NextResponse.json({ status: "failed", error: "Run not found" });
    }

    if (runStatus.status === "FAILED" || runStatus.status === "ABORTED") {
      return NextResponse.json({ status: "failed", error: `Run ${runStatus.status.toLowerCase()}` });
    }

    if (runStatus.status !== "SUCCEEDED") {
      return NextResponse.json({ status: "running" });
    }

    // Get published uploads for this campaign
    const { data: uploadsData } = await supabase
      .from("multi_channel_uploads")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "published");

    const uploads = (uploadsData as Upload[]) ?? [];
    const scrapableUploads = uploads.filter((u) => u.platform_post_url);

    // Get results
    const items = await getDatasetItems(runStatus.defaultDatasetId);

    let updatedCount = 0;
    for (const upload of scrapableUploads) {
      const item = items.find(
        (i: Record<string, unknown>) =>
          (i.url as string) === upload.platform_post_url ||
          (i.input_url as string) === upload.platform_post_url ||
          (i.sourceUrl as string) === upload.platform_post_url
      );

      if (!item) continue;

      const views = Number(item.views ?? item.viewCount ?? item.playCount ?? 0);
      const likes = Number(item.likes ?? item.likeCount ?? item.diggCount ?? 0);
      const comments = Number(item.comments ?? item.commentCount ?? item.replyCount ?? 0);
      const shares = Number(item.shares ?? item.shareCount ?? item.retweetCount ?? 0);
      const totalEngagement = likes + comments + shares;
      const engagementRate = views > 0 ? totalEngagement / views : null;

      const { error: insertError } = await supabase
        .from("content_metrics")
        .insert({ upload_id: upload.id, views, likes, comments, shares, engagement_rate: engagementRate });

      if (!insertError) updatedCount++;
    }

    return NextResponse.json({
      status: "completed",
      updated: updatedCount,
      total: scrapableUploads.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
