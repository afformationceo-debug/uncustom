export type CsvColumnDef = {
  dbColumn: string;
  koreanLabel: string;
  type: "string" | "number" | "boolean" | "date";
  required?: boolean;
};

const COMMON_COLUMNS: CsvColumnDef[] = [
  { dbColumn: "platform", koreanLabel: "플랫폼 (Platform)", type: "string", required: true },
  { dbColumn: "platform_id", koreanLabel: "플랫폼 ID (Platform ID)", type: "string" },
  { dbColumn: "username", koreanLabel: "유저네임 (Username)", type: "string", required: true },
  { dbColumn: "display_name", koreanLabel: "표시명 (Display Name)", type: "string" },
  { dbColumn: "profile_url", koreanLabel: "프로필 URL (Profile URL)", type: "string" },
  { dbColumn: "email", koreanLabel: "이메일 (Email)", type: "string" },
  { dbColumn: "email_source", koreanLabel: "이메일 출처 (Email Source)", type: "string" },
  { dbColumn: "bio", koreanLabel: "바이오 (Bio)", type: "string" },
  { dbColumn: "follower_count", koreanLabel: "팔로워 수 (Followers)", type: "number" },
  { dbColumn: "following_count", koreanLabel: "팔로잉 수 (Following)", type: "number" },
  { dbColumn: "post_count", koreanLabel: "게시물 수 (Posts)", type: "number" },
  { dbColumn: "engagement_rate", koreanLabel: "참여율 (Engagement Rate)", type: "number" },
  { dbColumn: "country", koreanLabel: "국가 (Country)", type: "string" },
  { dbColumn: "language", koreanLabel: "언어 (Language)", type: "string" },
  { dbColumn: "is_verified", koreanLabel: "인증 여부 (Verified)", type: "boolean" },
  { dbColumn: "external_url", koreanLabel: "외부 URL (External URL)", type: "string" },
  // Content source (공통)
  { dbColumn: "source_content_url", koreanLabel: "콘텐츠 URL (Content URL)", type: "string" },
  { dbColumn: "source_content_text", koreanLabel: "콘텐츠 텍스트 (Content Text)", type: "string" },
  { dbColumn: "source_content_created_at", koreanLabel: "콘텐츠 날짜 (Content Date)", type: "string" },
  { dbColumn: "content_language", koreanLabel: "콘텐츠 언어 (Content Language)", type: "string" },
  // Profile extended (공통)
  { dbColumn: "account_created_at", koreanLabel: "계정 생성일 (Account Created)", type: "string" },
  { dbColumn: "is_private", koreanLabel: "비공개 계정 (Private)", type: "boolean" },
];

export const PLATFORM_CSV_SCHEMAS: Record<string, CsvColumnDef[]> = {
  instagram: [
    ...COMMON_COLUMNS,
    { dbColumn: "is_business", koreanLabel: "비즈니스 계정 (Business)", type: "boolean" },
    { dbColumn: "category", koreanLabel: "카테고리 (Category)", type: "string" },
    { dbColumn: "location", koreanLabel: "위치 (Location)", type: "string" },
    { dbColumn: "avg_likes", koreanLabel: "평균 좋아요 (Avg Likes)", type: "number" },
    { dbColumn: "avg_comments", koreanLabel: "평균 댓글 (Avg Comments)", type: "number" },
    { dbColumn: "avg_views", koreanLabel: "평균 조회 (Avg Views)", type: "number" },
    { dbColumn: "video_duration", koreanLabel: "영상 길이 초 (Video Duration)", type: "number" },
    { dbColumn: "is_sponsored", koreanLabel: "광고 (Sponsored)", type: "boolean" },
    { dbColumn: "mentions", koreanLabel: "멘션 (Mentions)", type: "string" },
    { dbColumn: "product_type", koreanLabel: "유형 (Product Type)", type: "string" },
  ],
  tiktok: [
    ...COMMON_COLUMNS,
    { dbColumn: "location", koreanLabel: "위치 (Location)", type: "string" },
    { dbColumn: "heart_count", koreanLabel: "총 좋아요 (Total Hearts)", type: "number" },
    { dbColumn: "share_count", koreanLabel: "공유 수 (Shares)", type: "number" },
    { dbColumn: "avg_likes", koreanLabel: "평균 좋아요 (Avg Likes)", type: "number" },
    { dbColumn: "avg_comments", koreanLabel: "평균 댓글 (Avg Comments)", type: "number" },
    { dbColumn: "avg_shares", koreanLabel: "평균 공유 (Avg Shares)", type: "number" },
    { dbColumn: "avg_views", koreanLabel: "평균 조회 (Avg Views)", type: "number" },
    { dbColumn: "bookmark_count", koreanLabel: "저장 수 (Bookmarks)", type: "number" },
    { dbColumn: "quote_count", koreanLabel: "리포스트 (Reposts)", type: "number" },
    { dbColumn: "favourites_count", koreanLabel: "좋아요한 수 (Favourites Given)", type: "number" },
    { dbColumn: "video_duration", koreanLabel: "영상 길이 초 (Video Duration)", type: "number" },
    { dbColumn: "is_sponsored", koreanLabel: "광고 (Sponsored)", type: "boolean" },
    { dbColumn: "mentions", koreanLabel: "멘션 (Mentions)", type: "string" },
    { dbColumn: "product_type", koreanLabel: "유형 (Product Type)", type: "string" },
  ],
  youtube: [
    ...COMMON_COLUMNS,
    { dbColumn: "total_views", koreanLabel: "총 조회수 (Total Views)", type: "number" },
    { dbColumn: "channel_joined_date", koreanLabel: "채널 생성일 (Channel Joined)", type: "date" },
    { dbColumn: "is_monetized", koreanLabel: "수익화 (Monetized)", type: "boolean" },
    { dbColumn: "location", koreanLabel: "위치 (Location)", type: "string" },
    { dbColumn: "avg_likes", koreanLabel: "평균 좋아요 (Avg Likes)", type: "number" },
    { dbColumn: "avg_comments", koreanLabel: "평균 댓글 (Avg Comments)", type: "number" },
    { dbColumn: "avg_views", koreanLabel: "평균 조회 (Avg Views)", type: "number" },
    { dbColumn: "video_title", koreanLabel: "영상 제목 (Video Title)", type: "string" },
    { dbColumn: "video_duration", koreanLabel: "영상 길이 초 (Video Duration)", type: "number" },
    { dbColumn: "product_type", koreanLabel: "유형 (Product Type)", type: "string" },
  ],
  twitter: [
    ...COMMON_COLUMNS,
    { dbColumn: "is_blue_verified", koreanLabel: "Twitter Blue (Blue Verified)", type: "boolean" },
    { dbColumn: "verified_type", koreanLabel: "인증 유형 (Verified Type)", type: "string" },
    { dbColumn: "location", koreanLabel: "위치 (Location)", type: "string" },
    { dbColumn: "category", koreanLabel: "카테고리 (Category)", type: "string" },
    { dbColumn: "cover_image_url", koreanLabel: "커버 이미지 (Cover Image)", type: "string" },
    { dbColumn: "avg_likes", koreanLabel: "평균 좋아요 (Avg Likes)", type: "number" },
    { dbColumn: "avg_comments", koreanLabel: "평균 답글 (Avg Replies)", type: "number" },
    { dbColumn: "avg_shares", koreanLabel: "평균 리트윗 (Avg Retweets)", type: "number" },
    { dbColumn: "avg_views", koreanLabel: "평균 조회 (Avg Views)", type: "number" },
    { dbColumn: "bookmark_count", koreanLabel: "북마크 수 (Bookmarks)", type: "number" },
    { dbColumn: "quote_count", koreanLabel: "인용 트윗 (Quote Tweets)", type: "number" },
    { dbColumn: "favourites_count", koreanLabel: "좋아요한 수 (Favourites Given)", type: "number" },
    { dbColumn: "listed_count", koreanLabel: "리스트 수 (Listed)", type: "number" },
    { dbColumn: "media_count", koreanLabel: "미디어 수 (Media)", type: "number" },
    { dbColumn: "is_retweet", koreanLabel: "RT 여부 (Is Retweet)", type: "boolean" },
    { dbColumn: "is_reply", koreanLabel: "답글 여부 (Is Reply)", type: "boolean" },
    { dbColumn: "mentions", koreanLabel: "멘션 (Mentions)", type: "string" },
  ],
};

export function getSchemaForPlatform(platform: string): CsvColumnDef[] {
  return PLATFORM_CSV_SCHEMAS[platform] ?? COMMON_COLUMNS;
}
