import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runActor, getRunStatus, getDatasetItems } from "@/lib/apify/client";
import { APIFY_ACTORS, getDefaultInput } from "@/lib/apify/actors";
import { extractEmailFromBio } from "@/lib/utils/email-extractor";
import type { Tables } from "@/types/database";

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

    // Use Apify EMAIL_EXTRACTOR to scrape links
    const urls = links.map((l) => l.url);
    const input = getDefaultInput(APIFY_ACTORS.EMAIL_EXTRACTOR, {});
    (input as Record<string, unknown>).urls = urls;

    try {
      const run = await runActor(APIFY_ACTORS.EMAIL_EXTRACTOR, input as Record<string, unknown>);

      // Poll for completion (max 60 seconds)
      let attempts = 0;
      const maxAttempts = 12;
      let runStatus = run.status;

      while (runStatus !== "SUCCEEDED" && runStatus !== "FAILED" && runStatus !== "ABORTED" && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const statusCheck = await getRunStatus(run.id);
        if (statusCheck) {
          runStatus = statusCheck.status;
        }
        attempts++;
      }

      if (runStatus === "SUCCEEDED") {
        const items = await getDatasetItems(run.defaultDatasetId);
        let foundEmail: string | null = null;

        for (const item of items) {
          const result = item as Record<string, unknown>;
          const emails = result.emails as string[] | undefined;

          if (emails && emails.length > 0) {
            foundEmail = emails[0];
            break;
          }
        }

        // Mark all links as scraped
        for (const link of links) {
          const linkItem = items.find((item) => {
            const r = item as Record<string, unknown>;
            return r.url === link.url;
          });
          const emailsFound = linkItem
            ? ((linkItem as Record<string, unknown>).emails as string[]) ?? []
            : [];

          await supabase
            .from("influencer_links")
            .update({
              scraped: true,
              emails_found: emailsFound.length > 0 ? emailsFound : null,
              scraped_at: new Date().toISOString(),
            })
            .eq("id", link.id);
        }

        // Update influencer if email found
        if (foundEmail) {
          await supabase
            .from("influencers")
            .update({ email: foundEmail, email_source: "linktree" })
            .eq("id", influencer_id);

          return NextResponse.json({
            email: foundEmail,
            email_source: "linktree",
            already_exists: false,
          });
        }

        return NextResponse.json({
          email: null,
          email_source: null,
          message: "No email found in linked pages",
        });
      } else {
        return NextResponse.json({
          error: "Email extraction failed or timed out",
          status: runStatus,
        }, { status: 500 });
      }
    } catch (apifyError) {
      return NextResponse.json({ error: "Failed to run email extractor" }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
