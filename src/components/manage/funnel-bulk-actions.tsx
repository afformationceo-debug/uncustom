"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { FUNNEL_STATUSES } from "@/types/platform";
import type { FunnelStatus } from "@/types/platform";

interface FunnelBulkActionsProps {
  selectedIds: string[];
  campaignId: string | null;
  onClear: () => void;
  onDone: () => void;
}

export function FunnelBulkActions({ selectedIds, campaignId, onClear, onDone }: FunnelBulkActionsProps) {
  const [loading, setLoading] = useState(false);

  async function bulkUpdate(updates: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch("/api/manage/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, updates }),
      });
      if (!res.ok) throw new Error("Bulk update failed");
      toast.success(`${selectedIds.length}건 업데이트 완료`);
      onDone();
    } catch {
      toast.error("일괄 업데이트 실패");
    } finally {
      setLoading(false);
    }
  }

  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
      <span className="text-sm font-medium">{selectedIds.length}명 선택</span>

      <Select
        disabled={loading}
        onValueChange={(v) => bulkUpdate({ funnel_status: v })}
      >
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="상태 변경" />
        </SelectTrigger>
        <SelectContent>
          {FUNNEL_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline" size="sm" disabled={loading}
        onClick={() => bulkUpdate({ guideline_sent: true })}
      >
        가이드 전달
      </Button>
      <Button
        variant="outline" size="sm" disabled={loading}
        onClick={() => bulkUpdate({ visit_completed: true })}
      >
        방문 완료
      </Button>
      <Button
        variant="outline" size="sm" disabled={loading}
        onClick={() => bulkUpdate({ crm_registered: true })}
      >
        CRM 등록
      </Button>

      {loading && <Loader2 className="w-4 h-4 animate-spin" />}

      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
