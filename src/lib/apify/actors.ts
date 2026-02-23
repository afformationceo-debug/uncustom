export const APIFY_ACTORS = {
  // Instagram
  INSTAGRAM_REEL: "apify/instagram-reel-scraper",
  INSTAGRAM_HASHTAG: "apify/instagram-hashtag-scraper",
  INSTAGRAM_PROFILE: "apify/instagram-profile-scraper",
  INSTAGRAM_TAGGED: "apify/instagram-tagged-scraper",

  // TikTok
  TIKTOK: "clockworks/tiktok-scraper",

  // YouTube
  YOUTUBE: "streamers/youtube-scraper",

  // Twitter/X
  TWITTER: "apidojo/tweet-scraper",

  // Video Download
  VIDEO_DOWNLOADER: "easyapi/all-in-one-media-downloader",

  // Email & Contact Info Extraction (any URL - Linktree, Littly, personal sites, etc.)
  EMAIL_EXTRACTOR: "vdrmota/contact-info-scraper",

  // Content Metrics
  SOCIAL_INSIGHT: "insiteco/social-insight-scraper",
} as const;

export type ApifyActorId = (typeof APIFY_ACTORS)[keyof typeof APIFY_ACTORS];

// Platform to Actor mapping for keyword-based extraction
// Instagram uses HASHTAG scraper (Reel scraper changed API to require username[] instead of hashtags)
// Profile scraper is auto-triggered after extraction to enrich follower/bio/email data
export const PLATFORM_KEYWORD_ACTORS: Record<string, string> = {
  instagram: APIFY_ACTORS.INSTAGRAM_HASHTAG,
  tiktok: APIFY_ACTORS.TIKTOK,
  youtube: APIFY_ACTORS.YOUTUBE,
  twitter: APIFY_ACTORS.TWITTER,
};

// Platform to Actor mapping for tagged account extraction
export const PLATFORM_TAGGED_ACTORS: Record<string, string> = {
  instagram: APIFY_ACTORS.INSTAGRAM_TAGGED,
};

// Platform-specific default limits
// Reels/videos/tweets have high user duplication (same user appears in multiple results)
// so higher limits are needed to get enough unique influencers
const PLATFORM_DEFAULT_LIMITS: Record<string, number> = {
  [APIFY_ACTORS.INSTAGRAM_REEL]: 200,
  [APIFY_ACTORS.INSTAGRAM_HASHTAG]: 200,
  [APIFY_ACTORS.INSTAGRAM_TAGGED]: 200,
  [APIFY_ACTORS.TIKTOK]: 200,
  [APIFY_ACTORS.YOUTUBE]: 100,    // Videos have less user duplication
  [APIFY_ACTORS.TWITTER]: 200,
};

// Platform-specific advanced input field definitions
export type AdvancedInputField = {
  key: string;
  label: string;
  type: "select" | "number" | "boolean";
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean;
  description?: string;
};

export const PLATFORM_ADVANCED_INPUTS: Record<string, AdvancedInputField[]> = {
  twitter: [
    {
      key: "sort",
      label: "정렬",
      type: "select",
      options: [
        { value: "Latest", label: "최신순 (Latest)" },
        { value: "Top", label: "인기순 (Top)" },
      ],
      defaultValue: "Latest",
    },
    { key: "onlyVerifiedUsers", label: "인증 사용자만", type: "boolean", defaultValue: false },
    { key: "onlyBlueVerifiedUsers", label: "Twitter Blue만", type: "boolean", defaultValue: false },
    { key: "onlyImage", label: "이미지 포함만", type: "boolean", defaultValue: false },
    { key: "onlyVideo", label: "동영상 포함만", type: "boolean", defaultValue: false },
    { key: "onlyQuote", label: "인용 트윗만", type: "boolean", defaultValue: false },
  ],
  tiktok: [
    {
      key: "maxProfilesPerQuery",
      label: "프로필당 최대 결과",
      type: "number",
      defaultValue: 10,
      description: "각 검색어당 반환할 최대 프로필 수",
    },
    {
      key: "searchSection",
      label: "검색 섹션",
      type: "select",
      options: [
        { value: "default", label: "기본 (전체)" },
        { value: "/video", label: "동영상 (Videos)" },
        { value: "/user", label: "사용자 (Users)" },
      ],
      defaultValue: "default",
    },
    {
      key: "sorting",
      label: "정렬",
      type: "select",
      options: [
        { value: "0", label: "관련도순" },
        { value: "1", label: "좋아요순" },
        { value: "3", label: "날짜순" },
        { value: "4", label: "조회순" },
      ],
      defaultValue: "0",
    },
    { key: "excludePinnedPosts", label: "고정 게시물 제외", type: "boolean", defaultValue: false },
  ],
  // Instagram uses REEL scraper (always returns reels) - no advanced inputs needed
  youtube: [
    {
      key: "maxVideos",
      label: "최대 동영상 수",
      type: "number",
      defaultValue: 0,
      description: "채널당 가져올 동영상 수 (0=무제한)",
    },
    {
      key: "maxShorts",
      label: "최대 Shorts 수",
      type: "number",
      defaultValue: 0,
      description: "채널당 가져올 Shorts 수 (0=무제한)",
    },
  ],
};

// Default input configs per actor
export function getDefaultInput(
  actorId: string,
  params: { keyword?: string; username?: string; limit?: number },
  advancedInputs?: Record<string, unknown>,
) {
  const defaultLimit = PLATFORM_DEFAULT_LIMITS[actorId] ?? 200;
  const { keyword, username, limit = defaultLimit } = params;

  // Filter out "default" placeholder values (used to avoid empty string in SelectItem)
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(advancedInputs ?? {})) {
    if (v !== "default") extra[k] = v;
  }

  switch (actorId) {
    case APIFY_ACTORS.INSTAGRAM_REEL:
      return {
        hashtags: [keyword],
        resultsLimit: limit,
        ...extra,
      };
    case APIFY_ACTORS.INSTAGRAM_HASHTAG:
      return {
        hashtags: [keyword],
        resultsLimit: limit,
        resultsType: "posts",
        ...extra,
      };
    case APIFY_ACTORS.INSTAGRAM_TAGGED:
      return {
        usernames: [username],
        resultsLimit: limit,
        ...extra,
      };
    case APIFY_ACTORS.INSTAGRAM_PROFILE:
      return {
        usernames: [username],
        ...extra,
      };
    case APIFY_ACTORS.TIKTOK:
      return {
        searchQueries: [keyword],
        resultsPerPage: limit,
        ...extra,
      };
    case APIFY_ACTORS.YOUTUBE:
      return {
        searchKeywords: keyword,
        maxResults: limit,
        ...extra,
      };
    case APIFY_ACTORS.TWITTER:
      return {
        searchTerms: [keyword],
        maxItems: limit,
        ...extra,
      };
    case APIFY_ACTORS.VIDEO_DOWNLOADER:
      return {
        urls: [],
      };
    case APIFY_ACTORS.EMAIL_EXTRACTOR:
      return {
        startUrls: [],
        maxDepth: 1,
        maxRequestsPerStartUrl: 5,
        sameDomain: true,
      };
    default:
      return {};
  }
}

// Approximate Apify cost per result (USD)
// perRun: base cost per actor run, perResult: cost per scraped item
export const APIFY_COST_ESTIMATES: Record<string, { perRun: number; perResult: number }> = {
  [APIFY_ACTORS.INSTAGRAM_HASHTAG]: { perRun: 0.01, perResult: 0.004 },
  [APIFY_ACTORS.INSTAGRAM_REEL]: { perRun: 0.01, perResult: 0.004 },
  [APIFY_ACTORS.INSTAGRAM_TAGGED]: { perRun: 0.01, perResult: 0.004 },
  [APIFY_ACTORS.INSTAGRAM_PROFILE]: { perRun: 0.01, perResult: 0.003 },
  [APIFY_ACTORS.TIKTOK]: { perRun: 0.01, perResult: 0.002 },
  [APIFY_ACTORS.YOUTUBE]: { perRun: 0.01, perResult: 0.004 },
  [APIFY_ACTORS.TWITTER]: { perRun: 0.01, perResult: 0.003 },
  [APIFY_ACTORS.EMAIL_EXTRACTOR]: { perRun: 0.005, perResult: 0.002 },
};

/** Estimate Apify cost for a given actor and result count */
export function estimateApifyCost(actorId: string, resultCount: number): number {
  const est = APIFY_COST_ESTIMATES[actorId];
  if (!est) return 0;
  return est.perRun + est.perResult * resultCount;
}

/** Estimate total cost for keyword extraction across multiple platforms */
export function estimateKeywordCost(platforms: string[], limitPerPlatform: number): number {
  let total = 0;
  for (const platform of platforms) {
    const actorId = PLATFORM_KEYWORD_ACTORS[platform];
    if (actorId) total += estimateApifyCost(actorId, limitPerPlatform);
  }
  return total;
}

/** Estimate total cost for tagged extraction */
export function estimateTaggedCost(platform: string, limit: number): number {
  const actorId = PLATFORM_TAGGED_ACTORS[platform];
  if (!actorId) return 0;
  return estimateApifyCost(actorId, limit);
}
