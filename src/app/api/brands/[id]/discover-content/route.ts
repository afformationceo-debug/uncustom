import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startActor } from "@/lib/apify/client";
import { APIFY_ACTORS } from "@/lib/apify/actors";
import type { Json, Tables } from "@/types/database";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Get brand account
    const { data: brandRaw, error: brandError } = await supabase
      .from("brand_accounts")
      .select("*")
      .eq("id", id)
      .single();

    if (brandError || !brandRaw) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const brand = brandRaw as Tables<"brand_accounts">;

    // Check for existing running job
    const { data: existingJobs } = await supabase
      .from("extraction_jobs")
      .select("id")
      .eq("type", "brand_tagged_content")
      .eq("source_id", id)
      .in("status", ["running", "pending"])
      .limit(1);

    if (existingJobs && existingJobs.length > 0) {
      return NextResponse.json({
        error: "Content discovery already running for this brand",
        existing_job_id: existingJobs[0].id,
      }, { status: 409 });
    }

    // Parse optional body params
    let limit = 200;
    try {
      const body = await request.json();
      if (body.limit) limit = Math.min(Number(body.limit), 500);
    } catch {
      // No body or invalid JSON — use defaults
    }

    // Determine actor and input based on platform
    let actorId: string;
    let input: Record<string, unknown>;

    switch (brand.platform) {
      case "instagram":
        actorId = APIFY_ACTORS.INSTAGRAM_TAGGED;
        input = { username: [brand.username], resultsLimit: limit };
        break;
      case "tiktok":
        actorId = APIFY_ACTORS.TIKTOK;
        input = { searchQueries: [`@${brand.username}`], resultsPerPage: limit };
        break;
      case "youtube":
        actorId = APIFY_ACTORS.YOUTUBE;
        input = { searchKeywords: `@${brand.username}`, maxResults: Math.min(limit, 100) };
        break;
      case "twitter":
        actorId = APIFY_ACTORS.TWITTER;
        input = { searchTerms: [`@${brand.username}`], maxItems: limit };
        break;
      default:
        return NextResponse.json({ error: `Unsupported platform: ${brand.platform}` }, { status: 400 });
    }

    // Start Apify actor
    const run = await startActor(actorId, input);

    // Create extraction job
    const { data: job, error: jobError } = await supabase
      .from("extraction_jobs")
      .insert({
        type: "brand_tagged_content",
        platform: brand.platform,
        source_id: id,
        status: "running",
        apify_run_id: run.id,
        input_config: {
          brand_account_id: id,
          username: brand.username,
          platform: brand.platform,
          actor_id: actorId,
          limit,
        } as unknown as Json,
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 400 });
    }

    const jobData = job as Tables<"extraction_jobs">;

    return NextResponse.json({
      success: true,
      job_id: jobData.id,
      apify_run_id: run.id,
      message: `Content discovery started for @${brand.username} on ${brand.platform}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[brands/discover-content] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
