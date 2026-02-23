"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CampaignSelector } from "@/components/campaign-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useRealtime } from "@/hooks/use-realtime";
import {
  CheckCircle,
  Send,
  RefreshCw,
  Loader2,
  Mail,
  Eye,
  MousePointerClick,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";

type EmailLog = Tables<"email_logs"> & {
  influencer?: Tables<"influencers">;
  template?: Tables<"email_templates">;
};

const statusConfig: Record<string, { label: string; color: string }> = {
  queued: { label: "대기", color: "bg-muted text-muted-foreground" },
  sent: { label: "발송됨", color: "bg-blue-500/10 text-blue-500" },
  delivered: { label: "전달됨", color: "bg-green-500/10 text-green-500" },
  opened: { label: "열람됨", color: "bg-purple-500/10 text-purple-500" },
  clicked: { label: "클릭됨", color: "bg-indigo-500/10 text-indigo-500" },
  bounced: { label: "바운스", color: "bg-destructive/10 text-destructive" },
  failed: { label: "실패", color: "bg-destructive/10 text-destructive" },
};

interface RoundSummary {
  round: number;
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  failed: number;
}

export default function EmailLogsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">로딩 중...</div>}>
      <EmailLogsPageContent />
    </Suspense>
  );
}

function EmailLogsPageContent() {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const supabase = createClient();

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [campaigns, setCampaigns] = useState<Tables<"campaigns">[]>([]);
  const [loading, setLoading] = useState(true);
  const [roundFilter, setRoundFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [resending, setResending] = useState(false);

  // Fetch campaigns list for name mapping
  useEffect(() => {
    async function fetchCampaigns() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberData } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (!memberData) return;
      const { data } = await supabase
        .from("campaigns")
        .select("*")
        .eq("team_id", memberData.team_id)
        .order("created_at", { ascending: false });
      if (data) setCampaigns(data as Tables<"campaigns">[]);
    }
    fetchCampaigns();
  }, []);

  const campaignMap = useMemo(
    () => new Map(campaigns.map((c) => [c.id, c.name])),
    [campaigns]
  );

  useEffect(() => {
    fetchLogs();
  }, [campaignId]);

  const fetchLogsCallback = useCallback(() => fetchLogs(), [campaignId]);

  useRealtime(
    "email_logs",
    campaignId ? `campaign_id=eq.${campaignId}` : undefined,
    fetchLogsCallback
  );

  async function fetchLogs() {
    setLoading(true);
    let query = supabase
      .from("email_logs")
      .select(
        `
        *,
        influencer:influencers(id, username, display_name, email, platform),
        template:email_templates(subject, round_number)
      `
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    const { data, error } = await query;

    if (!error) {
      setLogs((data as unknown as EmailLog[]) ?? []);
    }
    setLoading(false);
  }

  // Compute per-round summaries
  const roundSummaries = useMemo(() => {
    const roundMap = new Map<number, RoundSummary>();

    for (const log of logs) {
      const r = log.round_number;
      if (!roundMap.has(r)) {
        roundMap.set(r, {
          round: r,
          total: 0,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
          bounced: 0,
          failed: 0,
        });
      }
      const summary = roundMap.get(r)!;
      summary.total++;

      if (
        log.status === "sent" ||
        log.status === "delivered" ||
        log.status === "opened" ||
        log.status === "clicked"
      ) {
        summary.sent++;
      }
      if (
        log.status === "delivered" ||
        log.status === "opened" ||
        log.status === "clicked"
      ) {
        summary.delivered++;
      }
      if (log.opened_at) summary.opened++;
      if (log.clicked_at) summary.clicked++;
      if (log.replied_at) summary.replied++;
      if (log.status === "bounced") summary.bounced++;
      if (log.status === "failed") summary.failed++;
    }

    return Array.from(roundMap.values()).sort((a, b) => a.round - b.round);
  }, [logs]);

  // Determine the next round number
  const maxRound = useMemo(() => {
    if (logs.length === 0) return 0;
    return Math.max(...logs.map((l) => l.round_number));
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs
      .filter(
        (l) =>
          roundFilter === "all" || l.round_number === parseInt(roundFilter)
      )
      .filter((l) => statusFilter === "all" || l.status === statusFilter);
  }, [logs, roundFilter, statusFilter]);

  // Failed/bounced logs for bulk re-send
  const failedBouncedLogs = useMemo(() => {
    return filteredLogs.filter(
      (l) => l.status === "bounced" || l.status === "failed"
    );
  }, [filteredLogs]);

  function toggleLogSelection(id: string) {
    setSelectedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllFailedBounced() {
    if (selectedLogs.size === failedBouncedLogs.length) {
      setSelectedLogs(new Set());
    } else {
      setSelectedLogs(new Set(failedBouncedLogs.map((l) => l.id)));
    }
  }

  async function handleResendFailed() {
    if (selectedLogs.size === 0) {
      toast.error("재발송할 로그를 선택하세요.");
      return;
    }

    setResending(true);
    try {
      // Gather influencer IDs and their template IDs from selected failed logs
      const logsToResend = logs.filter((l) => selectedLogs.has(l.id));
      // Group by template
      const templateGroups = new Map<
        string,
        { templateId: string; influencerIds: string[]; roundNumber: number; campaignId: string }
      >();
      for (const log of logsToResend) {
        if (!log.template_id) continue;
        const key = `${log.template_id}__${log.campaign_id}`;
        if (!templateGroups.has(key)) {
          templateGroups.set(key, {
            templateId: log.template_id,
            influencerIds: [],
            roundNumber: log.round_number,
            campaignId: log.campaign_id,
          });
        }
        templateGroups.get(key)!.influencerIds.push(log.influencer_id);
      }

      let totalSent = 0;
      for (const group of templateGroups.values()) {
        const response = await fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaign_id: group.campaignId,
            template_id: group.templateId,
            influencer_ids: group.influencerIds,
            round_number: group.roundNumber,
          }),
        });
        const result = await response.json();
        if (response.ok) {
          totalSent += result.sent;
        }
      }

      toast.success(`${totalSent}건 재발송 완료`);
      setSelectedLogs(new Set());
      fetchLogs();
    } catch {
      toast.error("재발송 중 오류가 발생했습니다.");
    }
    setResending(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">발송 로그</h2>
        <div className="flex items-center gap-2">
          <CampaignSelector mode="filter" value={campaignId} onChange={setCampaignId} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Badge variant="secondary">{logs.length}건</Badge>
        {campaignId && maxRound > 0 && (
          <Link href={`/email/send?campaign=${campaignId}`}>
            <Button variant="outline" size="sm">
              <Send className="w-4 h-4 mr-1" />
              {maxRound + 1}회차 자동 발송
            </Button>
          </Link>
        )}
      </div>

      {/* Per-round summary */}
      {roundSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">회차별 발송 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roundSummaries.map((summary) => {
                const openRate =
                  summary.sent > 0
                    ? Math.round((summary.opened / summary.sent) * 100)
                    : 0;
                const replyRate =
                  summary.sent > 0
                    ? Math.round((summary.replied / summary.sent) * 100)
                    : 0;

                return (
                  <div key={summary.round} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {summary.round}회차
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {summary.total}명 발송
                      </span>
                    </div>
                    {/* Stats bar */}
                    <div className="flex items-center gap-1 h-6 rounded-md overflow-hidden bg-muted">
                      {summary.sent > 0 && (
                        <>
                          {summary.opened > 0 && (
                            <div
                              className="h-full bg-purple-400 flex items-center justify-center"
                              style={{
                                width: `${(summary.opened / summary.total) * 100}%`,
                                minWidth: summary.opened > 0 ? "24px" : "0",
                              }}
                            >
                              <span className="text-[10px] text-white font-medium">
                                {summary.opened}
                              </span>
                            </div>
                          )}
                          {summary.replied > 0 && (
                            <div
                              className="h-full bg-green-400 flex items-center justify-center"
                              style={{
                                width: `${(summary.replied / summary.total) * 100}%`,
                                minWidth: summary.replied > 0 ? "24px" : "0",
                              }}
                            >
                              <span className="text-[10px] text-white font-medium">
                                {summary.replied}
                              </span>
                            </div>
                          )}
                          {summary.bounced + summary.failed > 0 && (
                            <div
                              className="h-full bg-red-400 flex items-center justify-center"
                              style={{
                                width: `${((summary.bounced + summary.failed) / summary.total) * 100}%`,
                                minWidth:
                                  summary.bounced + summary.failed > 0
                                    ? "24px"
                                    : "0",
                              }}
                            >
                              <span className="text-[10px] text-white font-medium">
                                {summary.bounced + summary.failed}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        발송 {summary.sent}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-purple-500" />
                        열람 {summary.opened} ({openRate}%)
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3 text-indigo-500" />
                        클릭 {summary.clicked}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-green-500" />
                        회신 {summary.replied} ({replyRate}%)
                      </span>
                      {summary.bounced + summary.failed > 0 && (
                        <span className="text-red-500">
                          실패 {summary.bounced + summary.failed}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Round + Status Filter */}
      <div className="flex gap-3">
        <Select value={roundFilter} onValueChange={setRoundFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="회차" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 회차</SelectItem>
            {Array.from(new Set(logs.map((l) => l.round_number)))
              .sort()
              .map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r}회차
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {Object.entries(statusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Object.entries(statusConfig).map(([key, config]) => {
          const count = filteredLogs.filter((l) => l.status === key).length;
          return (
            <Card key={key}>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">{config.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bulk action for failed/bounced */}
      {failedBouncedLogs.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <span className="text-sm text-destructive">
            실패/바운스: {failedBouncedLogs.length}건
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={selectAllFailedBounced}
          >
            {selectedLogs.size === failedBouncedLogs.length
              ? "선택 해제"
              : "전체 선택"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleResendFailed}
            disabled={resending || selectedLogs.size === 0}
          >
            {resending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            {selectedLogs.size}건 재발송
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  {failedBouncedLogs.length > 0 && (
                    <Checkbox
                      checked={
                        failedBouncedLogs.length > 0 &&
                        selectedLogs.size === failedBouncedLogs.length
                      }
                      onCheckedChange={selectAllFailedBounced}
                    />
                  )}
                </TableHead>
                {!campaignId && <TableHead>캠페인</TableHead>}
                <TableHead>인플루언서</TableHead>
                <TableHead>회차</TableHead>
                <TableHead>제목</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>발송일</TableHead>
                <TableHead>열람</TableHead>
                <TableHead>클릭</TableHead>
                <TableHead>CTA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={!campaignId ? 10 : 9}
                    className="text-center py-8 text-muted-foreground"
                  >
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={!campaignId ? 10 : 9}
                    className="text-center py-8 text-muted-foreground"
                  >
                    발송 로그가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => {
                  const sc = statusConfig[log.status] ?? {
                    label: log.status,
                    color: "",
                  };
                  const isFailedBounced =
                    log.status === "bounced" || log.status === "failed";

                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        {isFailedBounced && (
                          <Checkbox
                            checked={selectedLogs.has(log.id)}
                            onCheckedChange={() => toggleLogSelection(log.id)}
                          />
                        )}
                      </TableCell>
                      {!campaignId && (
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {campaignMap.get(log.campaign_id) ?? "알 수 없음"}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="font-medium">
                          {(
                            log.influencer as unknown as Tables<"influencers">
                          )?.display_name ??
                            (
                              log.influencer as unknown as Tables<"influencers">
                            )?.username ??
                            "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {log.round_number}회차
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {(
                          log.template as unknown as Tables<"email_templates">
                        )?.subject ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={sc.color} variant="secondary">
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.sent_at
                          ? new Date(log.sent_at).toLocaleString("ko-KR")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.opened_at
                          ? new Date(log.opened_at).toLocaleString("ko-KR")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.clicked_at
                          ? new Date(log.clicked_at).toLocaleString("ko-KR")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {log.cta_clicked ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
