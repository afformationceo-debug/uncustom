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
