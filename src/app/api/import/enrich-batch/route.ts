import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startActor } from "@/lib/apify/client";
import { APIFY_ACTORS } from "@/lib/apify/actors";
import type { Json, Tables } from "@/types/database";

type ExtractionJob = Tables<"extraction_jobs">;

const BATCH_SIZE = 200;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { min_followers = 10000, priority } = body;

    // Find Instagram influencers that need enrichment
    // Priority: follower_count >= min_followers first, then those with null bio/display_name
    let query = supabase
      .from("influencers")
      .select("id, username, follower_count, bio, display_name")
      .eq("platform", "instagram")
      .or("bio.is.null,display_name.is.null,profile_image_url.eq.,profile_image_url.is.null")
      .not("username", "is", null)
      .limit(BATCH_SIZE);

    if (priority === "high" || min_followers > 0) {
      // High priority: only 10K+ followers
      query = query.gte("follower_count", min_followers);
    }

    query = query.order("follower_count", { ascending: false, nullsFirst: false });

    const { data: influencers, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!influencers || influencers.length === 0) {
      // If high priority returned 0, try all unenriched
      if (priority === "high" || min_followers > 0) {
        const { data: allUnenriched } = await supabase
          .from("influencers")
          .select("id, username, follower_count")
          .eq("platform", "instagram")
          .or("bio.is.null,display_name.is.null,profile_image_url.eq.,profile_image_url.is.null")
          .not("username", "is", null)
          .limit(BATCH_SIZE)
          .order("follower_count", { ascending: false, nullsFirst: false });

        if (!allUnenriched || allUnenriched.length === 0) {
          return NextResponse.json({
            message: "모든 인플루언서가 이미 보강되었습니다.",
            remaining: 0,
          });
        }

        // Use all unenriched
        return await launchEnrichment(supabase, allUnenriched as Tables<"influencers">[], "all");
      }

      return NextResponse.json({
        message: "보강이 필요한 인플루언서가 없습니다.",
        remaining: 0,
      });
    }

    return await launchEnrichment(supabase, influencers as Tables<"influencers">[], priority ?? "high");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[import/enrich-batch] Error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function launchEnrichment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  influencers: Tables<"influencers">[],
  priority: string
) {
  const usernames = influencers
    .map((inf) => inf.username)
    .filter((u): u is string => !!u && u.trim() !== "");

  const uniqueUsernames = [...new Set(usernames)];

  if (uniqueUsernames.length === 0) {
    return NextResponse.json({ error: "유효한 username이 없습니다.", count: 0 }, { status: 400 });
  }

  // Count remaining unenriched
  const { count: remainingCount } = await supabase
    .from("influencers")
    .select("id", { count: "exact", head: true })
    .eq("platform", "instagram")
    .or("bio.is.null,display_name.is.null,profile_image_url.eq.,profile_image_url.is.null")
    .not("username", "is", null);

  // Create enrichment job (campaign_id = null for global)
  const { data: jobRaw, error: jobError } = await supabase
    .from("extraction_jobs")
    .insert({
      type: "enrich",
      platform: "instagram",
      status: "running",
      input_config: {
        usernames: uniqueUsernames,
        batch_priority: priority,
        batch_size: uniqueUsernames.length,
      } as unknown as Json,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  const job = jobRaw as ExtractionJob | null;

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? "Failed to create job" }, { status: 500 });
  }

  // Start Instagram Profile Scraper
  try {
    const run = await startActor(APIFY_ACTORS.INSTAGRAM_PROFILE, {
      usernames: uniqueUsernames,
    });

    await supabase
      .from("extraction_jobs")
      .update({ apify_run_id: run.id })
      .eq("id", job.id);

    console.log(`[enrich-batch] Started enrichment: ${uniqueUsernames.length} profiles, priority=${priority}, run=${run.id}`);

    return NextResponse.json({
      job_id: job.id,
      apify_run_id: run.id,
      count: uniqueUsernames.length,
      remaining: (remainingCount ?? 0) - uniqueUsernames.length,
      status: "running",
      priority,
    });
  } catch (apifyError) {
    const msg = apifyError instanceof Error ? apifyError.message : "Failed to start profile scraper";
    console.error("[enrich-batch] Apify error:", msg);
    await supabase
      .from("extraction_jobs")
      .update({ status: "failed" })
      .eq("id", job.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: Check enrichment stats
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Total Instagram influencers
    const { count: totalCount } = await supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("platform", "instagram");

    // Enriched (has bio or display_name)
    const { count: enrichedCount } = await supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("platform", "instagram")
      .not("bio", "is", null);

    // Unenriched
    const { count: unenrichedCount } = await supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("platform", "instagram")
      .or("bio.is.null,display_name.is.null,profile_image_url.eq.,profile_image_url.is.null");

    // 10K+ followers unenriched
    const { count: highPriorityCount } = await supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("platform", "instagram")
      .gte("follower_count", 10000)
      .or("bio.is.null,display_name.is.null,profile_image_url.eq.,profile_image_url.is.null");

    // With email
    const { count: emailCount } = await supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("platform", "instagram")
      .not("email", "is", null);

    // Running enrich jobs
    const { data: runningJobs } = await supabase
      .from("extraction_jobs")
      .select("id, apify_run_id, created_at, input_config")
      .eq("type", "enrich")
      .eq("status", "running")
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      total: totalCount ?? 0,
      enriched: enrichedCount ?? 0,
      unenriched: unenrichedCount ?? 0,
      high_priority_unenriched: highPriorityCount ?? 0,
      with_email: emailCount ?? 0,
      enrichment_rate: totalCount ? Math.round(((enrichedCount ?? 0) / totalCount) * 100) : 0,
      running_jobs: runningJobs ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[import/enrich-batch] GET Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
