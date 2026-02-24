"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Mail, Users } from "lucide-react";
import { FUNNEL_STATUSES, PLATFORMS, INFLUENCER_PAYMENT_STATUSES, CLIENT_PAYMENT_STATUSES, REPLY_CHANNELS } from "@/types/platform";
import { FunnelActivityTimeline } from "./funnel-activity-timeline";
import type { Tables, Json } from "@/types/database";

type CampaignInfluencer = Tables<"campaign_influencers"> & {
  influencer?: Tables<"influencers">;
  campaign?: { id: string; name: string };
};

interface FunnelDetailPanelProps {
  item: CampaignInfluencer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("ko-KR");
}

function formatMoney(n: number | null, currency: string) {
  if (n == null) return "-";
  return `${n.toLocaleString()} ${currency}`;
}

function boolBadge(v: boolean, yLabel = "Y", nLabel = "N") {
  return v
    ? <Badge variant="default" className="text-[10px]">{yLabel}</Badge>
    : <Badge variant="secondary" className="text-[10px]">{nLabel}</Badge>;
}

export function FunnelDetailPanel({ item, open, onOpenChange }: FunnelDetailPanelProps) {
  if (!item) return null;

  const inf = item.influencer as unknown as Tables<"influencers"> | undefined;
  const funnelInfo = FUNNEL_STATUSES.find((s) => s.value === item.funnel_status);
  const platformInfo = PLATFORMS.find((p) => p.value === inf?.platform);
  const settlement = item.settlement_info as { paypal_email?: string; bank_name?: string; account_number?: string; account_holder?: string } | null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[460px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {inf?.profile_image_url ? (
              <img src={inf.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <div className="text-base">{inf?.display_name ?? inf?.username ?? "-"}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {inf?.username && `@${inf.username}`}
                {platformInfo && <Badge variant="outline" className="text-[10px]">{platformInfo.label}</Badge>}
                {inf?.follower_count != null && (
                  <span>{inf.follower_count >= 1000 ? `${(inf.follower_count / 1000).toFixed(1)}K` : inf.follower_count}</span>
                )}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Campaign & Status */}
          <Section title="상태">
            {item.campaign && (
              <Row label="캠페인"><span className="text-xs font-medium">{(item.campaign as { name: string }).name}</span></Row>
            )}
            <Row label="퍼널 상태">
              <Badge style={{ backgroundColor: funnelInfo?.color, color: "#fff" }} className="text-xs">
                {funnelInfo?.label ?? item.funnel_status}
              </Badge>
            </Row>
            <Row label="이메일">{inf?.email ? <a href={`mailto:${inf.email}`} className="text-primary text-xs">{inf.email}</a> : "-"}</Row>
            {inf?.profile_url && (
              <Row label="프로필">
                <a href={inf.profile_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1">
                  프로필 열기 <ExternalLink className="w-3 h-3" />
                </a>
              </Row>
            )}
          </Section>

          {/* Outreach */}
          <Section title="아웃리치">
            <Row label="발송 N차">{item.outreach_round}차</Row>
            <Row label="마지막 발송">{formatDate(item.last_outreach_at)}</Row>
            <Row label="회신 채널">{REPLY_CHANNELS.find((c) => c.value === item.reply_channel)?.label ?? item.reply_channel ?? "-"}</Row>
            <Row label="회신일">{formatDate(item.reply_date)}</Row>
            <Row label="회신 요약">{item.reply_summary ?? "-"}</Row>
          </Section>

          {/* Confirmation */}
          <Section title="컨펌">
            <Row label="희망회신">{boolBadge(item.interest_confirmed)}</Row>
            <Row label="거래처 컨펌">{boolBadge(item.client_approved)}</Row>
            <Row label="거래처 메모">{item.client_note ?? "-"}</Row>
            <Row label="최종 확정">{boolBadge(item.final_confirmed)}</Row>
          </Section>

          {/* Payment */}
          <Section title="금액">
            <Row label="지급 원고료">{formatMoney(item.payment_amount, item.payment_currency)}</Row>
            <Row label="청구 원고료">{formatMoney(item.invoice_amount, item.invoice_currency)}</Row>
          </Section>

          {/* Execution */}
          <Section title="실행">
            <Row label="가이드라인">{item.guideline_url ? <a href={item.guideline_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1">링크 <ExternalLink className="w-3 h-3" /></a> : "-"}</Row>
            <Row label="가이드 전달">{boolBadge(item.guideline_sent)}</Row>
            <Row label="CRM 등록">{boolBadge(item.crm_registered)}</Row>
            <Row label="CRM 메모">{item.crm_note ?? "-"}</Row>
            <Row label="방문 예정일">{item.visit_scheduled_date ?? "-"}</Row>
            <Row label="방문 완료">{boolBadge(item.visit_completed)}</Row>
          </Section>

          {/* Upload */}
          <Section title="콘텐츠">
            <Row label="업로드 마감">{item.upload_deadline ?? "-"}</Row>
            <Row label="실제 업로드">{item.actual_upload_date ?? "-"}</Row>
            <Row label="업로드 URL">{item.upload_url ? <a href={item.upload_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1">링크 <ExternalLink className="w-3 h-3" /></a> : "-"}</Row>
          </Section>

          {/* Settlement */}
          <Section title="정산">
            <Row label="인플 정산">{INFLUENCER_PAYMENT_STATUSES.find((s) => s.value === item.influencer_payment_status)?.label ?? item.influencer_payment_status}</Row>
            <Row label="인플 지급액">{formatMoney(item.influencer_paid_amount, item.payment_currency)}</Row>
            <Row label="거래처 정산">{CLIENT_PAYMENT_STATUSES.find((s) => s.value === item.client_payment_status)?.label ?? item.client_payment_status}</Row>
            <Row label="거래처 수금액">{formatMoney(item.client_paid_amount, item.invoice_currency)}</Row>
            {settlement && (
              <>
                {settlement.paypal_email && <Row label="PayPal">{settlement.paypal_email}</Row>}
                {settlement.bank_name && <Row label="은행">{settlement.bank_name} {settlement.account_number} ({settlement.account_holder})</Row>}
              </>
            )}
          </Section>

          {/* Notes */}
          {item.notes && (
            <Section title="메모">
              <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
            </Section>
          )}

          {/* Activity Timeline */}
          <Section title="활동 기록">
            <FunnelActivityTimeline campaignInfluencerId={item.id} />
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-right">{children}</span>
    </div>
  );
}
