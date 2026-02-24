"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Layers } from "lucide-react";
import { getColumnsForGroups, COLUMN_GROUPS } from "./funnel-columns";
import { FUNNEL_STATUSES, PLATFORMS } from "@/types/platform";
import type { ColumnGroup } from "./funnel-columns";
import type { Tables } from "@/types/database";

type CampaignInfluencer = Tables<"campaign_influencers"> & {
  influencer?: Tables<"influencers">;
  campaign?: { id: string; name: string };
};

export type GroupByKey = "none" | "campaign" | "platform" | "funnel_status";

const GROUP_OPTIONS: { value: GroupByKey; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "campaign", label: "캠페인별" },
  { value: "platform", label: "플랫폼별" },
  { value: "funnel_status", label: "퍼널상태별" },
];

function getGroupKey(item: CampaignInfluencer, groupBy: GroupByKey): string {
  if (groupBy === "campaign") {
    return (item.campaign as { id: string; name: string } | undefined)?.name ?? "미지정";
  }
  if (groupBy === "platform") {
    const inf = item.influencer as unknown as Tables<"influencers"> | undefined;
    return inf?.platform ?? "unknown";
  }
  if (groupBy === "funnel_status") {
    return item.funnel_status ?? "extracted";
  }
  return "";
}

function getGroupLabel(key: string, groupBy: GroupByKey): string {
  if (groupBy === "platform") {
    return PLATFORMS.find((p) => p.value === key)?.label ?? key;
  }
  if (groupBy === "funnel_status") {
    return FUNNEL_STATUSES.find((s) => s.value === key)?.label ?? key;
  }
  return key;
}

interface FunnelTableProps {
  items: CampaignInfluencer[];
  loading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  activeGroups: ColumnGroup[];
  onGroupsChange: (groups: ColumnGroup[]) => void;
  groupBy: GroupByKey;
  onGroupByChange: (g: GroupByKey) => void;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onNoteEdit: (item: CampaignInfluencer, field: string, value: string) => void;
  onRowClick: (item: CampaignInfluencer) => void;
}

export function FunnelTable({
  items, loading, selectedIds, onSelectionChange,
  activeGroups, onGroupsChange, groupBy, onGroupByChange,
  onUpdate, onNoteEdit, onRowClick,
}: FunnelTableProps) {
  const columns = getColumnsForGroups(activeGroups);
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  // Group items
  const grouped = useMemo(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, CampaignInfluencer[]>();
    items.forEach((item) => {
      const key = getGroupKey(item, groupBy);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries()).map(([key, groupItems]) => ({
      key,
      label: getGroupLabel(key, groupBy),
      items: groupItems,
    }));
  }, [items, groupBy]);

  function toggleAll() {
    onSelectionChange(allSelected ? [] : items.map((i) => i.id));
  }

  function toggleOne(id: string) {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  }

  function toggleGroup(group: ColumnGroup) {
    if (group === "basic") return;
    onGroupsChange(
      activeGroups.includes(group)
        ? activeGroups.filter((g) => g !== group)
        : [...activeGroups, group]
    );
  }

  function renderRow(item: CampaignInfluencer) {
    return (
      <TableRow
        key={item.id}
        className={`h-8 cursor-pointer hover:bg-accent/50 ${selectedIds.includes(item.id) ? "bg-accent/30" : ""}`}
      >
        <TableCell
          className="px-1.5 py-0.5 sticky left-0 bg-card z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selectedIds.includes(item.id)}
            onCheckedChange={() => toggleOne(item.id)}
            className="scale-90"
          />
        </TableCell>
        {columns.map((col) => (
          <TableCell
            key={col.key}
            className={`px-1.5 py-0.5 ${col.sticky ? "sticky left-8 bg-card z-10" : ""}`}
            onClick={(e) => {
              const tag = (e.target as HTMLElement).tagName;
              if (["INPUT", "BUTTON", "SELECT"].includes(tag)) return;
              if ((e.target as HTMLElement).closest("button, select, input, [role=combobox]")) return;
              if (col.key === "influencer") onRowClick(item);
            }}
          >
            {col.render(item, onUpdate, onNoteEdit)}
          </TableCell>
        ))}
      </TableRow>
    );
  }

  return (
    <div className="space-y-2">
      {/* Column group tabs + groupBy selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {COLUMN_GROUPS.map((g) => {
            const isBasic = g.value === "basic";
            const active = isBasic || activeGroups.includes(g.value);
            return (
              <button
                key={g.value}
                onClick={() => toggleGroup(g.value)}
                disabled={isBasic}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-accent text-foreground"
                } ${isBasic ? "opacity-70 cursor-default" : "cursor-pointer"}`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as GroupByKey)}>
            <SelectTrigger className="w-28 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="w-8 px-1.5 sticky left-0 bg-card z-20">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="scale-90" />
                </TableHead>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={`text-[10px] font-semibold px-1.5 py-1 whitespace-nowrap ${col.sticky ? "sticky left-8 bg-card z-10" : ""} ${col.width ?? ""}`}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground text-xs">
                    관리할 인플루언서가 없습니다.
                  </TableCell>
                </TableRow>
              ) : grouped ? (
                // Grouped rendering
                grouped.map((group) => (
                  <GroupSection
                    key={group.key}
                    label={group.label}
                    count={group.items.length}
                    colSpan={columns.length + 1}
                    groupBy={groupBy}
                    groupKey={group.key}
                  >
                    {group.items.map(renderRow)}
                  </GroupSection>
                ))
              ) : (
                // Flat rendering
                items.map(renderRow)
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/** Collapsible group section */
function GroupSection({
  label, count, colSpan, groupBy, groupKey, children,
}: {
  label: string;
  count: number;
  colSpan: number;
  groupBy: GroupByKey;
  groupKey: string;
  children: React.ReactNode;
}) {
  const statusColor = groupBy === "funnel_status"
    ? FUNNEL_STATUSES.find((s) => s.value === groupKey)?.color
    : undefined;

  return (
    <>
      <TableRow className="bg-muted/60 hover:bg-muted/60">
        <TableCell colSpan={colSpan} className="py-1.5 px-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            {statusColor && (
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
            )}
            <span>{label}</span>
            <span className="text-muted-foreground font-normal">({count}명)</span>
          </div>
        </TableCell>
      </TableRow>
      {children}
    </>
  );
}
