import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRunStatus, getDatasetItems } from "@/lib/apify/client";
import { transformApifyItem } from "@/lib/apify/transform";
import { extractLinksFromBio } from "@/lib/utils/email-extractor";
import type { Json, Tables } from "@/types/database";

type ExtractionJob = Tables<"extraction_jobs">;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("job_id");

    if (!jobId) {
      return NextResponse.json({ error: "job_id is required" }, { status: 400 });
    }

    const { data: jobData, error } = await supabase
      .from("extraction_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    const job = jobData as ExtractionJob | null;

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.apify_run_id) {
      return NextResponse.json({ status: job.status, total_extracted: 0 });
    }

    // Check Apify run status
    const run = await getRunStatus(job.apify_run_id);

    if (!run) {
      return NextResponse.json({ status: "failed", error: "Run not found on Apify" });
    }

    if (run.status === "SUCCEEDED" && job.status !== "completed") {
      // Fetch results and save
      const items = await getDatasetItems(run.defaultDatasetId);

      // Look up source keyword/tag for extracted_keywords field
      let sourceKeyword: string | null = null;
      if (job.type === "keyword" && job.source_id) {
        const { data: kwData } = await supabase
          .from("keywords")
          .select("keyword")
          .eq("id", job.source_id)
          .single();
        sourceKeyword = kwData?.keyword ?? null;
      } else if (job.type === "tagged" && job.source_id) {
        const { data: tagData } = await supabase
          .from("tagged_accounts")
          .select("account_username")
          .eq("id", job.source_id)
          .single();
        sourceKeyword = tagData?.account_username ? `@${tagData.account_username}` : null;
      }

      let newCount = 0;
      // Track processed platform_ids to avoid duplicate processing
      // (e.g., IG reel scraper returns multiple reels per user)
      const processedIds = new Set<string>();

      for (const item of items) {
        const record = item as Record<string, unknown>;
        const transformed = transformApifyItem(record, job.platform);
        if (!transformed || !transformed.platform_id) continue;

        // Skip if we already processed this platform_id in this batch
        const dedupeKey = `${transformed.platform}:${transformed.platform_id}`;
        if (processedIds.has(dedupeKey)) continue;
        processedIds.add(dedupeKey);

        const externalUrl = (record.externalUrl ?? record.externalUrlShimmed ?? null) as string | null;
        const bioLinks = extractLinksFromBio(transformed.bio, externalUrl);

        // Upsert influencer
        const { data: existing } = await supabase
          .from("influencers")
          .select("id")
          .eq("platform", job.platform)
          .eq("platform_id", transformed.platform_id)
          .single();

        if (!existing) {
          const { data: newInf, error: insertErr } = await supabase
            .from("influencers")
            .insert({
              platform: transformed.platform,
              platform_id: transformed.platform_id,
              username: transformed.username,
              display_name: transformed.display_name,
              profile_url: transformed.profile_url,
              profile_image_url: transformed.profile_image_url,
              bio: transformed.bio,
              follower_count: transformed.follower_count,
              following_count: transformed.following_count,
              post_count: transformed.post_count,
              engagement_rate: transformed.engagement_rate,
              email: transformed.email,
              email_source: transformed.email_source,
              country: transformed.country,
              language: transformed.language,
              raw_data: transformed.raw_data,
              extracted_keywords: sourceKeyword ? [sourceKeyword] : [],
            })
            .select("id")
            .single();

          if (insertErr) {
            // Handle race condition: another job might have inserted this influencer
            console.error(`[extract/status] Insert influencer error: ${insertErr.message}`);
            // Try to find the existing record that was just inserted
            const { data: justInserted } = await supabase
              .from("influencers")
              .select("id")
              .eq("platform", job.platform)
              .eq("platform_id", transformed.platform_id)
              .single();
            if (justInserted && job.campaign_id) {
              await supabase
                .from("campaign_influencers")
                .upsert({
                  campaign_id: job.campaign_id,
                  influencer_id: justInserted.id,
                  status: "extracted",
                }, { onConflict: "campaign_id,influencer_id" });
            }
            continue;
          }

          if (newInf) {
            newCount++;
            // Link to campaign (only if campaign_id is provided)
            if (job.campaign_id) {
              await supabase
                .from("campaign_influencers")
                .upsert({
                  campaign_id: job.campaign_id,
                  influencer_id: newInf.id,
                  status: "extracted",
                }, { onConflict: "campaign_id,influencer_id" });
            }

            // Store bio links for future linktree scraping if no email found
            if (!transformed.email && bioLinks.length > 0) {
              for (const url of bioLinks) {
                await supabase
                  .from("influencer_links")
                  .upsert(
                    { influencer_id: newInf.id, url, scraped: false },
                    { onConflict: "influencer_id,url" }
                  );
              }
            }
          }
        } else {
          // Update existing influencer with latest data
          const updateData: Record<string, unknown> = {
            username: transformed.username || undefined,
            display_name: transformed.display_name || undefined,
            profile_image_url: transformed.profile_image_url || undefined,
            bio: transformed.bio || undefined,
            follower_count: transformed.follower_count,
            following_count: transformed.following_count,
            post_count: transformed.post_count,
            raw_data: transformed.raw_data,
            last_updated_at: new Date().toISOString(),
          };
          // Update email only if we found one
          if (transformed.email) {
            updateData.email = transformed.email;
            updateData.email_source = transformed.email_source;
          }
          // Remove undefined values
          Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) delete updateData[key];
          });
          await supabase
            .from("influencers")
            .update(updateData)
            .eq("id", existing.id);

          // Append keyword to extracted_keywords if not already present
          if (sourceKeyword) {
            const { data: infKw } = await supabase
              .from("influencers")
              .select("extracted_keywords")
              .eq("id", existing.id)
              .single();
            const currentKws = (infKw?.extracted_keywords as string[] | null) ?? [];
            if (!currentKws.includes(sourceKeyword)) {
              await supabase
                .from("influencers")
                .update({ extracted_keywords: [...currentKws, sourceKeyword] })
                .eq("id", existing.id);
            }
          }

          // Link existing to campaign (only if campaign_id is provided)
          if (job.campaign_id) {
            await supabase
              .from("campaign_influencers")
              .upsert({
                campaign_id: job.campaign_id,
                influencer_id: existing.id,
                status: "extracted",
              }, { onConflict: "campaign_id,influencer_id" });
          }

          // Store bio links for existing influencers without email
          if (!transformed.email && bioLinks.length > 0) {
            const { data: infCheck } = await supabase
              .from("influencers")
              .select("email")
              .eq("id", existing.id)
              .single();

            if (infCheck && !infCheck.email) {
              for (const url of bioLinks) {
                await supabase
                  .from("influencer_links")
                  .upsert(
                    { influencer_id: existing.id, url, scraped: false },
                    { onConflict: "influencer_id,url" }
                  );
              }
            }
          }
        }
      }

      // Update job status — unique influencer count, not raw item count
      await supabase
        .from("extraction_jobs")
        .update({
          status: "completed",
          total_extracted: processedIds.size,
          new_extracted: newCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json({
        status: "completed",
        total_extracted: processedIds.size,
        new_extracted: newCount,
      });
    } else if (run.status === "FAILED" || run.status === "ABORTED") {
      await supabase
        .from("extraction_jobs")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", jobId);

      return NextResponse.json({ status: "failed", error: `Apify run ${run.status}` });
    }

    return NextResponse.json({ status: "running", total_extracted: job.total_extracted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[extract/status] Error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
