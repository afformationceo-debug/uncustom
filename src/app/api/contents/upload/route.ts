import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { InsertTables, Tables } from "@/types/database";
import { uploadContent as uploadInstagram } from "@/lib/sns-api/instagram";
import { uploadContent as uploadYouTube } from "@/lib/sns-api/youtube";
import { uploadContent as uploadTikTok } from "@/lib/sns-api/tiktok";
import { uploadContent as uploadTwitter } from "@/lib/sns-api/twitter";
import { uploadContent as uploadThreads } from "@/lib/sns-api/threads";

type SnsAccount = Tables<"campaign_sns_accounts">;

type UploadRequest = {
  content_id: string;
  campaign_id: string;
  target_platform: string;
  sns_account_id: string | null;
  caption: string | null;
  title: string | null;
  tags: string[] | null;
};

function generatePlatformCaption(
  baseCaptionRaw: string | null,
  platform: string,
): string {
  const baseCaption = baseCaptionRaw ?? "";

  switch (platform) {
    case "twitter": {
      if (baseCaption.length <= 280) return baseCaption;
      return baseCaption.slice(0, 277) + "...";
    }
    case "youtube":
    case "instagram":
    case "tiktok":
    case "threads":
    default:
      return baseCaption;
  }
}

async function uploadToPlatform(
  platform: string,
  account: SnsAccount,
  videoUrl: string,
  caption: string,
  title: string | null,
  tags: string[] | null,
): Promise<{ postId: string; postUrl: string }> {
  const accessToken = account.access_token ?? "";
  const accountId = account.account_id ?? "";

  switch (platform) {
    case "instagram":
      return uploadInstagram({
        accessToken,
        accountId,
        videoUrl,
        caption,
      });

    case "youtube":
      return uploadYouTube({
        accessToken,
        videoUrl,
        title: title ?? caption.slice(0, 100),
        description: caption,
        tags: tags ?? undefined,
      });

    case "tiktok":
      return uploadTikTok({
        accessToken,
        videoUrl,
        caption,
      });

    case "twitter":
      return uploadTwitter({
        accessToken,
        apiKey: account.api_key ?? undefined,
        apiSecret: account.api_secret ?? undefined,
        videoUrl,
        text: caption,
      });

    case "threads":
      return uploadThreads({
        accessToken,
        accountId,
        videoUrl,
        text: caption,
      });

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const uploads: UploadRequest[] = body.uploads ?? [];

    // Legacy single-upload support
    if (
      uploads.length === 0 &&
      body.content_id &&
      body.campaign_id &&
      body.target_platform
    ) {
      uploads.push({
        content_id: body.content_id,
        campaign_id: body.campaign_id,
        target_platform: body.target_platform,
        sns_account_id: body.sns_account_id ?? null,
        caption: body.caption ?? null,
        title: body.title ?? null,
        tags: body.tags ?? null,
      });
    }

    if (uploads.length === 0) {
      return NextResponse.json(
        { error: "No upload targets provided." },
        { status: 400 },
      );
    }

    for (const upload of uploads) {
      if (!upload.content_id || !upload.campaign_id || !upload.target_platform) {
        return NextResponse.json(
          { error: "Each upload must include content_id, campaign_id, and target_platform" },
          { status: 400 },
        );
      }
    }

    const results: Array<{
      upload_id: string;
      platform: string;
      status: string;
      post_id?: string;
      post_url?: string;
      error?: string;
    }> = [];

    for (const upload of uploads) {
      const caption =
        upload.caption || generatePlatformCaption(upload.caption, upload.target_platform);

      // Insert record with uploading status
      const insertRecord: InsertTables<"multi_channel_uploads"> = {
        content_id: upload.content_id,
        campaign_id: upload.campaign_id,
        target_platform: upload.target_platform,
        sns_account_id: upload.sns_account_id,
        caption,
        title: upload.title,
        tags: upload.tags,
        status: "uploading",
      };

      const { data: uploadRecord, error: insertError } = await supabase
        .from("multi_channel_uploads")
        .insert(insertRecord)
        .select()
        .single();

      if (insertError || !uploadRecord) {
        results.push({
          upload_id: "",
          platform: upload.target_platform,
          status: "failed",
          error: insertError?.message ?? "Failed to create upload record",
        });
        continue;
      }

      const typedUpload = uploadRecord as Tables<"multi_channel_uploads">;

      // If no SNS account, skip actual upload (record stays as "uploading")
      if (!upload.sns_account_id) {
        results.push({
          upload_id: typedUpload.id,
          platform: upload.target_platform,
          status: "uploading",
          error: "No SNS account linked — upload record created, manual publish required",
        });
        continue;
      }

      // Get SNS account credentials
      const { data: accountData } = await supabase
        .from("campaign_sns_accounts")
        .select("*")
        .eq("id", upload.sns_account_id)
        .single();

      const account = accountData as SnsAccount | null;

      if (!account || !account.access_token) {
        await supabase
          .from("multi_channel_uploads")
          .update({ status: "failed" })
          .eq("id", typedUpload.id);

        results.push({
          upload_id: typedUpload.id,
          platform: upload.target_platform,
          status: "failed",
          error: "SNS account not found or missing access token",
        });
        continue;
      }

      // Get the content's video URL
      const { data: contentData } = await supabase
        .from("influencer_contents")
        .select("original_url, video_storage_path")
        .eq("id", upload.content_id)
        .single();

      const content = contentData as { original_url: string; video_storage_path: string | null } | null;
      const videoUrl = content?.video_storage_path
        ? content.video_storage_path
        : content?.original_url ?? "";

      if (!videoUrl) {
        await supabase
          .from("multi_channel_uploads")
          .update({ status: "failed" })
          .eq("id", typedUpload.id);

        results.push({
          upload_id: typedUpload.id,
          platform: upload.target_platform,
          status: "failed",
          error: "No video URL available",
        });
        continue;
      }

      // Attempt platform upload
      try {
        const { postId, postUrl } = await uploadToPlatform(
          upload.target_platform,
          account,
          videoUrl,
          caption,
          upload.title,
          upload.tags,
        );

        await supabase
          .from("multi_channel_uploads")
          .update({
            status: "published",
            platform_post_id: postId,
            platform_post_url: postUrl,
            published_at: new Date().toISOString(),
          })
          .eq("id", typedUpload.id);

        results.push({
          upload_id: typedUpload.id,
          platform: upload.target_platform,
          status: "published",
          post_id: postId,
          post_url: postUrl,
        });
      } catch (platformErr) {
        const errMsg = platformErr instanceof Error ? platformErr.message : "Upload failed";

        await supabase
          .from("multi_channel_uploads")
          .update({ status: "failed" })
          .eq("id", typedUpload.id);

        results.push({
          upload_id: typedUpload.id,
          platform: upload.target_platform,
          status: "failed",
          error: errMsg,
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        results,
        count: results.length,
        published: results.filter((r) => r.status === "published").length,
        failed: results.filter((r) => r.status === "failed").length,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
