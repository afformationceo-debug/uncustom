export type Platform = "instagram" | "tiktok" | "youtube" | "twitter" | "threads";

export const PLATFORMS: { value: Platform; label: string; color: string }[] = [
  { value: "instagram", label: "Instagram", color: "#E4405F" },
  { value: "tiktok", label: "TikTok", color: "#000000" },
  { value: "youtube", label: "YouTube", color: "#FF0000" },
  { value: "twitter", label: "X (Twitter)", color: "#1DA1F2" },
  { value: "threads", label: "Threads", color: "#000000" },
];

export type CampaignInfluencerStatus =
  | "extracted"
  | "contacted"
  | "replied"
  | "confirmed"
  | "visited"
  | "uploaded"
  | "completed";

export const CAMPAIGN_INFLUENCER_STATUSES: {
  value: CampaignInfluencerStatus;
  label: string;
  color: string;
}[] = [
  { value: "extracted", label: "추출됨", color: "#6B7280" },
  { value: "contacted", label: "연락함", color: "#3B82F6" },
  { value: "replied", label: "회신함", color: "#8B5CF6" },
  { value: "confirmed", label: "확정됨", color: "#10B981" },
  { value: "visited", label: "방문함", color: "#F59E0B" },
  { value: "uploaded", label: "업로드됨", color: "#EF4444" },
  { value: "completed", label: "완료", color: "#059669" },
];

// === Funnel Status (15-step) ===
export type FunnelStatus =
  | "extracted"
  | "contacted"
  | "interested"
  | "client_approved"
  | "confirmed"
  | "guideline_sent"
  | "crm_registered"
  | "visit_scheduled"
  | "visited"
  | "upload_pending"
  | "uploaded"
  | "completed"
  | "settled"
  | "declined"
  | "dropped";

export type FunnelStatusGroup = "outreach" | "confirmation" | "execution" | "settlement" | "terminal";

export const FUNNEL_STATUSES: {
  value: FunnelStatus;
  label: string;
  color: string;
  group: FunnelStatusGroup;
}[] = [
  { value: "extracted", label: "추출", color: "#6B7280", group: "outreach" },
  { value: "contacted", label: "연락함", color: "#3B82F6", group: "outreach" },
  { value: "interested", label: "희망회신", color: "#8B5CF6", group: "outreach" },
  { value: "client_approved", label: "거래처컨펌", color: "#06B6D4", group: "confirmation" },
  { value: "confirmed", label: "최종확정", color: "#10B981", group: "confirmation" },
  { value: "guideline_sent", label: "가이드전달", color: "#14B8A6", group: "execution" },
  { value: "crm_registered", label: "CRM등록", color: "#0EA5E9", group: "execution" },
  { value: "visit_scheduled", label: "방문예정", color: "#F59E0B", group: "execution" },
  { value: "visited", label: "방문완료", color: "#EAB308", group: "execution" },
  { value: "upload_pending", label: "업로드대기", color: "#F97316", group: "execution" },
  { value: "uploaded", label: "업로드완료", color: "#EF4444", group: "execution" },
  { value: "completed", label: "완료", color: "#059669", group: "settlement" },
  { value: "settled", label: "정산완료", color: "#047857", group: "settlement" },
  { value: "declined", label: "거절", color: "#9CA3AF", group: "terminal" },
  { value: "dropped", label: "드롭", color: "#D1D5DB", group: "terminal" },
];

export const FUNNEL_STATUS_GROUPS: { value: FunnelStatusGroup; label: string }[] = [
  { value: "outreach", label: "아웃리치" },
  { value: "confirmation", label: "컨펌" },
  { value: "execution", label: "실행" },
  { value: "settlement", label: "정산" },
  { value: "terminal", label: "종료" },
];

// Map new funnel_status → legacy status for backward compat
export const FUNNEL_TO_LEGACY_STATUS: Record<FunnelStatus, CampaignInfluencerStatus> = {
  extracted: "extracted",
  contacted: "contacted",
  interested: "replied",
  client_approved: "replied",
  confirmed: "confirmed",
  guideline_sent: "confirmed",
  crm_registered: "confirmed",
  visit_scheduled: "confirmed",
  visited: "visited",
  upload_pending: "visited",
  uploaded: "uploaded",
  completed: "completed",
  settled: "completed",
  declined: "extracted",
  dropped: "extracted",
};

export type InfluencerPaymentStatus = "unpaid" | "pending" | "paid";
export type ClientPaymentStatus = "uninvoiced" | "invoiced" | "paid";
export type ReplyChannel = "email" | "dm_instagram" | "dm_tiktok" | "phone" | "other";

export const INFLUENCER_PAYMENT_STATUSES: { value: InfluencerPaymentStatus; label: string; color: string }[] = [
  { value: "unpaid", label: "미지급", color: "#EF4444" },
  { value: "pending", label: "진행중", color: "#F59E0B" },
  { value: "paid", label: "지급완료", color: "#10B981" },
];

export const CLIENT_PAYMENT_STATUSES: { value: ClientPaymentStatus; label: string; color: string }[] = [
  { value: "uninvoiced", label: "미청구", color: "#6B7280" },
  { value: "invoiced", label: "청구완료", color: "#F59E0B" },
  { value: "paid", label: "수금완료", color: "#10B981" },
];

export const REPLY_CHANNELS: { value: ReplyChannel; label: string }[] = [
  { value: "email", label: "이메일" },
  { value: "dm_instagram", label: "인스타 DM" },
  { value: "dm_tiktok", label: "틱톡 DM" },
  { value: "phone", label: "전화" },
  { value: "other", label: "기타" },
];

export type EmailStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "failed";

export type CampaignStatus = "active" | "paused" | "completed";

export type ExtractionJobStatus = "pending" | "running" | "completed" | "failed";

export type UploadStatus = "pending" | "uploading" | "published" | "failed";
