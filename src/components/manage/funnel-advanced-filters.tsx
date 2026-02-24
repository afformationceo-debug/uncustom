"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLATFORMS, INFLUENCER_PAYMENT_STATUSES, CLIENT_PAYMENT_STATUSES } from "@/types/platform";
import type { ManageFilters } from "./funnel-filters";

interface FunnelAdvancedFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ManageFilters;
  onFiltersChange: (filters: ManageFilters) => void;
}

export function FunnelAdvancedFilters({
  open, onOpenChange, filters, onFiltersChange,
}: FunnelAdvancedFiltersProps) {
  function togglePlatform(p: string) {
    const next = filters.platform.includes(p)
      ? filters.platform.filter((x) => x !== p)
      : [...filters.platform, p];
    onFiltersChange({ ...filters, platform: next });
  }

  function togglePaymentStatus(field: "influencer_payment_status" | "client_payment_status", v: string) {
    const current = filters[field];
    const next = current.includes(v)
      ? current.filter((x) => x !== v)
      : [...current, v];
    onFiltersChange({ ...filters, [field]: next });
  }

  function setBoolFilter(field: keyof ManageFilters, value: string) {
    if (value === "all") {
      const next = { ...filters };
      delete (next as Record<string, unknown>)[field];
      onFiltersChange(next as ManageFilters);
    } else {
      onFiltersChange({ ...filters, [field]: value === "true" });
    }
  }

  function getBoolValue(field: keyof ManageFilters): string {
    const v = filters[field];
    if (v === undefined) return "all";
    return v ? "true" : "false";
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>고급 필터</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 py-4">
          {/* Platform */}
          <div>
            <Label className="text-sm font-medium">플랫폼</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {PLATFORMS.map((p) => (
                <label key={p.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={filters.platform.includes(p.value)}
                    onCheckedChange={() => togglePlatform(p.value)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          {/* Boolean filters */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">상태 필터</Label>
            {([
              ["interest_confirmed", "희망회신"],
              ["client_approved", "거래처컨펌"],
              ["final_confirmed", "최종확정"],
              ["guideline_sent", "가이드전달"],
              ["crm_registered", "CRM등록"],
              ["visit_completed", "방문완료"],
              ["has_email", "이메일 보유"],
              ["has_upload_url", "업로드 완료"],
            ] as const).map(([field, label]) => (
              <div key={field} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Select value={getBoolValue(field)} onValueChange={(v) => setBoolFilter(field, v)}>
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="true">Y</SelectItem>
                    <SelectItem value="false">N</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Payment status */}
          <div>
            <Label className="text-sm font-medium">인플루언서 정산</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {INFLUENCER_PAYMENT_STATUSES.map((s) => (
                <label key={s.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={filters.influencer_payment_status.includes(s.value)}
                    onCheckedChange={() => togglePaymentStatus("influencer_payment_status", s.value)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">거래처 정산</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CLIENT_PAYMENT_STATUSES.map((s) => (
                <label key={s.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={filters.client_payment_status.includes(s.value)}
                    onCheckedChange={() => togglePaymentStatus("client_payment_status", s.value)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          {/* Date ranges */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">날짜 범위</Label>
            <div>
              <span className="text-xs text-muted-foreground">방문 예정일</span>
              <div className="flex gap-2 mt-1">
                <Input
                  type="date" className="h-8 text-xs"
                  value={filters.visit_date_from}
                  onChange={(e) => onFiltersChange({ ...filters, visit_date_from: e.target.value })}
                />
                <span className="text-muted-foreground self-center">~</span>
                <Input
                  type="date" className="h-8 text-xs"
                  value={filters.visit_date_to}
                  onChange={(e) => onFiltersChange({ ...filters, visit_date_to: e.target.value })}
                />
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">업로드 마감일</span>
              <div className="flex gap-2 mt-1">
                <Input
                  type="date" className="h-8 text-xs"
                  value={filters.upload_deadline_from}
                  onChange={(e) => onFiltersChange({ ...filters, upload_deadline_from: e.target.value })}
                />
                <span className="text-muted-foreground self-center">~</span>
                <Input
                  type="date" className="h-8 text-xs"
                  value={filters.upload_deadline_to}
                  onChange={(e) => onFiltersChange({ ...filters, upload_deadline_to: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
