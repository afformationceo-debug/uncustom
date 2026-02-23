import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRunStatus, getDatasetItems, getDatasetInfo, startActor } from "@/lib/apify/client";
import { transformApifyItem } from "@/lib/apify/transform";
import { extractLinksFromBio, isEmailExtractableLink } from "@/lib/utils/email-extractor";
import { APIFY_ACTORS } from "@/lib/apify/actors";
import type { Json, Tables } from "@/types/database";

type ExtractionJob = Tables<"extraction_jobs">;

/** Normalize URL for matching: lowercase, remove trailing slash, www, query params, enforce https */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.protocol = "https:";
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `https://${host}${path}`.toLowerCase();
  } catch {
    return url.replace(/\/+$/, "").replace(/^http:/, "https:").replace(/\?.*$/, "").toLowerCase();
  }
}

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

      // Route to enrichment handler if this is an enrich job
      if (job.type === "enrich") {
        return handleEnrichmentResults(supabase, job, items, jobId);
      }

      // Route to email_scrape handler if this is a batch email scrape job
      if (job.type === "email_scrape") {
        return handleEmailScrapeResults(supabase, job, items, jobId);
      }

      // (email_social type removed — now uses email_scrape with EMAIL_EXTRACTOR)

      // Regular extraction handling (keyword/tagged)
      return handleExtractionResults(supabase, job, items, jobId);
    } else if (run.status === "FAILED" || run.status === "ABORTED") {
      await supabase
        .from("extraction_jobs")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", jobId);

      return NextResponse.json({ status: "failed", error: `Apify run ${run.status}` });
    }

    // Get real-time item count from the dataset (not from run.stats which has no itemCount)
    let itemCount = job.total_extracted ?? 0;
    if (run.defaultDatasetId) {
      try {
        const datasetInfo = await getDatasetInfo(run.defaultDatasetId);
        if (datasetInfo && typeof datasetInfo.itemCount === "number") {
          itemCount = datasetInfo.itemCount;
        }
      } catch {
        // Dataset info fetch failed, use existing count
      }
    }
    return NextResponse.json({ status: "running", total_extracted: itemCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[extract/status] Error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Handle regular extraction results (keyword/tagged scrapers)
 * Inserts new influencers or updates existing ones, links to campaign
 */
async function handleExtractionResults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ExtractionJob,
  items: Record<string, unknown>[],
  jobId: string,
) {
  // Look up source keyword/tag for extracted_keywords / extracted_from_tags fields
  let sourceKeyword: string | null = null;
  let sourceTag: string | null = null;
  let sourceCountry: string | null = null;
  if (job.type === "keyword" && job.source_id) {
    const { data: kwData } = await supabase
      .from("keywords")
      .select("keyword, target_country")
      .eq("id", job.source_id)
      .single();
    sourceKeyword = kwData?.keyword ?? null;
    // Set country from keyword's target_country (if specific, not 'ALL')
    if (kwData?.target_country && kwData.target_country !== "ALL") {
      sourceCountry = kwData.target_country;
    }
  } else if (job.type === "tagged" && job.source_id) {
    const { data: tagData } = await supabase
      .from("tagged_accounts")
      .select("account_username, target_country")
      .eq("id", job.source_id)
      .single();
    sourceTag = tagData?.account_username ? `@${tagData.account_username}` : null;
    if (tagData?.target_country && tagData.target_country !== "ALL") {
      sourceCountry = tagData.target_country;
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 1: Group items by (platform, platform_id) to collect ALL posts per user
  // Hashtag scraper returns one item per post, so a user with 5 posts = 5 items.
  // We accumulate them into _collectedPosts in raw_data.
  // ---------------------------------------------------------------------------
  type UserGroup = {
    transformed: ReturnType<typeof transformApifyItem> & {};
    rawItems: Record<string, unknown>[];
  };
  const groupedByUser = new Map<string, UserGroup>();

  for (const item of items) {
    const record = item as Record<string, unknown>;
    const transformed = transformApifyItem(record, job.platform);
    if (!transformed || !transformed.platform_id) continue;

    const dedupeKey = `${transformed.platform}:${transformed.platform_id}`;
    const existing = groupedByUser.get(dedupeKey);
    if (existing) {
      existing.rawItems.push(record);
    } else {
      groupedByUser.set(dedupeKey, { transformed, rawItems: [record] });
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Process each unique user with accumulated posts
  // ---------------------------------------------------------------------------
  console.log(`[handleExtractionResults] ${job.platform} ${job.type}: ${items.length} raw items → ${groupedByUser.size} unique users`);
  let newCount = 0;

  for (const [, { transformed, rawItems }] of groupedByUser) {
    // Build collected posts array from all raw items
    const collectedPosts: Record<string, unknown>[] = rawItems.map((raw) => ({
      displayUrl: raw.displayUrl ?? raw.thumbnailSrc ?? null,
      videoUrl: raw.videoUrl ?? null,
      caption: raw.caption ?? raw.text ?? null,
      likesCount: raw.likesCount ?? raw.diggCount ?? null,
      commentsCount: raw.commentsCount ?? raw.commentCount ?? null,
      viewCount: raw.viewCount ?? raw.playCount ?? null,
      url: raw.url ?? null,
      shortCode: raw.shortCode ?? null,
      type: raw.type ?? (raw.videoUrl ? "Video" : "Image"),
      timestamp: raw.timestamp ?? raw.createTimeISO ?? null,
    }));

    // Use first item as base raw_data, attach all collected posts
    const enrichedRawData = {
      ...(rawItems[0]),
      _collectedPosts: collectedPosts,
    } as unknown as Json;

    const externalUrl = (rawItems[0].externalUrl ?? rawItems[0].externalUrlShimmed ?? null) as string | null;
    const bioLinks = extractLinksFromBio(transformed.bio, externalUrl);

    // Upsert influencer
    const { data: existingInf } = await supabase
      .from("influencers")
      .select("id, raw_data, country")
      .eq("platform", transformed.platform)
      .eq("platform_id", transformed.platform_id)
      .single();

    if (!existingInf) {
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
          country: transformed.country || sourceCountry,
          language: transformed.language,
          raw_data: enrichedRawData,
          extracted_keywords: sourceKeyword ? [sourceKeyword] : [],
          extracted_from_tags: sourceTag ? [sourceTag] : [],
          import_source: sourceKeyword
            ? `apify:keyword:${sourceKeyword}`
            : sourceTag
              ? `apify:tagged:${sourceTag}`
              : `apify:${job.type}`,
          // Platform-specific fields
          is_blue_verified: transformed.is_blue_verified,
          verified_type: transformed.verified_type,
          location: transformed.location,
          heart_count: transformed.heart_count,
          share_count: transformed.share_count,
          total_views: transformed.total_views,
          channel_joined_date: transformed.channel_joined_date,
          is_monetized: transformed.is_monetized,
          external_url: transformed.external_url,
          avg_likes: transformed.avg_likes,
          avg_comments: transformed.avg_comments,
          avg_views: transformed.avg_views,
          avg_shares: transformed.avg_shares,
          // Content source fields
          source_content_url: transformed.source_content_url,
          source_content_text: transformed.source_content_text,
          source_content_media: transformed.source_content_media,
          source_content_created_at: transformed.source_content_created_at,
          content_language: transformed.content_language,
          content_hashtags: transformed.content_hashtags,
          // Profile extended fields
          account_created_at: transformed.account_created_at,
          is_private: transformed.is_private ?? false,
          cover_image_url: transformed.cover_image_url,
          // Engagement metrics
          bookmark_count: transformed.bookmark_count,
          quote_count: transformed.quote_count,
          favourites_count: transformed.favourites_count,
          video_duration: transformed.video_duration,
          video_title: transformed.video_title,
          // Extended actor fields
          listed_count: transformed.listed_count,
          media_count: transformed.media_count,
          is_sponsored: transformed.is_sponsored ?? false,
          is_retweet: transformed.is_retweet ?? false,
          is_reply: transformed.is_reply ?? false,
          mentions: transformed.mentions,
          music_info: transformed.music_info,
          product_type: transformed.product_type,
          // Existing DB fields from transform
          is_verified: transformed.is_verified ?? false,
          category: transformed.category,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error(`[extract/status] Insert influencer error: ${insertErr.message}`);
        const { data: justInserted } = await supabase
          .from("influencers")
          .select("id")
          .eq("platform", transformed.platform)
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
        if (job.campaign_id) {
          await supabase
            .from("campaign_influencers")
            .upsert({
              campaign_id: job.campaign_id,
              influencer_id: newInf.id,
              status: "extracted",
            }, { onConflict: "campaign_id,influencer_id" });
        }

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
      // Merge raw_data: preserve existing latestPosts/profile data, add new collected posts
      const existingRaw = (existingInf.raw_data ?? {}) as Record<string, unknown>;
      const existingCollected = (existingRaw._collectedPosts ?? []) as Record<string, unknown>[];
      // Merge new collected posts with existing ones (dedup by url or shortCode)
      const existingUrls = new Set(existingCollected.map((p) => p.url ?? p.shortCode).filter(Boolean));
      const newPosts = collectedPosts.filter((p) => !existingUrls.has(p.url ?? p.shortCode));
      const mergedPosts = [...existingCollected, ...newPosts].slice(0, 30); // cap at 30

      // Build merged raw_data: keep existing profile data (latestPosts etc), update posts
      // CRITICAL: Preserve enrichment fields from profile scraper that re-extraction would overwrite
      const mergedRawData = {
        ...existingRaw,
        ...(rawItems[0]),
        _collectedPosts: mergedPosts,
        // Preserve profile scraper enrichment data if present in existing
        latestPosts: existingRaw.latestPosts ?? undefined,
        biography: existingRaw.biography ?? (rawItems[0] as Record<string, unknown>).biography ?? undefined,
        followersCount: existingRaw.followersCount ?? (rawItems[0] as Record<string, unknown>).followersCount ?? undefined,
        followsCount: existingRaw.followsCount ?? (rawItems[0] as Record<string, unknown>).followsCount ?? undefined,
        businessEmail: existingRaw.businessEmail ?? (rawItems[0] as Record<string, unknown>).businessEmail ?? undefined,
        profilePicUrlHD: existingRaw.profilePicUrlHD ?? (rawItems[0] as Record<string, unknown>).profilePicUrlHD ?? undefined,
        isBusinessAccount: existingRaw.isBusinessAccount ?? (rawItems[0] as Record<string, unknown>).isBusinessAccount ?? undefined,
        businessCategoryName: existingRaw.businessCategoryName ?? (rawItems[0] as Record<string, unknown>).businessCategoryName ?? undefined,
      } as unknown as Json;

      const updateData: Record<string, unknown> = {
        username: transformed.username || undefined,
        display_name: transformed.display_name || undefined,
        profile_image_url: transformed.profile_image_url || undefined,
        bio: transformed.bio || undefined,
        follower_count: transformed.follower_count,
        following_count: transformed.following_count,
        post_count: transformed.post_count,
        raw_data: mergedRawData,
        last_updated_at: new Date().toISOString(),
      };
      if (transformed.email) {
        updateData.email = transformed.email;
        updateData.email_source = transformed.email_source;
      }
      // Platform-specific fields
      if (transformed.is_blue_verified !== null) updateData.is_blue_verified = transformed.is_blue_verified;
      if (transformed.verified_type) updateData.verified_type = transformed.verified_type;
      if (transformed.location) updateData.location = transformed.location;
      if (transformed.heart_count !== null) updateData.heart_count = transformed.heart_count;
      if (transformed.share_count !== null) updateData.share_count = transformed.share_count;
      if (transformed.total_views !== null) updateData.total_views = transformed.total_views;
      if (transformed.channel_joined_date) updateData.channel_joined_date = transformed.channel_joined_date;
      if (transformed.is_monetized !== null) updateData.is_monetized = transformed.is_monetized;
      if (transformed.external_url) updateData.external_url = transformed.external_url;
      if (transformed.avg_likes !== null) updateData.avg_likes = transformed.avg_likes;
      if (transformed.avg_comments !== null) updateData.avg_comments = transformed.avg_comments;
      if (transformed.avg_views !== null) updateData.avg_views = transformed.avg_views;
      if (transformed.avg_shares !== null) updateData.avg_shares = transformed.avg_shares;
      // Content source fields
      if (transformed.source_content_url) updateData.source_content_url = transformed.source_content_url;
      if (transformed.source_content_text) updateData.source_content_text = transformed.source_content_text;
      if (transformed.source_content_media) updateData.source_content_media = transformed.source_content_media;
      if (transformed.source_content_created_at) updateData.source_content_created_at = transformed.source_content_created_at;
      if (transformed.content_language) updateData.content_language = transformed.content_language;
      if (transformed.content_hashtags) updateData.content_hashtags = transformed.content_hashtags;
      // Profile extended fields
      if (transformed.account_created_at) updateData.account_created_at = transformed.account_created_at;
      if (transformed.is_private !== null) updateData.is_private = transformed.is_private;
      if (transformed.cover_image_url) updateData.cover_image_url = transformed.cover_image_url;
      // Engagement metrics
      if (transformed.bookmark_count !== null) updateData.bookmark_count = transformed.bookmark_count;
      if (transformed.quote_count !== null) updateData.quote_count = transformed.quote_count;
      if (transformed.favourites_count !== null) updateData.favourites_count = transformed.favourites_count;
      if (transformed.video_duration !== null) updateData.video_duration = transformed.video_duration;
      if (transformed.video_title) updateData.video_title = transformed.video_title;
      // Extended actor fields
      if (transformed.listed_count !== null) updateData.listed_count = transformed.listed_count;
      if (transformed.media_count !== null) updateData.media_count = transformed.media_count;
      if (transformed.is_sponsored !== null) updateData.is_sponsored = transformed.is_sponsored;
      if (transformed.is_retweet !== null) updateData.is_retweet = transformed.is_retweet;
      if (transformed.is_reply !== null) updateData.is_reply = transformed.is_reply;
      if (transformed.mentions) updateData.mentions = transformed.mentions;
      if (transformed.music_info) updateData.music_info = transformed.music_info;
      if (transformed.product_type) updateData.product_type = transformed.product_type;
      // Existing DB fields
      if (transformed.is_verified !== null) updateData.is_verified = transformed.is_verified;
      if (transformed.category) updateData.category = transformed.category;
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key];
      });
      await supabase
        .from("influencers")
        .update(updateData)
        .eq("id", existingInf.id);

      if (sourceKeyword) {
        const { data: infKw } = await supabase
          .from("influencers")
          .select("extracted_keywords")
          .eq("id", existingInf.id)
          .single();
        const currentKws = (infKw?.extracted_keywords as string[] | null) ?? [];
        if (!currentKws.includes(sourceKeyword)) {
          await supabase
            .from("influencers")
            .update({ extracted_keywords: [...currentKws, sourceKeyword] })
            .eq("id", existingInf.id);
        }
      }

      if (sourceTag) {
        const { data: infTag } = await supabase
          .from("influencers")
          .select("extracted_from_tags")
          .eq("id", existingInf.id)
          .single();
        const currentTags = (infTag?.extracted_from_tags as string[] | null) ?? [];
        if (!currentTags.includes(sourceTag)) {
          await supabase
            .from("influencers")
            .update({ extracted_from_tags: [...currentTags, sourceTag] })
            .eq("id", existingInf.id);
        }
      }

      // Set country from keyword target_country if influencer doesn't have one
      if (sourceCountry && !existingInf.country) {
        await supabase
          .from("influencers")
          .update({ country: sourceCountry })
          .eq("id", existingInf.id);
      }

      if (job.campaign_id) {
        await supabase
          .from("campaign_influencers")
          .upsert({
            campaign_id: job.campaign_id,
            influencer_id: existingInf.id,
            status: "extracted",
          }, { onConflict: "campaign_id,influencer_id" });
      }

      if (!transformed.email && bioLinks.length > 0) {
        const { data: infCheck } = await supabase
          .from("influencers")
          .select("email")
          .eq("id", existingInf.id)
          .single();

        if (infCheck && !infCheck.email) {
          for (const url of bioLinks) {
            await supabase
              .from("influencer_links")
              .upsert(
                { influencer_id: existingInf.id, url, scraped: false },
                { onConflict: "influencer_id,url" }
              );
          }
        }
      }
    }
  }

  // Update job status
  const totalUsers = groupedByUser.size;
  await supabase
    .from("extraction_jobs")
    .update({
      status: "completed",
      total_extracted: totalUsers,
      new_extracted: newCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  // Auto-trigger profile enrichment for Instagram extraction (both global and campaign-scoped)
  let enrichJobId: string | null = null;
  if (job.platform === "instagram") {
    if (job.campaign_id) {
      enrichJobId = await autoTriggerEnrichment(supabase, job.campaign_id);
    } else {
      enrichJobId = await autoTriggerGlobalEnrichment(supabase);
    }
  }

  // Auto-trigger batch email extraction (all platforms, all unscraped links in one run)
  let emailJobId: string | null = null;
  try {
    emailJobId = await autoTriggerBatchEmailExtraction(supabase, job.campaign_id);
  } catch (err) {
    console.error("[extract/status] Auto batch email extraction error:", err);
  }

  return NextResponse.json({
    status: "completed",
    total_extracted: totalUsers,
    new_extracted: newCount,
    enrich_job_id: enrichJobId,
    email_job_id: emailJobId,
  });
}

/**
 * Handle enrichment results (profile scraper output)
 * Updates existing influencers with follower_count, bio, email, etc.
 */
async function handleEnrichmentResults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ExtractionJob,
  items: Record<string, unknown>[],
  jobId: string,
) {
  let enrichedCount = 0;
  let emailsFound = 0;
  const processedUsernames = new Set<string>();

  for (const item of items) {
    const record = item as Record<string, unknown>;
    const transformed = transformApifyItem(record, "instagram");
    if (!transformed) continue;
    // Accept results even without username - we can match by platform_id
    if (!transformed.username && !transformed.platform_id) continue;

    // Deduplicate by username or platform_id
    const dedupeKey = (transformed.username || transformed.platform_id || "").toLowerCase();
    if (processedUsernames.has(dedupeKey)) continue;
    processedUsernames.add(dedupeKey);

    // Try matching by platform_id first (more reliable than username)
    let existing: { id: string; email: string | null; follower_count: number | null } | null = null;

    if (transformed.platform_id) {
      const { data: byPlatformId } = await supabase
        .from("influencers")
        .select("id, email, follower_count")
        .eq("platform", "instagram")
        .eq("platform_id", transformed.platform_id)
        .single();
      existing = byPlatformId;
    }

    // Fallback: match by username (case-insensitive)
    if (!existing && transformed.username) {
      const { data: byUsername } = await supabase
        .from("influencers")
        .select("id, email, follower_count")
        .eq("platform", "instagram")
        .ilike("username", transformed.username)
        .single();
      existing = byUsername;
    }

    if (!existing) continue;

    await enrichInfluencer(supabase, existing, transformed, record);
    enrichedCount++;
    if (transformed.email && !existing.email) emailsFound++;
  }

  // Update job status
  await supabase
    .from("extraction_jobs")
    .update({
      status: "completed",
      total_extracted: enrichedCount,
      new_extracted: emailsFound,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  // Auto-trigger batch email extraction (all unscraped links in one run)
  let emailScrapeJobId: string | null = null;
  try {
    emailScrapeJobId = await autoTriggerBatchEmailExtraction(supabase, job.campaign_id);
  } catch (err) {
    console.error("[extract/status] Auto batch email extraction error:", err);
  }

  return NextResponse.json({
    status: "completed",
    total_extracted: enrichedCount,
    new_extracted: emailsFound,
    type: "enrich",
    email_scrape_job_id: emailScrapeJobId,
  });
}

/**
 * Update a single influencer with profile enrichment data
 */
async function enrichInfluencer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  existing: { id: string; email: string | null; follower_count: number | null },
  transformed: ReturnType<typeof transformApifyItem> & {},
  record: Record<string, unknown>,
) {
  // Build update data - only overwrite with non-null values
  const updateData: Record<string, unknown> = {
    last_updated_at: new Date().toISOString(),
  };

  // CRITICAL: Update all fields from profile scraper enrichment.
  // Hashtag scraper doesn't return profile pics, follower counts, or bio - profile scraper fills these in.
  if (transformed.username) updateData.username = transformed.username;
  if (transformed.follower_count !== null) updateData.follower_count = transformed.follower_count;
  if (transformed.following_count !== null) updateData.following_count = transformed.following_count;
  if (transformed.post_count !== null) updateData.post_count = transformed.post_count;
  if (transformed.bio) updateData.bio = transformed.bio;
  if (transformed.display_name) updateData.display_name = transformed.display_name;
  // Profile image: always update if we got a valid URL (even if existing was empty string "")
  if (transformed.profile_image_url && transformed.profile_image_url.startsWith("http")) {
    updateData.profile_image_url = transformed.profile_image_url;
  }
  if (transformed.profile_url) updateData.profile_url = transformed.profile_url;
  if (transformed.platform_id) updateData.platform_id = transformed.platform_id;
  if (transformed.engagement_rate !== null) {
    updateData.engagement_rate = transformed.engagement_rate;
  } else if (transformed.follower_count && transformed.follower_count > 0 && Array.isArray(record.latestPosts)) {
    // Calculate engagement_rate from latestPosts: avg(likes + comments) / follower_count
    const posts = record.latestPosts as Record<string, unknown>[];
    const recentPosts = posts.slice(0, 12);
    if (recentPosts.length > 0) {
      let totalEngagement = 0;
      for (const post of recentPosts) {
        const likes = Number(post.likesCount ?? post.likes ?? 0) || 0;
        const comments = Number(post.commentsCount ?? post.comments ?? 0) || 0;
        totalEngagement += likes + comments;
      }
      const avgEngagement = totalEngagement / recentPosts.length;
      const rate = avgEngagement / transformed.follower_count;
      updateData.engagement_rate = Math.round(rate * 10000) / 10000; // Store as decimal (e.g., 0.0345 = 3.45%)
    }
  }

  // Map profile scraper fields to new columns
  // Profile Scraper uses "verified" (NOT "isVerified")
  if (record.verified === true) updateData.is_verified = true;
  else if (record.verified === false) updateData.is_verified = false;
  if (record.isBusinessAccount === true) updateData.is_business = true;
  else if (record.isBusinessAccount === false) updateData.is_business = false;
  if (record.businessCategoryName && typeof record.businessCategoryName === "string") {
    let cat = record.businessCategoryName;
    // Profile Scraper sometimes returns "None,Category" format - strip "None,"
    if (cat.startsWith("None,")) cat = cat.replace("None,", "").trim();
    if (cat && cat !== "None") updateData.category = cat;
  }

  // External URL from profile scraper
  const enrichExternalUrl = (record.externalUrl ?? record.externalUrlShimmed) as string | undefined;
  if (enrichExternalUrl) updateData.external_url = enrichExternalUrl;

  // Compute avg metrics from latestPosts
  if (Array.isArray(record.latestPosts)) {
    const posts = record.latestPosts as Record<string, unknown>[];
    const recentPosts = posts.slice(0, 12);
    if (recentPosts.length > 0) {
      let totalLikes = 0, totalComments = 0, totalViews = 0;
      for (const post of recentPosts) {
        totalLikes += Number(post.likesCount ?? post.likes ?? 0) || 0;
        totalComments += Number(post.commentsCount ?? post.comments ?? 0) || 0;
        totalViews += Number(post.videoViewCount ?? post.viewCount ?? 0) || 0;
      }
      updateData.avg_likes = Math.round(totalLikes / recentPosts.length);
      updateData.avg_comments = Math.round(totalComments / recentPosts.length);
      if (totalViews > 0) updateData.avg_views = Math.round(totalViews / recentPosts.length);
    }
  }

  // Update email: businessEmail always takes priority over regex-extracted email
  const businessEmail = record.businessEmail as string | null;
  if (businessEmail && businessEmail.includes("@")) {
    // businessEmail from Profile Scraper - highest priority, always overwrite
    updateData.email = businessEmail;
    updateData.email_source = "business";
  } else if (transformed.email && !existing.email) {
    // Bio regex email - only if influencer doesn't already have one
    updateData.email = transformed.email;
    updateData.email_source = transformed.email_source;
  }

  // Merge raw_data: preserve _collectedPosts from extraction, add profile data + latestPosts
  const { data: currentInf } = await supabase
    .from("influencers")
    .select("raw_data")
    .eq("id", existing.id)
    .single();
  const existingRaw = (currentInf?.raw_data ?? {}) as Record<string, unknown>;
  const collectedPosts = existingRaw._collectedPosts ?? [];

  // Profile scraper returns latestPosts - these are preserved via ...record spread
  const hasLatestPosts = Array.isArray(record.latestPosts) && (record.latestPosts as unknown[]).length > 0;
  updateData.raw_data = {
    ...record,
    _collectedPosts: collectedPosts, // Preserve posts from extraction
  } as unknown as Json;

  const updatedFields = Object.keys(updateData).filter(k => k !== "last_updated_at" && k !== "raw_data");
  console.log(`[enrichInfluencer] ${transformed.username || transformed.platform_id}: updating [${updatedFields.join(", ")}]${hasLatestPosts ? ` + ${(record.latestPosts as unknown[]).length} latestPosts` : ""}`);

  await supabase
    .from("influencers")
    .update(updateData)
    .eq("id", existing.id);

  // Store bio links for email extraction - always save (even if email exists, better email may be found)
  // Filter out Amazon, YouTube, TikTok etc. that never have personal emails
  {
    const externalUrl = (record.externalUrl ?? record.externalUrlShimmed ?? null) as string | null;
    const bioLinks = extractLinksFromBio(transformed.bio, externalUrl);
    const extractableLinks = bioLinks.filter(url => isEmailExtractableLink(url));

    if (extractableLinks.length > 0) {
      for (const url of extractableLinks) {
        await supabase
          .from("influencer_links")
          .upsert(
            { influencer_id: existing.id, url, scraped: false },
            { onConflict: "influencer_id,url" }
          );
      }
      console.log(`[enrichInfluencer] ${transformed.username}: stored ${extractableLinks.length}/${bioLinks.length} extractable bio links`);
    }
  }
}

/**
 * Auto-trigger profile enrichment for Instagram influencers lacking follower data
 */
async function autoTriggerEnrichment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
): Promise<string | null> {
  try {
    // Check if there's already a running enrichment job for this campaign
    const { data: existingEnrich } = await supabase
      .from("extraction_jobs")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("type", "enrich")
      .eq("platform", "instagram")
      .in("status", ["running", "pending"])
      .limit(1);

    if (existingEnrich && existingEnrich.length > 0) {
      console.log("[extract/status] Enrichment already running for campaign:", campaignId);
      return null;
    }

    // Find Instagram influencers in campaign that need enrichment
    // (missing follower_count OR missing profile_image_url)
    const { data: ciData } = await supabase
      .from("campaign_influencers")
      .select("influencer_id")
      .eq("campaign_id", campaignId);

    if (!ciData || ciData.length === 0) return null;

    const infIds = ciData.map((ci) => ci.influencer_id);
    // Find influencers needing enrichment: follower_count is null OR profile_image_url is empty
    const { data: unenriched } = await supabase
      .from("influencers")
      .select("id, username, platform_id, follower_count, profile_image_url")
      .eq("platform", "instagram")
      .in("id", infIds)
      .or("follower_count.is.null,profile_image_url.eq.,profile_image_url.is.null");

    if (!unenriched || unenriched.length === 0) {
      console.log("[extract/status] No Instagram influencers need enrichment in campaign:", campaignId);
      return null;
    }

    // Log why each influencer needs enrichment
    const needsFollowers = unenriched.filter((inf) => (inf as Record<string, unknown>).follower_count === null).length;
    const needsProfilePic = unenriched.filter((inf) => {
      const pic = (inf as Record<string, unknown>).profile_image_url;
      return !pic || pic === "";
    }).length;
    console.log(`[extract/status] Campaign ${campaignId}: ${unenriched.length} need enrichment (${needsFollowers} missing followers, ${needsProfilePic} missing profile pic)`);

    // Use username when available, fall back to platform_id (numeric ownerId)
    const identifiers = unenriched
      .map((inf) => {
        const username = (inf as { username: string | null }).username;
        const platformId = (inf as { platform_id: string | null }).platform_id;
        if (username && username.trim() !== "") return username.trim();
        if (platformId && platformId.trim() !== "") return platformId.trim();
        return null;
      })
      .filter((u): u is string => !!u);

    const uniqueIdentifiers = [...new Set(identifiers)];
    if (uniqueIdentifiers.length === 0) return null;

    console.log(`[extract/status] Auto-triggering enrichment for ${uniqueIdentifiers.length} Instagram influencers`);

    // Create enrichment job
    const { data: jobData, error: jobError } = await supabase
      .from("extraction_jobs")
      .insert({
        campaign_id: campaignId,
        type: "enrich",
        platform: "instagram",
        status: "running",
        input_config: { usernames: uniqueIdentifiers } as unknown as Json,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError || !jobData) {
      console.error("[extract/status] Failed to create enrichment job:", jobError?.message);
      return null;
    }

    // Start Instagram Profile Scraper (accepts both usernames and numeric IDs)
    const run = await startActor(APIFY_ACTORS.INSTAGRAM_PROFILE, {
      usernames: uniqueIdentifiers,
    });

    await supabase
      .from("extraction_jobs")
      .update({ apify_run_id: run.id })
      .eq("id", jobData.id);

    console.log(`[extract/status] Enrichment job started: ${jobData.id} (Apify run: ${run.id})`);
    return jobData.id;
  } catch (err) {
    console.error("[extract/status] Auto-trigger enrichment error:", err);
    return null;
  }
}

/**
 * Auto-trigger global profile enrichment for Instagram influencers lacking follower data or profile pics
 * Used when extraction is global (no campaign_id)
 */
async function autoTriggerGlobalEnrichment(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  try {
    // Check if there's already a running global enrichment job
    const { data: existingEnrich } = await supabase
      .from("extraction_jobs")
      .select("id")
      .is("campaign_id", null)
      .eq("type", "enrich")
      .eq("platform", "instagram")
      .in("status", ["running", "pending"])
      .limit(1);

    if (existingEnrich && existingEnrich.length > 0) {
      console.log("[extract/status] Global enrichment already running");
      return null;
    }

    // Find ALL Instagram influencers needing enrichment (missing follower_count OR profile_image_url)
    // Select platform_id too - profile scraper accepts numeric IDs when username is empty
    const { data: unenriched } = await supabase
      .from("influencers")
      .select("id, username, platform_id, follower_count, profile_image_url")
      .eq("platform", "instagram")
      .or("follower_count.is.null,profile_image_url.eq.,profile_image_url.is.null")
      .limit(200);

    if (!unenriched || unenriched.length === 0) {
      console.log("[extract/status] No Instagram influencers need global enrichment");
      return null;
    }

    // Log why each influencer needs enrichment
    const needsFollowers = unenriched.filter((inf) => (inf as Record<string, unknown>).follower_count === null).length;
    const needsProfilePic = unenriched.filter((inf) => {
      const pic = (inf as Record<string, unknown>).profile_image_url;
      return !pic || pic === "";
    }).length;
    console.log(`[extract/status] Global: ${unenriched.length} need enrichment (${needsFollowers} missing followers, ${needsProfilePic} missing profile pic)`);

    // Use username when available, fall back to platform_id (numeric ownerId)
    // Instagram Profile Scraper accepts both usernames and numeric user IDs
    const identifiers = unenriched
      .map((inf) => {
        const username = (inf as { username: string | null }).username;
        const platformId = (inf as { platform_id: string | null }).platform_id;
        if (username && username.trim() !== "") return username.trim();
        if (platformId && platformId.trim() !== "") return platformId.trim();
        return null;
      })
      .filter((u): u is string => !!u);

    const uniqueIdentifiers = [...new Set(identifiers)];
    if (uniqueIdentifiers.length === 0) return null;

    const byIdCount = uniqueIdentifiers.filter(i => /^\d+$/.test(i)).length;
    console.log(`[extract/status] Auto-triggering global enrichment for ${uniqueIdentifiers.length} Instagram influencers (${byIdCount} by numeric ID, ${uniqueIdentifiers.length - byIdCount} by username)`);

    // Create global enrichment job (no campaign_id)
    const { data: jobData, error: jobError } = await supabase
      .from("extraction_jobs")
      .insert({
        campaign_id: null,
        type: "enrich",
        platform: "instagram",
        status: "running",
        input_config: { usernames: uniqueIdentifiers } as unknown as Json,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError || !jobData) {
      console.error("[extract/status] Failed to create global enrichment job:", jobError?.message);
      return null;
    }

    // Start Instagram Profile Scraper (accepts both usernames and numeric IDs)
    const run = await startActor(APIFY_ACTORS.INSTAGRAM_PROFILE, {
      usernames: uniqueIdentifiers,
    });

    await supabase
      .from("extraction_jobs")
      .update({ apify_run_id: run.id })
      .eq("id", jobData.id);

    console.log(`[extract/status] Global enrichment job started: ${jobData.id} (Apify run: ${run.id})`);
    return jobData.id;
  } catch (err) {
    console.error("[extract/status] Auto-trigger global enrichment error:", err);
    return null;
  }
}

/**
 * Unified batch email extraction: collects ALL unscraped links + external_url from influencers
 * without email across ALL platforms, then runs ONE Apify batch.
 * Replaces both autoTriggerEmailExtraction and autoTriggerWebEmailExtraction.
 */
async function autoTriggerBatchEmailExtraction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string | null,
): Promise<string | null> {
  try {
    // Check if there's already ANY running email_scrape job (global check, not per-platform)
    const existingQuery = supabase
      .from("extraction_jobs")
      .select("id")
      .eq("type", "email_scrape")
      .in("status", ["running", "pending"])
      .limit(1);

    if (campaignId) {
      existingQuery.eq("campaign_id", campaignId);
    } else {
      existingQuery.is("campaign_id", null);
    }

    const { data: existingJob } = await existingQuery;
    if (existingJob && existingJob.length > 0) {
      console.log("[extract/status] Email scrape already running, skipping");
      return null;
    }

    // Step 1: Find ALL influencers without email that have external_url (across ALL platforms)
    let infQuery = supabase
      .from("influencers")
      .select("id, external_url, profile_url")
      .is("email", null)
      .limit(300);

    if (campaignId) {
      const { data: ciData } = await supabase
        .from("campaign_influencers")
        .select("influencer_id")
        .eq("campaign_id", campaignId);
      if (ciData && ciData.length > 0) {
        infQuery = infQuery.in("id", ciData.map((ci) => ci.influencer_id));
      }
    }

    const { data: noEmailInfs } = await infQuery;
    const typedInfs = (noEmailInfs ?? []) as { id: string; external_url: string | null; profile_url: string | null }[];

    // Step 2: Register external_url/profile_url as influencer_links (for result matching)
    const linkMap: Record<string, { link_id: string; influencer_id: string }> = {};
    const urlsToScrape: string[] = [];

    for (const inf of typedInfs) {
      const urls: string[] = [];
      if (inf.external_url && inf.external_url.startsWith("http")) urls.push(inf.external_url);
      if (inf.profile_url && inf.profile_url.startsWith("http")) urls.push(inf.profile_url);

      for (const url of urls) {
        if (!isEmailExtractableLink(url)) continue;
        const { data: linkData } = await supabase
          .from("influencer_links")
          .upsert(
            { influencer_id: inf.id, url, scraped: false },
            { onConflict: "influencer_id,url" }
          )
          .select("id, scraped")
          .single();

        if (linkData && !linkData.scraped && !linkMap[url]) {
          urlsToScrape.push(url);
          linkMap[url] = { link_id: linkData.id, influencer_id: inf.id };
        }
      }
    }

    // Step 3: Also collect ALL existing unscraped influencer_links
    const { data: existingLinks } = await supabase
      .from("influencer_links")
      .select("id, influencer_id, url")
      .eq("scraped", false)
      .limit(300);

    if (existingLinks) {
      for (const link of existingLinks) {
        if (!linkMap[link.url] && isEmailExtractableLink(link.url)) {
          urlsToScrape.push(link.url);
          linkMap[link.url] = { link_id: link.id, influencer_id: link.influencer_id };
        }
      }
    }

    if (urlsToScrape.length === 0) {
      console.log("[extract/status] No URLs to scrape for batch email extraction");
      return null;
    }

    // Step 4: Limit to 200 URLs per batch and create ONE job
    const batchUrls = urlsToScrape.slice(0, 200);
    const batchLinkMap: Record<string, { link_id: string; influencer_id: string }> = {};
    for (const url of batchUrls) {
      if (linkMap[url]) batchLinkMap[url] = linkMap[url];
    }

    const uniqueInfluencers = new Set(Object.values(batchLinkMap).map((m) => m.influencer_id));
    console.log(`[extract/status] Batch email extraction: ${batchUrls.length} URLs from ${uniqueInfluencers.size} influencers`);

    const { data: jobData, error: jobError } = await supabase
      .from("extraction_jobs")
      .insert({
        campaign_id: campaignId,
        type: "email_scrape",
        platform: "all",
        status: "running",
        input_config: {
          urls: batchUrls,
          link_map: batchLinkMap,
          total_links: batchUrls.length,
          total_influencers: uniqueInfluencers.size,
          auto_triggered: true,
        } as unknown as Json,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError || !jobData) {
      console.error("[extract/status] Failed to create batch email job:", jobError?.message);
      return null;
    }

    // Step 5: Start ONE Apify run with ALL URLs
    try {
      const run = await startActor(APIFY_ACTORS.EMAIL_EXTRACTOR, {
        startUrls: batchUrls.map(url => ({ url })),
        maxDepth: 1,
        maxRequestsPerStartUrl: 5,
        sameDomain: true,
      });

      await supabase
        .from("extraction_jobs")
        .update({ apify_run_id: run.id })
        .eq("id", jobData.id);

      console.log(`[extract/status] Batch email job started: ${jobData.id} (${batchUrls.length} URLs, ${uniqueInfluencers.size} influencers, Apify run: ${run.id})`);
      return jobData.id;
    } catch (startErr) {
      console.error("[extract/status] Failed to start EMAIL_EXTRACTOR:", startErr);
      await supabase
        .from("extraction_jobs")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", jobData.id);
      return null;
    }
  } catch (err) {
    console.error("[extract/status] Auto batch email extraction error:", err);
    return null;
  }
}

/**
 * Handle batch email scrape results (EMAIL_EXTRACTOR actor output)
 * Matches scraped URLs back to influencer_links, updates influencers with found emails
 */
async function handleEmailScrapeResults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ExtractionJob,
  items: Record<string, unknown>[],
  jobId: string,
) {
  // Retrieve the link_map from input_config
  const inputConfig = job.input_config as Record<string, unknown> | null;
  const linkMap = (inputConfig?.link_map ?? {}) as Record<
    string,
    { link_id: string; influencer_id: string }
  >;

  let totalProcessed = 0;
  let emailsFound = 0;
  // Track which influencers already got an email in this batch to avoid overwriting
  const influencerEmailSet = new Set<string>();

  // Build normalized URL index for faster matching
  const normalizedLinkMap = new Map<string, { link_id: string; influencer_id: string }>();
  for (const [mapUrl, mapInfo] of Object.entries(linkMap)) {
    normalizedLinkMap.set(normalizeUrl(mapUrl), mapInfo);
  }

  for (const item of items) {
    const result = item as Record<string, unknown>;
    // vdrmota/contact-info-scraper returns one item per start URL:
    //   originalStartUrl: the URL we provided, emails[], phones[], scrapedUrls[]
    const originalStartUrl = result.originalStartUrl as string | undefined;
    const emails = (result.emails ?? result.email) as string[] | string | undefined;

    // Normalize emails to array, filter out generic/privacy emails
    let emailList: string[] = [];
    if (Array.isArray(emails)) {
      emailList = emails.filter((e) =>
        typeof e === "string" && e.includes("@") &&
        !e.includes("gdprlocal.com") && !e.includes("privacy@") &&
        !e.includes("dpo.support@")
      );
    } else if (typeof emails === "string" && emails.includes("@")) {
      emailList = [emails];
    }

    // Try to match this result back to a link via originalStartUrl
    let matchedLink: { link_id: string; influencer_id: string } | null = null;

    if (originalStartUrl) {
      matchedLink = linkMap[originalStartUrl] ?? normalizedLinkMap.get(normalizeUrl(originalStartUrl)) ?? null;
    }
    // Fallback: try scrapedUrls array (actual pages visited)
    if (!matchedLink && Array.isArray(result.scrapedUrls)) {
      for (const scraped of result.scrapedUrls as string[]) {
        matchedLink = linkMap[scraped] ?? normalizedLinkMap.get(normalizeUrl(scraped)) ?? null;
        if (matchedLink) break;
      }
    }

    if (!matchedLink) {
      // Could not match this result to a link, skip
      continue;
    }

    totalProcessed++;

    // Update influencer_links: mark as scraped with results
    await supabase
      .from("influencer_links")
      .update({
        scraped: true,
        emails_found: emailList.length > 0 ? emailList : null,
        scraped_at: new Date().toISOString(),
      })
      .eq("id", matchedLink.link_id);

    // If emails were found and influencer doesn't already have one from this batch
    if (emailList.length > 0 && !influencerEmailSet.has(matchedLink.influencer_id)) {
      // Check if influencer still doesn't have an email (could have been set by another process)
      const { data: infCheck } = await supabase
        .from("influencers")
        .select("email")
        .eq("id", matchedLink.influencer_id)
        .single();

      if (infCheck && !infCheck.email) {
        const foundEmail = emailList[0];
        // Extract domain from the source URL for email_source
        // Format: "linktree:https://linktr.ee/username" to include source info
        // Use originalStartUrl for source tracking
        const sourceUrl = originalStartUrl;
        let emailSource = "web-scraper";
        if (sourceUrl) {
          try {
            const urlObj = new URL(sourceUrl);
            const domain = urlObj.hostname.replace("www.", "");
            emailSource = `${domain}:${sourceUrl}`;
          } catch {
            emailSource = `link:${sourceUrl}`;
          }
        }

        await supabase
          .from("influencers")
          .update({
            email: foundEmail,
            email_source: emailSource,
          })
          .eq("id", matchedLink.influencer_id);

        influencerEmailSet.add(matchedLink.influencer_id);
        emailsFound++;
      }
    }
  }

  // Mark any remaining unmatched links as scraped (no results found)
  // This handles links that the actor didn't return results for
  const processedLinkIds = new Set<string>();
  for (const item of items) {
    const result = item as Record<string, unknown>;
    const startUrl = result.originalStartUrl as string | undefined;
    if (startUrl) {
      const match = linkMap[startUrl] ?? normalizedLinkMap.get(normalizeUrl(startUrl));
      if (match) processedLinkIds.add(match.link_id);
    }
    // Also check scrapedUrls for matching
    if (Array.isArray(result.scrapedUrls)) {
      for (const scraped of result.scrapedUrls as string[]) {
        const match = linkMap[scraped] ?? normalizedLinkMap.get(normalizeUrl(scraped));
        if (match) processedLinkIds.add(match.link_id);
      }
    }
  }

  // Get all link IDs from the original input
  const allLinkIds = Object.values(linkMap).map((m) => m.link_id);
  const unprocessedLinkIds = allLinkIds.filter((id) => !processedLinkIds.has(id));

  if (unprocessedLinkIds.length > 0) {
    // Batch update unprocessed links as scraped with no results
    for (const linkId of unprocessedLinkIds) {
      await supabase
        .from("influencer_links")
        .update({
          scraped: true,
          emails_found: null,
          scraped_at: new Date().toISOString(),
        })
        .eq("id", linkId);
    }
  }

  // Update job status
  await supabase
    .from("extraction_jobs")
    .update({
      status: "completed",
      total_extracted: totalProcessed,
      new_extracted: emailsFound,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  console.log(
    `[extract/status] Email scrape completed: ${totalProcessed} links processed, ${emailsFound} emails found`
  );

  return NextResponse.json({
    status: "completed",
    total_extracted: totalProcessed,
    new_extracted: emailsFound,
    type: "email_scrape",
  });
}

// autoTriggerWebEmailExtraction and autoTriggerEmailExtraction have been replaced by
// autoTriggerBatchEmailExtraction above — single unified batch function for all platforms.
