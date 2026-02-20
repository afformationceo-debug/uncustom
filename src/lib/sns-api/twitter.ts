/**
 * X (Twitter) API v2 - Content Posting Client
 *
 * Uses a two-step process:
 *   1) Upload media via the v1.1 chunked media upload endpoint
 *   2) Create a tweet referencing the uploaded media via API v2
 *
 * Media Upload API: https://upload.twitter.com/1.1/media/upload.json
 * Tweet API:        https://api.twitter.com/2/tweets
 * Docs: https://developer.x.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets
 */

const MEDIA_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";
const TWEET_API_URL = "https://api.twitter.com/2/tweets";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

// Max chunk size for chunked upload: 5 MB
const CHUNK_SIZE = 5 * 1024 * 1024;

export type PlatformUploadResult = {
  postId: string;
  postUrl: string;
};

type MediaInitResponse = {
  media_id_string: string;
  expires_after_secs: number;
};

type MediaStatusResponse = {
  media_id_string: string;
  processing_info?: {
    state: "pending" | "in_progress" | "succeeded" | "failed";
    check_after_secs?: number;
    progress_percent?: number;
    error?: {
      code: number;
      name: string;
      message: string;
    };
  };
};

type TweetResponse = {
  data?: {
    id: string;
    text: string;
  };
  errors?: Array<{
    message: string;
    type: string;
  }>;
  detail?: string;
};

type UserMeResponse = {
  data?: {
    id: string;
    username: string;
    name: string;
  };
  errors?: Array<{ message: string }>;
};

/**
 * Upload video content and create a tweet with it.
 *
 * @param params.accessToken - OAuth 2.0 Bearer token (User context, tweet.write + users.read scopes)
 * @param params.apiKey      - Optional: API key for OAuth 1.0a media upload if needed
 * @param params.apiSecret   - Optional: API secret for OAuth 1.0a media upload if needed
 * @param params.videoUrl    - Public URL of the video to upload
 * @param params.text        - Tweet text
 */
export async function uploadContent(params: {
  accessToken: string;
  apiKey?: string;
  apiSecret?: string;
  videoUrl: string;
  text: string;
}): Promise<PlatformUploadResult> {
  const { accessToken, videoUrl, text } = params;

  // Step 1: Download the video
  const videoBuffer = await downloadVideo(videoUrl);

  // Step 2: Upload media via chunked upload
  const mediaId = await uploadMedia({ accessToken, videoBuffer });

  // Step 3: Wait for media processing to complete
  await pollMediaProcessing({ accessToken, mediaId });

  // Step 4: Create a tweet with the media
  const { tweetId, username } = await createTweet({ accessToken, text, mediaId });

  return {
    postId: tweetId,
    postUrl: `https://x.com/${username}/status/${tweetId}`,
  };
}

async function downloadVideo(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Twitter: Failed to download video from ${url} - HTTP ${response.status}`
    );
  }

  return response.arrayBuffer();
}

/**
 * Chunked media upload via v1.1 endpoint.
 * Uses INIT -> APPEND (chunked) -> FINALIZE flow.
 */
async function uploadMedia(params: {
  accessToken: string;
  videoBuffer: ArrayBuffer;
}): Promise<string> {
  const { accessToken, videoBuffer } = params;
  const totalBytes = videoBuffer.byteLength;

  // INIT
  const initForm = new URLSearchParams({
    command: "INIT",
    total_bytes: totalBytes.toString(),
    media_type: "video/mp4",
    media_category: "tweet_video",
  });

  const initResponse = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: initForm.toString(),
  });

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    throw new Error(
      `Twitter: Media INIT failed - HTTP ${initResponse.status}: ${errorText}`
    );
  }

  const initData = (await initResponse.json()) as MediaInitResponse;
  const mediaId = initData.media_id_string;

  // APPEND (chunked)
  const uint8Array = new Uint8Array(videoBuffer);
  let segmentIndex = 0;
  let offset = 0;

  while (offset < totalBytes) {
    const end = Math.min(offset + CHUNK_SIZE, totalBytes);
    const chunk = uint8Array.slice(offset, end);

    const formData = new FormData();
    formData.append("command", "APPEND");
    formData.append("media_id", mediaId);
    formData.append("segment_index", segmentIndex.toString());
    formData.append("media_data", Buffer.from(chunk).toString("base64"));

    const appendResponse = await fetch(MEDIA_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!appendResponse.ok) {
      const errorText = await appendResponse.text();
      throw new Error(
        `Twitter: Media APPEND failed (segment ${segmentIndex}) - HTTP ${appendResponse.status}: ${errorText}`
      );
    }

    offset = end;
    segmentIndex++;
  }

  // FINALIZE
  const finalizeForm = new URLSearchParams({
    command: "FINALIZE",
    media_id: mediaId,
  });

  const finalizeResponse = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: finalizeForm.toString(),
  });

  if (!finalizeResponse.ok) {
    const errorText = await finalizeResponse.text();
    throw new Error(
      `Twitter: Media FINALIZE failed - HTTP ${finalizeResponse.status}: ${errorText}`
    );
  }

  return mediaId;
}

async function pollMediaProcessing(params: {
  accessToken: string;
  mediaId: string;
}): Promise<void> {
  const { accessToken, mediaId } = params;
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    const url = `${MEDIA_UPLOAD_URL}?command=STATUS&media_id=${mediaId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // If STATUS check returns 404, media may already be processed
      if (response.status === 404) {
        return;
      }
      const errorText = await response.text();
      throw new Error(
        `Twitter: Media STATUS check failed - HTTP ${response.status}: ${errorText}`
      );
    }

    const data = (await response.json()) as MediaStatusResponse;

    if (!data.processing_info) {
      // No processing_info means processing is complete
      return;
    }

    const { state, error, check_after_secs } = data.processing_info;

    if (state === "succeeded") {
      return;
    }

    if (state === "failed") {
      throw new Error(
        `Twitter: Media processing failed - ${error?.message ?? "Unknown error"}`
      );
    }

    // pending or in_progress — wait and retry
    const waitMs = check_after_secs ? check_after_secs * 1000 : POLL_INTERVAL_MS;
    await sleep(waitMs);
  }

  throw new Error("Twitter: Media processing timed out after 60 seconds");
}

async function createTweet(params: {
  accessToken: string;
  text: string;
  mediaId: string;
}): Promise<{ tweetId: string; username: string }> {
  const { accessToken, text, mediaId } = params;

  // First, get the current user's username for the URL
  const username = await getAuthenticatedUsername(accessToken);

  const body = {
    text,
    media: {
      media_ids: [mediaId],
    },
  };

  const response = await fetch(TWEET_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as TweetResponse;

  if (!response.ok || data.errors || data.detail) {
    const errorMsg =
      data.errors?.[0]?.message ?? data.detail ?? response.statusText;
    throw new Error(`Twitter: Failed to create tweet - ${errorMsg}`);
  }

  if (!data.data?.id) {
    throw new Error("Twitter: No tweet ID returned after creation");
  }

  return {
    tweetId: data.data.id,
    username,
  };
}

async function getAuthenticatedUsername(accessToken: string): Promise<string> {
  const response = await fetch("https://api.twitter.com/2/users/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = (await response.json()) as UserMeResponse;

  if (!response.ok || data.errors) {
    // Fallback to 'i' if we can't get the username
    return "i";
  }

  return data.data?.username ?? "i";
}

/**
 * Validate the access token by fetching the authenticated user's profile.
 */
export async function testConnection(params: {
  accessToken: string;
}): Promise<{ valid: boolean; username?: string; error?: string }> {
  const { accessToken } = params;

  try {
    const response = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await response.json()) as UserMeResponse;

    if (!response.ok || data.errors) {
      return {
        valid: false,
        error: data.errors?.[0]?.message ?? `HTTP ${response.status}`,
      };
    }

    return {
      valid: true,
      username: data.data?.username,
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
