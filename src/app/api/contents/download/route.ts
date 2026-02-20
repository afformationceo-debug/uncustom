import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startActor, getRunStatus, getDatasetItems } from "@/lib/apify/client";
import { APIFY_ACTORS } from "@/lib/apify/actors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";

type Content = Tables<"influencer_contents">;

// POST: Start video download (fire-and-forget)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { content_id } = body;

    if (!content_id) {
      return NextResponse.json({ error: "content_id is required" }, { status: 400 });
    }

    const { data: contentData, error } = await supabase
      .from("influencer_contents")
      .select("*")
      .eq("id", content_id)
      .single();

    const content = contentData as Content | null;

    if (error || !content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    // Start Apify video downloader (non-blocking)
    const run = await startActor(APIFY_ACTORS.VIDEO_DOWNLOADER, {
      urls: [content.original_url],
    });

    // Store run_id in video_storage_path temporarily for tracking
    await supabase
      .from("influencer_contents")
      .update({ video_storage_path: `apify_run:${run.id}` })
      .eq("id", content_id);

    return NextResponse.json({
      success: true,
      run_id: run.id,
      status: "running",
    });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET: Check download status and finalize if complete
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("content_id");
    const runId = searchParams.get("run_id");

    if (!contentId || !runId) {
      return NextResponse.json({ error: "content_id and run_id are required" }, { status: 400 });
    }

    const { data: contentData } = await supabase
      .from("influencer_contents")
      .select("*")
      .eq("id", contentId)
      .single();

    const content = contentData as Content | null;
    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    // Already downloaded
    if (content.video_downloaded && !content.video_storage_path?.startsWith("apify_run:")) {
      return NextResponse.json({ status: "completed", storage_path: content.video_storage_path });
    }

    const runStatus = await getRunStatus(runId);
    if (!runStatus) {
      return NextResponse.json({ status: "failed", error: "Run not found on Apify" });
    }

    if (runStatus.status === "SUCCEEDED") {
      // Fetch the downloaded video URL
      const items = await getDatasetItems(runStatus.defaultDatasetId);
      let downloadUrl: string | null = null;

      for (const item of items) {
        const record = item as Record<string, unknown>;
        const url = (record.downloadUrl ?? record.url ?? record.videoUrl ?? record.mediaUrl) as string | undefined;
        if (url) {
          downloadUrl = url;
          break;
        }
      }

      if (!downloadUrl) {
        await supabase
          .from("influencer_contents")
          .update({ video_downloaded: false, video_storage_path: null })
          .eq("id", contentId);
        return NextResponse.json({ status: "failed", error: "No video URL found in results" });
      }

      // Download and upload to Supabase Storage
      const storagePath = `videos/${content.campaign_id}/${content.id}.mp4`;
      try {
        const videoResponse = await fetch(downloadUrl);
        if (!videoResponse.ok) throw new Error(`Fetch failed: ${videoResponse.status}`);

        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        const adminClient = createAdminClient();

        const { error: uploadError } = await adminClient.storage
          .from("contents")
          .upload(storagePath, videoBuffer, { contentType: "video/mp4", upsert: true });

        if (uploadError) throw new Error(uploadError.message);

        await supabase
          .from("influencer_contents")
          .update({ video_downloaded: true, video_storage_path: storagePath })
          .eq("id", contentId);

        return NextResponse.json({ status: "completed", storage_path: storagePath });
      } catch {
        // Fallback: use direct URL
        await supabase
          .from("influencer_contents")
          .update({ video_downloaded: true, video_storage_path: downloadUrl })
          .eq("id", contentId);
        return NextResponse.json({ status: "completed", storage_path: downloadUrl });
      }
    }

    if (runStatus.status === "FAILED" || runStatus.status === "ABORTED") {
      await supabase
        .from("influencer_contents")
        .update({ video_downloaded: false, video_storage_path: null })
        .eq("id", contentId);
      return NextResponse.json({ status: "failed", error: `Download ${runStatus.status.toLowerCase()}` });
    }

    return NextResponse.json({ status: "running" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
