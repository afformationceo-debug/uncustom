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

    // Determine actor and input based on platform
    let actorId: string;
    let input: Record<string, unknown>;

    switch (brand.platform) {
      case "instagram":
        actorId = APIFY_ACTORS.INSTAGRAM_PROFILE;
        input = { usernames: [brand.username] };
        break;
      case "tiktok":
        actorId = APIFY_ACTORS.TIKTOK;
        input = { searchQueries: [`@${brand.username}`], resultsPerPage: 1, searchSection: "/user" };
        break;
      case "youtube":
        actorId = APIFY_ACTORS.YOUTUBE;
        input = { searchKeywords: `@${brand.username}`, maxResults: 1 };
        break;
      case "twitter":
        actorId = APIFY_ACTORS.TWITTER;
        input = { searchTerms: [`from:${brand.username}`], maxItems: 1 };
        break;
      default:
        return NextResponse.json({ error: `Unsupported platform: ${brand.platform}` }, { status: 400 });
    }

    // Start Apify actor
    const run = await startActor(actorId, input);

    // Create extraction job with apify_run_id
    const { data: job, error: jobError } = await supabase
      .from("extraction_jobs")
      .insert({
        type: "brand_profile",
        platform: brand.platform,
        source_id: id,
        status: "running",
        apify_run_id: run.id,
        input_config: {
          brand_account_id: id,
          username: brand.username,
          platform: brand.platform,
          actor_id: actorId,
        } as unknown as Json,
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 400 });
    }

    const jobData = job as Tables<"extraction_jobs">;

    // Update last_analyzed_at
    await supabase
      .from("brand_accounts")
      .update({ last_analyzed_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      job_id: jobData.id,
      apify_run_id: run.id,
      message: `Analysis started for @${brand.username} on ${brand.platform}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[brands/analyze] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
