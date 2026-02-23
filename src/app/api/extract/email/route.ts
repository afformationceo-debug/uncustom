import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startActor } from "@/lib/apify/client";
import { APIFY_ACTORS } from "@/lib/apify/actors";
import { extractEmailFromBio } from "@/lib/utils/email-extractor";
import type { Json, Tables } from "@/types/database";

type Influencer = Tables<"influencers">;
type InfluencerLink = Tables<"influencer_links">;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { influencer_id } = body;

    if (!influencer_id) {
      return NextResponse.json({ error: "influencer_id is required" }, { status: 400 });
    }

    // Get influencer info
    const { data: influencerData, error: infError } = await supabase
      .from("influencers")
      .select("*")
      .eq("id", influencer_id)
      .single();

    const influencer = influencerData as Influencer | null;

    if (infError || !influencer) {
      return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
    }

    // If influencer already has an email, return it
    if (influencer.email) {
      return NextResponse.json({
        email: influencer.email,
        email_source: influencer.email_source,
        already_exists: true,
      });
    }

    // Try extracting email from bio first
    const bioEmail = extractEmailFromBio(influencer.bio);
    if (bioEmail) {
      await supabase
        .from("influencers")
        .update({ email: bioEmail, email_source: "bio" })
        .eq("id", influencer_id);

      return NextResponse.json({
        email: bioEmail,
        email_source: "bio",
        already_exists: false,
      });
    }

    // Get unscraped links for this influencer
    const { data: linksData } = await supabase
      .from("influencer_links")
      .select("*")
      .eq("influencer_id", influencer_id)
      .eq("scraped", false);

    const links = (linksData as InfluencerLink[]) ?? [];

    if (links.length === 0) {
      return NextResponse.json({
        email: null,
        email_source: null,
        message: "No unscraped links found for this influencer",
      });
    }

    // Build URL list and link map for the status handler
    const urls = links.map((l) => l.url);
    const linkMap: Record<string, { link_id: string; influencer_id: string }> = {};
    for (const link of links) {
      linkMap[link.url] = {
        link_id: link.id,
        influencer_id: link.influencer_id,
      };
    }

    // Create extraction job record for tracking
    const { data: jobData, error: jobError } = await supabase
      .from("extraction_jobs")
      .insert({
        campaign_id: null,
        type: "email_scrape",
        platform: influencer.platform,
        status: "running",
        input_config: {
          urls,
          link_map: linkMap,
          total_links: links.length,
          total_influencers: 1,
          single_influencer_id: influencer_id,
        } as unknown as Json,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError || !jobData) {
      console.error("[extract/email] Failed to create job:", jobError?.message);
      return NextResponse.json({ error: "Failed to create extraction job" }, { status: 500 });
    }

    // Start the Apify EMAIL_EXTRACTOR actor (non-blocking)
    try {
      const run = await startActor(APIFY_ACTORS.EMAIL_EXTRACTOR, { startUrls: urls.map(url => ({ url })) });

      await supabase
        .from("extraction_jobs")
        .update({ apify_run_id: run.id })
        .eq("id", jobData.id);

      console.log(
        `[extract/email] Job started: ${jobData.id} (Apify run: ${run.id}), ` +
        `${links.length} links for influencer ${influencer_id}`
      );

      return NextResponse.json({
        job_id: jobData.id,
        apify_run_id: run.id,
        unscraped_links: links.length,
        status: "running",
        message: "Email extraction started. Poll /api/extract/status?job_id=... for results.",
      });
    } catch (apifyError) {
      await supabase
        .from("extraction_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobData.id);

      console.error("[extract/email] Apify start error:", apifyError);
      return NextResponse.json({ error: "Failed to start email extractor" }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[extract/email] Error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
