import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRunStatus, getDatasetItems } from "@/lib/apify/client";
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

      let newCount = 0;
      for (const item of items) {
        const record = item as Record<string, unknown>;
        const username = (record.ownerUsername ?? record.username ?? record.authorMeta?.toString() ?? "") as string;
        const platformId = (record.ownerId ?? record.id ?? record.authorId ?? "") as string;

        if (!username && !platformId) continue;

        // Upsert influencer
        const { data: existing } = await supabase
          .from("influencers")
          .select("id")
          .eq("platform", job.platform)
          .eq("platform_id", platformId)
          .single();

        if (!existing) {
          const { data: newInf } = await supabase
            .from("influencers")
            .insert({
              platform: job.platform,
              platform_id: platformId,
              username,
              display_name: (record.ownerFullName ?? record.fullName ?? record.nickName ?? "") as string,
              profile_url: (record.url ?? record.profileUrl ?? "") as string,
              profile_image_url: (record.profilePicUrl ?? record.avatar ?? "") as string,
              bio: (record.biography ?? record.signature ?? record.description ?? "") as string,
              follower_count: (record.followersCount ?? record.fans ?? record.subscriberCount ?? null) as number | null,
              following_count: (record.followsCount ?? record.following ?? null) as number | null,
              post_count: (record.postsCount ?? record.video ?? null) as number | null,
              email: (record.businessEmail ?? record.email ?? null) as string | null,
              email_source: record.businessEmail ? "bio" : null,
              raw_data: record as unknown as Json,
            })
            .select("id")
            .single();

          if (newInf) {
            newCount++;
            // Link to campaign
            await supabase
              .from("campaign_influencers")
              .upsert({
                campaign_id: job.campaign_id,
                influencer_id: newInf.id,
                status: "extracted",
              }, { onConflict: "campaign_id,influencer_id" });
          }
        } else {
          // Link existing to campaign
          await supabase
            .from("campaign_influencers")
            .upsert({
              campaign_id: job.campaign_id,
              influencer_id: existing.id,
              status: "extracted",
            }, { onConflict: "campaign_id,influencer_id" });
        }
      }

      // Update job status
      await supabase
        .from("extraction_jobs")
        .update({
          status: "completed",
          total_extracted: items.length,
          new_extracted: newCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json({
        status: "completed",
        total_extracted: items.length,
        new_extracted: newCount,
      });
    } else if (run.status === "FAILED" || run.status === "ABORTED") {
      await supabase
        .from("extraction_jobs")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", jobId);

      return NextResponse.json({ status: "failed" });
    }

    return NextResponse.json({ status: "running", total_extracted: job.total_extracted });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
