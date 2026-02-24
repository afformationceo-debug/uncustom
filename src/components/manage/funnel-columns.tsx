"use client";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  FUNNEL_STATUSES, PLATFORMS, REPLY_CHANNELS, OUTREACH_TYPES,
  INFLUENCER_PAYMENT_STATUSES, CLIENT_PAYMENT_STATUSES,
} from "@/types/platform";
import { InlineCurrencyInput } from "./inline-currency-input";
import { InlineSettlementEditor } from "./inline-settlement-editor";
import { Mail, Users, ExternalLink, StickyNote, BarChart3 } from "lucide-react";
import type { Tables, Json } from "@/types/database";

type CampaignInfluencer = Tables<"campaign_influencers"> & {
  influencer?: Tables<"influencers">;
  campaign?: { id: string; name: string };
};

export type ColumnGroup = "basic" | "outreach" | "confirm" | "execution" | "content" | "settlement";

export const COLUMN_GROUPS: { value: ColumnGroup; label: string }[] = [
  { value: "basic", label: "기본" },
  { value: "outreach", label: "아웃리치" },
  { value: "confirm", label: "컨펌" },
  { value: "execution", label: "실행" },
  { value: "content", label: "콘텐츠" },
  { value: "settlement", label: "정산" },
];

export interface ColumnDef {
  key: string;
  label: string;
  group: ColumnGroup;
  width?: string;
  sticky?: boolean;
  render: (
    item: CampaignInfluencer,
    onUpdate: (id: string, field: string, value: unknown) => void,
    onNoteEdit: (item: CampaignInfluencer, field: string, value: string) => void,
  ) => React.ReactNode;
}

function formatCount(n: number | null) {
  if (n == null) return "-";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

/** Inline text input that saves on blur/Enter */
function InlineText({
  value,
  placeholder,
  onSave,
  className = "",
}: {
  value: string | null;
  placeholder?: string;
  onSave: (v: string | null) => void;
  className?: string;
}) {
  return (
    <Input
      defaultValue={value ?? ""}
      placeholder={placeholder ?? "-"}
      onBlur={(e) => {
        const v = e.target.value.trim();
        onSave(v || null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className={`h-6 text-[11px] px-1.5 ${className}`}
    />
  );
}

/** Content metrics popover */
function MetricsPopover({ metrics, uploadUrl }: { metrics: Json | null; uploadUrl: string | null }) {
  const m = metrics as { views?: number; likes?: number; comments?: number; shares?: number } | null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
          <BarChart3 className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <h4 className="text-xs font-semibold mb-2">콘텐츠 성과</h4>
        {m ? (
          <div className="space-y-1.5 text-xs">
            {m.views != null && <div className="flex justify-between"><span className="text-muted-foreground">조회수</span><span className="font-medium">{m.views.toLocaleString()}</span></div>}
            {m.likes != null && <div className="flex justify-between"><span className="text-muted-foreground">좋아요</span><span className="font-medium">{m.likes.toLocaleString()}</span></div>}
            {m.comments != null && <div className="flex justify-between"><span className="text-muted-foreground">댓글</span><span className="font-medium">{m.comments.toLocaleString()}</span></div>}
            {m.shares != null && <div className="flex justify-between"><span className="text-muted-foreground">공유</span><span className="font-medium">{m.shares.toLocaleString()}</span></div>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">아직 수집된 성과 데이터가 없습니다.</p>
        )}
        {uploadUrl && (
          <a
            href={uploadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-xs text-primary flex items-center gap-1 hover:underline"
          >
            콘텐츠 보기 <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
}

export const ALL_COLUMNS: ColumnDef[] = [
  // === BASIC (always shown) ===
  {
    key: "campaign_name",
    label: "캠페인",
    group: "basic",
    width: "min-w-[100px] max-w-[140px]",
    render: (item) => {
      const c = item.campaign as { name: string } | undefined;
      return <span className="text-[11px] truncate block" title={c?.name}>{c?.name ?? "-"}</span>;
    },
  },
  {
    key: "influencer",
    label: "인플루언서",
    group: "basic",
    width: "min-w-[160px]",
    sticky: true,
    render: (item) => {
      const inf = item.influencer as unknown as Tables<"influencers"> | undefined;
      return (
        <div className="flex items-center gap-1.5">
          {inf?.profile_image_url ? (
            <img src={inf.profile_image_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Users className="w-3 h-3 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium text-[11px] truncate leading-tight">{inf?.display_name ?? inf?.username ?? "-"}</div>
            {inf?.email && (
              <div className="text-[10px] text-muted-foreground truncate leading-tight">{inf.email}</div>
            )}
          </div>
        </div>
      );
    },
  },
  {
    key: "platform",
    label: "플랫폼",
    group: "basic",
    render: (item) => {
      const inf = item.influencer as unknown as Tables<"influencers"> | undefined;
      const p = PLATFORMS.find((pl) => pl.value === inf?.platform);
      return <span className="text-[10px] text-muted-foreground">{p?.label ?? inf?.platform ?? "-"}</span>;
    },
  },
  {
    key: "follower_count",
    label: "팔로워",
    group: "basic",
    render: (item) => {
      const inf = item.influencer as unknown as Tables<"influencers"> | undefined;
      return <span className="text-[11px]">{formatCount(inf?.follower_count ?? null)}</span>;
    },
  },
  {
    key: "funnel_status",
    label: "퍼널상태",
    group: "basic",
    render: (item, onUpdate) => {
      const current = FUNNEL_STATUSES.find((s) => s.value === item.funnel_status);
      return (
        <Select value={item.funnel_status} onValueChange={(v) => onUpdate(item.id, "funnel_status", v)}>
          <SelectTrigger className="w-24 h-6 text-[11px] px-2">
            <SelectValue>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: current?.color }} />
                {current?.label ?? item.funnel_status}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FUNNEL_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
  },
  {
    key: "notes",
    label: "메모",
    group: "basic",
    render: (item, _onUpdate, onNoteEdit) => (
      item.notes ? (
        <button
          onClick={() => onNoteEdit(item, "notes", item.notes ?? "")}
          className="text-[11px] text-muted-foreground truncate max-w-[80px] block hover:text-primary"
          title={item.notes}
        >
          {item.notes.slice(0, 15)}...
        </button>
      ) : (
        <button onClick={() => onNoteEdit(item, "notes", "")} className="text-muted-foreground hover:text-foreground">
          <StickyNote className="w-3 h-3" />
        </button>
      )
    ),
  },
  {
    key: "profile_link",
    label: "",
    group: "basic",
    render: (item) => {
      const inf = item.influencer as unknown as Tables<"influencers"> | undefined;
      if (!inf?.profile_url) return null;
      return (
        <a href={inf.profile_url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
        </a>
      );
    },
  },

  // === OUTREACH ===
  {
    key: "outreach_type",
    label: "발송유형",
    group: "outreach",
    render: (item, onUpdate) => (
      <Select value={item.outreach_type ?? "email"} onValueChange={(v) => onUpdate(item.id, "outreach_type", v)}>
        <SelectTrigger className="w-20 h-6 text-[11px] px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OUTREACH_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
        </SelectContent>
      </Select>
    ),
  },
  {
    key: "outreach_round",
    label: "발송N차",
    group: "outreach",
    render: (item, onUpdate) => (
      <Input
        type="number" min={0}
        value={item.outreach_round}
        onChange={(e) => onUpdate(item.id, "outreach_round", parseInt(e.target.value) || 0)}
        className="h-6 w-12 text-[11px] px-1.5"
      />
    ),
  },
  {
    key: "last_outreach_at",
    label: "마지막발송",
    group: "outreach",
    render: (item) => (
      <span className="text-[11px]">{item.last_outreach_at ? new Date(item.last_outreach_at).toLocaleDateString("ko-KR") : "-"}</span>
    ),
  },
  {
    key: "reply_channel",
    label: "회신채널",
    group: "outreach",
    render: (item, onUpdate) => (
      <Select value={item.reply_channel ?? "__none__"} onValueChange={(v) => onUpdate(item.id, "reply_channel", v === "__none__" ? null : v)}>
        <SelectTrigger className="w-20 h-6 text-[11px] px-2">
          <SelectValue placeholder="-" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">-</SelectItem>
          {REPLY_CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
    ),
  },
  {
    key: "reply_channel_url",
    label: "회신링크",
    group: "outreach",
    render: (item, onUpdate) => (
      <div className="flex items-center gap-0.5">
        <InlineText
          value={item.reply_channel_url}
          placeholder="링크"
          onSave={(v) => onUpdate(item.id, "reply_channel_url", v)}
          className="w-28"
        />
        {item.reply_channel_url && (
          <a href={item.reply_channel_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </a>
        )}
      </div>
    ),
  },
  {
    key: "reply_date",
    label: "회신일",
    group: "outreach",
    render: (item, onUpdate) => (
      <Input
        type="date"
        value={item.reply_date ? item.reply_date.slice(0, 10) : ""}
        onChange={(e) => onUpdate(item.id, "reply_date", e.target.value ? new Date(e.target.value).toISOString() : null)}
        className="w-32 h-6 text-[11px] px-1.5"
      />
    ),
  },
  {
    key: "reply_summary",
    label: "회신요약",
    group: "outreach",
    render: (item, onUpdate) => (
      <InlineText
        value={item.reply_summary}
        placeholder="요약"
        onSave={(v) => onUpdate(item.id, "reply_summary", v)}
        className="w-28"
      />
    ),
  },

  // === CONFIRM ===
  {
    key: "interest_confirmed",
    label: "희망회신",
    group: "confirm",
    render: (item, onUpdate) => (
      <Switch
        checked={item.interest_confirmed}
        onCheckedChange={(v) => onUpdate(item.id, "interest_confirmed", v)}
        className="scale-75"
      />
    ),
  },
  {
    key: "client_approved",
    label: "거래처컨펌",
    group: "confirm",
    render: (item, onUpdate) => (
      <Switch
        checked={item.client_approved}
        onCheckedChange={(v) => onUpdate(item.id, "client_approved", v)}
        className="scale-75"
      />
    ),
  },
  {
    key: "client_note",
    label: "거래처메모",
    group: "confirm",
    render: (item, onUpdate) => (
      <InlineText
        value={item.client_note}
        placeholder="메모 입력"
        onSave={(v) => onUpdate(item.id, "client_note", v)}
        className="w-28"
      />
    ),
  },
  {
    key: "final_confirmed",
    label: "최종확정",
    group: "confirm",
    render: (item, onUpdate) => (
      <Switch
        checked={item.final_confirmed}
        onCheckedChange={(v) => onUpdate(item.id, "final_confirmed", v)}
        className="scale-75"
      />
    ),
  },

  // === EXECUTION ===
  {
    key: "guideline_url",
    label: "가이드URL",
    group: "execution",
    render: (item, onUpdate) => (
      <div className="flex items-center gap-0.5">
        <InlineText
          value={item.guideline_url}
          placeholder="URL"
          onSave={(v) => onUpdate(item.id, "guideline_url", v)}
          className="w-28"
        />
        {item.guideline_url && (
          <a href={item.guideline_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </a>
        )}
      </div>
    ),
  },
  {
    key: "guideline_sent",
    label: "가이드전달",
    group: "execution",
    render: (item, onUpdate) => (
      <Switch
        checked={item.guideline_sent}
        onCheckedChange={(v) => onUpdate(item.id, "guideline_sent", v)}
        className="scale-75"
      />
    ),
  },
  {
    key: "crm_registered",
    label: "CRM등록",
    group: "execution",
    render: (item, onUpdate) => (
      <Switch
        checked={item.crm_registered}
        onCheckedChange={(v) => onUpdate(item.id, "crm_registered", v)}
        className="scale-75"
      />
    ),
  },
  {
    key: "crm_note",
    label: "CRM메모",
    group: "execution",
    render: (item, onUpdate) => (
      <InlineText
        value={item.crm_note}
        placeholder="CRM 메모"
        onSave={(v) => onUpdate(item.id, "crm_note", v)}
        className="w-28"
      />
    ),
  },
  {
    key: "visit_scheduled_date",
    label: "방문예정일",
    group: "execution",
    render: (item, onUpdate) => (
      <Input
        type="date"
        value={item.visit_scheduled_date ?? ""}
        onChange={(e) => onUpdate(item.id, "visit_scheduled_date", e.target.value || null)}
        className="w-32 h-6 text-[11px] px-1.5"
      />
    ),
  },
  {
    key: "visit_completed",
    label: "방문완료",
    group: "execution",
    render: (item, onUpdate) => (
      <Switch
        checked={item.visit_completed}
        onCheckedChange={(v) => onUpdate(item.id, "visit_completed", v)}
        className="scale-75"
      />
    ),
  },

  // === CONTENT ===
  {
    key: "upload_deadline",
    label: "업로드마감",
    group: "content",
    render: (item, onUpdate) => (
      <Input
        type="date"
        value={item.upload_deadline ?? ""}
        onChange={(e) => onUpdate(item.id, "upload_deadline", e.target.value || null)}
        className="w-32 h-6 text-[11px] px-1.5"
      />
    ),
  },
  {
    key: "actual_upload_date",
    label: "실제업로드",
    group: "content",
    render: (item, onUpdate) => (
      <Input
        type="date"
        value={item.actual_upload_date ?? ""}
        onChange={(e) => onUpdate(item.id, "actual_upload_date", e.target.value || null)}
        className="w-32 h-6 text-[11px] px-1.5"
      />
    ),
  },
  {
    key: "upload_url",
    label: "업로드URL",
    group: "content",
    render: (item, onUpdate) => (
      <div className="flex items-center gap-0.5">
        <InlineText
          value={item.upload_url}
          placeholder="URL"
          onSave={(v) => onUpdate(item.id, "upload_url", v)}
          className="w-28"
        />
        {item.upload_url && (
          <>
            <a href={item.upload_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </a>
            <MetricsPopover metrics={item.content_metrics_cache} uploadUrl={item.upload_url} />
          </>
        )}
      </div>
    ),
  },

  // === SETTLEMENT ===
  {
    key: "payment_amount",
    label: "지급원고료",
    group: "settlement",
    render: (item, onUpdate) => (
      <InlineCurrencyInput
        value={item.payment_amount}
        currency={item.payment_currency}
        onSave={(v) => onUpdate(item.id, "payment_amount", v)}
      />
    ),
  },
  {
    key: "invoice_amount",
    label: "청구원고료",
    group: "settlement",
    render: (item, onUpdate) => (
      <InlineCurrencyInput
        value={item.invoice_amount}
        currency={item.invoice_currency}
        onSave={(v) => onUpdate(item.id, "invoice_amount", v)}
      />
    ),
  },
  {
    key: "settlement_info",
    label: "정산정보",
    group: "settlement",
    render: (item, onUpdate) => (
      <InlineSettlementEditor
        value={item.settlement_info}
        onSave={(v) => onUpdate(item.id, "settlement_info", v)}
      />
    ),
  },
  {
    key: "influencer_payment_status",
    label: "인플정산",
    group: "settlement",
    render: (item, onUpdate) => (
      <Select value={item.influencer_payment_status} onValueChange={(v) => onUpdate(item.id, "influencer_payment_status", v)}>
        <SelectTrigger className="w-20 h-6 text-[11px] px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INFLUENCER_PAYMENT_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ),
  },
  {
    key: "client_payment_status",
    label: "거래처정산",
    group: "settlement",
    render: (item, onUpdate) => (
      <Select value={item.client_payment_status} onValueChange={(v) => onUpdate(item.id, "client_payment_status", v)}>
        <SelectTrigger className="w-20 h-6 text-[11px] px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CLIENT_PAYMENT_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ),
  },
];

export function getColumnsForGroups(activeGroups: ColumnGroup[]): ColumnDef[] {
  return ALL_COLUMNS.filter(
    (col) => col.group === "basic" || activeGroups.includes(col.group)
  );
}
