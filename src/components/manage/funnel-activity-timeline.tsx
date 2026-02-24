"use client";

import { useEffect, useState } from "react";
import { FUNNEL_STATUSES } from "@/types/platform";
import { Clock, ArrowRight, Edit2, MessageSquare } from "lucide-react";

interface ActivityLog {
  id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_at: string;
}

interface FunnelActivityTimelineProps {
  campaignInfluencerId: string;
}

const FIELD_LABELS: Record<string, string> = {
  funnel_status: "퍼널 상태",
  status: "레거시 상태",
  outreach_round: "발송 N차",
  reply_channel: "회신 채널",
  reply_date: "회신일",
  reply_summary: "회신 요약",
  interest_confirmed: "희망회신",
  client_approved: "거래처 컨펌",
  client_note: "거래처 메모",
  final_confirmed: "최종 확정",
  payment_amount: "지급 원고료",
  invoice_amount: "청구 원고료",
  guideline_url: "가이드라인 URL",
  guideline_sent: "가이드 전달",
  crm_registered: "CRM 등록",
  visit_scheduled_date: "방문 예정일",
  visit_completed: "방문 완료",
  upload_url: "업로드 URL",
  upload_deadline: "업로드 마감",
  influencer_payment_status: "인플 정산",
  client_payment_status: "거래처 정산",
  notes: "메모",
};

function getStatusLabel(value: string | null) {
  if (!value) return "-";
  return FUNNEL_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function FunnelActivityTimeline({ campaignInfluencerId }: FunnelActivityTimelineProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch(`/api/manage/activity?campaign_influencer_id=${campaignInfluencerId}`);
        if (res.ok) {
          const json = await res.json();
          setLogs(json.data ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    fetch_();
  }, [campaignInfluencerId]);

  if (loading) return <div className="text-sm text-muted-foreground py-4 text-center">로딩 중...</div>;
  if (logs.length === 0) return <div className="text-sm text-muted-foreground py-4 text-center">활동 기록이 없습니다.</div>;

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        const fieldLabel = log.field_name ? FIELD_LABELS[log.field_name] ?? log.field_name : "";
        const isStatusChange = log.action === "status_change";
        const Icon = isStatusChange ? ArrowRight : log.action === "note_added" ? MessageSquare : Edit2;

        return (
          <div key={log.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="w-px flex-1 bg-border" />
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <div className="text-sm">
                <span className="font-medium">{fieldLabel}</span>
                {isStatusChange ? (
                  <span className="text-muted-foreground">
                    {" "}{getStatusLabel(log.old_value)} → {getStatusLabel(log.new_value)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {log.old_value ? ` ${log.old_value} →` : ""} {log.new_value ?? "삭제됨"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Clock className="w-3 h-3" />
                {new Date(log.performed_at).toLocaleString("ko-KR")}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
