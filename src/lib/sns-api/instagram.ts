/**
 * Instagram Graph API - Content Posting Client
 *
 * Uses the Instagram Graph API container-based publishing flow:
 *   1) Create a media container (Reels for video)
 *   2) Poll container status until FINISHED
 *   3) Publish the container
 *
 * API Base: https://graph.facebook.com/v21.0
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
 */

const API_BASE = "https://graph.facebook.com/v21.0";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

export type PlatformUploadResult = {
  postId: string;
  postUrl: string;
};

type ContainerStatusResponse = {
  id: string;
  status_code: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
  status?: string;
};

type CreateContainerResponse = {
  id: string;
};

type PublishResponse = {
  id: string;
};

type MediaResponse = {
  id: string;
  permalink?: string;
  shortcode?: string;
};

type ErrorResponse = {
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id?: string;
  };
};

/**
 * Upload video content to Instagram as a Reel.
 *
 * @param params.accessToken - Instagram Graph API access token
 * @param params.accountId  - Instagram Business/Creator Account ID
 * @param params.videoUrl   - Public URL of the video to upload
 * @param params.caption    - Caption text for the Reel
 */
export async function uploadContent(params: {
  accessToken: string;
  accountId: string;
  videoUrl: string;
  caption: string;
}): Promise<PlatformUploadResult> {
  const { accessToken, accountId, videoUrl, caption } = params;

  // Step 1: Create a media container for Reels
  const containerId = await createMediaContainer({
    accessToken,
    accountId,
    videoUrl,
    caption,
  });

  // Step 2: Poll container status until FINISHED
  await pollContainerStatus({ accessToken, containerId });

  // Step 3: Publish the container
  const publishedId = await publishContainer({
    accessToken,
    accountId,
    containerId,
  });

  // Step 4: Fetch the permalink
  const postUrl = await getMediaPermalink({ accessToken, mediaId: publishedId });

  return {
    postId: publishedId,
    postUrl,
  };
}

async function createMediaContainer(params: {
  accessToken: string;
  accountId: string;
  videoUrl: string;
  caption: string;
}): Promise<string> {
  const { accessToken, accountId, videoUrl, caption } = params;

  const url = `${API_BASE}/${accountId}/media`;
  const body = new URLSearchParams({
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    access_token: accessToken,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await response.json()) as CreateContainerResponse & ErrorResponse;

  if (!response.ok || data.error) {
    throw new Error(
      `Instagram: Failed to create media container - ${data.error?.message ?? response.statusText}`
    );
  }

  return data.id;
}

async function pollContainerStatus(params: {
  accessToken: string;
  containerId: string;
}): Promise<void> {
  const { accessToken, containerId } = params;
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    const url = `${API_BASE}/${containerId}?fields=status_code,status&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = (await response.json()) as ContainerStatusResponse & ErrorResponse;

    if (!response.ok || data.error) {
      throw new Error(
        `Instagram: Failed to check container status - ${data.error?.message ?? response.statusText}`
      );
    }

    if (data.status_code === "FINISHED") {
      return;
    }

    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(
        `Instagram: Container processing failed with status ${data.status_code} - ${data.status ?? "Unknown error"}`
      );
    }

    // IN_PROGRESS — wait and retry
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Instagram: Container processing timed out after 60 seconds");
}

async function publishContainer(params: {
  accessToken: string;
  accountId: string;
  containerId: string;
}): Promise<string> {
  const { accessToken, accountId, containerId } = params;

  const url = `${API_BASE}/${accountId}/media_publish`;
  const body = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await response.json()) as PublishResponse & ErrorResponse;

  if (!response.ok || data.error) {
    throw new Error(
      `Instagram: Failed to publish container - ${data.error?.message ?? response.statusText}`
    );
  }

  return data.id;
}

async function getMediaPermalink(params: {
  accessToken: string;
  mediaId: string;
}): Promise<string> {
  const { accessToken, mediaId } = params;

  const url = `${API_BASE}/${mediaId}?fields=id,permalink,shortcode&access_token=${accessToken}`;
  const response = await fetch(url);
  const data = (await response.json()) as MediaResponse & ErrorResponse;

  if (data.permalink) {
    return data.permalink;
  }

  if (data.shortcode) {
    return `https://www.instagram.com/reel/${data.shortcode}/`;
  }

  // Fallback URL using the media ID
  return `https://www.instagram.com/p/${mediaId}/`;
}

/**
 * Validate the access token by fetching basic account info.
 */
export async function testConnection(params: {
  accessToken: string;
  accountId: string;
}): Promise<{ valid: boolean; username?: string; error?: string }> {
  const { accessToken, accountId } = params;

  try {
    const url = `${API_BASE}/${accountId}?fields=id,username,name&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = (await response.json()) as {
      id?: string;
      username?: string;
      name?: string;
      error?: { message: string };
    };

    if (!response.ok || data.error) {
      return {
        valid: false,
        error: data.error?.message ?? `HTTP ${response.status}`,
      };
    }

    return {
      valid: true,
      username: data.username ?? data.name,
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
