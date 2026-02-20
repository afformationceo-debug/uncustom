import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runActor } from "@/lib/apify/client";
import { APIFY_ACTORS } from "@/lib/apify/actors";
import type { Tables } from "@/types/database";

type Content = Tables<"influencer_contents">;

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

    // Run Apify video downloader
    const run = await runActor(APIFY_ACTORS.VIDEO_DOWNLOADER, {
      urls: [content.original_url],
    });

    // Update content record
    await supabase
      .from("influencer_contents")
      .update({
        video_downloaded: true,
        video_storage_path: `videos/${content.campaign_id}/${content.id}`,
      })
      .eq("id", content_id);

    return NextResponse.json({
      success: true,
      run_id: run.id,
    });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
