import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startActor, getRunStatus, getDatasetItems } from "@/lib/apify/client";
import { APIFY_ACTORS } from "@/lib/apify/actors";
import { transformApifyItem } from "@/lib/apify/transform";
import type { Tables } from "@/types/database";

type Influencer = Tables<"influencers">;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { influencer_ids } = body;

    if (!influencer_ids?.length) {
      return NextResponse.json({ error: "influencer_ids are required" }, { status: 400 });
    }

    const { data: influencerData } = await supabase
      .from("influencers")
      .select("*")
      .in("id", influencer_ids);

    const influencers = influencerData as Influencer[] | null;

    if (!influencers || influencers.length === 0) {
      return NextResponse.json({ error: "No influencers found" }, { status: 404 });
    }

    // Group by platform
    const igUsers = influencers
      .filter((i) => i.platform === "instagram" && i.username)
      .map((i) => i.username!);

    const unsupportedPlatforms = new Set(
      influencers
        .filter((i) => i.platform !== "instagram")
        .map((i) => i.platform)
    );

    let updated = 0;

    // Instagram profile refresh
    if (igUsers.length > 0) {
      const run = await startActor(APIFY_ACTORS.INSTAGRAM_PROFILE, {
        usernames: igUsers,
      });

      // Wait briefly for the profile scraper (usually fast)
      let runStatus = run.status;
      for (let i = 0; i < 12; i++) {
        if (runStatus === "SUCCEEDED" || runStatus === "FAILED" || runStatus === "ABORTED") break;
        await new Promise((r) => setTimeout(r, 5000));
        const status = await getRunStatus(run.id);
        if (status) runStatus = status.status;
      }

      if (runStatus === "SUCCEEDED") {
        const items = await getDatasetItems(run.defaultDatasetId);

        for (const item of items) {
          const record = item as Record<string, unknown>;
          const transformed = transformApifyItem(record, "instagram");
          if (!transformed || !transformed.username) continue;

          const updateData: Record<string, unknown> = {
            display_name: transformed.display_name || undefined,
            bio: transformed.bio || undefined,
            follower_count: transformed.follower_count,
            following_count: transformed.following_count,
            post_count: transformed.post_count,
            profile_image_url: transformed.profile_image_url || undefined,
            last_updated_at: new Date().toISOString(),
          };
          if (transformed.email) {
            updateData.email = transformed.email;
            updateData.email_source = transformed.email_source;
          }
          Object.keys(updateData).forEach((k) => {
            if (updateData[k] === undefined) delete updateData[k];
          });

          await supabase
            .from("influencers")
            .update(updateData)
            .eq("platform", "instagram")
            .eq("username", transformed.username);

          updated++;
        }
      }
    }

    const warnings: string[] = [];
    if (unsupportedPlatforms.size > 0) {
      warnings.push(
        `현재 프로필 새로고침은 Instagram만 지원합니다. 건너뛴 플랫폼: ${Array.from(unsupportedPlatforms).join(", ")}`
      );
    }

    return NextResponse.json({
      updated,
      total: influencers.length,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
