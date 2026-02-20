import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runActor } from "@/lib/apify/client";
import { PLATFORM_KEYWORD_ACTORS, PLATFORM_TAGGED_ACTORS, getDefaultInput } from "@/lib/apify/actors";
import type { Json, Tables } from "@/types/database";

type ExtractionJob = Tables<"extraction_jobs">;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { campaign_id, type, source_id, platform } = body;

    if (!campaign_id || !type || !source_id || !platform) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get actor ID based on type and platform
    let actorId: string | undefined;
    let input: Record<string, unknown> = {};

    if (type === "keyword") {
      actorId = PLATFORM_KEYWORD_ACTORS[platform];
      const { data: keyword } = await supabase
        .from("keywords")
        .select("keyword")
        .eq("id", source_id)
        .single();

      if (!keyword) {
        return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
      }
      input = getDefaultInput(actorId!, { keyword: keyword.keyword });
    } else if (type === "tagged") {
      actorId = PLATFORM_TAGGED_ACTORS[platform];
      const { data: account } = await supabase
        .from("tagged_accounts")
        .select("account_username")
        .eq("id", source_id)
        .single();

      if (!account) {
        return NextResponse.json({ error: "Tagged account not found" }, { status: 404 });
      }
      input = getDefaultInput(actorId!, { username: account.account_username });
    }

    if (!actorId) {
      return NextResponse.json({ error: `No actor available for ${platform} ${type}` }, { status: 400 });
    }

    // Create extraction job record
    const { data: jobData, error: jobError } = await supabase
      .from("extraction_jobs")
      .insert({
        campaign_id,
        type,
        source_id,
        platform,
        status: "running",
        input_config: input as unknown as Json,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 400 });
    }

    const job = jobData as ExtractionJob;

    // Run Apify actor
    try {
      const run = await runActor(actorId, input);

      // Update job with apify_run_id
      await supabase
        .from("extraction_jobs")
        .update({ apify_run_id: run.id })
        .eq("id", job.id);

      return NextResponse.json({
        job_id: job.id,
        apify_run_id: run.id,
        status: "running",
      });
    } catch (apifyError) {
      await supabase
        .from("extraction_jobs")
        .update({ status: "failed" })
        .eq("id", job.id);

      return NextResponse.json({ error: "Failed to start Apify actor" }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
