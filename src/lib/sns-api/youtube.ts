/**
 * YouTube Data API v3 - Content Posting Client
 *
 * Uses the YouTube Data API v3 resumable upload flow:
 *   1) Download video from source URL
 *   2) Initiate a resumable upload session with video metadata
 *   3) Upload the video binary to the resumable URI
 *   4) Retrieve the published video details
 *
 * Upload API: https://www.googleapis.com/upload/youtube/v3
 * Data API:   https://www.googleapis.com/youtube/v3
 * Docs: https://developers.google.com/youtube/v3/docs/videos/insert
 */

const UPLOAD_API_BASE = "https://www.googleapis.com/upload/youtube/v3";
const DATA_API_BASE = "https://www.googleapis.com/youtube/v3";

export type PlatformUploadResult = {
  postId: string;
  postUrl: string;
};

type YouTubeVideoResource = {
  id: string;
  snippet?: {
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
    tags?: string[];
  };
  status?: {
    uploadStatus: string;
    privacyStatus: string;
    publishAt?: string;
  };
};

type YouTubeErrorResponse = {
  error?: {
    code: number;
    message: string;
    errors: Array<{ domain: string; reason: string; message: string }>;
  };
};

/**
 * Upload a video to YouTube.
 *
 * @param params.accessToken  - OAuth2 access token with youtube.upload scope
 * @param params.videoUrl     - Public URL of the video file to upload
 * @param params.title        - Video title
 * @param params.description  - Video description
 * @param params.tags         - Optional tags / keywords
 */
export async function uploadContent(params: {
  accessToken: string;
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
}): Promise<PlatformUploadResult> {
  const { accessToken, videoUrl, title, description, tags } = params;

  // Step 1: Download video from the source URL
  const videoBuffer = await downloadVideo(videoUrl);

  // Step 2: Initiate resumable upload and get the upload URI
  const uploadUri = await initiateResumableUpload({
    accessToken,
    title,
    description,
    tags,
    contentLength: videoBuffer.byteLength,
  });

  // Step 3: Upload the video binary
  const videoResource = await uploadVideoData({
    uploadUri,
    videoBuffer,
  });

  // Step 4: Return result
  return {
    postId: videoResource.id,
    postUrl: `https://www.youtube.com/watch?v=${videoResource.id}`,
  };
}

async function downloadVideo(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `YouTube: Failed to download video from ${url} - HTTP ${response.status}`
    );
  }

  return response.arrayBuffer();
}

async function initiateResumableUpload(params: {
  accessToken: string;
  title: string;
  description: string;
  tags?: string[];
  contentLength: number;
}): Promise<string> {
  const { accessToken, title, description, tags, contentLength } = params;

  const metadata = {
    snippet: {
      title,
      description,
      tags: tags ?? [],
      categoryId: "22", // People & Blogs (default)
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false,
    },
  };

  const url = `${UPLOAD_API_BASE}/videos?uploadType=resumable&part=snippet,status`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": contentLength.toString(),
      "X-Upload-Content-Type": "video/*",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as YouTubeErrorResponse;
    throw new Error(
      `YouTube: Failed to initiate upload - ${errorData.error?.message ?? response.statusText}`
    );
  }

  const location = response.headers.get("Location");
  if (!location) {
    throw new Error("YouTube: No upload URI returned from resumable upload initiation");
  }

  return location;
}

async function uploadVideoData(params: {
  uploadUri: string;
  videoBuffer: ArrayBuffer;
}): Promise<YouTubeVideoResource> {
  const { uploadUri, videoBuffer } = params;

  const response = await fetch(uploadUri, {
    method: "PUT",
    headers: {
      "Content-Type": "video/*",
      "Content-Length": videoBuffer.byteLength.toString(),
    },
    body: videoBuffer,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as YouTubeErrorResponse;
    throw new Error(
      `YouTube: Failed to upload video data - ${errorData.error?.message ?? response.statusText}`
    );
  }

  const data = (await response.json()) as YouTubeVideoResource & YouTubeErrorResponse;

  if (data.error) {
    throw new Error(`YouTube: Upload returned error - ${data.error.message}`);
  }

  if (!data.id) {
    throw new Error("YouTube: No video ID returned after upload");
  }

  return data;
}

/**
 * Validate the access token by fetching the authenticated user's channel info.
 */
export async function testConnection(params: {
  accessToken: string;
}): Promise<{ valid: boolean; channelTitle?: string; channelId?: string; error?: string }> {
  const { accessToken } = params;

  try {
    const url = `${DATA_API_BASE}/channels?part=snippet&mine=true`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await response.json()) as {
      items?: Array<{
        id: string;
        snippet: { title: string };
      }>;
      error?: { message: string };
    };

    if (!response.ok || data.error) {
      return {
        valid: false,
        error: data.error?.message ?? `HTTP ${response.status}`,
      };
    }

    const channel = data.items?.[0];
    if (!channel) {
      return {
        valid: false,
        error: "No YouTube channel found for this account",
      };
    }

    return {
      valid: true,
      channelTitle: channel.snippet.title,
      channelId: channel.id,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
