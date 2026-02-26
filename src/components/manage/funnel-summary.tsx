"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown, ChevronUp, AlertTriangle, DollarSign,
  Calendar, CalendarDays, CalendarRange, BarChart3, TrendingUp,
} from "lucide-react";
import { FUNNEL_STATUSES, getFunnelStatusLabel } from "@/types/platform";

type DateRange = "today" | "week" | "month" | "all" | "custom";

interface SummaryData {
  statusCounts: Record<string, number>;
  total: number;
  financials: {
    totalPayment: number;
    totalInvoice: number;
    paidToInfluencers: number;
    receivedFromClients: number;
  };
  bottlenecks: {
    noReply: number;
    awaitingClient: number;
    overdueVisit: number;
    overdueUpload: number;
  };
  dailyCounts?: Record<string, Record<string, number>>;
  outreachDaily?: Record<string, number>;
  replyDaily?: Record<string, number>;
}

interface FunnelSummaryProps {
  campaignId: string | null;
  campaignType?: string | null;
  refreshKey?: number;
}

function getDateRange(range: DateRange): { from: string | null; to: string | null } {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  switch (range) {
    case "today":
      return { from: todayStr, to: todayStr };
    case "week": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 6);
      return { from: weekAgo.toISOString().slice(0, 10), to: todayStr };
    }
    case "month": {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 29);
      return { from: monthAgo.toISOString().slice(0, 10), to: todayStr };
    }
    case "all":
      return { from: null, to: null };
    case "custom":
      return { from: null, to: null };
  }
}

export function FunnelSummary({ campaignId, campaignType, refreshKey }: FunnelSummaryProps) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [totalData, setTotalData] = useState<SummaryData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showTimeline, setShowTimeline] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (campaignId) params.set("campaign_id", campaignId);

      const range = dateRange === "custom"
        ? { from: customFrom || null, to: customTo || null }
        : getDateRange(dateRange);

      if (range.from) params.set("date_from", range.from);
      if (range.to) params.set("date_to", range.to);

      const res = await fetch(`/api/manage/summary?${params.toString()}`);
      if (res.ok) setData(await res.json());

      // Always fetch total (no date filter) for comparison
      if (dateRange !== "all") {
        const totalParams = new URLSearchParams();
        if (campaignId) totalParams.set("campaign_id", campaignId);
        const totalRes = await fetch(`/api/manage/summary?${totalParams.toString()}`);
        if (totalRes.ok) setTotalData(await totalRes.json());
      } else {
        setTotalData(null);
      }
    } catch { /* ignore */ }
  }, [campaignId, dateRange, customFrom, customTo]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshKey]);

  if (!data) return null;

  const fmtMoney = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toLocaleString();
  const pipelineStatuses = FUNNEL_STATUSES.filter((s) => s.group !== "terminal");
  const terminalStatuses = FUNNEL_STATUSES.filter((s) => s.group === "terminal");
  const totalBottlenecks = data.bottlenecks.noReply + data.bottlenecks.awaitingClient + data.bottlenecks.overdueVisit + data.bottlenecks.overdueUpload;

  const rangeLabel = dateRange === "today" ? "오늘" : dateRange === "week" ? "최근 7일" : dateRange === "month" ? "최근 30일" : dateRange === "all" ? "전체" : "커스텀";

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header with date range selector */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">퍼널 요약</h3>
            {totalBottlenecks > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-500">
                <AlertTriangle className="w-3.5 h-3.5" />
                병목 {totalBottlenecks}건
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Date range buttons */}
            {(["today", "week", "month", "all"] as const).map((r) => (
              <Button
                key={r}
                variant={dateRange === r ? "default" : "ghost"}
                size="sm"
                className={`h-6 px-2 text-[10px] ${dateRange === r ? "" : "text-muted-foreground"}`}
                onClick={() => setDateRange(r)}
              >
                {r === "today" && <Calendar className="w-3 h-3 mr-0.5" />}
                {r === "week" && <CalendarDays className="w-3 h-3 mr-0.5" />}
                {r === "month" && <CalendarRange className="w-3 h-3 mr-0.5" />}
                {r === "today" ? "오늘" : r === "week" ? "7일" : r === "month" ? "30일" : "전체"}
              </Button>
            ))}
            <Button
              variant={dateRange === "custom" ? "default" : "ghost"}
              size="sm"
              className={`h-6 px-2 text-[10px] ${dateRange === "custom" ? "" : "text-muted-foreground"}`}
              onClick={() => setDateRange("custom")}
            >
              기간
            </Button>

            {/* Timeline toggle */}
            <div className="w-px h-4 bg-border mx-1" />
            <Button
              variant={showTimeline ? "default" : "ghost"}
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowTimeline(!showTimeline)}
              title="일별 추이"
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </Button>

            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Custom date inputs */}
        {dateRange === "custom" && (
          <div className="flex items-center gap-2 mb-3">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-7 text-xs w-36"
            />
            <span className="text-xs text-muted-foreground">~</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-7 text-xs w-36"
            />
          </div>
        )}

        {!collapsed && (
          <div className="space-y-3">
            {/* Date range context */}
            {dateRange !== "all" && totalData && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <BarChart3 className="w-3 h-3" />
                <span>{rangeLabel}: <strong className="text-foreground">{data.total}명</strong> 배정</span>
                <span className="text-muted-foreground/50">|</span>
                <span>전체: {totalData.total}명</span>
              </div>
            )}

            {/* Pipeline bar — main funnel visualization */}
            <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
              {pipelineStatuses.map((s, i) => {
                const count = data.statusCounts[s.value] ?? 0;
                const totalCount = totalData ? (totalData.statusCounts[s.value] ?? 0) : null;
                const pct = data.total > 0 ? Math.round(count / data.total * 100) : 0;
                return (
                  <div key={s.value} className="flex items-center">
                    <div className="flex flex-col items-center min-w-[52px]">
                      <div
                        className="text-sm font-bold leading-tight"
                        style={{ color: s.color }}
                      >
                        {count}
                      </div>
                      {totalCount !== null && count !== totalCount && (
                        <div className="text-[8px] text-muted-foreground/60">/{totalCount}</div>
                      )}
                      <div className="text-[9px] text-muted-foreground whitespace-nowrap leading-tight">
                        {getFunnelStatusLabel(s.value, campaignType ?? undefined)}
                      </div>
                      {data.total > 0 && (
                        <div className="w-full h-1 bg-muted rounded-full mt-0.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: s.color }}
                          />
                        </div>
                      )}
                    </div>
                    {i < pipelineStatuses.length - 1 && (
                      <div className="text-muted-foreground/30 text-[10px] mx-0">&rsaquo;</div>
                    )}
                  </div>
                );
              })}

              {/* Terminal statuses */}
              <div className="flex items-center ml-2 pl-2 border-l border-border">
                {terminalStatuses.map((s) => {
                  const count = data.statusCounts[s.value] ?? 0;
                  if (count === 0) return null;
                  return (
                    <div key={s.value} className="flex flex-col items-center min-w-[40px]">
                      <div className="text-xs font-medium" style={{ color: s.color }}>{count}</div>
                      <div className="text-[9px] text-muted-foreground whitespace-nowrap">{s.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Daily timeline (mini sparkline) */}
            {showTimeline && data.dailyCounts && (
              <DailyTimeline
                dailyCounts={data.dailyCounts}
                outreachDaily={data.outreachDaily ?? {}}
                replyDaily={data.replyDaily ?? {}}
              />
            )}

            {/* Financial cards + Bottlenecks — compact row */}
            <div className="flex items-center gap-3">
              {/* Financial pills */}
              <div className="flex items-center gap-1.5 flex-1">
                {[
                  { label: "지급예정", value: data.financials.totalPayment, color: "text-blue-500" },
                  { label: "청구예정", value: data.financials.totalInvoice, color: "text-violet-500" },
                  { label: "지급완료", value: data.financials.paidToInfluencers, color: "text-emerald-500" },
                  { label: "수금완료", value: data.financials.receivedFromClients, color: "text-amber-500" },
                ].map((card) => (
                  <div key={card.label} className="bg-muted/50 rounded px-2 py-1 text-center flex-1">
                    <div className="text-[9px] text-muted-foreground leading-tight">{card.label}</div>
                    <div className={`text-[11px] font-bold ${card.color} flex items-center justify-center gap-0.5`}>
                      <DollarSign className="w-2.5 h-2.5" />
                      {fmtMoney(card.value)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottlenecks pills */}
              {totalBottlenecks > 0 && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  {data.bottlenecks.noReply > 0 && (
                    <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px]">
                      미회신 {data.bottlenecks.noReply}
                    </span>
                  )}
                  {data.bottlenecks.awaitingClient > 0 && (
                    <span className="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded text-[10px]">
                      거래처대기 {data.bottlenecks.awaitingClient}
                    </span>
                  )}
                  {data.bottlenecks.overdueVisit > 0 && (
                    <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-[10px]">
                      방문지연 {data.bottlenecks.overdueVisit}
                    </span>
                  )}
                  {data.bottlenecks.overdueUpload > 0 && (
                    <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-[10px]">
                      업로드지연 {data.bottlenecks.overdueUpload}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Mini daily timeline showing assignment/outreach/reply counts per day */
function DailyTimeline({
  dailyCounts,
  outreachDaily,
  replyDaily,
}: {
  dailyCounts: Record<string, Record<string, number>>;
  outreachDaily: Record<string, number>;
  replyDaily: Record<string, number>;
}) {
  // Merge all dates and sort
  const allDates = useMemo(() => {
    const dates = new Set<string>();
    Object.keys(dailyCounts).forEach((d) => dates.add(d));
    Object.keys(outreachDaily).forEach((d) => dates.add(d));
    Object.keys(replyDaily).forEach((d) => dates.add(d));
    return Array.from(dates).sort().slice(-14); // Last 14 days
  }, [dailyCounts, outreachDaily, replyDaily]);

  if (allDates.length === 0) return null;

  // Find max for scaling
  const maxVal = useMemo(() => {
    let max = 1;
    for (const d of allDates) {
      const assigned = Object.values(dailyCounts[d] ?? {}).reduce((a, b) => a + b, 0);
      const outreach = outreachDaily[d] ?? 0;
      const reply = replyDaily[d] ?? 0;
      max = Math.max(max, assigned, outreach, reply);
    }
    return max;
  }, [allDates, dailyCounts, outreachDaily, replyDaily]);

  return (
    <div className="border border-border rounded-lg p-2">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[10px] font-medium text-muted-foreground">일별 추이 (최근 14일)</span>
        <div className="flex items-center gap-2 text-[9px]">
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-blue-400" />배정</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-violet-400" />발송</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-emerald-400" />회신</span>
        </div>
      </div>
      <div className="flex items-end gap-px h-12">
        {allDates.map((date) => {
          const assigned = Object.values(dailyCounts[date] ?? {}).reduce((a, b) => a + b, 0);
          const outreach = outreachDaily[date] ?? 0;
          const reply = replyDaily[date] ?? 0;
          const dayOfWeek = new Date(date).getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          return (
            <div
              key={date}
              className={`flex-1 flex flex-col items-center gap-px ${isWeekend ? "opacity-60" : ""}`}
              title={`${date}\n배정: ${assigned}, 발송: ${outreach}, 회신: ${reply}`}
            >
              <div className="flex items-end gap-px w-full" style={{ height: 32 }}>
                <div
                  className="flex-1 bg-blue-400 rounded-t-sm min-h-0"
                  style={{ height: `${Math.max(assigned > 0 ? 2 : 0, (assigned / maxVal) * 32)}px` }}
                />
                <div
                  className="flex-1 bg-violet-400 rounded-t-sm min-h-0"
                  style={{ height: `${Math.max(outreach > 0 ? 2 : 0, (outreach / maxVal) * 32)}px` }}
                />
                <div
                  className="flex-1 bg-emerald-400 rounded-t-sm min-h-0"
                  style={{ height: `${Math.max(reply > 0 ? 2 : 0, (reply / maxVal) * 32)}px` }}
                />
              </div>
              <span className="text-[7px] text-muted-foreground leading-none">
                {date.slice(8)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
