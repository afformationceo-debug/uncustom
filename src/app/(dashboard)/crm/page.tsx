"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeftRight,
  Building2,
  Users,
  CalendarCheck,
  Pill,
  Bot,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCcw,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type PhaseResult = {
  phase: string;
  created?: number;
  matched?: number;
  updated?: number;
  skipped?: number;
  total?: number;
  errors?: string[];
  // automation-specific
  keywords?: number;
  templates?: number;
  dmHistory?: number;
  snsAccounts?: number;
  // nested results
  results?: Record<string, PhaseResult>;
};

type MigrationStatus = {
  migrated: {
    campaigns: number;
    influencers: number;
    campaign_influencers: number;
    procedures: number;
  };
  syncLogSummary: Record<string, Record<string, number>>;
  recentLogs: Array<{
    id: string;
    direction: string;
    entity_type: string;
    crm_id: number | null;
    action: string;
    details: Record<string, unknown> | null;
    synced_at: string;
  }>;
};

type VerifyResult = {
  verification: {
    crm: Record<string, number>;
    uncustom: Record<string, number>;
    syncLog: Record<string, number>;
  };
};

const PHASES: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  api: string;
  desc: string;
  method: string;
  body?: Record<string, unknown>;
}[] = [
  {
    id: "hospitals",
    label: "병원 → 캠페인",
    icon: Building2,
    api: "/api/crm/migrate/hospitals",
    desc: "CRM 병원 데이터를 캠페인으로 마이그레이션",
    method: "POST",
  },
  {
    id: "influencers",
    label: "인플루언서 통합",
    icon: Users,
    api: "/api/crm/migrate/influencers",
    desc: "CRM 사용자 + 자동화 크롤링 데이터 → 인플루언서",
    method: "POST",
    body: { source: "all" },
  },
  {
    id: "reservations",
    label: "예약 → 퍼널",
    icon: CalendarCheck,
    api: "/api/crm/migrate/reservations",
    desc: "예약/리뷰/결제 → campaign_influencers (6,184건)",
    method: "POST",
  },
  {
    id: "automation",
    label: "자동화 데이터",
    icon: Bot,
    api: "/api/crm/migrate/automation",
    desc: "키워드, 템플릿, DM 히스토리 마이그레이션",
    method: "POST",
  },
];

export default function CrmPage() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [phaseResults, setPhaseResults] = useState<Record<string, PhaseResult>>({});
  const [runningPhase, setRunningPhase] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/migrate/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const runPhase = async (phaseId: string, api: string, method: string, body?: unknown) => {
    setRunningPhase(phaseId);
    try {
      const res = await fetch(api, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      setPhaseResults((prev) => ({ ...prev, [phaseId]: data }));
      // Refresh status
      await fetchStatus();
    } catch (err) {
      setPhaseResults((prev) => ({
        ...prev,
        [phaseId]: { phase: phaseId, errors: [(err as Error).message] },
      }));
    } finally {
      setRunningPhase(null);
    }
  };

  const runVerify = async () => {
    setRunningPhase("verify");
    try {
      const res = await fetch("/api/crm/migrate/verify", { method: "POST" });
      const data = await res.json();
      setVerifyResult(data);
    } finally {
      setRunningPhase(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM 연동</h1>
          <p className="text-sm text-muted-foreground mt-1">
            MySQL CRM (afformation_system + automation) 양방향 마이그레이션 관리
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            <span className="ml-1.5">상태 새로고침</span>
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusCard label="캠페인 (병원)" value={status.migrated.campaigns} icon={Building2} />
          <StatusCard label="인플루언서" value={status.migrated.influencers} icon={Users} />
          <StatusCard label="예약 (퍼널)" value={status.migrated.campaign_influencers} icon={CalendarCheck} />
          <StatusCard label="시술 카탈로그" value={status.migrated.procedures} icon={Pill} />
        </div>
      )}

      {/* Migration Phases */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            마이그레이션 Phase 실행
          </CardTitle>
          <CardDescription>
            각 Phase를 순서대로 실행하세요. 중복 실행해도 안전합니다 (idempotent).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PHASES.map((phase) => {
            const result = phaseResults[phase.id];
            const isRunning = runningPhase === phase.id;

            return (
              <div
                key={phase.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <phase.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{phase.label}</div>
                    <div className="text-xs text-muted-foreground">{phase.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {result && <PhaseResultBadge result={result} />}
                  <Button
                    size="sm"
                    variant={result ? "outline" : "default"}
                    disabled={isRunning || (runningPhase !== null && runningPhase !== phase.id)}
                    onClick={() => runPhase(phase.id, phase.api, phase.method, phase.body)}
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        실행 중...
                      </>
                    ) : result ? (
                      "재실행"
                    ) : (
                      "실행"
                    )}
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Verify */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium">데이터 검증</div>
                <div className="text-xs text-muted-foreground">CRM ↔ Uncustom 카운트 비교 + 정합성</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={runningPhase === "verify"}
              onClick={runVerify}
            >
              {runningPhase === "verify" ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  검증 중...
                </>
              ) : (
                "검증 실행"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Verification Results */}
      {verifyResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">검증 결과</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-2">CRM (MySQL)</h4>
                <div className="space-y-1">
                  {Object.entries(verifyResult.verification.crm).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-mono">{val.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Uncustom (Supabase)</h4>
                <div className="space-y-1">
                  {Object.entries(verifyResult.verification.uncustom).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-mono">{val.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {Object.keys(verifyResult.verification.syncLog).length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Sync Log 요약</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(verifyResult.verification.syncLog).map(([key, val]) => (
                    <Badge key={key} variant="secondary" className="text-xs font-mono">
                      {key}: {val}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Sync Logs */}
      {status && status.recentLogs && status.recentLogs.length > 0 && (
        <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
          <Card>
            <CardHeader className="pb-2">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <CardTitle className="text-lg">최근 동기화 로그</CardTitle>
                <ChevronDown className={`w-4 h-4 transition-transform ${logsOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-1.5 pr-3">방향</th>
                        <th className="py-1.5 pr-3">유형</th>
                        <th className="py-1.5 pr-3">CRM ID</th>
                        <th className="py-1.5 pr-3">액션</th>
                        <th className="py-1.5 pr-3">시간</th>
                        <th className="py-1.5">상세</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.recentLogs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0">
                          <td className="py-1.5 pr-3">
                            <Badge variant={log.direction === "crm_to_uncustom" ? "default" : "secondary"} className="text-[10px]">
                              {log.direction === "crm_to_uncustom" ? "CRM→UC" : "UC→CRM"}
                            </Badge>
                          </td>
                          <td className="py-1.5 pr-3 font-mono">{log.entity_type}</td>
                          <td className="py-1.5 pr-3 font-mono">{log.crm_id ?? "-"}</td>
                          <td className="py-1.5 pr-3">
                            <Badge
                              variant={
                                log.action === "error"
                                  ? "destructive"
                                  : log.action === "created"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {log.action}
                            </Badge>
                          </td>
                          <td className="py-1.5 pr-3 text-muted-foreground">
                            {new Date(log.synced_at).toLocaleString("ko-KR")}
                          </td>
                          <td className="py-1.5 text-muted-foreground truncate max-w-48">
                            {log.details ? JSON.stringify(log.details).slice(0, 80) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Empty State */}
      {!status && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ArrowLeftRight className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <h3 className="text-sm font-medium mb-1">마이그레이션 상태를 확인하세요</h3>
            <p className="text-xs text-muted-foreground mb-4">
              &quot;상태 새로고침&quot; 버튼을 클릭하여 현재 마이그레이션 진행 상황을 확인합니다.
            </p>
            <Button variant="outline" size="sm" onClick={fetchStatus}>
              상태 새로고침
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-4 pb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PhaseResultBadge({ result }: { result: PhaseResult }) {
  const hasErrors = result.errors && result.errors.length > 0;

  if (hasErrors) {
    return (
      <Badge variant="destructive" className="text-[10px]">
        <AlertCircle className="w-3 h-3 mr-0.5" />
        {result.errors!.length} errors
      </Badge>
    );
  }

  const parts: string[] = [];
  if (result.created) parts.push(`+${result.created}`);
  if (result.matched) parts.push(`=${result.matched}`);
  if (result.updated) parts.push(`~${result.updated}`);
  if (result.skipped) parts.push(`-${result.skipped}`);
  if (result.keywords) parts.push(`kw:${result.keywords}`);
  if (result.templates) parts.push(`tpl:${result.templates}`);
  if (result.dmHistory) parts.push(`dm:${result.dmHistory}`);

  // Check nested results
  if (result.results) {
    for (const [key, sub] of Object.entries(result.results)) {
      const subParts: string[] = [];
      if (sub.created) subParts.push(`+${sub.created}`);
      if (sub.matched) subParts.push(`=${sub.matched}`);
      if (subParts.length) parts.push(`${key}(${subParts.join("/")})`);
    }
  }

  return (
    <Badge variant="secondary" className="text-[10px] font-mono">
      <CheckCircle2 className="w-3 h-3 mr-0.5 text-green-500" />
      {parts.join(" | ") || "OK"}
    </Badge>
  );
}
