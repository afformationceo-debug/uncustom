import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startActor } from "@/lib/apify/client";
import { APIFY_ACTORS } from "@/lib/apify/actors";
import type { Json, Tables } from "@/types/database";

type BrandAccount = Tables<"brand_accounts">;

/**
 * POST /api/campaigns/[id]/analyze-accounts
 *
 * 캠페인 SNS 계정을 brand_accounts에 등록하고 프로필 분석을 트리거합니다.
 * - 이미 등록된 계정은 스킵 (upsert)
 * - 각 계정에 대해 Apify 프로필 분석 시작
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Get campaign
    const { data: campaignRaw, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (campaignError || !campaignRaw) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaign = campaignRaw as Tables<"campaigns">;
    const snsAccounts = (campaign.sns_accounts as { platform: string; username: string }[]) ?? [];

    if (snsAccounts.length === 0) {
      return NextResponse.json(
        { error: "캠페인에 SNS 계정이 등록되지 않았습니다" },
        { status: 400 }
      );
    }

    const results: {
      platform: string;
      username: string;
      brand_account_id: string;
      action: "created" | "existing";
      analysis_triggered: boolean;
      job_id?: string;
      error?: string;
    }[] = [];

    for (const account of snsAccounts) {
      if (!account.platform || !account.username) continue;

      const username = account.username.replace(/^@/, "");

      // Check if brand_account already exists for this team + platform + username
      // UNIQUE constraint is on (team_id, platform, username) — campaign_id is not part of it
      // So we look for ANY existing account with same platform+username first
      const { data: existing } = await supabase
        .from("brand_accounts")
        .select("*")
        .eq("platform", account.platform)
        .eq("username", username)
        .limit(1);

      let brandAccount: BrandAccount;

      if (existing && existing.length > 0) {
        brandAccount = existing[0] as BrandAccount;
        results.push({
          platform: account.platform,
          username,
          brand_account_id: brandAccount.id,
          action: "existing",
          analysis_triggered: false,
        });
      } else {
        // Create new brand_account linked to this campaign
        const { data: newAccount, error: insertError } = await supabase
          .from("brand_accounts")
          .insert({
            team_id: campaign.team_id,
            campaign_id: id,
            platform: account.platform,
            username,
            brand_name: campaign.name,
            target_countries: campaign.target_countries ?? [],
            notes: `캠페인 "${campaign.name}"에서 자동 등록`,
          })
          .select()
          .single();

        if (insertError || !newAccount) {
          results.push({
            platform: account.platform,
            username,
            brand_account_id: "",
            action: "created",
            analysis_triggered: false,
            error: insertError?.message ?? "Insert failed",
          });
          continue;
        }

        brandAccount = newAccount as BrandAccount;
        results.push({
          platform: account.platform,
          username,
          brand_account_id: brandAccount.id,
          action: "created",
          analysis_triggered: false,
        });
      }

      // Trigger profile analysis if not recently analyzed
      const shouldAnalyze =
        !brandAccount.last_analyzed_at ||
        Date.now() - new Date(brandAccount.last_analyzed_at).getTime() > 24 * 60 * 60 * 1000; // 24h

      if (shouldAnalyze) {
        try {
          const { actorId, input } = getAnalysisConfig(account.platform, username);

          const run = await startActor(actorId, input);

          const { data: job } = await supabase
            .from("extraction_jobs")
            .insert({
              type: "brand_profile",
              platform: account.platform,
              source_id: brandAccount.id,
              status: "running",
              apify_run_id: run.id,
              input_config: {
                brand_account_id: brandAccount.id,
                campaign_id: id,
                username,
                platform: account.platform,
                actor_id: actorId,
              } as unknown as Json,
            })
            .select()
            .single();

          await supabase
            .from("brand_accounts")
            .update({ last_analyzed_at: new Date().toISOString() })
            .eq("id", brandAccount.id);

          const lastResult = results[results.length - 1];
          lastResult.analysis_triggered = true;
          lastResult.job_id = (job as Tables<"extraction_jobs"> | null)?.id ?? undefined;
        } catch (err) {
          const lastResult = results[results.length - 1];
          lastResult.error = err instanceof Error ? err.message : "Analysis trigger failed";
        }
      }
    }

    return NextResponse.json({
      success: true,
      campaign_id: id,
      accounts: results,
      message: `${results.filter((r) => r.analysis_triggered).length}개 계정 분석 시작`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[campaigns/analyze-accounts] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/campaigns/[id]/analyze-accounts
 *
 * 캠페인에 연결된 brand_accounts 목록 + 분석 상태 조회
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Get campaign to extract sns_accounts usernames
    const { data: campaignRaw } = await supabase
      .from("campaigns")
      .select("sns_accounts")
      .eq("id", id)
      .single();

    const snsAccounts = ((campaignRaw as { sns_accounts: { platform: string; username: string }[] } | null)?.sns_accounts) ?? [];
    const usernames = snsAccounts.map((a) => a.username.replace(/^@/, "")).filter(Boolean);

    // Get brand accounts matching campaign's sns_accounts usernames
    // (regardless of campaign_id — accounts may be global or from another campaign)
    let accounts;
    let error;
    if (usernames.length > 0) {
      ({ data: accounts, error } = await supabase
        .from("brand_accounts")
        .select("*")
        .in("username", usernames)
        .order("platform"));
    } else {
      ({ data: accounts, error } = await supabase
        .from("brand_accounts")
        .select("*")
        .eq("campaign_id", id)
        .order("platform"));
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Get content and relationship counts for each account
    const enrichedAccounts = await Promise.all(
      ((accounts as BrandAccount[]) ?? []).map(async (acc) => {
        const [{ count: contentCount }, { count: relationshipCount }] = await Promise.all([
          supabase
            .from("brand_influencer_contents")
            .select("*", { count: "exact", head: true })
            .eq("brand_account_id", acc.id),
          supabase
            .from("brand_influencer_relationships")
            .select("*", { count: "exact", head: true })
            .eq("brand_account_id", acc.id),
        ]);

        return {
          ...acc,
          content_count: contentCount ?? 0,
          relationship_count: relationshipCount ?? 0,
        };
      })
    );

    return NextResponse.json(enrichedAccounts);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getAnalysisConfig(
  platform: string,
  username: string
): { actorId: string; input: Record<string, unknown> } {
  switch (platform) {
    case "instagram":
      return {
        actorId: APIFY_ACTORS.INSTAGRAM_PROFILE,
        input: { usernames: [username] },
      };
    case "tiktok":
      return {
        actorId: APIFY_ACTORS.TIKTOK,
        input: { searchQueries: [`@${username}`], resultsPerPage: 1, searchSection: "/user" },
      };
    case "youtube":
      return {
        actorId: APIFY_ACTORS.YOUTUBE,
        input: { searchKeywords: `@${username}`, maxResults: 1 },
      };
    case "twitter":
      return {
        actorId: APIFY_ACTORS.TWITTER,
        input: { searchTerms: [`from:${username}`], maxItems: 1 },
      };
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
