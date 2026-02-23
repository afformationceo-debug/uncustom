import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startActor } from "@/lib/apify/client";
import { APIFY_ACTORS } from "@/lib/apify/actors";
import type { Json, Tables } from "@/types/database";

type Influencer = Tables<"influencers">;
type InfluencerLink = Tables<"influencer_links">;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { campaign_id } = body;

    if (!campaign_id) {
      return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
    }

    // Verify campaign exists
    const { data: campaign, error: campError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", campaign_id)
      .single();

    if (campError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Check if there's already a running email_scrape job for this campaign
    const { data: existingJob } = await supabase
      .from("extraction_jobs")
      .select("id")
      .eq("campaign_id", campaign_id)
      .eq("type", "email_scrape")
      .in("status", ["running", "pending"])
      .limit(1);

    if (existingJob && existingJob.length > 0) {
      return NextResponse.json({
        error: "An email scrape job is already running for this campaign",
        existing_job_id: existingJob[0].id,
      }, { status: 409 });
    }

    // Get all influencer IDs in this campaign
    const { data: ciData } = await supabase
      .from("campaign_influencers")
      .select("influencer_id")
      .eq("campaign_id", campaign_id);

    if (!ciData || ciData.length === 0) {
      return NextResponse.json({
        error: "No influencers found in this campaign",
      }, { status: 404 });
    }

    const influencerIds = ciData.map((ci) => ci.influencer_id);

    // Find influencers that don't have an email yet
    const { data: infData } = await supabase
      .from("influencers")
      .select("id, username")
      .in("id", influencerIds)
      .is("email", null);

    const influencersWithoutEmail = (infData as Influencer[]) ?? [];

    if (influencersWithoutEmail.length === 0) {
      return NextResponse.json({
        message: "All influencers in this campaign already have emails",
        total_influencers: influencerIds.length,
        without_email: 0,
      });
    }

    const noEmailIds = influencersWithoutEmail.map((inf) => inf.id);

    // Get all unscraped links for these influencers
    const { data: linksData } = await supabase
      .from("influencer_links")
      .select("*")
      .in("influencer_id", noEmailIds)
      .eq("scraped", false);

    const links = (linksData as InfluencerLink[]) ?? [];

    if (links.length === 0) {
      return NextResponse.json({
        message: "No unscraped links found for influencers without email",
        total_influencers: influencerIds.length,
        without_email: noEmailIds.length,
        unscraped_links: 0,
      });
    }

    // Collect all URLs and build a mapping of URL -> link info
    const urls = links.map((l) => l.url);
    // Store the link-to-influencer mapping in input_config for the status handler
    const linkMap: Record<string, { link_id: string; influencer_id: string }> = {};
    for (const link of links) {
      linkMap[link.url] = {
        link_id: link.id,
        influencer_id: link.influencer_id,
      };
    }

    // Create extraction job
    const { data: jobData, error: jobError } = await supabase
      .from("extraction_jobs")
      .insert({
        campaign_id,
        type: "email_scrape",
        platform: "all",
        status: "running",
        input_config: {
          urls,
          link_map: linkMap,
          total_links: links.length,
          total_influencers: noEmailIds.length,
        } as unknown as Json,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError || !jobData) {
      console.error("[extract/email-batch] Failed to create job:", jobError?.message);
      return NextResponse.json({ error: "Failed to create extraction job" }, { status: 500 });
    }

    // Start the Apify EMAIL_EXTRACTOR actor with all URLs
    try {
      const run = await startActor(APIFY_ACTORS.EMAIL_EXTRACTOR, { urls });

      // Update job with apify_run_id
      await supabase
        .from("extraction_jobs")
        .update({ apify_run_id: run.id })
        .eq("id", jobData.id);

      console.log(
        `[extract/email-batch] Job started: ${jobData.id} (Apify run: ${run.id}), ` +
        `${links.length} links for ${noEmailIds.length} influencers`
      );

      return NextResponse.json({
        job_id: jobData.id,
        apify_run_id: run.id,
        total_influencers: influencerIds.length,
        without_email: noEmailIds.length,
        unscraped_links: links.length,
        status: "running",
      });
    } catch (apifyError) {
      // Mark job as failed if Apify call fails
      await supabase
        .from("extraction_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobData.id);

      console.error("[extract/email-batch] Apify start error:", apifyError);
      return NextResponse.json({ error: "Failed to start email extractor" }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[extract/email-batch] Error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
