import { NextResponse } from "next/server";
import { startActor, getRunStatus, getDatasetItems } from "@/lib/apify/client";
import { APIFY_ACTORS, PLATFORM_TAGGED_ACTORS } from "@/lib/apify/actors";

export async function POST(request: Request) {
  try {
    const { username, platform } = await request.json();

    if (!username || !platform) {
      return NextResponse.json({ error: "username and platform are required" }, { status: 400 });
    }

    let run;
    if (platform === "instagram") {
      // Use profile scraper for direct profile lookup
      run = await startActor(APIFY_ACTORS.INSTAGRAM_PROFILE, {
        usernames: [username],
      });
    } else {
      // For other platforms, search with @username to verify existence
      const actorId = PLATFORM_TAGGED_ACTORS[platform];
      if (!actorId) {
        return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
      }

      const searchQuery = `@${username}`;
      const inputMap: Record<string, Record<string, unknown>> = {
        tiktok: { searchQueries: [searchQuery], resultsPerPage: 1 },
        youtube: { searchKeywords: searchQuery, maxResults: 1 },
        twitter: { searchTerms: [searchQuery], maxItems: 1 },
      };

      run = await startActor(actorId, inputMap[platform] ?? { searchTerms: [searchQuery], maxItems: 1 });
    }

    // Poll for completion (max 30 seconds)
    const maxWait = 30000;
    const interval = 2000;
    let elapsed = 0;

    while (elapsed < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      elapsed += interval;

      const status = await getRunStatus(run.id);
      if (!status) break;

      if (status.status === "SUCCEEDED") {
        const items = await getDatasetItems(status.defaultDatasetId);
        if (items.length === 0) {
          return NextResponse.json({ verified: false });
        }

        const item = items[0] as Record<string, unknown>;

        if (platform === "instagram") {
          return NextResponse.json({
            verified: true,
            profile: {
              display_name: item.fullName ?? item.name ?? null,
              follower_count: item.followersCount ?? null,
              profile_image_url: item.profilePicUrlHD ?? item.profilePicUrl ?? null,
              bio: item.biography ?? null,
            },
          });
        }

        // For other platforms, extract basic info from first result
        const authorMeta = item.authorMeta as Record<string, unknown> | undefined;
        const userObj = item.user as Record<string, unknown> | undefined;
        return NextResponse.json({
          verified: true,
          profile: {
            display_name: authorMeta?.name ?? item.channelName ?? item.name ?? userObj?.name ?? null,
            follower_count: authorMeta?.fans ?? item.subscriberCount ?? userObj?.followers ?? null,
            profile_image_url: authorMeta?.avatar ?? item.channelAvatar ?? userObj?.profileImageUrl ?? null,
            bio: authorMeta?.signature ?? item.channelDescription ?? userObj?.description ?? null,
          },
        });
      }

      if (status.status === "FAILED" || status.status === "ABORTED") {
        return NextResponse.json({ verified: false, error: `Actor ${status.status}` });
      }
    }

    return NextResponse.json({ verified: false, error: "Verification timed out" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[tagged/verify] Error:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
