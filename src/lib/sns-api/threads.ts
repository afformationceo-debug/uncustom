/**
 * Threads API (Meta) - Content Posting Client
 *
 * Uses the Threads API container-based publishing flow:
 *   1) Create a media container (video or text)
 *   2) Poll container status until FINISHED
 *   3) Publish the container
 *
 * API Base: https://graph.threads.net/v1.0
 * Docs: https://developers.facebook.com/docs/threads/posts
 */

const API_BASE = "https://graph.threads.net/v1.0";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

export type PlatformUploadResult = {
  postId: string;
  postUrl: string;
};

type CreateContainerResponse = {
  id: string;
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id?: string;
  };
};

type ContainerStatusResponse = {
  id: string;
  status: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
  error_message?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

type PublishResponse = {
  id: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

type ThreadResponse = {
  id: string;
  permalink?: string;
  text?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

type UserProfileResponse = {
  id: string;
  username?: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

/**
 * Publish content to Threads. Supports both video posts and text-only posts.
 *
 * @param params.accessToken - Threads API access token
 * @param params.accountId   - Threads user ID
 * @param params.videoUrl    - Optional: public URL of the video to upload (omit for text-only)
 * @param params.text        - Post text content
 */
export async function uploadContent(params: {
  accessToken: string;
  accountId: string;
  videoUrl?: string;
  text: string;
}): Promise<PlatformUploadResult> {
  const { accessToken, accountId, videoUrl, text } = params;

  // Step 1: Create a media container
  const containerId = await createMediaContainer({
    accessToken,
    accountId,
    videoUrl,
    text,
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
  const postUrl = await getThreadPermalink({ accessToken, threadId: publishedId });

  return {
    postId: publishedId,
    postUrl,
  };
}

async function createMediaContainer(params: {
  accessToken: string;
  accountId: string;
  videoUrl?: string;
  text: string;
}): Promise<string> {
  const { accessToken, accountId, videoUrl, text } = params;

  const url = `${API_BASE}/${accountId}/threads`;

  const formParams: Record<string, string> = {
    text,
    access_token: accessToken,
  };

  if (videoUrl) {
    formParams.media_type = "VIDEO";
    formParams.video_url = videoUrl;
  } else {
    formParams.media_type = "TEXT";
  }

  const body = new URLSearchParams(formParams);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await response.json()) as CreateContainerResponse;

  if (!response.ok || data.error) {
    throw new Error(
      `Threads: Failed to create media container - ${data.error?.message ?? response.statusText}`
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
    const url = `${API_BASE}/${containerId}?fields=id,status,error_message&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = (await response.json()) as ContainerStatusResponse;

    if (!response.ok || data.error) {
      throw new Error(
        `Threads: Failed to check container status - ${data.error?.message ?? response.statusText}`
      );
    }

    if (data.status === "FINISHED") {
      return;
    }

    if (data.status === "ERROR" || data.status === "EXPIRED") {
      throw new Error(
        `Threads: Container processing failed with status ${data.status} - ${data.error_message ?? "Unknown error"}`
      );
    }

    // IN_PROGRESS — wait and retry
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Threads: Container processing timed out after 60 seconds");
}

async function publishContainer(params: {
  accessToken: string;
  accountId: string;
  containerId: string;
}): Promise<string> {
  const { accessToken, accountId, containerId } = params;

  const url = `${API_BASE}/${accountId}/threads_publish`;

  const body = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await response.json()) as PublishResponse;

  if (!response.ok || data.error) {
    throw new Error(
      `Threads: Failed to publish container - ${data.error?.message ?? response.statusText}`
    );
  }

  return data.id;
}

async function getThreadPermalink(params: {
  accessToken: string;
  threadId: string;
}): Promise<string> {
  const { accessToken, threadId } = params;

  const url = `${API_BASE}/${threadId}?fields=id,permalink,text&access_token=${accessToken}`;

  const response = await fetch(url);
  const data = (await response.json()) as ThreadResponse;

  if (data.permalink) {
    return data.permalink;
  }

  // Fallback: construct a generic Threads URL
  return `https://www.threads.net/post/${threadId}`;
}

/**
 * Validate the access token by fetching the user's Threads profile.
 */
export async function testConnection(params: {
  accessToken: string;
  accountId: string;
}): Promise<{ valid: boolean; username?: string; error?: string }> {
  const { accessToken, accountId } = params;

  try {
    const url = `${API_BASE}/${accountId}?fields=id,username,threads_profile_picture_url&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = (await response.json()) as UserProfileResponse;

    if (!response.ok || data.error) {
      return {
        valid: false,
        error: data.error?.message ?? `HTTP ${response.status}`,
      };
    }

    return {
      valid: true,
      username: data.username,
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
