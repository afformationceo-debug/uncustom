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

  // Email Extraction
  EMAIL_EXTRACTOR: "ahmed_jasarevic/linktree-beacons-bio-email-scraper-extract-leads",

  // Content Metrics
  SOCIAL_INSIGHT: "insiteco/social-insight-scraper",
} as const;

export type ApifyActorId = (typeof APIFY_ACTORS)[keyof typeof APIFY_ACTORS];

// Platform to Actor mapping for keyword-based extraction
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

// Default input configs per actor
export function getDefaultInput(actorId: string, params: { keyword?: string; username?: string; limit?: number }) {
  const { keyword, username, limit = 50 } = params;

  switch (actorId) {
    case APIFY_ACTORS.INSTAGRAM_HASHTAG:
      return {
        hashtags: [keyword],
        resultsLimit: limit,
      };
    case APIFY_ACTORS.INSTAGRAM_TAGGED:
      return {
        usernames: [username],
        resultsLimit: limit,
      };
    case APIFY_ACTORS.INSTAGRAM_PROFILE:
      return {
        usernames: [username],
      };
    case APIFY_ACTORS.TIKTOK:
      return {
        searchQueries: [keyword],
        resultsPerPage: limit,
      };
    case APIFY_ACTORS.YOUTUBE:
      return {
        searchKeywords: keyword,
        maxResults: limit,
      };
    case APIFY_ACTORS.TWITTER:
      return {
        searchTerms: [keyword],
        maxTweets: limit,
      };
    case APIFY_ACTORS.VIDEO_DOWNLOADER:
      return {
        urls: [],
      };
    case APIFY_ACTORS.EMAIL_EXTRACTOR:
      return {
        urls: [],
      };
    default:
      return {};
  }
}
