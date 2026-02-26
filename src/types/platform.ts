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

// === Next Action per Funnel Status ===
// Each funnel status has a recommended "next action" to guide operators
export interface FunnelNextAction {
  label: string;         // 간결한 액션명
  description: string;   // 상세 설명
  icon: string;          // lucide icon name hint
  color: string;         // accent color
  autoAction?: string;   // 자동 처리 가능 여부 ("email_send" | "manual" 등)
}

export const FUNNEL_NEXT_ACTIONS: Record<FunnelStatus, FunnelNextAction> = {
  extracted: {
    label: "발송 필요",
    description: "이메일/DM을 발송하여 제안서를 전달하세요",
    icon: "Send",
    color: "#3B82F6",
    autoAction: "email_send",
  },
  contacted: {
    label: "회신 대기",
    description: "회신이 없으면 재연락하세요 (2~3일 후)",
    icon: "Clock",
    color: "#F59E0B",
    autoAction: "follow_up",
  },
  interested: {
    label: "거래처 컨펌",
    description: "인플루언서가 관심을 표현함 → 거래처에 컨펌 요청하세요",
    icon: "CheckCircle",
    color: "#06B6D4",
  },
  client_approved: {
    label: "최종 확정",
    description: "거래처 승인 완료 → 인플루언서에게 최종 확정 통보하세요",
    icon: "ThumbsUp",
    color: "#10B981",
  },
  confirmed: {
    label: "가이드 전달",
    description: "확정된 인플루언서에게 캠페인 가이드라인을 전달하세요",
    icon: "FileText",
    color: "#14B8A6",
  },
  guideline_sent: {
    label: "CRM 등록",
    description: "가이드 전달 완료 → CRM에 등록하세요",
    icon: "Database",
    color: "#0EA5E9",
  },
  crm_registered: {
    label: "방문/배송 예약",
    description: "CRM 등록 완료 → 방문일 또는 배송일을 예약하세요",
    icon: "Calendar",
    color: "#F59E0B",
  },
  visit_scheduled: {
    label: "방문/수령 확인",
    description: "예약 확인 → 방문 완료 또는 수령 완료를 체크하세요",
    icon: "MapPin",
    color: "#EAB308",
  },
  visited: {
    label: "업로드 요청",
    description: "방문/수령 완료 → 콘텐츠 업로드 기한을 설정하세요",
    icon: "Upload",
    color: "#F97316",
  },
  upload_pending: {
    label: "업로드 독촉",
    description: "업로드 기한 확인 → 기한 내 업로드되도록 리마인드하세요",
    icon: "AlertCircle",
    color: "#EF4444",
  },
  uploaded: {
    label: "검수 완료",
    description: "콘텐츠 업로드됨 → 검수 후 완료 처리하세요",
    icon: "CheckSquare",
    color: "#059669",
  },
  completed: {
    label: "정산 처리",
    description: "캠페인 완료 → 인플루언서 정산 및 거래처 청구 처리하세요",
    icon: "DollarSign",
    color: "#047857",
  },
  settled: {
    label: "완료",
    description: "정산까지 모두 완료된 상태입니다",
    icon: "CheckCircle2",
    color: "#059669",
  },
  declined: {
    label: "거절됨",
    description: "인플루언서가 거절했습니다",
    icon: "XCircle",
    color: "#9CA3AF",
  },
  dropped: {
    label: "드롭됨",
    description: "진행 중 드롭되었습니다",
    icon: "XCircle",
    color: "#D1D5DB",
  },
};

// Get shipping-aware next action label
export function getFunnelNextAction(status: FunnelStatus, campaignType?: string): FunnelNextAction {
  const action = FUNNEL_NEXT_ACTIONS[status];
  if (!action) return { label: "-", description: "", icon: "Circle", color: "#6B7280" };

  // Shipping campaigns: adjust visit-related actions
  if (campaignType === "shipping") {
    if (status === "crm_registered") {
      return { ...action, label: "배송 예약", description: "CRM 등록 완료 → 배송일을 예약하세요" };
    }
    if (status === "visit_scheduled") {
      return { ...action, label: "수령 확인", description: "배송 완료 → 수령 확인을 체크하세요" };
    }
    if (status === "visited") {
      return { ...action, label: "업로드 요청", description: "수령 완료 → 콘텐츠 업로드 기한을 설정하세요" };
    }
  }
  return action;
}

export type InfluencerPaymentStatus = "unpaid" | "pending" | "paid";
export type ClientPaymentStatus = "uninvoiced" | "invoiced" | "paid";
export type ReplyChannel = "email" | "dm_instagram" | "dm_tiktok" | "dm_twitter" | "line" | "whatsapp" | "phone" | "other";

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

export type CampaignType = "visit" | "shipping";

export const CAMPAIGN_TYPES: { value: CampaignType; label: string }[] = [
  { value: "visit", label: "방문형" },
  { value: "shipping", label: "배송형" },
];

export type OutreachType = "email" | "dm";

export const OUTREACH_TYPES: { value: OutreachType; label: string }[] = [
  { value: "email", label: "이메일" },
  { value: "dm", label: "DM" },
];

// Context-aware funnel status label (shipping campaigns use different labels)
export function getFunnelStatusLabel(status: string, campaignType?: string): string {
  if (campaignType === "shipping") {
    if (status === "visit_scheduled") return "배송완료";
    if (status === "visited") return "수령완료";
  }
  return FUNNEL_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export type ShippingCarrier = "cj" | "logen" | "hanjin" | "post" | "lotte" | "fedex" | "ups" | "dhl" | "ems" | "sf" | "yamato" | "other";

export const SHIPPING_CARRIERS: { value: ShippingCarrier; label: string }[] = [
  { value: "cj", label: "CJ대한통운" },
  { value: "logen", label: "로젠택배" },
  { value: "hanjin", label: "한진택배" },
  { value: "post", label: "우체국" },
  { value: "lotte", label: "롯데택배" },
  { value: "fedex", label: "FedEx" },
  { value: "ups", label: "UPS" },
  { value: "dhl", label: "DHL" },
  { value: "ems", label: "EMS" },
  { value: "sf", label: "SF Express" },
  { value: "yamato", label: "야마토" },
  { value: "other", label: "기타" },
];

export const REPLY_CHANNELS: { value: ReplyChannel; label: string }[] = [
  { value: "email", label: "이메일" },
  { value: "dm_instagram", label: "인스타그램 DM" },
  { value: "dm_tiktok", label: "틱톡 DM" },
  { value: "dm_twitter", label: "트위터 DM" },
  { value: "line", label: "라인" },
  { value: "whatsapp", label: "왓츠앱" },
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
