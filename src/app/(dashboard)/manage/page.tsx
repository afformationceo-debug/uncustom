"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CampaignSelector } from "@/components/campaign-selector";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { LayoutGrid } from "lucide-react";
import type { Tables } from "@/types/database";
import type { ColumnGroup } from "@/components/manage/funnel-columns";
import type { ManageFilters } from "@/components/manage/funnel-filters";
import type { GroupByKey } from "@/components/manage/funnel-table";

import { FunnelSummary } from "@/components/manage/funnel-summary";
import { FunnelTable } from "@/components/manage/funnel-table";
import { FunnelFilters, DEFAULT_FILTERS } from "@/components/manage/funnel-filters";
import { FunnelPagination } from "@/components/manage/funnel-pagination";
import { FunnelDetailPanel } from "@/components/manage/funnel-detail-panel";
import { FunnelBulkActions } from "@/components/manage/funnel-bulk-actions";
import { FunnelExportButton } from "@/components/manage/funnel-export-button";

type CampaignInfluencer = Tables<"campaign_influencers"> & {
  influencer?: Tables<"influencers">;
  campaign?: { id: string; name: string };
};

export default function ManagePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">로딩 중...</div>}>
      <ManagePageContent />
    </Suspense>
  );
}

// Load column groups from localStorage — default to ALL groups
function loadColumnGroups(): ColumnGroup[] {
  if (typeof window === "undefined") return ["outreach", "confirm", "execution", "content", "settlement"];
  try {
    const saved = localStorage.getItem("manage_column_groups");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return ["outreach", "confirm", "execution", "content", "settlement"];
}

function ManagePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Campaign — null means "전체 캠페인"
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Data
  const [items, setItems] = useState<CampaignInfluencer[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [filters, setFilters] = useState<ManageFilters>(DEFAULT_FILTERS);

  // Column groups
  const [activeGroups, setActiveGroups] = useState<ColumnGroup[]>(loadColumnGroups);

  // Grouping
  const [groupBy, setGroupBy] = useState<GroupByKey>("none");

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Detail panel
  const [detailItem, setDetailItem] = useState<CampaignInfluencer | null>(null);

  // Note editor
  const [editingNote, setEditingNote] = useState<{ id: string; field: string; value: string } | null>(null);

  // Summary refresh key
  const [summaryKey, setSummaryKey] = useState(0);

  // Mark as initialized after first render (to trigger initial fetch)
  useEffect(() => {
    setInitialized(true);
  }, []);

  // Fetch data — works with or without campaignId
  const fetchData = useCallback(async () => {
    if (!initialized) return;
    setLoading(true);

    const params = new URLSearchParams();
    if (campaignId) params.set("campaign_id", campaignId);
    params.set("page", String(page));
    params.set("limit", String(limit));

    if (filters.funnel_status.length > 0) params.set("funnel_status", filters.funnel_status.join(","));
    if (filters.platform.length > 0) params.set("platform", filters.platform.join(","));
    if (filters.interest_confirmed !== undefined) params.set("interest_confirmed", String(filters.interest_confirmed));
    if (filters.client_approved !== undefined) params.set("client_approved", String(filters.client_approved));
    if (filters.final_confirmed !== undefined) params.set("final_confirmed", String(filters.final_confirmed));
    if (filters.visit_completed !== undefined) params.set("visit_completed", String(filters.visit_completed));
    if (filters.guideline_sent !== undefined) params.set("guideline_sent", String(filters.guideline_sent));
    if (filters.crm_registered !== undefined) params.set("crm_registered", String(filters.crm_registered));
    if (filters.influencer_payment_status.length > 0) params.set("influencer_payment_status", filters.influencer_payment_status.join(","));
    if (filters.client_payment_status.length > 0) params.set("client_payment_status", filters.client_payment_status.join(","));
    if (filters.has_email !== undefined) params.set("has_email", String(filters.has_email));
    if (filters.has_upload_url !== undefined) params.set("has_upload_url", String(filters.has_upload_url));
    if (filters.search) params.set("search", filters.search);
    if (filters.visit_date_from) params.set("visit_date_from", filters.visit_date_from);
    if (filters.visit_date_to) params.set("visit_date_to", filters.visit_date_to);
    if (filters.upload_deadline_from) params.set("upload_deadline_from", filters.upload_deadline_from);
    if (filters.upload_deadline_to) params.set("upload_deadline_to", filters.upload_deadline_to);

    try {
      const res = await fetch(`/api/manage?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
      }
    } catch {
      toast.error("데이터 조회 실패");
    }
    setLoading(false);
  }, [initialized, campaignId, page, limit, filters]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    if (!initialized) return;
    try {
      const url = campaignId
        ? `/api/manage/summary?campaign_id=${campaignId}`
        : `/api/manage/summary`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setStatusCounts(json.statusCounts ?? {});
      }
    } catch { /* ignore */ }
  }, [initialized, campaignId]);

  useEffect(() => {
    fetchData();
    fetchSummary();
  }, [fetchData, fetchSummary]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [filters]);

  // Save column groups to localStorage
  useEffect(() => {
    localStorage.setItem("manage_column_groups", JSON.stringify(activeGroups));
  }, [activeGroups]);

  // Realtime: row-level merge instead of full refetch
  useRealtime(
    "campaign_influencers",
    campaignId ? `campaign_id=eq.${campaignId}` : undefined,
    (payload: unknown) => {
      const p = payload as { eventType?: string; new?: CampaignInfluencer; old?: { id: string } };
      if (p.eventType === "UPDATE" && p.new) {
        setItems((prev) => {
          const idx = prev.findIndex((i) => i.id === p.new!.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...p.new! };
            return updated;
          }
          return prev;
        });
        setSummaryKey((k) => k + 1);
      } else if (p.eventType === "INSERT" || p.eventType === "DELETE") {
        fetchData();
        setSummaryKey((k) => k + 1);
      }
    }
  );

  // Inline update handler
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function handleUpdate(id: string, field: string, value: unknown) {
    // Optimistic update for the changed field only
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );

    const key = `${id}_${field}`;
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);

    debounceTimers.current[key] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/manage/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) {
          toast.error("저장 실패");
          fetchData();
        } else {
          // Apply full server response (includes auto-calculated funnel_status)
          const json = await res.json();
          if (json.data) {
            setItems((prev) =>
              prev.map((item) =>
                item.id === id
                  ? { ...item, ...json.data, influencer: item.influencer, campaign: item.campaign }
                  : item
              )
            );
          }
          setSummaryKey((k) => k + 1);
        }
      } catch {
        toast.error("저장 실패");
        fetchData();
      }
    }, 300);
  }

  // Note editor — supports multiple text fields (notes, client_note, reply_summary, crm_note)
  function handleNoteEdit(_item: CampaignInfluencer, field: string, value: string) {
    setEditingNote({ id: _item.id, field, value });
  }

  async function saveNote() {
    if (!editingNote) return;
    handleUpdate(editingNote.id, editingNote.field, editingNote.value || null);
    setEditingNote(null);
    toast.success("메모가 저장되었습니다.");
  }

  // Pagination handlers
  function handlePageChange(newPage: number) {
    setPage(newPage);
    setSelectedIds([]);
  }

  function handleLimitChange(newLimit: number) {
    setLimit(newLimit);
    setPage(1);
    setSelectedIds([]);
  }

  // Filter change
  function handleFiltersChange(newFilters: ManageFilters) {
    setFilters(newFilters);
  }

  // Bulk action done
  function handleBulkDone() {
    setSelectedIds([]);
    fetchData();
    setSummaryKey((k) => k + 1);
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" />
            인플루언서 관리
          </h2>
          <p className="text-xs text-muted-foreground">
            {campaignId ? "캠페인별 퍼널 관리" : "전체 캠페인 통합 관리"}
            {total > 0 && ` — ${total.toLocaleString()}명`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FunnelExportButton campaignId={campaignId} />
          <CampaignSelector mode="filter" value={campaignId} onChange={setCampaignId} />
        </div>
      </div>

      {/* Summary bar */}
      <FunnelSummary campaignId={campaignId} refreshKey={summaryKey} />

      {/* Filters — inline multi-filter dropdowns */}
      <FunnelFilters
        filters={filters}
        statusCounts={statusCounts}
        total={total}
        onFiltersChange={handleFiltersChange}
      />

      {/* Table */}
      <FunnelTable
        items={items}
        loading={loading}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        activeGroups={activeGroups}
        onGroupsChange={setActiveGroups}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        onUpdate={handleUpdate}
        onNoteEdit={handleNoteEdit}
        onRowClick={setDetailItem}
      />

      {/* Pagination */}
      <FunnelPagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />

      {/* Detail panel */}
      <FunnelDetailPanel
        item={detailItem}
        open={!!detailItem}
        onOpenChange={(open) => { if (!open) setDetailItem(null); }}
      />

      {/* Bulk actions */}
      <FunnelBulkActions
        selectedIds={selectedIds}
        campaignId={campaignId}
        onClear={() => setSelectedIds([])}
        onDone={handleBulkDone}
      />

      {/* Note editor dialog */}
      <Dialog open={!!editingNote} onOpenChange={() => setEditingNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingNote?.field === "notes" ? "메모" : editingNote?.field === "client_note" ? "거래처 메모" : editingNote?.field === "reply_summary" ? "회신 요약" : editingNote?.field === "crm_note" ? "CRM 메모" : "편집"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editingNote?.value ?? ""}
              onChange={(e) => setEditingNote(editingNote ? { ...editingNote, value: e.target.value } : null)}
              placeholder="메모를 입력하세요..."
              rows={5}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingNote(null)}>취소</Button>
              <Button onClick={saveNote}>저장</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
