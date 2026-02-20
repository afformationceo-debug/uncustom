import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runActor, getDatasetItems } from "@/lib/apify/client";
import { APIFY_ACTORS } from "@/lib/apify/actors";
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

    // Group by platform for batch refresh
    const igUsers = influencers
      .filter((i) => i.platform === "instagram" && i.username)
      .map((i) => i.username!);

    let updated = 0;

    if (igUsers.length > 0) {
      const run = await runActor(APIFY_ACTORS.INSTAGRAM_PROFILE, {
        usernames: igUsers,
      });

      const items = await getDatasetItems(run.defaultDatasetId);

      for (const item of items) {
        const record = item as Record<string, unknown>;
        const username = record.username as string;
        if (!username) continue;

        await supabase
          .from("influencers")
          .update({
            display_name: (record.fullName ?? "") as string,
            bio: (record.biography ?? "") as string,
            follower_count: (record.followersCount ?? null) as number | null,
            following_count: (record.followsCount ?? null) as number | null,
            post_count: (record.postsCount ?? null) as number | null,
            profile_image_url: (record.profilePicUrlHD ?? record.profilePicUrl ?? "") as string,
            email: (record.businessEmail ?? null) as string | null,
            last_updated_at: new Date().toISOString(),
          })
          .eq("platform", "instagram")
          .eq("username", username);

        updated++;
      }
    }

    return NextResponse.json({ updated });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
