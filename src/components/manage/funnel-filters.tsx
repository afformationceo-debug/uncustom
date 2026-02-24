"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { FUNNEL_STATUSES } from "@/types/platform";
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

interface FunnelFiltersProps {
  filters: ManageFilters;
  statusCounts: Record<string, number>;
  total: number;
  onFiltersChange: (filters: ManageFilters) => void;
  onAdvancedOpen: () => void;
}

export function FunnelFilters({
  filters, statusCounts, total, onFiltersChange, onAdvancedOpen,
}: FunnelFiltersProps) {
  function toggleStatus(status: FunnelStatus) {
    const current = filters.funnel_status;
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({ ...filters, funnel_status: next });
  }

  // Count active non-status filters
  const advancedCount = [
    filters.platform.length > 0,
    filters.interest_confirmed !== undefined,
    filters.client_approved !== undefined,
    filters.final_confirmed !== undefined,
    filters.visit_completed !== undefined,
    filters.guideline_sent !== undefined,
    filters.crm_registered !== undefined,
    filters.influencer_payment_status.length > 0,
    filters.client_payment_status.length > 0,
    filters.has_email !== undefined,
    filters.has_upload_url !== undefined,
    filters.visit_date_from !== "",
    filters.visit_date_to !== "",
    filters.upload_deadline_from !== "",
    filters.upload_deadline_to !== "",
  ].filter(Boolean).length;

  // Active filter chips
  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (filters.funnel_status.length > 0) {
    filters.funnel_status.forEach((s) => {
      const label = FUNNEL_STATUSES.find((fs) => fs.value === s)?.label ?? s;
      activeChips.push({ label, onRemove: () => toggleStatus(s as FunnelStatus) });
    });
  }
  if (filters.platform.length > 0) {
    activeChips.push({
      label: `플랫폼: ${filters.platform.join(", ")}`,
      onRemove: () => onFiltersChange({ ...filters, platform: [] }),
    });
  }
  if (filters.influencer_payment_status.length > 0) {
    activeChips.push({
      label: `인플정산: ${filters.influencer_payment_status.join(", ")}`,
      onRemove: () => onFiltersChange({ ...filters, influencer_payment_status: [] }),
    });
  }
  if (filters.client_payment_status.length > 0) {
    activeChips.push({
      label: `거래처정산: ${filters.client_payment_status.join(", ")}`,
      onRemove: () => onFiltersChange({ ...filters, client_payment_status: [] }),
    });
  }

  const hasAnyFilter = filters.funnel_status.length > 0 || filters.search || advancedCount > 0;

  return (
    <div className="space-y-3">
      {/* Status quick filter buttons */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onFiltersChange({ ...filters, funnel_status: [] })}
          className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
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
              className={`px-2.5 py-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
                active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search + advanced filter button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="이름, 유저네임, 이메일 검색..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-10 h-9"
          />
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onAdvancedOpen}>
          <SlidersHorizontal className="w-4 h-4" />
          고급 필터
          {advancedCount > 0 && (
            <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {advancedCount}
            </Badge>
          )}
        </Button>
        {hasAnyFilter && (
          <Button
            variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground"
            onClick={() => onFiltersChange(DEFAULT_FILTERS)}
          >
            필터 초기화
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {activeChips.map((chip, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pr-1">
              {chip.label}
              <button onClick={chip.onRemove} className="hover:bg-accent rounded-full p-0.5">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
