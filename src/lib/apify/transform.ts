import type { Json } from "@/types/database";

export type TransformedInfluencer = {
  platform: string;
  platform_id: string;
  username: string;
  display_name: string;
  profile_url: string;
  profile_image_url: string;
  bio: string;
  follower_count: number | null;
  following_count: number | null;
  post_count: number | null;
  engagement_rate: number | null;
  email: string | null;
  email_source: string | null;
  country: string | null;
  language: string | null;
  raw_data: Json;
};

const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.\w+/g;

/**
 * Instagram Reel / Hashtag / Tagged Scraper output:
 * Reel scraper: ownerUsername, ownerId, ownerFullName, ownerProfilePicUrl (NO followers/bio)
 * Profile scraper: followersCount, followsCount, postsCount, biography, businessEmail
 * Tagged scraper: ownerUsername, ownerId, ownerFullName (NO followers/bio)
 */
function transformInstagram(item: Record<string, unknown>): Partial<TransformedInfluencer> | null {
  const username = (item.ownerUsername ?? item.username ?? "") as string;
  const platformId = (item.ownerId ?? item.id ?? item.pk ?? "") as string;
  if (!username && !platformId) return null;

  // biography comes from profile scraper; reel/tagged scraper may include caption instead
  const bio = (item.biography ?? item.bio ?? "") as string;
  const businessEmail = (item.businessEmail ?? null) as string | null;
  const bioEmail = bio ? (bio.match(EMAIL_REGEX)?.[0] ?? null) : null;
  const finalEmail = businessEmail || bioEmail || null;

  return {
    platform_id: String(platformId),
    username,
    display_name: (item.ownerFullName ?? item.fullName ?? item.full_name ?? "") as string,
    profile_url: username ? `https://www.instagram.com/${username}/` : "",
    // ownerProfilePicUrl from reel scraper, profilePicUrl from profile scraper
    profile_image_url: (item.ownerProfilePicUrl ?? item.profilePicUrl ?? item.profilePicUrlHd ?? item.profile_pic_url ?? "") as string,
    bio,
    follower_count: toNumber(item.followersCount ?? item.follower_count),
    following_count: toNumber(item.followsCount ?? item.following_count),
    post_count: toNumber(item.postsCount ?? item.media_count),
    engagement_rate: toNumber(item.engagement_rate ?? item.engagementRate),
    email: finalEmail,
    email_source: finalEmail ? (businessEmail ? "business" : "bio") : null,
    country: null,
    language: null,
  };
}

/**
 * TikTok scraper (clockworks/tiktok-scraper) output:
 * Nested author data: authorMeta.name, authorMeta.nickName, authorMeta.avatar, authorMeta.fans, etc.
 * Also top-level: author (username string)
 */
function transformTiktok(item: Record<string, unknown>): Partial<TransformedInfluencer> | null {
  const authorMeta = item.authorMeta as Record<string, unknown> | undefined;
  const username = (authorMeta?.name ?? item.author ?? "") as string;
  const platformId = (authorMeta?.id ?? item.authorId ?? item.id ?? "") as string;
  if (!username && !platformId) return null;

  const bio = (authorMeta?.signature ?? item.signature ?? "") as string;
  const bioEmail = bio ? (bio.match(EMAIL_REGEX)?.[0] ?? null) : null;

  return {
    platform_id: String(platformId),
    username,
    display_name: (authorMeta?.nickName ?? item.nickName ?? "") as string,
    profile_url: username ? `https://www.tiktok.com/@${username}` : "",
    profile_image_url: (authorMeta?.avatar ?? item.avatar ?? "") as string,
    bio,
    follower_count: toNumber(authorMeta?.fans ?? item.fans),
    following_count: toNumber(authorMeta?.following ?? item.following),
    post_count: toNumber(authorMeta?.video ?? item.video),
    engagement_rate: null,
    email: bioEmail,
    email_source: bioEmail ? "bio" : null,
    country: null,
    language: null,
  };
}

/**
 * YouTube scraper (streamers/youtube-scraper) output:
 * Video-level: channelName, channelUrl, channelId, numberOfSubscribers, viewCount,
 * thumbnailUrl, details (description), title, date
 */
function transformYoutube(item: Record<string, unknown>): Partial<TransformedInfluencer> | null {
  const channelId = (item.channelId ?? item.id ?? "") as string;
  const channelName = (item.channelName ?? item.name ?? item.title ?? "") as string;
  const channelUrl = (item.channelUrl ?? item.url ?? "") as string;
  const channelUsername = (item.channelUsername ?? "") as string;
  const handleMatch = channelUrl ? String(channelUrl).match(/@([^/]+)/) : null;
  const username = channelUsername || (handleMatch ? handleMatch[1] : channelName);
  if (!username && !channelId) return null;

  // streamers/youtube-scraper uses "text" or "details" for video description
  const description = (item.text ?? item.details ?? item.description ?? "") as string;
  const bioEmail = description ? (description.match(EMAIL_REGEX)?.[0] ?? null) : null;

  return {
    platform_id: String(channelId),
    username,
    display_name: channelName,
    profile_url: channelUrl ? String(channelUrl) : "",
    profile_image_url: (item.thumbnailUrl ?? item.thumbnail ?? item.avatar ?? "") as string,
    bio: description,
    // numberOfSubscribers is the actual field name from streamers/youtube-scraper
    follower_count: toNumber(item.numberOfSubscribers ?? item.subscriberCount ?? item.subscribers),
    following_count: null,
    post_count: toNumber(item.videoCount ?? item.videos),
    engagement_rate: null,
    email: bioEmail,
    email_source: bioEmail ? "bio" : null,
    country: (item.country ?? null) as string | null,
    language: (item.defaultLanguage ?? null) as string | null,
  };
}

/**
 * Twitter/X scraper (apidojo/tweet-scraper) output:
 * Nested author: author.userName, author.name (display), author.profilePicture,
 * author.followers, author.following, author.statusesCount, author.isBlueVerified, author.location
 */
function transformTwitter(item: Record<string, unknown>): Partial<TransformedInfluencer> | null {
  const author = item.author as Record<string, unknown> | undefined;
  const username = (author?.userName ?? author?.username ?? item.userName ?? item.username ?? "") as string;
  const platformId = (author?.id ?? author?.restId ?? item.authorId ?? item.id ?? "") as string;
  if (!username && !platformId) return null;

  const bio = (author?.description ?? author?.bio ?? item.description ?? "") as string;
  const bioEmail = bio ? (bio.match(EMAIL_REGEX)?.[0] ?? null) : null;

  return {
    platform_id: String(platformId),
    username,
    // apidojo uses author.name for display name, NOT author.displayName
    display_name: (author?.name ?? author?.displayName ?? item.displayName ?? "") as string,
    profile_url: username ? `https://x.com/${username}` : "",
    // apidojo uses author.profilePicture, NOT author.profileImageUrl
    profile_image_url: (author?.profilePicture ?? author?.profileImageUrl ?? author?.profile_image_url_https ?? item.profileImageUrl ?? "") as string,
    bio,
    follower_count: toNumber(author?.followers ?? author?.followersCount ?? item.followersCount),
    following_count: toNumber(author?.following ?? author?.followingCount ?? item.followingCount),
    post_count: toNumber(author?.statusesCount ?? item.statusesCount),
    engagement_rate: null,
    email: bioEmail,
    email_source: bioEmail ? "bio" : null,
    country: (author?.location ?? item.location ?? null) as string | null,
    language: null,
  };
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

export function transformApifyItem(
  item: Record<string, unknown>,
  platform: string,
): TransformedInfluencer | null {
  let partial: Partial<TransformedInfluencer> | null = null;

  switch (platform) {
    case "instagram":
      partial = transformInstagram(item);
      break;
    case "tiktok":
      partial = transformTiktok(item);
      break;
    case "youtube":
      partial = transformYoutube(item);
      break;
    case "twitter":
      partial = transformTwitter(item);
      break;
    default:
      // Generic fallback
      partial = transformInstagram(item);
  }

  if (!partial) return null;

  return {
    platform,
    platform_id: partial.platform_id ?? "",
    username: partial.username ?? "",
    display_name: partial.display_name ?? "",
    profile_url: partial.profile_url ?? "",
    profile_image_url: partial.profile_image_url ?? "",
    bio: partial.bio ?? "",
    follower_count: partial.follower_count ?? null,
    following_count: partial.following_count ?? null,
    post_count: partial.post_count ?? null,
    engagement_rate: partial.engagement_rate ?? null,
    email: partial.email ?? null,
    email_source: partial.email_source ?? null,
    country: partial.country ?? null,
    language: partial.language ?? null,
    raw_data: item as unknown as Json,
  };
}
