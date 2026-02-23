import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startActor } from "@/lib/apify/client";
import { APIFY_ACTORS, PLATFORM_KEYWORD_ACTORS, PLATFORM_TAGGED_ACTORS, getDefaultInput } from "@/lib/apify/actors";
import type { Json, Tables } from "@/types/database";

type ExtractionJob = Tables<"extraction_jobs">;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { campaign_id, type, source_id, platform, platforms, limit, platform_inputs } = body;
    // platform_inputs: Record<string, Record<string, unknown>> - per-platform advanced Apify inputs

    // Support multi-platform: platforms is an array, platform is a single string (backward-compatible)
    let targetPlatforms: string[] = platforms?.length > 0
      ? platforms
      : platform ? [platform] : [];

    if (!type || !source_id || targetPlatforms.length === 0) {
      return NextResponse.json({ error: "Missing required fields (type, source_id, platform or platforms)" }, { status: 400 });
    }

    // Get source data once
    let sourceKeyword: string | null = null;
    let sourceUsername: string | null = null;

    if (type === "keyword") {
      const { data: keyword } = await supabase
        .from("keywords")
        .select("keyword, platform, target_country")
        .eq("id", source_id)
        .single();
      if (!keyword) {
        return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
      }
      sourceKeyword = keyword.keyword;
      // If keyword has a specific platform (not "all"), narrow to that platform only
      if (keyword.platform && keyword.platform !== "all") {
        targetPlatforms = [keyword.platform];
      }
    } else if (type === "tagged") {
      const { data: account } = await supabase
        .from("tagged_accounts")
        .select("account_username, platform, target_country")
        .eq("id", source_id)
        .single();
      if (!account) {
        return NextResponse.json({ error: "Tagged account not found" }, { status: 404 });
      }
      sourceUsername = account.account_username;
      // If tagged account has a specific platform, narrow to that platform only
      if (account.platform && targetPlatforms.length <= 1) {
        targetPlatforms = [account.platform];
      }
    }

    // Launch extraction jobs for each platform
    const results: { platform: string; job_id: string; apify_run_id: string; status: string }[] = [];
    const errors: { platform: string; error: string }[] = [];

    for (const plat of targetPlatforms) {
      // Get actor ID based on type and platform
      let actorId: string | undefined;
      let input: Record<string, unknown> = {};

      if (type === "keyword") {
        // Platform-specific keyword actors (Instagram→Reel, TikTok, YouTube, Twitter)
        actorId = PLATFORM_KEYWORD_ACTORS[plat];
        if (!actorId) {
          errors.push({ platform: plat, error: `No keyword actor for ${plat}` });
          continue;
        }
        const advInputs = platform_inputs?.[plat] as Record<string, unknown> | undefined;
        input = getDefaultInput(actorId, { keyword: sourceKeyword!, limit: limit ?? 200 }, advInputs);
      } else if (type === "tagged") {
        actorId = PLATFORM_TAGGED_ACTORS[plat];
        if (!actorId) {
          errors.push({ platform: plat, error: `No tagged actor for ${plat}` });
          continue;
        }
        const advInputs = platform_inputs?.[plat] as Record<string, unknown> | undefined;
        input = getDefaultInput(actorId, { username: sourceUsername!, limit: limit ?? 200 }, advInputs);
      }

      if (!actorId) {
        errors.push({ platform: plat, error: `No actor available for ${plat} ${type}` });
        continue;
      }

      // Create extraction job record
      const { data: jobData, error: jobError } = await supabase
        .from("extraction_jobs")
        .insert({
          campaign_id,
          type,
          source_id,
          platform: plat,
          status: "running",
          input_config: input as unknown as Json,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobError) {
        errors.push({ platform: plat, error: jobError.message });
        continue;
      }

      const job = jobData as ExtractionJob;

      // Run Apify actor
      try {
        const run = await startActor(actorId, input);
        await supabase
          .from("extraction_jobs")
          .update({ apify_run_id: run.id })
          .eq("id", job.id);

        results.push({
          platform: plat,
          job_id: job.id,
          apify_run_id: run.id,
          status: "running",
        });
      } catch (apifyError) {
        const msg = apifyError instanceof Error ? apifyError.message : "Failed to start Apify actor";
        console.error(`[extract] Apify error for ${plat}:`, msg);
        await supabase
          .from("extraction_jobs")
          .update({ status: "failed" })
          .eq("id", job.id);
        errors.push({ platform: plat, error: msg });
      }
    }

    return NextResponse.json({
      jobs: results,
      errors: errors.length > 0 ? errors : undefined,
      total_started: results.length,
      total_failed: errors.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[extract] Error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
