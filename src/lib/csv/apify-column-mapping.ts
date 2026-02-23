/**
 * Apify CSV column mapping
 *
 * Maps Apify actor raw output column names to our DB column names.
 * Used to auto-detect and import CSV files exported directly from Apify console.
 */

// Platform-specific Apify output column → DB column mappings
// Keys are lowercase Apify column headers, values are our DB column names

const INSTAGRAM_APIFY_MAP: Record<string, string> = {
  // Reel / Hashtag scraper output
  ownerusername: "username",
  ownerid: "platform_id",
  ownerfullname: "display_name",
  ownerprofilepicurl: "profile_image_url",
  // Profile scraper output
  username: "username",
  id: "platform_id",
  fullname: "display_name",
  profilepicurlhd: "profile_image_url",
  profilepicurl: "profile_image_url",
  biography: "bio",
  followerscount: "follower_count",
  followscount: "following_count",
  postscount: "post_count",
  businessemail: "email",
  externalurl: "external_url",
  externalurlshimmed: "external_url",
  isverified: "is_verified",
  isbusinessaccount: "is_business",
  businesscategoryname: "category",
};

const TIKTOK_APIFY_MAP: Record<string, string> = {
  // clockworks/tiktok-scraper - top-level fields
  author: "username",
  authorid: "platform_id",
  // authorMeta nested fields (flattened by Apify CSV export)
  "authormeta/name": "username",
  "authormeta/nickname": "display_name",
  "authormeta/id": "platform_id",
  "authormeta/avatar": "profile_image_url",
  "authormeta/signature": "bio",
  "authormeta/fans": "follower_count",
  "authormeta/following": "following_count",
  "authormeta/heart": "heart_count",
  "authormeta/video": "post_count",
  "authormeta/biolink/link": "external_url",
  nickname: "display_name",
  signature: "bio",
  diggcount: "avg_likes",
  commentcount: "avg_comments",
  sharecount: "avg_shares",
  playcount: "avg_views",
  heartcount: "heart_count",
};

const YOUTUBE_APIFY_MAP: Record<string, string> = {
  // streamers/youtube-scraper output
  channelname: "display_name",
  channelid: "platform_id",
  channelurl: "profile_url",
  channelusername: "username",
  numberofsubscribers: "follower_count",
  subscribercount: "follower_count",
  text: "bio",
  details: "bio",
  description: "bio",
  thumbnailurl: "profile_image_url",
  viewcount: "total_views",
  channeljoineddate: "channel_joined_date",
  ismonetized: "is_monetized",
  videocount: "post_count",
  likes: "avg_likes",
  likecount: "avg_likes",
  commentscount: "avg_comments",
  commentcount: "avg_comments",
  country: "country",
  defaultlanguage: "language",
};

const TWITTER_APIFY_MAP: Record<string, string> = {
  // apidojo/tweet-scraper output (author nested, flattened by CSV)
  "author/username": "username",
  "author/name": "display_name",
  "author/id": "platform_id",
  "author/restid": "platform_id",
  "author/profilepicture": "profile_image_url",
  "author/profileimageurl": "profile_image_url",
  "author/followers": "follower_count",
  "author/followerscount": "follower_count",
  "author/following": "following_count",
  "author/followingcount": "following_count",
  "author/statusescount": "post_count",
  "author/description": "bio",
  "author/location": "location",
  "author/isblueverified": "is_blue_verified",
  "author/verifiedtype": "verified_type",
  "author/website": "external_url",
  // Top-level tweet fields (may appear if not nested)
  username: "username",
  displayname: "display_name",
  authorid: "platform_id",
  followerscount: "follower_count",
  favoritecount: "avg_likes",
  likecount: "avg_likes",
  retweetcount: "avg_shares",
  replycount: "avg_comments",
  viewcount: "avg_views",
};

const PLATFORM_APIFY_MAPS: Record<string, Record<string, string>> = {
  instagram: INSTAGRAM_APIFY_MAP,
  tiktok: TIKTOK_APIFY_MAP,
  youtube: YOUTUBE_APIFY_MAP,
  twitter: TWITTER_APIFY_MAP,
};

/**
 * Signature columns that uniquely identify each platform's Apify output.
 * Each array contains column names that, if found (case-insensitive), strongly indicate the platform.
 */
const PLATFORM_SIGNATURES: Record<string, string[]> = {
  instagram: ["ownerusername", "ownerid", "ownerfullname", "ownerprofilepicurl", "biography", "profilepicurlhd"],
  tiktok: ["authormeta/name", "authormeta/fans", "authormeta/heart", "diggcount", "playcount", "sharecount"],
  youtube: ["channelname", "channelid", "channelurl", "numberofsubscribers", "channeljoineddate"],
  twitter: ["author/username", "author/isblueverified", "author/profilepicture", "favoritecount", "retweetcount"],
};

/**
 * Detect which platform an Apify CSV belongs to based on its headers.
 * Returns the platform name or null if not detected.
 */
export function detectApifyPlatform(headers: string[]): string | null {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim().replace(/\s+/g, ""));

  let bestPlatform: string | null = null;
  let bestScore = 0;

  for (const [platform, signatures] of Object.entries(PLATFORM_SIGNATURES)) {
    const score = signatures.filter((sig) => lowerHeaders.includes(sig)).length;
    if (score > bestScore) {
      bestScore = score;
      bestPlatform = platform;
    }
  }

  // Require at least 2 matching signature columns to be confident
  return bestScore >= 2 ? bestPlatform : null;
}

/**
 * Check if CSV headers look like they come from Apify (rather than our own template).
 * Returns true if Apify-style columns are detected.
 */
export function isApifyCsv(headers: string[]): boolean {
  return detectApifyPlatform(headers) !== null;
}

/**
 * Get the column mapping for a specific platform.
 */
export function getApifyColumnMap(platform: string): Record<string, string> {
  return PLATFORM_APIFY_MAPS[platform] ?? {};
}

/**
 * Map a single Apify CSV row to our DB column format.
 * Takes raw header→value pairs and returns DB column→value pairs.
 */
export function mapApifyRow(
  row: Record<string, string>,
  platform: string,
): Record<string, unknown> {
  const mapping = getApifyColumnMap(platform);
  const result: Record<string, unknown> = { platform };

  for (const [rawHeader, value] of Object.entries(row)) {
    if (!value || value === "" || value === "-") continue;

    const normalizedHeader = rawHeader.toLowerCase().trim().replace(/\s+/g, "");
    const dbColumn = mapping[normalizedHeader];

    if (!dbColumn) continue;

    // Don't overwrite a value already set (first match wins for duplicates like username)
    if (result[dbColumn] !== undefined) continue;

    // Type conversion based on known numeric/boolean columns
    result[dbColumn] = convertApifyValue(dbColumn, value);
  }

  // Generate profile_url if we have username but no profile_url
  if (result.username && !result.profile_url) {
    const u = result.username as string;
    switch (platform) {
      case "instagram":
        result.profile_url = `https://www.instagram.com/${u}/`;
        break;
      case "tiktok":
        result.profile_url = `https://www.tiktok.com/@${u}`;
        break;
      case "twitter":
        result.profile_url = `https://x.com/${u}`;
        break;
    }
  }

  return result;
}

const NUMERIC_COLUMNS = new Set([
  "follower_count", "following_count", "post_count", "engagement_rate",
  "heart_count", "share_count", "total_views",
  "avg_likes", "avg_comments", "avg_views", "avg_shares",
]);

const BOOLEAN_COLUMNS = new Set([
  "is_verified", "is_business", "is_blue_verified", "is_monetized",
]);

function convertApifyValue(dbColumn: string, value: string): unknown {
  if (NUMERIC_COLUMNS.has(dbColumn)) {
    const n = Number(value.replace(/,/g, ""));
    return isNaN(n) ? null : n;
  }
  if (BOOLEAN_COLUMNS.has(dbColumn)) {
    const lower = value.toLowerCase();
    return lower === "true" || lower === "1" || lower === "yes";
  }
  if (dbColumn === "email") {
    // Basic email validation
    return value.includes("@") ? value.trim() : null;
  }
  return value;
}
