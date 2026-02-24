"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, AlertTriangle, DollarSign } from "lucide-react";
import { FUNNEL_STATUSES, getFunnelStatusLabel } from "@/types/platform";

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
}

interface FunnelSummaryProps {
  campaignId: string | null;
  campaignType?: string | null;
  refreshKey?: number;
}

export function FunnelSummary({ campaignId, campaignType, refreshKey }: FunnelSummaryProps) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const url = campaignId
        ? `/api/manage/summary?campaign_id=${campaignId}`
        : `/api/manage/summary`;
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }, [campaignId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshKey]);

  if (!data) return null;

  const fmtMoney = (n: number) => `₩${n.toLocaleString()}`;
  const pipelineStatuses = FUNNEL_STATUSES.filter((s) => s.group !== "terminal");
  const totalBottlenecks = data.bottlenecks.noReply + data.bottlenecks.awaitingClient + data.bottlenecks.overdueVisit + data.bottlenecks.overdueUpload;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">퍼널 요약</h3>
            {totalBottlenecks > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-500">
                <AlertTriangle className="w-3.5 h-3.5" />
                병목 {totalBottlenecks}건
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>

        {!collapsed && (
          <div className="space-y-4">
            {/* Pipeline bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {pipelineStatuses.map((s, i) => {
                const count = data.statusCounts[s.value] ?? 0;
                return (
                  <div key={s.value} className="flex items-center">
                    <div className="flex flex-col items-center min-w-[56px]">
                      <div
                        className="text-sm font-bold"
                        style={{ color: s.color }}
                      >
                        {count}
                      </div>
                      <div className="text-[10px] text-muted-foreground whitespace-nowrap">{getFunnelStatusLabel(s.value, campaignType ?? undefined)}</div>
                    </div>
                    {i < pipelineStatuses.length - 1 && (
                      <div className="text-muted-foreground/40 text-xs mx-0.5">&rarr;</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Financial cards */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "지급 예정", value: data.financials.totalPayment, color: "text-blue-500" },
                { label: "청구 예정", value: data.financials.totalInvoice, color: "text-violet-500" },
                { label: "인플 지급완료", value: data.financials.paidToInfluencers, color: "text-emerald-500" },
                { label: "거래처 수금", value: data.financials.receivedFromClients, color: "text-amber-500" },
              ].map((card) => (
                <div key={card.label} className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-muted-foreground">{card.label}</div>
                  <div className={`text-sm font-bold ${card.color} flex items-center justify-center gap-0.5`}>
                    <DollarSign className="w-3 h-3" />
                    {fmtMoney(card.value)}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottlenecks */}
            {totalBottlenecks > 0 && (
              <div className="flex gap-3 text-xs">
                {data.bottlenecks.noReply > 0 && (
                  <span className="text-amber-500">미회신 {data.bottlenecks.noReply}</span>
                )}
                {data.bottlenecks.awaitingClient > 0 && (
                  <span className="text-orange-500">거래처 대기 {data.bottlenecks.awaitingClient}</span>
                )}
                {data.bottlenecks.overdueVisit > 0 && (
                  <span className="text-red-500">방문 지연 {data.bottlenecks.overdueVisit}</span>
                )}
                {data.bottlenecks.overdueUpload > 0 && (
                  <span className="text-red-500">업로드 지연 {data.bottlenecks.overdueUpload}</span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
