"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { getColumnsForGroups, COLUMN_GROUPS } from "./funnel-columns";
import type { ColumnGroup } from "./funnel-columns";
import type { Tables } from "@/types/database";

type CampaignInfluencer = Tables<"campaign_influencers"> & {
  influencer?: Tables<"influencers">;
  campaign?: { id: string; name: string };
};

interface FunnelTableProps {
  items: CampaignInfluencer[];
  loading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  activeGroups: ColumnGroup[];
  onGroupsChange: (groups: ColumnGroup[]) => void;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onNoteEdit: (item: CampaignInfluencer, field: string, value: string) => void;
  onRowClick: (item: CampaignInfluencer) => void;
}

export function FunnelTable({
  items, loading, selectedIds, onSelectionChange,
  activeGroups, onGroupsChange, onUpdate, onNoteEdit, onRowClick,
}: FunnelTableProps) {
  const columns = getColumnsForGroups(activeGroups);
  const allSelected = items.length > 0 && selectedIds.length === items.length;

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

  return (
    <div className="space-y-2">
      {/* Column group tabs */}
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
              ) : (
                items.map((item) => (
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
