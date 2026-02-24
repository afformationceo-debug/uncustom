"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Search, X, ChevronDown } from "lucide-react";
import {
  FUNNEL_STATUSES, PLATFORMS,
  INFLUENCER_PAYMENT_STATUSES, CLIENT_PAYMENT_STATUSES,
} from "@/types/platform";
import type { FunnelStatus } from "@/types/platform";

export interface ManageFilters {
  funnel_status: string[];
  platform: string[];
  interest_confirmed?: boolean;
  client_approved?: boolean;
  final_confirmed?: boolean;
  visit_completed?: boolean;
  guideline_sent?: boolean;
  crm_registered?: boolean;
  influencer_payment_status: string[];
  client_payment_status: string[];
  has_email?: boolean;
  has_upload_url?: boolean;
  search: string;
  visit_date_from: string;
  visit_date_to: string;
  upload_deadline_from: string;
  upload_deadline_to: string;
}

export const DEFAULT_FILTERS: ManageFilters = {
  funnel_status: [],
  platform: [],
  influencer_payment_status: [],
  client_payment_status: [],
  search: "",
  visit_date_from: "",
  visit_date_to: "",
  upload_deadline_from: "",
  upload_deadline_to: "",
};

const BOOL_FILTERS: { field: keyof ManageFilters; label: string }[] = [
  { field: "interest_confirmed", label: "희망회신" },
  { field: "client_approved", label: "거래처컨펌" },
  { field: "final_confirmed", label: "최종확정" },
  { field: "guideline_sent", label: "가이드전달" },
  { field: "crm_registered", label: "CRM등록" },
  { field: "visit_completed", label: "방문완료" },
  { field: "has_email", label: "이메일 보유" },
  { field: "has_upload_url", label: "업로드 완료" },
];

interface FunnelFiltersProps {
  filters: ManageFilters;
  statusCounts: Record<string, number>;
  total: number;
  onFiltersChange: (filters: ManageFilters) => void;
}

export function FunnelFilters({
  filters, statusCounts, total, onFiltersChange,
}: FunnelFiltersProps) {
  function toggleStatus(status: FunnelStatus) {
    const current = filters.funnel_status;
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({ ...filters, funnel_status: next });
  }

  function togglePlatform(p: string) {
    const next = filters.platform.includes(p)
      ? filters.platform.filter((x) => x !== p)
      : [...filters.platform, p];
    onFiltersChange({ ...filters, platform: next });
  }

  function togglePayment(field: "influencer_payment_status" | "client_payment_status", v: string) {
    const current = filters[field];
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    onFiltersChange({ ...filters, [field]: next });
  }

  function cycleBool(field: keyof ManageFilters) {
    const current = filters[field];
    // undefined → true → false → undefined
    let next: boolean | undefined;
    if (current === undefined) next = true;
    else if (current === true) next = false;
    else next = undefined;

    const updated = { ...filters };
    if (next === undefined) {
      delete (updated as Record<string, unknown>)[field];
    } else {
      (updated as Record<string, unknown>)[field] = next;
    }
    onFiltersChange(updated as ManageFilters);
  }

  // Build active filter chips
  const activeChips: { label: string; onRemove: () => void }[] = [];
  filters.funnel_status.forEach((s) => {
    const label = FUNNEL_STATUSES.find((fs) => fs.value === s)?.label ?? s;
    activeChips.push({ label: `상태: ${label}`, onRemove: () => toggleStatus(s as FunnelStatus) });
  });
  filters.platform.forEach((p) => {
    const label = PLATFORMS.find((pl) => pl.value === p)?.label ?? p;
    activeChips.push({ label: `플랫폼: ${label}`, onRemove: () => togglePlatform(p) });
  });
  BOOL_FILTERS.forEach(({ field, label }) => {
    const val = filters[field];
    if (val !== undefined) {
      activeChips.push({
        label: `${label}: ${val ? "Y" : "N"}`,
        onRemove: () => {
          const updated = { ...filters };
          delete (updated as Record<string, unknown>)[field];
          onFiltersChange(updated as ManageFilters);
        },
      });
    }
  });
  filters.influencer_payment_status.forEach((v) => {
    const label = INFLUENCER_PAYMENT_STATUSES.find((s) => s.value === v)?.label ?? v;
    activeChips.push({ label: `인플정산: ${label}`, onRemove: () => togglePayment("influencer_payment_status", v) });
  });
  filters.client_payment_status.forEach((v) => {
    const label = CLIENT_PAYMENT_STATUSES.find((s) => s.value === v)?.label ?? v;
    activeChips.push({ label: `거래처정산: ${label}`, onRemove: () => togglePayment("client_payment_status", v) });
  });
  if (filters.visit_date_from || filters.visit_date_to) {
    activeChips.push({
      label: `방문일: ${filters.visit_date_from || "~"} ~ ${filters.visit_date_to || "~"}`,
      onRemove: () => onFiltersChange({ ...filters, visit_date_from: "", visit_date_to: "" }),
    });
  }
  if (filters.upload_deadline_from || filters.upload_deadline_to) {
    activeChips.push({
      label: `업로드마감: ${filters.upload_deadline_from || "~"} ~ ${filters.upload_deadline_to || "~"}`,
      onRemove: () => onFiltersChange({ ...filters, upload_deadline_from: "", upload_deadline_to: "" }),
    });
  }

  const hasAnyFilter = activeChips.length > 0 || filters.search;

  return (
    <div className="space-y-2">
      {/* Row 1: Status quick filter */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => onFiltersChange({ ...filters, funnel_status: [] })}
          className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
            filters.funnel_status.length === 0
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-accent"
          }`}
        >
          전체 ({total})
        </button>
        {FUNNEL_STATUSES.filter((s) => s.group !== "terminal").map((s) => {
          const count = statusCounts[s.value] ?? 0;
          const active = filters.funnel_status.includes(s.value);
          return (
            <button
              key={s.value}
              onClick={() => toggleStatus(s.value)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1 ${
                active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Row 2: Search + filter dropdowns */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="relative w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="이름, 유저네임, 이메일..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Platform filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 px-2.5">
              플랫폼
              {filters.platform.length > 0 && (
                <Badge variant="default" className="ml-0.5 h-4 min-w-4 px-1 text-[9px]">{filters.platform.length}</Badge>
              )}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-3" align="start">
            <div className="space-y-2">
              {PLATFORMS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={filters.platform.includes(p.value)}
                    onCheckedChange={() => togglePlatform(p.value)}
                    className="scale-90"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Bool filters (confirm status) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 px-2.5">
              상태필터
              {BOOL_FILTERS.some(({ field }) => filters[field] !== undefined) && (
                <Badge variant="default" className="ml-0.5 h-4 min-w-4 px-1 text-[9px]">
                  {BOOL_FILTERS.filter(({ field }) => filters[field] !== undefined).length}
                </Badge>
              )}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-3" align="start">
            <div className="space-y-1.5">
              {BOOL_FILTERS.map(({ field, label }) => {
                const val = filters[field];
                return (
                  <button
                    key={field}
                    onClick={() => cycleBool(field)}
                    className="flex items-center justify-between w-full text-xs py-1 px-1.5 rounded hover:bg-accent"
                  >
                    <span>{label}</span>
                    <Badge
                      variant={val === undefined ? "outline" : "default"}
                      className={`text-[9px] px-1.5 h-4 ${
                        val === true ? "bg-green-600" : val === false ? "bg-red-500" : ""
                      }`}
                    >
                      {val === undefined ? "전체" : val ? "Y" : "N"}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Payment status */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 px-2.5">
              정산
              {(filters.influencer_payment_status.length + filters.client_payment_status.length) > 0 && (
                <Badge variant="default" className="ml-0.5 h-4 min-w-4 px-1 text-[9px]">
                  {filters.influencer_payment_status.length + filters.client_payment_status.length}
                </Badge>
              )}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-3" align="start">
            <div className="space-y-3">
              <div>
                <Label className="text-[10px] text-muted-foreground font-medium">인플루언서 정산</Label>
                <div className="space-y-1.5 mt-1.5">
                  {INFLUENCER_PAYMENT_STATUSES.map((s) => (
                    <label key={s.value} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={filters.influencer_payment_status.includes(s.value)}
                        onCheckedChange={() => togglePayment("influencer_payment_status", s.value)}
                        className="scale-90"
                      />
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-medium">거래처 정산</Label>
                <div className="space-y-1.5 mt-1.5">
                  {CLIENT_PAYMENT_STATUSES.map((s) => (
                    <label key={s.value} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={filters.client_payment_status.includes(s.value)}
                        onCheckedChange={() => togglePayment("client_payment_status", s.value)}
                        className="scale-90"
                      />
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Date ranges */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 px-2.5">
              날짜
              {(filters.visit_date_from || filters.visit_date_to || filters.upload_deadline_from || filters.upload_deadline_to) && (
                <Badge variant="default" className="ml-0.5 h-4 min-w-4 px-1 text-[9px]">!</Badge>
              )}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <div>
                <Label className="text-[10px] text-muted-foreground font-medium">방문 예정일</Label>
                <div className="flex gap-1.5 mt-1.5 items-center">
                  <Input
                    type="date" className="h-7 text-[11px] flex-1"
                    value={filters.visit_date_from}
                    onChange={(e) => onFiltersChange({ ...filters, visit_date_from: e.target.value })}
                  />
                  <span className="text-muted-foreground text-xs">~</span>
                  <Input
                    type="date" className="h-7 text-[11px] flex-1"
                    value={filters.visit_date_to}
                    onChange={(e) => onFiltersChange({ ...filters, visit_date_to: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-medium">업로드 마감일</Label>
                <div className="flex gap-1.5 mt-1.5 items-center">
                  <Input
                    type="date" className="h-7 text-[11px] flex-1"
                    value={filters.upload_deadline_from}
                    onChange={(e) => onFiltersChange({ ...filters, upload_deadline_from: e.target.value })}
                  />
                  <span className="text-muted-foreground text-xs">~</span>
                  <Input
                    type="date" className="h-7 text-[11px] flex-1"
                    value={filters.upload_deadline_to}
                    onChange={(e) => onFiltersChange({ ...filters, upload_deadline_to: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {hasAnyFilter && (
          <Button
            variant="ghost" size="sm" className="h-8 text-[11px] text-muted-foreground px-2"
            onClick={() => onFiltersChange(DEFAULT_FILTERS)}
          >
            초기화
          </Button>
        )}
      </div>

      {/* Row 3: Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {activeChips.map((chip, i) => (
            <Badge key={i} variant="secondary" className="gap-0.5 pr-0.5 text-[10px] h-5">
              {chip.label}
              <button onClick={chip.onRemove} className="hover:bg-accent rounded-full p-0.5 ml-0.5">
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
