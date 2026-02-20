// Instagram Hashtag Scraper output
export interface InstagramHashtagResult {
  id: string;
  type: string;
  shortCode: string;
  caption: string;
  commentsCount: number;
  dimensionsHeight: number;
  dimensionsWidth: number;
  displayUrl: string;
  likesCount: number;
  timestamp: string;
  locationName?: string;
  ownerFullName: string;
  ownerUsername: string;
  ownerId: string;
  productType: string;
  videoDuration?: number;
  videoViewCount?: number;
  url: string;
  hashtags: string[];
  mentions: string[];
}

// Instagram Profile Scraper output
export interface InstagramProfileResult {
  id: string;
  username: string;
  fullName: string;
  biography: string;
  externalUrl: string;
  externalUrlShimmed: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  profilePicUrl: string;
  profilePicUrlHD: string;
  isBusinessAccount: boolean;
  businessCategoryName?: string;
  businessEmail?: string;
  businessPhoneNumber?: string;
  isVerified: boolean;
  isPrivate: boolean;
}

// TikTok Scraper output
export interface TikTokResult {
  id: string;
  text: string;
  createTime: number;
  authorMeta: {
    id: string;
    name: string;
    nickName: string;
    verified: boolean;
    signature: string;
    avatar: string;
    fans: number;
    following: number;
    heart: number;
    video: number;
  };
  musicMeta: {
    musicName: string;
    musicAuthor: string;
  };
  covers: {
    default: string;
    origin: string;
  };
  webVideoUrl: string;
  videoUrl: string;
  diggCount: number;
  shareCount: number;
  playCount: number;
  commentCount: number;
  hashtags: { id: string; name: string }[];
}

// YouTube Scraper output
export interface YouTubeResult {
  id: string;
  title: string;
  description: string;
  viewCount: number;
  date: string;
  likes: number;
  channelName: string;
  channelUrl: string;
  channelId: string;
  subscriberCount?: number;
  thumbnailUrl: string;
  url: string;
  duration: string;
}

// Twitter/X Scraper output
export interface TwitterResult {
  id: string;
  url: string;
  text: string;
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  quoteCount: number;
  createdAt: string;
  author: {
    id: string;
    userName: string;
    name: string;
    profileImageUrl: string;
    followersCount: number;
    followingCount: number;
    isVerified: boolean;
    description: string;
    url?: string;
  };
  media?: {
    type: string;
    url: string;
  }[];
}

// Linktree Email Extractor output
export interface LinktreeEmailResult {
  url: string;
  emails: string[];
  socialLinks: Record<string, string>;
}
