/**
 * TikTok Content Posting API v2 - Client
 *
 * Uses the TikTok Content Posting API (direct post flow):
 *   1) Initialize a video upload and get an upload URL
 *   2) Upload the video binary to TikTok's upload URL
 *   3) Poll the publish status until completion
 *
 * API Base: https://open.tiktokapis.com/v2
 * Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
 */

const API_BASE = "https://open.tiktokapis.com/v2";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

export type PlatformUploadResult = {
  postId: string;
  postUrl: string;
};

type InitUploadResponse = {
  data: {
    publish_id: string;
    upload_url: string;
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
};

type PublishStatusResponse = {
  data: {
    status: "PROCESSING_UPLOAD" | "PROCESSING_DOWNLOAD" | "SEND_TO_USER_INBOX" | "PUBLISH_COMPLETE" | "FAILED";
    publicaly_available_post_id?: string[];
    fail_reason?: string;
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
};

type UserInfoResponse = {
  data: {
    user: {
      open_id: string;
      display_name: string;
      avatar_url: string;
    };
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
};

/**
 * Upload video content to TikTok via the Content Posting API (direct post).
 *
 * @param params.accessToken - TikTok OAuth2 access token
 * @param params.videoUrl    - Public URL of the video to upload
 * @param params.caption     - Caption / title for the TikTok post
 */
export async function uploadContent(params: {
  accessToken: string;
  videoUrl: string;
  caption: string;
}): Promise<PlatformUploadResult> {
  const { accessToken, videoUrl, caption } = params;

  // Step 1: Download video to get size info
  const videoBuffer = await downloadVideo(videoUrl);

  // Step 2: Initialize the upload with TikTok
  const { publishId, uploadUrl } = await initializeUpload({
    accessToken,
    caption,
    videoSize: videoBuffer.byteLength,
  });

  // Step 3: Upload the video binary to TikTok's upload URL
  await uploadVideoData({ uploadUrl, videoBuffer });

  // Step 4: Poll publish status until complete
  const postId = await pollPublishStatus({ accessToken, publishId });

  return {
    postId,
    postUrl: `https://www.tiktok.com/@/video/${postId}`,
  };
}

async function downloadVideo(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `TikTok: Failed to download video from ${url} - HTTP ${response.status}`
    );
  }

  return response.arrayBuffer();
}

async function initializeUpload(params: {
  accessToken: string;
  caption: string;
  videoSize: number;
}): Promise<{ publishId: string; uploadUrl: string }> {
  const { accessToken, caption, videoSize } = params;

  const url = `${API_BASE}/post/publish/video/init/`;

  const body = {
    post_info: {
      title: caption,
      privacy_level: "PUBLIC_TO_EVERYONE",
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 0,
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: videoSize,
      chunk_size: videoSize,
      total_chunk_count: 1,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as InitUploadResponse;

  if (!response.ok || data.error?.code !== "ok") {
    throw new Error(
      `TikTok: Failed to initialize upload - ${data.error?.message ?? response.statusText}`
    );
  }

  return {
    publishId: data.data.publish_id,
    uploadUrl: data.data.upload_url,
  };
}

async function uploadVideoData(params: {
  uploadUrl: string;
  videoBuffer: ArrayBuffer;
}): Promise<void> {
  const { uploadUrl, videoBuffer } = params;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": videoBuffer.byteLength.toString(),
      "Content-Range": `bytes 0-${videoBuffer.byteLength - 1}/${videoBuffer.byteLength}`,
    },
    body: videoBuffer,
  });

  if (!response.ok) {
    throw new Error(
      `TikTok: Failed to upload video data - HTTP ${response.status} ${response.statusText}`
    );
  }
}

async function pollPublishStatus(params: {
  accessToken: string;
  publishId: string;
}): Promise<string> {
  const { accessToken, publishId } = params;
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    const url = `${API_BASE}/post/publish/status/fetch/`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });

    const data = (await response.json()) as PublishStatusResponse;

    if (!response.ok || (data.error?.code !== "ok" && data.error?.code !== "")) {
      throw new Error(
        `TikTok: Failed to check publish status - ${data.error?.message ?? response.statusText}`
      );
    }

    const status = data.data.status;

    if (status === "PUBLISH_COMPLETE") {
      const postId = data.data.publicaly_available_post_id?.[0];
      if (!postId) {
        // Use publish_id as fallback
        return publishId;
      }
      return postId;
    }

    if (status === "FAILED") {
      throw new Error(
        `TikTok: Publishing failed - ${data.data.fail_reason ?? "Unknown reason"}`
      );
    }

    // PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, SEND_TO_USER_INBOX — wait and retry
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("TikTok: Publishing timed out after 60 seconds");
}

/**
 * Validate the access token by fetching basic user info.
 */
export async function testConnection(params: {
  accessToken: string;
}): Promise<{ valid: boolean; displayName?: string; error?: string }> {
  const { accessToken } = params;

  try {
    const url = `${API_BASE}/user/info/?fields=open_id,display_name,avatar_url`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await response.json()) as UserInfoResponse;

    if (!response.ok || (data.error?.code !== "ok" && data.error?.code !== "")) {
      return {
        valid: false,
        error: data.error?.message ?? `HTTP ${response.status}`,
      };
    }

    return {
      valid: true,
      displayName: data.data.user.display_name,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
