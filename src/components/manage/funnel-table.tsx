"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Layers, X, Plus, ChevronRight, ChevronDown } from "lucide-react";
import { getColumnsForGroups, COLUMN_GROUPS } from "./funnel-columns";
import { FUNNEL_STATUSES, PLATFORMS } from "@/types/platform";
import type { ColumnGroup } from "./funnel-columns";
import type { Tables } from "@/types/database";

type CampaignInfluencer = Tables<"campaign_influencers"> & {
  influencer?: Tables<"influencers">;
  campaign?: { id: string; name: string; campaign_type?: string };
};

// Multi-group support: empty array = no grouping
export type GroupByKey = "campaign" | "platform" | "funnel_status" | "campaign_type";

const GROUP_OPTIONS: { value: GroupByKey; label: string }[] = [
  { value: "campaign", label: "캠페인별" },
  { value: "platform", label: "플랫폼별" },
  { value: "funnel_status", label: "퍼널상태별" },
  { value: "campaign_type", label: "캠페인유형별" },
];

interface NestedGroup {
  key: string;
  label: string;
  groupByKey: GroupByKey;
  count: number;
  items: CampaignInfluencer[];
  subGroups: NestedGroup[] | null;
}

function getGroupKey(item: CampaignInfluencer, groupBy: GroupByKey): string {
  if (groupBy === "campaign") {
    return (item.campaign as { name: string } | undefined)?.name ?? "미지정";
  }
  if (groupBy === "platform") {
    const inf = item.influencer as unknown as Tables<"influencers"> | undefined;
    return inf?.platform ?? "unknown";
  }
  if (groupBy === "funnel_status") {
    return item.funnel_status ?? "extracted";
  }
  if (groupBy === "campaign_type") {
    return (item.campaign as { campaign_type?: string } | undefined)?.campaign_type ?? "visit";
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
  if (groupBy === "campaign_type") {
    return key === "shipping" ? "배송형" : "방문형";
  }
  return key;
}

function buildNestedGroups(items: CampaignInfluencer[], keys: GroupByKey[]): NestedGroup[] | null {
  if (keys.length === 0) return null;
  const [firstKey, ...restKeys] = keys;
  const map = new Map<string, CampaignInfluencer[]>();
  items.forEach((item) => {
    const k = getGroupKey(item, firstKey);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  });
  return Array.from(map.entries()).map(([k, groupItems]) => ({
    key: k,
    label: getGroupLabel(k, firstKey),
    groupByKey: firstKey,
    count: groupItems.length,
    items: groupItems,
    subGroups: restKeys.length > 0 ? buildNestedGroups(groupItems, restKeys) : null,
  }));
}

// Sticky column left offsets (px): checkbox(32) + campaign(120) + influencer(170) + platform(56)
const STICKY_OFFSETS = {
  checkbox: 0,
  campaign_name: 32,
  influencer: 152,
  platform: 322,
};
const LAST_STICKY_LEFT = STICKY_OFFSETS.platform;

interface FunnelTableProps {
  items: CampaignInfluencer[];
  loading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  activeGroups: ColumnGroup[];
  onGroupsChange: (groups: ColumnGroup[]) => void;
  groupBy: GroupByKey[];
  onGroupByChange: (g: GroupByKey[]) => void;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onNoteEdit: (item: CampaignInfluencer, field: string, value: string) => void;
  onRowClick: (item: CampaignInfluencer) => void;
}

export function FunnelTable({
  items, loading, selectedIds, onSelectionChange,
  activeGroups, onGroupsChange, groupBy, onGroupByChange,
  onUpdate, onNoteEdit, onRowClick,
}: FunnelTableProps) {
  const columns = useMemo(() => getColumnsForGroups(activeGroups), [activeGroups]);
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Multi-level grouping
  const nested = useMemo(() => {
    if (groupBy.length === 0) return null;
    return buildNestedGroups(items, groupBy);
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

  function toggleColumnGroup(group: ColumnGroup) {
    if (group === "basic") return;
    onGroupsChange(
      activeGroups.includes(group)
        ? activeGroups.filter((g) => g !== group)
        : [...activeGroups, group]
    );
  }

  function addGroupBy(key: GroupByKey) {
    if (!groupBy.includes(key)) {
      onGroupByChange([...groupBy, key]);
    }
  }

  function removeGroupBy(key: GroupByKey) {
    onGroupByChange(groupBy.filter((g) => g !== key));
  }

  function toggleCollapse(groupPath: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupPath)) next.delete(groupPath);
      else next.add(groupPath);
      return next;
    });
  }

  // Sticky cell helper
  function stickyStyle(colKey: string, isHeader: boolean): React.CSSProperties | undefined {
    const offset = STICKY_OFFSETS[colKey as keyof typeof STICKY_OFFSETS];
    if (offset == null) return undefined;
    const isLast = offset === LAST_STICKY_LEFT;
    return {
      position: "sticky" as const,
      left: offset,
      zIndex: isHeader ? (colKey === "checkbox" ? 30 : 20) : (colKey === "checkbox" ? 20 : 10),
      ...(isLast ? { boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" } : {}),
    };
  }

  function stickyClass(colKey: string): string {
    const offset = STICKY_OFFSETS[colKey as keyof typeof STICKY_OFFSETS];
    if (offset == null) return "";
    return "sticky bg-card";
  }

  function renderRow(item: CampaignInfluencer) {
    const isSelected = selectedIds.includes(item.id);
    return (
      <TableRow
        key={item.id}
        className={`h-8 cursor-pointer hover:bg-accent/50 ${isSelected ? "bg-accent/30" : ""}`}
      >
        <TableCell
          className={`px-1.5 py-0.5 w-[32px] min-w-[32px] ${stickyClass("checkbox")} ${isSelected ? "!bg-accent/30" : ""}`}
          style={stickyStyle("checkbox", false)}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleOne(item.id)}
            className="scale-90"
          />
        </TableCell>
        {columns.map((col) => {
          const isStickyCol = col.key in STICKY_OFFSETS;
          return (
            <TableCell
              key={col.key}
              className={`px-1.5 py-0.5 ${isStickyCol ? `${stickyClass(col.key)} ${isSelected ? "!bg-accent/30" : ""}` : ""} ${col.fixedWidth ? `w-[${col.fixedWidth}px] min-w-[${col.fixedWidth}px] max-w-[${col.fixedWidth}px]` : ""}`}
              style={isStickyCol ? stickyStyle(col.key, false) : undefined}
              onClick={(e) => {
                const tag = (e.target as HTMLElement).tagName;
                if (["INPUT", "BUTTON", "SELECT"].includes(tag)) return;
                if ((e.target as HTMLElement).closest("button, select, input, [role=combobox]")) return;
                if (col.key === "influencer") onRowClick(item);
              }}
            >
              {col.render(item, onUpdate, onNoteEdit)}
            </TableCell>
          );
        })}
      </TableRow>
    );
  }

  function renderNestedGroups(groups: NestedGroup[], depth: number, pathPrefix: string) {
    return groups.map((group) => {
      const path = `${pathPrefix}/${group.key}`;
      const isCollapsed = collapsedGroups.has(path);
      const statusColor = group.groupByKey === "funnel_status"
        ? FUNNEL_STATUSES.find((s) => s.value === group.key)?.color
        : undefined;

      return (
        <GroupSection
          key={path}
          label={group.label}
          count={group.count}
          colSpan={columns.length + 1}
          depth={depth}
          statusColor={statusColor}
          isCollapsed={isCollapsed}
          onToggle={() => toggleCollapse(path)}
        >
          {!isCollapsed && (
            group.subGroups
              ? renderNestedGroups(group.subGroups, depth + 1, path)
              : group.items.map(renderRow)
          )}
        </GroupSection>
      );
    });
  }

  const availableGroupOptions = GROUP_OPTIONS.filter((o) => !groupBy.includes(o.value));

  return (
    <div className="space-y-2">
      {/* Top bar: Group selector (left) + Column group tabs (right) */}
      <div className="flex items-center gap-3">
        {/* Group selector — LEFT */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          {groupBy.length === 0 && (
            <span className="text-xs text-muted-foreground">그룹 없음</span>
          )}
          {groupBy.map((key) => {
            const opt = GROUP_OPTIONS.find((o) => o.value === key);
            return (
              <span
                key={key}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium"
              >
                {opt?.label}
                <button onClick={() => removeGroupBy(key)} className="hover:text-primary/70 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          {availableGroupOptions.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 px-1.5 text-xs gap-0.5">
                  <Plus className="w-3 h-3" />
                  추가
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1" align="start">
                {availableGroupOptions.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => addGroupBy(o.value)}
                    className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent"
                  >
                    {o.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border shrink-0" />

        {/* Column group tabs — RIGHT */}
        <div className="flex gap-1.5 flex-wrap flex-1">
          {COLUMN_GROUPS.map((g) => {
            const isBasic = g.value === "basic";
            const active = isBasic || activeGroups.includes(g.value);
            return (
              <button
                key={g.value}
                onClick={() => toggleColumnGroup(g.value)}
                disabled={isBasic}
                className={`px-2.5 py-0.5 rounded-md text-xs transition-colors ${
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
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow className="h-8">
                <TableHead
                  className={`w-[32px] min-w-[32px] px-1.5 ${stickyClass("checkbox")}`}
                  style={stickyStyle("checkbox", true)}
                >
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="scale-90" />
                </TableHead>
                {columns.map((col) => {
                  const isStickyCol = col.key in STICKY_OFFSETS;
                  return (
                    <TableHead
                      key={col.key}
                      className={`text-[10px] font-semibold px-1.5 py-1 whitespace-nowrap ${isStickyCol ? stickyClass(col.key) : ""} ${col.width ?? ""} ${col.fixedWidth ? `w-[${col.fixedWidth}px] min-w-[${col.fixedWidth}px] max-w-[${col.fixedWidth}px]` : ""}`}
                      style={isStickyCol ? stickyStyle(col.key, true) : undefined}
                    >
                      {col.label}
                    </TableHead>
                  );
                })}
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
              ) : nested ? (
                renderNestedGroups(nested, 0, "")
              ) : (
                items.map(renderRow)
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/** Collapsible group section with indent support */
function GroupSection({
  label, count, colSpan, depth, statusColor, isCollapsed, onToggle, children,
}: {
  label: string;
  count: number;
  colSpan: number;
  depth: number;
  statusColor?: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const indent = depth * 16;

  return (
    <>
      <TableRow
        className={`hover:bg-muted/80 cursor-pointer ${depth === 0 ? "bg-muted/60" : "bg-muted/30"}`}
        onClick={onToggle}
      >
        <TableCell colSpan={colSpan} className="py-1.5 px-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ paddingLeft: indent }}>
            {isCollapsed
              ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            }
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
