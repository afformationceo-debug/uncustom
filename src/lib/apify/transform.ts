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
  // Platform-specific fields
  is_blue_verified: boolean | null;
  verified_type: string | null;
  location: string | null;
  heart_count: number | null;
  share_count: number | null;
  total_views: number | null;
  channel_joined_date: string | null;
  is_monetized: boolean | null;
  external_url: string | null;
  avg_likes: number | null;
  avg_comments: number | null;
  avg_views: number | null;
  avg_shares: number | null;
  // Existing DB fields that can be set by transforms
  is_verified: boolean | null;
  category: string | null;
  // Content source fields (어떤 콘텐츠에서 발견됐는지)
  source_content_url: string | null;
  source_content_text: string | null;
  source_content_media: Json | null;
  source_content_created_at: string | null;
  content_language: string | null;
  content_hashtags: string[] | null;
  // Profile extended fields
  account_created_at: string | null;
  is_private: boolean | null;
  cover_image_url: string | null;
  // Additional engagement metrics
  bookmark_count: number | null;
  quote_count: number | null;
  favourites_count: number | null;
  // Content meta
  video_duration: number | null;
  video_title: string | null;
  // Extended actor fields
  listed_count: number | null;
  media_count: number | null;
  is_sponsored: boolean | null;
  is_retweet: boolean | null;
  is_reply: boolean | null;
  mentions: string[] | null;
  music_info: Json | null;
  product_type: string | null;
};

// Improved email regex: requires alphanumeric start/end, min 2-char TLD
const EMAIL_REGEX = /[a-zA-Z0-9][\w.-]*[a-zA-Z0-9]@[a-zA-Z0-9][\w.-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}/g;

/**
 * Instagram Reel / Hashtag / Tagged Scraper output:
 * Reel scraper (PRIMARY for keyword extraction):
 *   ownerUsername, ownerId, ownerFullName, ownerProfilePicUrl, displayUrl, videoUrl, caption
 *   - Returns profile pics via ownerProfilePicUrl (unlike hashtag scraper)
 *   - Does NOT return: followersCount, biography, businessEmail (enrichment fills these)
 * Hashtag scraper (legacy): ownerUsername, ownerId, ownerFullName, displayUrl, caption
 *   - Does NOT return: profilePicUrl, followersCount, biography, businessEmail
 * Profile scraper (enrichment): username, id, fullName, profilePicUrlHD, followersCount, followsCount, postsCount, biography, businessEmail, latestPosts[]
 * Tagged scraper: ownerUsername, ownerId, ownerFullName (NO followers/bio)
 */
function transformInstagram(item: Record<string, unknown>): Partial<TransformedInfluencer> | null {
  const username = (item.ownerUsername ?? item.username ?? "") as string;
  const platformId = (item.ownerId ?? item.id ?? item.pk ?? "") as string;
  if (!username && !platformId) return null;

  // biography comes from profile scraper; reel/tagged/hashtag scraper may include caption instead
  const bio = (item.biography ?? item.bio ?? "") as string;
  const businessEmail = (item.businessEmail ?? null) as string | null;
  const bioEmail = bio ? (bio.match(EMAIL_REGEX)?.[0] ?? null) : null;
  const finalEmail = businessEmail || bioEmail || null;

  // Profile pic: hashtag scraper does NOT return profile pics at all.
  // Only profile scraper (profilePicUrlHD) and reel scraper (ownerProfilePicUrl) have them.
  // Keep empty string as "" only if we actually got a URL - otherwise leave as "" for DB.
  const profilePic = (item.profilePicUrlHD ?? item.profilePicUrlHd ?? item.profilePicUrl ?? item.ownerProfilePicUrl ?? item.profile_pic_url ?? "") as string;

  // Content source: reel/hashtag/tagged scraper returns the content, profile scraper doesn't
  const contentUrl = (item.url ?? item.webUrl ?? null) as string | null;
  const caption = (item.caption ?? item.text ?? null) as string | null;
  const mediaArr = item.displayUrl ? [item.displayUrl as string] : (item.videoUrl ? [item.videoUrl as string] : null);
  const hashtags = Array.isArray(item.hashtags) ? (item.hashtags as string[]) : null;

  // Timestamp: convert Unix timestamp to ISO string
  const rawTimestamp = item.timestamp ?? item.takenAtTimestamp ?? null;
  let contentCreatedAt: string | null = null;
  if (rawTimestamp !== null) {
    const ts = Number(rawTimestamp);
    if (!isNaN(ts) && ts > 1000000000) {
      // Unix seconds → ISO
      contentCreatedAt = new Date(ts * 1000).toISOString();
    } else if (typeof rawTimestamp === "string") {
      contentCreatedAt = rawTimestamp;
    }
  }

  // Mentions extraction
  const rawMentions = item.mentions;
  const mentions = Array.isArray(rawMentions)
    ? rawMentions.map((m: Record<string, unknown> | string) => typeof m === "object" ? (m.username as string ?? m.id as string ?? "") : m).filter(Boolean)
    : null;

  // Music info
  const musicInfo = (item.musicInfo ?? item.audio ?? null) as Record<string, unknown> | null;

  // Location from reel/post
  const locationName = (item.locationName ?? (item.location as Record<string, unknown>)?.name ?? null) as string | null;

  return {
    platform_id: String(platformId),
    username,
    display_name: (item.ownerFullName ?? item.fullName ?? item.full_name ?? "") as string,
    profile_url: username ? `https://www.instagram.com/${username}/` : "",
    profile_image_url: profilePic,
    bio,
    follower_count: toNumber(item.followersCount ?? item.follower_count),
    following_count: toNumber(item.followsCount ?? item.following_count),
    post_count: toNumber(item.postsCount ?? item.media_count),
    engagement_rate: toNumber(item.engagement_rate ?? item.engagementRate),
    email: finalEmail,
    email_source: finalEmail ? (businessEmail ? "business" : "bio") : null,
    country: null,
    language: null,
    external_url: (item.externalUrl ?? item.externalUrlShimmed ?? null) as string | null,
    location: locationName,
    // Content source
    source_content_url: contentUrl,
    source_content_text: caption,
    source_content_media: mediaArr as unknown as Json ?? null,
    source_content_created_at: contentCreatedAt,
    content_language: null,
    content_hashtags: hashtags,
    // Profile extended
    account_created_at: null,
    is_private: item.private === true ? true : null,
    cover_image_url: null,
    // IG-specific metrics (from reel/post - before enrichment fills averages)
    avg_likes: toNumber(item.likesCount ?? item.likes),
    avg_comments: toNumber(item.commentsCount ?? item.comments),
    avg_views: toNumber(item.videoViewCount ?? item.playCount ?? item.videoPlayCount),
    bookmark_count: null,
    quote_count: null,
    favourites_count: null,
    video_duration: toNumber(item.videoDuration) as number | null,
    video_title: null,
    // Extended fields
    is_sponsored: item.isSponsored === true ? true : null,
    mentions: mentions,
    music_info: musicInfo as unknown as Json ?? null,
    product_type: (item.productType ?? item.type ?? null) as string | null,
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

  const followers = toNumber(authorMeta?.fans ?? item.fans);
  const diggCount = toNumber(item.diggCount ?? item.likes);
  const commentCount = toNumber(item.commentCount ?? item.comments);
  const shareCount = toNumber(item.shareCount ?? item.shares);
  const playCount = toNumber(item.playCount ?? item.plays);

  // TikTok engagement: (likes + comments + shares) / views
  let engagementRate: number | null = null;
  if (playCount && playCount > 0) {
    const totalEngagement = (diggCount ?? 0) + (commentCount ?? 0) + (shareCount ?? 0);
    engagementRate = totalEngagement / playCount;
  }

  const heartCount = toNumber(authorMeta?.heart ?? item.heartCount);
  const bioLink = authorMeta?.bioLink as Record<string, unknown> | string | undefined;
  const externalUrl = typeof bioLink === "object" && bioLink !== null
    ? (bioLink.link as string | null) ?? null
    : typeof bioLink === "string" ? bioLink : null;

  // Content source
  const webVideoUrl = (item.webVideoUrl ?? null) as string | null;
  const text = (item.text ?? null) as string | null;
  const mediaUrls = Array.isArray(item.mediaUrls) ? item.mediaUrls as string[] : null;
  const hashtagsRaw = item.hashtags;
  const hashtags = Array.isArray(hashtagsRaw)
    ? hashtagsRaw.map((h: Record<string, unknown> | string) => typeof h === "object" ? (h.name as string) : h)
    : null;
  const createTimeISO = (item.createTimeISO ?? null) as string | null;
  const textLanguage = (item.textLanguage ?? null) as string | null;

  // Video meta
  const videoMeta = item.videoMeta as Record<string, unknown> | undefined;
  const videoDuration = toNumber(videoMeta?.duration ?? item.duration);
  const collectCount = toNumber(item.collectCount);

  // TikTok location
  const locationCreated = (item.locationCreated ?? item.poi ?? null) as string | null;

  // TikTok verified
  const isVerified = authorMeta?.verified === true ? true : null;

  // Music metadata
  const musicMeta = (item.musicMeta ?? null) as Record<string, unknown> | null;

  // Mentions from textExtra or mentions array
  const rawMentions = item.mentions ?? item.textExtra;
  const mentions = Array.isArray(rawMentions)
    ? rawMentions.map((m: Record<string, unknown> | string) => {
        if (typeof m === "string") return m;
        return (m.awemeId as string) ?? (m.userId as string) ?? (m.secUid as string) ?? "";
      }).filter(Boolean)
    : null;

  // Is ad/sponsored
  const isAd = item.isAd === true ? true : null;

  // Region code for country
  const regionCode = (item.regionCode ?? item.region ?? null) as string | null;

  // Item struct type
  const itemInfos = item.itemInfos as Record<string, unknown> | undefined;
  const itemStruct = itemInfos?.itemStruct as Record<string, unknown> | undefined;
  const productType = (itemStruct?.type ?? null) as string | null;

  return {
    platform_id: String(platformId),
    username,
    display_name: (authorMeta?.nickName ?? item.nickName ?? "") as string,
    profile_url: username ? `https://www.tiktok.com/@${username}` : "",
    profile_image_url: (authorMeta?.avatar ?? item.avatar ?? "") as string,
    bio,
    follower_count: followers,
    following_count: toNumber(authorMeta?.following ?? item.following),
    post_count: toNumber(authorMeta?.video ?? item.video),
    engagement_rate: engagementRate,
    email: bioEmail,
    email_source: bioEmail ? "bio" : null,
    country: regionCode ? regionCode.toUpperCase() : null,
    language: null,
    is_verified: isVerified,
    heart_count: heartCount,
    share_count: shareCount,
    external_url: externalUrl,
    location: locationCreated,
    avg_likes: diggCount,
    avg_comments: commentCount,
    avg_shares: shareCount,
    avg_views: playCount,
    // Content source
    source_content_url: webVideoUrl,
    source_content_text: text,
    source_content_media: mediaUrls as unknown as Json ?? null,
    source_content_created_at: createTimeISO,
    content_language: textLanguage,
    content_hashtags: hashtags as string[] | null,
    // Profile extended
    account_created_at: null,
    is_private: authorMeta?.privateAccount === true ? true : null,
    cover_image_url: null,
    // TikTok-specific
    bookmark_count: collectCount,
    quote_count: toNumber(item.repostCount),
    favourites_count: toNumber(authorMeta?.digg),
    video_duration: videoDuration as number | null,
    video_title: null,
    // Extended fields
    is_sponsored: isAd,
    mentions: mentions,
    music_info: musicMeta as unknown as Json ?? null,
    product_type: productType,
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

  const subscribers = toNumber(item.numberOfSubscribers ?? item.subscriberCount ?? item.subscribers);
  const viewCount = toNumber(item.viewCount ?? item.views);
  const likeCount = toNumber(item.likes ?? item.likeCount);
  const ytCommentCount = toNumber(item.commentsCount ?? item.commentCount ?? item.comments);

  // YouTube engagement: (likes + comments) / views
  let ytEngagement: number | null = null;
  if (viewCount && viewCount > 0) {
    const totalEngagement = (likeCount ?? 0) + (ytCommentCount ?? 0);
    ytEngagement = totalEngagement / viewCount;
  }

  // Content source (the video that matched the search)
  const videoUrl = (item.url ?? null) as string | null;
  const videoTitle = (item.title ?? null) as string | null;
  const videoDate = (item.date ?? null) as string | null;
  const thumbnailUrl = (item.thumbnailUrl ?? item.thumbnail ?? "") as string;
  // YouTube: tags array OR hashtags array
  const tagsRaw = item.tags ?? item.hashtags;
  const hashtags = Array.isArray(tagsRaw) ? tagsRaw as string[] : null;
  const durationStr = (item.duration ?? null) as string | null;
  // YouTube: isShort flag or category
  const isShort = item.isShort === true;
  const category = (item.category ?? null) as string | null;
  const productType = isShort ? "short" : (category ?? "video");
  // Parse duration "HH:MM:SS" to seconds
  let durationSec: number | null = null;
  if (durationStr) {
    const parts = durationStr.split(":").map(Number);
    if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
  }

  return {
    platform_id: String(channelId),
    username,
    display_name: channelName,
    profile_url: channelUrl ? String(channelUrl) : "",
    profile_image_url: thumbnailUrl,
    bio: description,
    follower_count: subscribers,
    following_count: null,
    post_count: toNumber(item.videoCount ?? item.videos),
    engagement_rate: ytEngagement,
    email: bioEmail,
    email_source: bioEmail ? "bio" : null,
    country: (item.country ?? null) as string | null,
    language: (item.defaultLanguage ?? null) as string | null,
    total_views: viewCount,
    channel_joined_date: (() => {
      const raw = item.channelJoinedDate as string | null | undefined;
      if (!raw) return null;
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d.toISOString();
    })(),
    is_monetized: item.isMonetized === true ? true : item.isMonetized === false ? false : null,
    external_url: channelUrl ? String(channelUrl) : null,
    location: (item.country ?? null) as string | null,
    avg_likes: likeCount,
    avg_comments: ytCommentCount,
    avg_views: viewCount,
    // Content source
    source_content_url: videoUrl,
    source_content_text: description,
    source_content_media: thumbnailUrl ? [thumbnailUrl] as unknown as Json : null,
    source_content_created_at: videoDate,
    content_language: (item.defaultLanguage ?? null) as string | null,
    content_hashtags: hashtags,
    // Profile extended
    account_created_at: (() => {
      const raw = item.channelJoinedDate as string | null | undefined;
      if (!raw) return null;
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d.toISOString();
    })(),
    is_private: null,
    cover_image_url: null,
    // YouTube-specific
    bookmark_count: null,
    quote_count: null,
    favourites_count: null,
    video_duration: durationSec,
    video_title: videoTitle,
    // Extended fields
    product_type: productType,
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

  // Twitter's location is free-text (user self-reported), may contain email, city, or anything
  const rawLocation = (author?.location ?? item.location ?? null) as string | null;
  // Check if location field accidentally contains an email
  const locationEmail = rawLocation ? (rawLocation.match(EMAIL_REGEX)?.[0] ?? null) : null;
  // Use location email as fallback if no email found in bio
  const finalEmail = bioEmail || locationEmail || null;
  const emailSource = finalEmail ? (bioEmail ? "bio" : "location") : null;

  const twFollowers = toNumber(author?.followers ?? author?.followersCount ?? item.followersCount);
  const favoriteCount = toNumber(item.favoriteCount ?? item.likeCount ?? item.likes);
  const retweetCount = toNumber(item.retweetCount ?? item.retweets);

  // Twitter engagement: (likes + retweets) / follower_count
  let twEngagement: number | null = null;
  if (twFollowers && twFollowers > 0 && (favoriteCount !== null || retweetCount !== null)) {
    const totalEngagement = (favoriteCount ?? 0) + (retweetCount ?? 0);
    twEngagement = totalEngagement / twFollowers;
  }

  const isBlueVerified = author?.isBlueVerified as boolean | undefined;
  const verifiedType = (author?.verifiedType ?? null) as string | null;
  const externalUrl = (author?.website ?? item.website ?? null) as string | null;
  const replyCount = toNumber(item.replyCount ?? item.replies);

  // Twitter author extended fields
  const listedCount = toNumber(author?.listedCount ?? author?.listed_count);
  const mediaCount = toNumber(author?.mediaCount ?? author?.media_count);
  const professionalCategory = (author?.professionalCategory ?? null) as string | null;
  const isProtected = author?.protected === true ? true : null;

  // Tweet type flags
  const isRetweet = item.isRetweet === true ? true : null;
  const isReply = item.isReply === true || (item.inReplyToStatusId != null) ? true : null;

  // Content source (the tweet itself)
  const tweetUrl = (item.url ?? item.twitterUrl ?? null) as string | null;
  const fullText = (item.fullText ?? item.text ?? null) as string | null;
  const tweetMedia = Array.isArray(item.media) ? item.media as string[] : null;
  const tweetCreatedAt = (item.createdAt ?? null) as string | null;
  const tweetLang = (item.lang ?? null) as string | null;
  const entitiesObj = item.entities as Record<string, unknown> | undefined;
  const rawHashtags = entitiesObj?.hashtags;
  const hashtags = Array.isArray(rawHashtags)
    ? rawHashtags.map((h: Record<string, unknown> | string) => typeof h === "object" ? (h.text as string) : h)
    : null;

  // Mentions from entities
  const rawUserMentions = entitiesObj?.user_mentions ?? entitiesObj?.mentions;
  const mentions = Array.isArray(rawUserMentions)
    ? rawUserMentions.map((m: Record<string, unknown> | string) => typeof m === "object" ? (m.screen_name as string ?? m.username as string ?? "") : m).filter(Boolean)
    : null;

  return {
    platform_id: String(platformId),
    username,
    display_name: (author?.name ?? author?.displayName ?? item.displayName ?? "") as string,
    profile_url: username ? `https://x.com/${username}` : "",
    profile_image_url: (author?.profilePicture ?? author?.profileImageUrl ?? author?.profile_image_url_https ?? item.profileImageUrl ?? "") as string,
    bio,
    follower_count: twFollowers,
    following_count: toNumber(author?.following ?? author?.followingCount ?? item.followingCount),
    post_count: toNumber(author?.statusesCount ?? item.statusesCount),
    engagement_rate: twEngagement,
    email: finalEmail,
    email_source: emailSource,
    country: null,
    language: null,
    is_blue_verified: isBlueVerified ?? null,
    verified_type: verifiedType,
    location: rawLocation,
    external_url: externalUrl,
    category: professionalCategory,
    avg_likes: favoriteCount,
    avg_comments: replyCount,
    avg_shares: retweetCount,
    avg_views: toNumber(item.viewCount ?? item.views),
    // Content source
    source_content_url: tweetUrl,
    source_content_text: fullText,
    source_content_media: tweetMedia as unknown as Json ?? null,
    source_content_created_at: tweetCreatedAt,
    content_language: tweetLang,
    content_hashtags: hashtags as string[] | null,
    // Profile extended
    account_created_at: (author?.createdAt ?? null) as string | null,
    is_private: isProtected,
    cover_image_url: (author?.coverPicture ?? null) as string | null,
    // Twitter-specific
    bookmark_count: toNumber(item.bookmarkCount),
    quote_count: toNumber(item.quoteCount),
    favourites_count: toNumber(author?.favouritesCount),
    video_duration: null,
    video_title: null,
    // Extended fields
    listed_count: listedCount,
    media_count: mediaCount,
    is_retweet: isRetweet,
    is_reply: isReply,
    mentions: mentions,
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
    // Existing DB fields
    is_verified: partial.is_verified ?? null,
    category: partial.category ?? null,
    // Platform-specific fields
    is_blue_verified: partial.is_blue_verified ?? null,
    verified_type: partial.verified_type ?? null,
    location: partial.location ?? null,
    heart_count: partial.heart_count ?? null,
    share_count: partial.share_count ?? null,
    total_views: partial.total_views ?? null,
    channel_joined_date: partial.channel_joined_date ?? null,
    is_monetized: partial.is_monetized ?? null,
    external_url: partial.external_url ?? null,
    avg_likes: partial.avg_likes ?? null,
    avg_comments: partial.avg_comments ?? null,
    avg_views: partial.avg_views ?? null,
    avg_shares: partial.avg_shares ?? null,
    // Content source fields
    source_content_url: partial.source_content_url ?? null,
    source_content_text: partial.source_content_text ?? null,
    source_content_media: partial.source_content_media ?? null,
    source_content_created_at: partial.source_content_created_at ?? null,
    content_language: partial.content_language ?? null,
    content_hashtags: partial.content_hashtags ?? null,
    // Profile extended fields
    account_created_at: partial.account_created_at ?? null,
    is_private: partial.is_private ?? null,
    cover_image_url: partial.cover_image_url ?? null,
    // Additional engagement
    bookmark_count: partial.bookmark_count ?? null,
    quote_count: partial.quote_count ?? null,
    favourites_count: partial.favourites_count ?? null,
    // Content meta
    video_duration: partial.video_duration ?? null,
    video_title: partial.video_title ?? null,
    // Extended actor fields
    listed_count: partial.listed_count ?? null,
    media_count: partial.media_count ?? null,
    is_sponsored: partial.is_sponsored ?? null,
    is_retweet: partial.is_retweet ?? null,
    is_reply: partial.is_reply ?? null,
    mentions: partial.mentions ?? null,
    music_info: partial.music_info ?? null,
    product_type: partial.product_type ?? null,
  };
}
