/**
 * Brand Pipeline Transform Functions
 * Transforms Apify scraper output into brand_accounts, brand_influencer_contents,
 * and brand_influencer_relationships data.
 */

import type { Json } from "@/types/database";

// ============== Types ==============

export interface BrandProfileUpdate {
  follower_count: number | null;
  following_count: number | null;
  engagement_rate: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  avg_views: number | null;
  avg_shares: number | null;
  avg_saves: number | null;
  post_count: number | null;
  display_name: string | null;
  biography: string | null;
  external_url: string | null;
  is_verified: boolean;
  is_business_account: boolean;
  business_category: string | null;
  profile_url: string | null;
  profile_image_url: string | null;
  top_hashtags: string[];
  primary_content_types: string[];
  content_style: string[];
  posting_frequency: string | null;
}

interface BrandContentItem {
  platform: string;
  content_url: string | null;
  content_platform_id: string | null;
  content_type: string | null;
  caption: string | null;
  hashtags: string[];
  mentions: string[];
  media_urls: Json;
  thumbnail_url: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  engagement_rate: number | null;
  posted_at: string | null;
  influencer_username: string | null;
  is_sponsored: boolean;
  is_organic: boolean;
  sponsorship_indicators: string[];
  brand_mention_type: string | null;
}

// ============== Brand Profile Transform ==============

export function transformBrandProfile(
  items: Record<string, unknown>[],
  platform: string
): BrandProfileUpdate | null {
  if (!items.length) return null;
  const item = items[0];

  switch (platform) {
    case "instagram":
      return transformInstagramBrandProfile(item);
    case "tiktok":
      return transformTiktokBrandProfile(item);
    case "youtube":
      return transformYoutubeBrandProfile(item);
    case "twitter":
      return transformTwitterBrandProfile(item);
    default:
      return null;
  }
}

/** Safe number parser: handles string numbers, 0, and null */
function safeNum(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function transformInstagramBrandProfile(item: Record<string, unknown>): BrandProfileUpdate {
  const latestPosts = (item.latestPosts as Record<string, unknown>[]) || [];
  const postTypes = new Set<string>();
  const allHashtags: string[] = [];
  let totalLikes = 0;
  let totalComments = 0;
  let totalViews = 0;
  let totalShares = 0;
  let totalSaves = 0;

  for (const post of latestPosts) {
    const type = (post.type as string) || "post";
    postTypes.add(type);
    totalLikes += safeNum(post.likesCount) ?? 0;
    totalComments += safeNum(post.commentsCount) ?? 0;
    totalViews += safeNum(post.videoViewCount) ?? safeNum(post.videoPlayCount) ?? 0;
    totalShares += safeNum(post.sharesCount) ?? 0;
    totalSaves += safeNum(post.savesCount) ?? 0;
    const tags = (post.hashtags as string[]) || [];
    allHashtags.push(...tags);
  }

  const postCount = latestPosts.length;
  const avgLikes = postCount > 0 ? Math.round(totalLikes / postCount) : null;
  const avgComments = postCount > 0 ? Math.round(totalComments / postCount) : null;
  const avgViews = postCount > 0 ? Math.round(totalViews / postCount) : null;
  const avgShares = postCount > 0 ? Math.round(totalShares / postCount) : null;
  const avgSaves = postCount > 0 ? Math.round(totalSaves / postCount) : null;

  // Try multiple field names for follower count
  const followerCount = safeNum(item.followersCount) ?? safeNum(item.followerCount) ?? safeNum(item.edgeFollowedBy) ?? null;
  const followingCount = safeNum(item.followsCount) ?? safeNum(item.followingCount) ?? null;
  const totalPostCount = safeNum(item.postsCount) ?? safeNum(item.postCount) ?? safeNum(item.mediaCount) ?? null;

  const engagementRate = followerCount && followerCount > 0 && avgLikes != null
    ? Number(((avgLikes + (avgComments ?? 0)) / followerCount * 100).toFixed(4))
    : null;

  // Top hashtags by frequency
  const hashtagCounts: Record<string, number> = {};
  for (const tag of allHashtags) {
    hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
  }
  const topHashtags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag]) => tag);

  // Extract bio/external URL
  const biography = (item.biography as string) || (item.bio as string) || null;
  const externalUrl = (item.externalUrl as string) || (item.website as string) || null;
  const isVerified = item.verified === true || item.isVerified === true;
  const isBusinessAccount = item.isBusinessAccount === true;
  const businessCategory = (item.businessCategoryName as string) || (item.categoryName as string) || null;

  return {
    follower_count: followerCount,
    following_count: followingCount,
    engagement_rate: engagementRate,
    avg_likes: avgLikes,
    avg_comments: avgComments,
    avg_views: avgViews,
    avg_shares: avgShares,
    avg_saves: avgSaves,
    post_count: totalPostCount,
    display_name: (item.fullName as string) || (item.name as string) || null,
    biography,
    external_url: externalUrl,
    is_verified: isVerified,
    is_business_account: isBusinessAccount,
    business_category: businessCategory,
    profile_url: `https://instagram.com/${item.username}`,
    profile_image_url: (item.profilePicUrlHD as string) || (item.profilePicUrl as string) || null,
    top_hashtags: topHashtags,
    primary_content_types: Array.from(postTypes),
    content_style: detectContentStyle(latestPosts),
    posting_frequency: latestPosts.length > 1 ? estimatePostingFrequency(latestPosts) : null,
  };
}

function detectContentStyle(posts: Record<string, unknown>[]): string[] {
  if (posts.length === 0) return [];
  const styles: string[] = [];
  const types = posts.map(p => (p.type as string) || "post");
  const reelCount = types.filter(t => t === "Reel" || t === "reel" || t === "Video").length;
  const carouselCount = types.filter(t => t === "Sidecar" || t === "carousel").length;
  const imageCount = types.filter(t => t === "Image" || t === "photo" || t === "post").length;
  if (reelCount > posts.length * 0.5) styles.push("reel_focused");
  if (carouselCount > posts.length * 0.3) styles.push("carousel_heavy");
  if (imageCount > posts.length * 0.5) styles.push("image_focused");
  const avgCaptionLen = posts.reduce((acc, p) => acc + ((p.caption as string) || "").length, 0) / posts.length;
  if (avgCaptionLen > 500) styles.push("long_caption");
  else if (avgCaptionLen < 50) styles.push("minimal_caption");
  return styles;
}

function transformTiktokBrandProfile(item: Record<string, unknown>): BrandProfileUpdate {
  const authorStats = (item.authorStats as Record<string, unknown>) || item;
  return {
    follower_count: safeNum(authorStats.followerCount) ?? safeNum(item.fans) ?? null,
    following_count: safeNum(authorStats.followingCount) ?? null,
    engagement_rate: null,
    avg_likes: safeNum(authorStats.heartCount) ?? null,
    avg_comments: null,
    avg_views: null,
    avg_shares: null,
    avg_saves: null,
    post_count: safeNum(authorStats.videoCount) ?? null,
    display_name: (item.nickname as string) || null,
    biography: (item.signature as string) || null,
    external_url: (item.bioLink as string) || null,
    is_verified: item.verified === true,
    is_business_account: false,
    business_category: null,
    profile_url: `https://tiktok.com/@${item.uniqueId || item.username}`,
    profile_image_url: (item.avatarLarger as string) || (item.avatarMedium as string) || null,
    top_hashtags: [],
    primary_content_types: ["video"],
    content_style: [],
    posting_frequency: null,
  };
}

function transformYoutubeBrandProfile(item: Record<string, unknown>): BrandProfileUpdate {
  return {
    follower_count: safeNum(item.numberOfSubscribers) ?? null,
    following_count: null,
    engagement_rate: null,
    avg_likes: null,
    avg_comments: null,
    avg_views: safeNum(item.averageViewCount) ?? null,
    avg_shares: null,
    avg_saves: null,
    post_count: safeNum(item.numberOfVideos) ?? null,
    display_name: (item.channelName as string) || null,
    biography: (item.description as string) || null,
    external_url: (item.channelUrl as string) || null,
    is_verified: item.isVerified === true,
    is_business_account: false,
    business_category: null,
    profile_url: (item.channelUrl as string) || null,
    profile_image_url: (item.channelProfilePicUrl as string) || null,
    top_hashtags: [],
    primary_content_types: ["video"],
    content_style: [],
    posting_frequency: null,
  };
}

function transformTwitterBrandProfile(item: Record<string, unknown>): BrandProfileUpdate {
  const user = (item.author as Record<string, unknown>) || item;
  return {
    follower_count: safeNum(user.followers) ?? safeNum(user.followersCount) ?? null,
    following_count: safeNum(user.following) ?? safeNum(user.followingCount) ?? null,
    engagement_rate: null,
    avg_likes: null,
    avg_comments: null,
    avg_views: null,
    avg_shares: null,
    avg_saves: null,
    post_count: safeNum(user.statusesCount) ?? null,
    display_name: (user.name as string) || null,
    biography: (user.description as string) || null,
    external_url: null,
    is_verified: user.isBlueVerified === true || user.verified === true,
    is_business_account: false,
    business_category: null,
    profile_url: `https://x.com/${user.userName || user.username}`,
    profile_image_url: (user.profileImageUrl as string) || null,
    top_hashtags: [],
    primary_content_types: ["tweet"],
    content_style: [],
    posting_frequency: null,
  };
}

// ============== Content Transform ==============

export function transformToContent(
  item: Record<string, unknown>,
  platform: string,
  sourceType: string = "tagged_scraper"
): BrandContentItem {
  switch (platform) {
    case "instagram":
      return transformInstagramContent(item, sourceType);
    case "tiktok":
      return transformTiktokContent(item, sourceType);
    case "youtube":
      return transformYoutubeContent(item, sourceType);
    case "twitter":
      return transformTwitterContent(item, sourceType);
    default:
      return createDefaultContent(item, platform, sourceType);
  }
}

function transformInstagramContent(
  item: Record<string, unknown>,
  sourceType: string
): BrandContentItem {
  const caption = (item.caption as string) || "";
  const hashtags = (item.hashtags as string[]) || extractHashtags(caption);
  const mentions = (item.mentions as string[]) || extractMentions(caption);
  const sponsorSignals = detectSponsorshipSignals(caption, hashtags);

  return {
    platform: "instagram",
    content_url: (item.url as string) || (item.webLink as string) || null,
    content_platform_id: (item.id as string) || (item.shortCode as string) || null,
    content_type: (item.type as string) || "post",
    caption,
    hashtags,
    mentions,
    media_urls: (item.images as Json) || (item.displayUrl ? [item.displayUrl as string] : [] as Json),
    thumbnail_url: (item.displayUrl as string) || null,
    views_count: (item.videoViewCount as number) || 0,
    likes_count: (item.likesCount as number) || 0,
    comments_count: (item.commentsCount as number) || 0,
    shares_count: 0,
    saves_count: 0,
    engagement_rate: null,
    posted_at: (item.timestamp as string) || null,
    influencer_username: (item.ownerUsername as string) || null,
    is_sponsored: sponsorSignals.length > 0,
    is_organic: sponsorSignals.length === 0,
    sponsorship_indicators: sponsorSignals,
    brand_mention_type: sourceType === "tagged_scraper" ? "tagged" : "mentioned",
  };
}

function transformTiktokContent(
  item: Record<string, unknown>,
  sourceType: string
): BrandContentItem {
  const text = (item.text as string) || (item.desc as string) || "";
  const hashtags = (item.hashtags as Record<string, unknown>[])?.map((h) => h.name as string) || extractHashtags(text);
  const mentions = extractMentions(text);
  const sponsorSignals = detectSponsorshipSignals(text, hashtags);
  const stats = (item.stats as Record<string, unknown>) || {};

  return {
    platform: "tiktok",
    content_url: (item.webVideoUrl as string) || null,
    content_platform_id: (item.id as string) || null,
    content_type: "video",
    caption: text,
    hashtags,
    mentions,
    media_urls: [],
    thumbnail_url: (item.covers as Record<string, unknown>)?.default as string || null,
    views_count: (stats.playCount as number) || (item.playCount as number) || 0,
    likes_count: (stats.diggCount as number) || (item.diggCount as number) || 0,
    comments_count: (stats.commentCount as number) || (item.commentCount as number) || 0,
    shares_count: (stats.shareCount as number) || (item.shareCount as number) || 0,
    saves_count: 0,
    engagement_rate: null,
    posted_at: (item.createTime as string) ? new Date(Number(item.createTime) * 1000).toISOString() : null,
    influencer_username: (item.authorMeta as Record<string, unknown>)?.name as string || null,
    is_sponsored: sponsorSignals.length > 0,
    is_organic: sponsorSignals.length === 0,
    sponsorship_indicators: sponsorSignals,
    brand_mention_type: sourceType === "tagged_scraper" ? "tagged" : "mentioned",
  };
}

function transformYoutubeContent(
  item: Record<string, unknown>,
  sourceType: string
): BrandContentItem {
  const title = (item.title as string) || "";
  const description = (item.description as string) || "";
  const fullText = `${title} ${description}`;
  const hashtags = extractHashtags(fullText);
  const mentions = extractMentions(fullText);
  const sponsorSignals = detectSponsorshipSignals(fullText, hashtags);

  return {
    platform: "youtube",
    content_url: (item.url as string) || null,
    content_platform_id: (item.id as string) || null,
    content_type: (item.type as string) || "video",
    caption: title,
    hashtags,
    mentions,
    media_urls: [],
    thumbnail_url: (item.thumbnailUrl as string) || null,
    views_count: (item.viewCount as number) || 0,
    likes_count: (item.likes as number) || 0,
    comments_count: (item.commentsCount as number) || 0,
    shares_count: 0,
    saves_count: 0,
    engagement_rate: null,
    posted_at: (item.date as string) || (item.uploadDate as string) || null,
    influencer_username: (item.channelName as string) || null,
    is_sponsored: sponsorSignals.length > 0,
    is_organic: sponsorSignals.length === 0,
    sponsorship_indicators: sponsorSignals,
    brand_mention_type: sourceType === "tagged_scraper" ? "tagged" : "mentioned",
  };
}

function transformTwitterContent(
  item: Record<string, unknown>,
  sourceType: string
): BrandContentItem {
  const text = (item.text as string) || (item.fullText as string) || "";
  const hashtags = (item.entities as Record<string, unknown>)?.hashtags as string[] || extractHashtags(text);
  const mentions = extractMentions(text);
  const sponsorSignals = detectSponsorshipSignals(text, hashtags);
  const author = (item.author as Record<string, unknown>) || {};

  return {
    platform: "twitter",
    content_url: (item.url as string) || null,
    content_platform_id: (item.id as string) || null,
    content_type: "tweet",
    caption: text,
    hashtags,
    mentions,
    media_urls: (item.media as Json) || [],
    thumbnail_url: null,
    views_count: (item.viewCount as number) || 0,
    likes_count: (item.likeCount as number) || (item.favoriteCount as number) || 0,
    comments_count: (item.replyCount as number) || 0,
    shares_count: (item.retweetCount as number) || 0,
    saves_count: (item.bookmarkCount as number) || 0,
    engagement_rate: null,
    posted_at: (item.createdAt as string) || null,
    influencer_username: (author.userName as string) || null,
    is_sponsored: sponsorSignals.length > 0,
    is_organic: sponsorSignals.length === 0,
    sponsorship_indicators: sponsorSignals,
    brand_mention_type: sourceType === "tagged_scraper" ? "tagged" : "mentioned",
  };
}

function createDefaultContent(
  item: Record<string, unknown>,
  platform: string,
  sourceType: string
): BrandContentItem {
  return {
    platform,
    content_url: (item.url as string) || null,
    content_platform_id: (item.id as string) || null,
    content_type: null,
    caption: (item.text as string) || (item.caption as string) || null,
    hashtags: [],
    mentions: [],
    media_urls: [],
    thumbnail_url: null,
    views_count: 0,
    likes_count: 0,
    comments_count: 0,
    shares_count: 0,
    saves_count: 0,
    engagement_rate: null,
    posted_at: null,
    influencer_username: null,
    is_sponsored: false,
    is_organic: true,
    sponsorship_indicators: [],
    brand_mention_type: sourceType === "tagged_scraper" ? "tagged" : "mentioned",
  };
}

// ============== Helpers ==============

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F\uAC00-\uD7AF\u3040-\u30FF\u4E00-\u9FFF]+/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w.]+/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

function detectSponsorshipSignals(text: string, hashtags: string[]): string[] {
  const signals: string[] = [];
  const lowerText = text.toLowerCase();
  const lowerHashtags = hashtags.map((h) => h.toLowerCase());

  const adKeywords = ["ad", "sponsored", "paid", "partnership", "collab", "gifted", "pr"];
  const adHashtags = ["ad", "sponsored", "paidpartnership", "collab", "gifted", "광고", "협찬", "pr제공", "제공"];

  for (const kw of adKeywords) {
    if (lowerText.includes(kw)) signals.push(`text:${kw}`);
  }
  for (const tag of adHashtags) {
    if (lowerHashtags.includes(tag)) signals.push(`hashtag:${tag}`);
  }

  // Instagram paid partnership label
  if (lowerText.includes("paid partnership")) signals.push("label:paid_partnership");

  return [...new Set(signals)];
}

function estimatePostingFrequency(posts: Record<string, unknown>[]): string | null {
  if (posts.length < 2) return null;
  const timestamps = posts
    .map((p) => new Date((p.timestamp as string) || 0).getTime())
    .filter((t) => t > 0)
    .sort((a, b) => b - a);

  if (timestamps.length < 2) return null;

  const totalDays = (timestamps[0] - timestamps[timestamps.length - 1]) / (1000 * 60 * 60 * 24);
  if (totalDays <= 0) return null;

  const postsPerWeek = (timestamps.length / totalDays) * 7;

  if (postsPerWeek >= 7) return "daily";
  if (postsPerWeek >= 3) return "several_per_week";
  if (postsPerWeek >= 1) return "weekly";
  if (postsPerWeek >= 0.5) return "biweekly";
  return "monthly_or_less";
}
