"use client";

import { useEffect, useState, useMemo, useCallback, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CampaignSelector } from "@/components/campaign-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Send,
  Loader2,
  Filter,
  Eye,
  Mail,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { useRealtime } from "@/hooks/use-realtime";
import DOMPurify from "dompurify";

type Influencer = Tables<"influencers">;
type EmailTemplate = Tables<"email_templates">;
type EmailLog = Tables<"email_logs">;

type QuickFilter = "all" | "unopened" | "unreplied";

interface SendResult {
  sent: number;
  total: number;
  failed: number;
}

export default function EmailSendPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">로딩 중...</div>}>
      <EmailSendPageContent />
    </Suspense>
  );
}

function EmailSendPageContent() {
  const searchParams = useSearchParams();
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const supabase = createClient();

  const [allInfluencers, setAllInfluencers] = useState<Influencer[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedInfluencers, setSelectedInfluencers] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Track whether we've applied the URL pre-selection
  const preselectedApplied = useRef(false);

  // N-Round state
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  // Dialog state
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (campaignId) {
      preselectedApplied.current = false;
      fetchData();
    } else {
      setAllInfluencers([]);
      setTemplates([]);
      setEmailLogs([]);
      setSelectedInfluencers(new Set());
      setLoading(false);
    }
  }, [campaignId]);

  // Pre-select influencers from ?selected= URL param after data loads
  useEffect(() => {
    if (preselectedApplied.current || loading || allInfluencers.length === 0) return;
    const selectedParam = searchParams.get("selected");
    if (selectedParam) {
      const ids = selectedParam.split(",").filter(Boolean);
      const validIds = ids.filter((id) =>
        allInfluencers.some((inf) => inf.id === id)
      );
      if (validIds.length > 0) {
        setSelectedInfluencers(new Set(validIds));
      }
    }
    preselectedApplied.current = true;
  }, [loading, allInfluencers, searchParams]);

  const realtimeCallback = useCallback(() => {
    if (campaignId) fetchData();
  }, [campaignId]);
  useRealtime(
    "email_logs",
    campaignId ? `campaign_id=eq.${campaignId}` : undefined,
    realtimeCallback
  );

  // Auto-select template when round changes
  useEffect(() => {
    const roundTemplate = templates.find(
      (t) => t.round_number === selectedRound
    );
    if (roundTemplate) {
      setSelectedTemplate(roundTemplate.id);
    } else {
      setSelectedTemplate("");
    }
  }, [selectedRound, templates]);

  // Clear selection when round or quick filter changes (skip initial render to preserve URL pre-selection)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setSelectedInfluencers(new Set());
  }, [selectedRound, quickFilter]);

  async function fetchData() {
    if (!campaignId) return;
    setLoading(true);

    const { data: ciData } = await supabase
      .from("campaign_influencers")
      .select("influencer_id")
      .eq("campaign_id", campaignId);

    if (ciData && ciData.length > 0) {
      const ids = ciData.map((ci) => ci.influencer_id);
      const { data } = await supabase
        .from("influencers")
        .select("*")
        .in("id", ids)
        .not("email", "is", null)
        .order("follower_count", { ascending: false });
      setAllInfluencers((data as Influencer[]) ?? []);
    } else {
      setAllInfluencers([]);
    }

    const { data: tmplData } = await supabase
      .from("email_templates")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("round_number", { ascending: true });
    setTemplates((tmplData as EmailTemplate[]) ?? []);

    const { data: logData } = await supabase
      .from("email_logs")
      .select("*")
      .eq("campaign_id", campaignId);
    setEmailLogs((logData as EmailLog[]) ?? []);

    setLoading(false);
  }

  const availableRounds = useMemo(() => {
    const rounds = templates.map((t) => t.round_number);
    return Array.from(new Set(rounds)).sort((a, b) => a - b);
  }, [templates]);

  const roundStats = useMemo(() => {
    const logsForPrevRound = emailLogs.filter(
      (l) => l.round_number === selectedRound - 1
    );
    const logsForCurrentRound = emailLogs.filter(
      (l) => l.round_number === selectedRound
    );

    const sentInCurrentRound = new Set(
      logsForCurrentRound.map((l) => l.influencer_id)
    );

    const repliedIds = new Set(
      emailLogs.filter((l) => l.replied_at !== null).map((l) => l.influencer_id)
    );

    let eligibleInfluencers: Influencer[];

    if (selectedRound === 1) {
      eligibleInfluencers = allInfluencers.filter(
        (inf) => !sentInCurrentRound.has(inf.id) && !repliedIds.has(inf.id)
      );
    } else {
      const prevRoundSentIds = new Set(
        logsForPrevRound.map((l) => l.influencer_id)
      );
      const prevRoundOpenedIds = new Set(
        logsForPrevRound
          .filter((l) => l.opened_at !== null)
          .map((l) => l.influencer_id)
      );
      const prevRoundRepliedIds = new Set(
        logsForPrevRound
          .filter((l) => l.replied_at !== null)
          .map((l) => l.influencer_id)
      );

      eligibleInfluencers = allInfluencers.filter(
        (inf) =>
          prevRoundSentIds.has(inf.id) &&
          !prevRoundOpenedIds.has(inf.id) &&
          !prevRoundRepliedIds.has(inf.id) &&
          !sentInCurrentRound.has(inf.id) &&
          !repliedIds.has(inf.id)
      );
    }

    const unopenedIds = new Set<string>();
    const unrepliedIds = new Set<string>();

    for (const inf of eligibleInfluencers) {
      const infLogs = emailLogs.filter(
        (l) => l.influencer_id === inf.id && l.round_number < selectedRound
      );
      const hasOpened = infLogs.some((l) => l.opened_at !== null);
      const hasReplied = infLogs.some((l) => l.replied_at !== null);

      if (!hasOpened) unopenedIds.add(inf.id);
      if (!hasReplied) unrepliedIds.add(inf.id);
    }

    return {
      eligibleInfluencers,
      unopenedIds,
      unrepliedIds,
      total: eligibleInfluencers.length,
      unopenedCount: unopenedIds.size,
      unrepliedCount: unrepliedIds.size,
    };
  }, [allInfluencers, emailLogs, selectedRound]);

  const filteredInfluencers = useMemo(() => {
    const { eligibleInfluencers, unopenedIds, unrepliedIds } = roundStats;

    switch (quickFilter) {
      case "unopened":
        return eligibleInfluencers.filter((inf) => unopenedIds.has(inf.id));
      case "unreplied":
        return eligibleInfluencers.filter((inf) => unrepliedIds.has(inf.id));
      default:
        return eligibleInfluencers;
    }
  }, [roundStats, quickFilter]);

  const currentTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplate) ?? null,
    [templates, selectedTemplate]
  );

  const previewHtml = useMemo(() => {
    if (!currentTemplate) return "";
    const firstInfId = Array.from(selectedInfluencers)[0];
    const inf = firstInfId
      ? allInfluencers.find((i) => i.id === firstInfId)
      : filteredInfluencers[0];
    if (!inf) return currentTemplate.body_html;

    let html = currentTemplate.body_html;
    html = html.replace(
      /\{\{name\}\}/g,
      inf.display_name ?? inf.username ?? ""
    );
    html = html.replace(/\{\{username\}\}/g, inf.username ?? "");
    html = html.replace(/\{\{email\}\}/g, inf.email ?? "");
    return html;
  }, [
    currentTemplate,
    selectedInfluencers,
    allInfluencers,
    filteredInfluencers,
  ]);

  const previewSubject = useMemo(() => {
    if (!currentTemplate) return "";
    const firstInfId = Array.from(selectedInfluencers)[0];
    const inf = firstInfId
      ? allInfluencers.find((i) => i.id === firstInfId)
      : filteredInfluencers[0];
    if (!inf) return currentTemplate.subject;

    let subject = currentTemplate.subject;
    subject = subject.replace(
      /\{\{name\}\}/g,
      inf.display_name ?? inf.username ?? ""
    );
    return subject;
  }, [
    currentTemplate,
    selectedInfluencers,
    allInfluencers,
    filteredInfluencers,
  ]);

  function toggleInfluencer(id: string) {
    setSelectedInfluencers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedInfluencers.size === filteredInfluencers.length) {
      setSelectedInfluencers(new Set());
    } else {
      setSelectedInfluencers(new Set(filteredInfluencers.map((i) => i.id)));
    }
  }

  function handleSendClick() {
    if (!selectedTemplate) {
      toast.error("템플릿을 선택하세요.");
      return;
    }
    if (selectedInfluencers.size === 0) {
      toast.error("발송할 인플루언서를 선택하세요.");
      return;
    }
    setShowConfirm(true);
  }

  async function handleSendConfirm() {
    setShowConfirm(false);
    setSending(true);
    setSendResult(null);

    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          template_id: selectedTemplate,
          influencer_ids: Array.from(selectedInfluencers),
          round_number: selectedRound,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error("발송 실패: " + result.error);
      } else {
        const failed = (result.total ?? selectedInfluencers.size) - result.sent;
        setSendResult({
          sent: result.sent,
          total: result.total ?? selectedInfluencers.size,
          failed,
        });
        setShowResult(true);

        if (result.sent > 0) {
          toast.success(`${result.sent}건 발송 완료`);
        }
        if (failed > 0) {
          toast.error(`${failed}건 발송 실패`);
        }

        setSelectedInfluencers(new Set());
        fetchData();
      }
    } catch {
      toast.error("발송 중 오류가 발생했습니다.");
    }
    setSending(false);
  }

  // Sanitize preview HTML for safe rendering
  const sanitizedPreviewHtml = useMemo(() => {
    return DOMPurify.sanitize(previewHtml, {
      ALLOWED_TAGS: [
        "p", "br", "strong", "em", "a", "ul", "ol", "li",
        "h1", "h2", "h3", "span", "div", "b", "i", "u",
        "blockquote", "img", "table", "tr", "td", "th", "thead", "tbody",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "class", "style", "src", "alt", "width", "height"],
    });
  }, [previewHtml]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">이메일 발송</h2>
        <CampaignSelector mode="required" value={campaignId} onChange={setCampaignId} />
      </div>

      {!campaignId ? (
        <div className="text-center py-16 text-muted-foreground">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">캠페인을 선택하세요</p>
          <p className="text-sm mt-1">이메일을 발송할 캠페인을 먼저 선택해주세요.</p>
        </div>
      ) : (
        <>
          {/* N-Round Filter Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4" />
                회차 필터
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium whitespace-nowrap">
                  발송 회차
                </label>
                <div className="flex gap-2">
                  {availableRounds.length > 0 ? (
                    availableRounds.map((round) => (
                      <Button
                        key={round}
                        variant={selectedRound === round ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedRound(round)}
                      >
                        {round}회차
                      </Button>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      템플릿이 없습니다. 먼저 템플릿을 생성하세요.
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  전체:{" "}
                  <span className="font-semibold">{roundStats.total}명</span>
                </span>
                <span className="text-muted-foreground">
                  미열람:{" "}
                  <span className="font-semibold text-orange-600">
                    {roundStats.unopenedCount}명
                  </span>
                </span>
                <span className="text-muted-foreground">
                  미회신:{" "}
                  <span className="font-semibold text-red-600">
                    {roundStats.unrepliedCount}명
                  </span>
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={quickFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter("all")}
                >
                  전체 ({roundStats.total})
                </Button>
                <Button
                  variant={quickFilter === "unopened" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter("unopened")}
                >
                  미열람 ({roundStats.unopenedCount})
                </Button>
                <Button
                  variant={quickFilter === "unreplied" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter("unreplied")}
                >
                  미회신 ({roundStats.unrepliedCount})
                </Button>
              </div>

              {selectedRound > 1 && (
                <p className="text-xs text-muted-foreground">
                  * {selectedRound}회차: {selectedRound - 1}회차를 받았지만 열람
                  또는 회신하지 않은 인플루언서만 표시됩니다.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Send Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">발송 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">
                    이메일 템플릿
                  </label>
                  <Select
                    value={selectedTemplate}
                    onValueChange={setSelectedTemplate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="템플릿 선택..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          [{t.round_number}회차] {t.subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {currentTemplate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(true)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    미리보기
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedInfluencers.size}명 선택됨 / 대상:{" "}
                  {filteredInfluencers.length}명
                </span>
                <Button
                  onClick={handleSendClick}
                  disabled={
                    sending ||
                    !selectedTemplate ||
                    selectedInfluencers.size === 0
                  }
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-1" />
                  )}
                  발송하기
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Influencer Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          filteredInfluencers.length > 0 &&
                          selectedInfluencers.size === filteredInfluencers.length
                        }
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>플랫폼</TableHead>
                    <TableHead>팔로워</TableHead>
                    <TableHead>이전 발송 상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        로딩 중...
                      </TableCell>
                    </TableRow>
                  ) : filteredInfluencers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {selectedRound > 1
                          ? `${selectedRound - 1}회차 미열람/미회신 인플루언서가 없습니다.`
                          : "이메일이 있는 인플루언서가 없습니다."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInfluencers.map((inf) => {
                      const infPrevLogs = emailLogs.filter(
                        (l) =>
                          l.influencer_id === inf.id &&
                          l.round_number < selectedRound
                      );
                      const lastLog =
                        infPrevLogs.length > 0
                          ? infPrevLogs.sort(
                              (a, b) => b.round_number - a.round_number
                            )[0]
                          : null;

                      return (
                        <TableRow key={inf.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedInfluencers.has(inf.id)}
                              onCheckedChange={() => toggleInfluencer(inf.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {inf.display_name ?? inf.username ?? "-"}
                          </TableCell>
                          <TableCell>{inf.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{inf.platform}</Badge>
                          </TableCell>
                          <TableCell>
                            {inf.follower_count?.toLocaleString() ?? "-"}
                          </TableCell>
                          <TableCell>
                            {lastLog ? (
                              <div className="flex items-center gap-1">
                                <Badge variant="secondary" className="text-xs">
                                  {lastLog.round_number}회차
                                </Badge>
                                {lastLog.opened_at ? (
                                  <Badge className="bg-purple-500/10 text-purple-500 text-xs">
                                    열람
                                  </Badge>
                                ) : (
                                  <Badge className="bg-muted text-muted-foreground text-xs">
                                    미열람
                                  </Badge>
                                )}
                                {lastLog.replied_at ? (
                                  <Badge className="bg-green-500/10 text-green-500 text-xs">
                                    회신
                                  </Badge>
                                ) : (
                                  <Badge className="bg-orange-500/10 text-orange-500 text-xs">
                                    미회신
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                발송 내역 없음
                              </span>
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

          {/* Template Preview Dialog */}
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  <Mail className="w-4 h-4 inline mr-2" />
                  템플릿 미리보기
                </DialogTitle>
                <DialogDescription>
                  첫 번째 선택된 인플루언서 기준으로 변수가 치환됩니다.
                </DialogDescription>
              </DialogHeader>
              {currentTemplate && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      발신자
                    </label>
                    <p className="text-sm">
                      {currentTemplate.sender_name ?? "Uncustom"} &lt;
                      {currentTemplate.sender_email ?? "hello@uncustom.com"}&gt;
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      제목
                    </label>
                    <p className="text-sm font-medium">{previewSubject}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      본문
                    </label>
                    <div
                      className="border rounded-lg p-4 bg-card text-sm mt-1 [&_a]:text-primary [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: sanitizedPreviewHtml }}
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  닫기
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Send Confirmation Dialog */}
          <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>발송 확인</DialogTitle>
                <DialogDescription>
                  아래 내용으로 이메일을 발송합니다. 계속하시겠습니까?
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">회차</span>
                  <span className="font-medium">{selectedRound}회차</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">템플릿</span>
                  <span className="font-medium">
                    {currentTemplate?.subject ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">발송 대상</span>
                  <span className="font-medium">
                    {selectedInfluencers.size}명
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowConfirm(false)}>
                  취소
                </Button>
                <Button onClick={handleSendConfirm}>
                  <Send className="w-4 h-4 mr-1" />
                  발송하기
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Send Result Dialog */}
          <Dialog open={showResult} onOpenChange={setShowResult}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>발송 결과</DialogTitle>
              </DialogHeader>
              {sendResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <Card>
                      <CardContent className="p-3 text-center">
                        <Mail className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                        <div className="text-2xl font-bold">{sendResult.total}</div>
                        <div className="text-xs text-muted-foreground">전체</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
                        <div className="text-2xl font-bold text-green-600">
                          {sendResult.sent}
                        </div>
                        <div className="text-xs text-muted-foreground">성공</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <XCircle className="w-5 h-5 mx-auto mb-1 text-red-500" />
                        <div className="text-2xl font-bold text-red-600">
                          {sendResult.failed}
                        </div>
                        <div className="text-xs text-muted-foreground">실패</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Link href={`/email/logs?campaign=${campaignId}`}>
                  <Button variant="outline">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    발송 로그 보기
                  </Button>
                </Link>
                <Button onClick={() => setShowResult(false)}>닫기</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
