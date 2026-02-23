import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startActor } from "@/lib/apify/client";
import { APIFY_ACTORS } from "@/lib/apify/actors";
import type { Json, Tables } from "@/types/database";

type Influencer = Tables<"influencers">;
type ExtractionJob = Tables<"extraction_jobs">;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { campaign_id, influencer_ids } = body;

    if (!campaign_id) {
      return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
    }

    // Find Instagram influencers in this campaign
    const { data: ciData } = await supabase
      .from("campaign_influencers")
      .select("influencer_id")
      .eq("campaign_id", campaign_id);

    if (!ciData || ciData.length === 0) {
      return NextResponse.json({ message: "No influencers in campaign", count: 0 });
    }

    const allInfluencerIds = ciData.map((ci) => ci.influencer_id);

    // Get Instagram influencers - either specific IDs or those missing follower_count
    let infQuery = supabase
      .from("influencers")
      .select("id, username, follower_count")
      .eq("platform", "instagram");

    if (influencer_ids && influencer_ids.length > 0) {
      infQuery = infQuery.in("id", influencer_ids);
    } else {
      infQuery = infQuery.in("id", allInfluencerIds).is("follower_count", null);
    }

    const { data: influencers } = await infQuery;

    if (!influencers || influencers.length === 0) {
      return NextResponse.json({
        message: "No Instagram influencers need enrichment",
        count: 0,
      });
    }

    const usernames = (influencers as Influencer[])
      .map((inf) => inf.username)
      .filter((u): u is string => !!u && u.trim() !== "");

    // Deduplicate usernames
    const uniqueUsernames = [...new Set(usernames)];

    if (uniqueUsernames.length === 0) {
      return NextResponse.json({
        error: "No valid usernames found for enrichment",
        count: 0,
      }, { status: 400 });
    }

    // Create enrichment job record
    const { data: jobRaw, error: jobError } = await supabase
      .from("extraction_jobs")
      .insert({
        campaign_id,
        type: "enrich",
        platform: "instagram",
        status: "running",
        input_config: { usernames: uniqueUsernames } as unknown as Json,
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    const job = jobRaw as ExtractionJob | null;

    if (jobError || !job) {
      return NextResponse.json({ error: jobError?.message ?? "Failed to create job" }, { status: 500 });
    }

    // Start Instagram Profile Scraper with all usernames
    try {
      const run = await startActor(APIFY_ACTORS.INSTAGRAM_PROFILE, {
        usernames: uniqueUsernames,
      });

      await supabase
        .from("extraction_jobs")
        .update({ apify_run_id: run.id })
        .eq("id", job.id);

      return NextResponse.json({
        job_id: job.id,
        apify_run_id: run.id,
        count: uniqueUsernames.length,
        status: "running",
      });
    } catch (apifyError) {
      const msg = apifyError instanceof Error ? apifyError.message : "Failed to start profile scraper";
      console.error("[extract/enrich] Apify error:", msg);
      await supabase
        .from("extraction_jobs")
        .update({ status: "failed" })
        .eq("id", job.id);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[extract/enrich] Error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
