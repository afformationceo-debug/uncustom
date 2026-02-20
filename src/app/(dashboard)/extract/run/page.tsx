"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Play,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Settings,
  PlayCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";
import { useRealtime } from "@/hooks/use-realtime";

type ExtractionJob = Tables<"extraction_jobs">;
type Keyword = Tables<"keywords">;
type TaggedAccount = Tables<"tagged_accounts">;

const ALL_PLATFORMS = ["instagram", "tiktok", "youtube", "twitter"] as const;

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "Twitter/X",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-600",
  tiktok: "bg-black/10 text-black dark:bg-white/10 dark:text-white",
  youtube: "bg-red-500/10 text-red-600",
  twitter: "bg-blue-500/10 text-blue-500",
};

// Tagged extraction is only supported on Instagram currently
const TAGGED_SUPPORTED_PLATFORMS = ["instagram"];

interface ExtractionConfig {
  limit: number;
  selectedPlatforms: string[];
}

export default function MasterExtractPage() {
  const supabase = createClient();

  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [taggedAccounts, setTaggedAccounts] = useState<TaggedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [extractingAll, setExtractingAll] = useState<"keyword" | "tagged" | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  // Global platform selection for keyword extraction
  const [globalPlatforms, setGlobalPlatforms] = useState<string[]>(["instagram"]);

  // Per-source advanced settings
  const [expandedSettings, setExpandedSettings] = useState<Record<string, boolean>>({});
  const [configs, setConfigs] = useState<Record<string, ExtractionConfig>>({});

  // Polling refs
  const pollingIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const keywordMap = useRef<Record<string, string>>({});
  const taggedMap = useRef<Record<string, string>>({});

  useEffect(() => {
    fetchData();
    return () => {
      Object.values(pollingIntervals.current).forEach(clearInterval);
    };
  }, []);

  useEffect(() => {
    const kwMap: Record<string, string> = {};
    for (const kw of keywords) kwMap[kw.id] = kw.keyword;
    keywordMap.current = kwMap;
  }, [keywords]);

  useEffect(() => {
    const tMap: Record<string, string> = {};
    for (const acc of taggedAccounts) tMap[acc.id] = acc.account_username;
    taggedMap.current = tMap;
  }, [taggedAccounts]);

  useEffect(() => {
    for (const job of jobs) {
      if ((job.status === "running" || job.status === "pending") && !pollingIntervals.current[job.id]) {
        startPolling(job.id);
      }
    }
  }, [jobs.length]);

  const handleRealtimeUpdate = useCallback(
    (payload: { eventType: string; new: unknown }) => {
      if (payload.eventType === "INSERT") {
        setJobs((prev) => [payload.new as ExtractionJob, ...prev]);
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as ExtractionJob;
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
        if (updated.status === "completed" || updated.status === "failed") {
          stopPolling(updated.id);
        }
      }
    },
    []
  );

  useRealtime<ExtractionJob>("extraction_jobs", undefined, handleRealtimeUpdate);

  function startPolling(jobId: string) {
    if (pollingIntervals.current[jobId]) return;
    pollingIntervals.current[jobId] = setInterval(async () => {
      try {
        const response = await fetch(`/api/extract/status?job_id=${jobId}`);
        const result = await response.json();
        if (result.status === "completed" || result.status === "failed") {
          stopPolling(jobId);
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? { ...j, status: result.status, total_extracted: result.total_extracted ?? j.total_extracted, new_extracted: result.new_extracted ?? j.new_extracted, completed_at: new Date().toISOString() }
                : j
            )
          );
          if (result.status === "completed") {
            toast.success(`추출 완료: ${result.total_extracted ?? 0}건 (신규 ${result.new_extracted ?? 0}건)`);
          } else {
            toast.error(`추출 실패: ${result.error ?? "알 수 없는 오류"}`);
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);
  }

  function stopPolling(jobId: string) {
    if (pollingIntervals.current[jobId]) {
      clearInterval(pollingIntervals.current[jobId]);
      delete pollingIntervals.current[jobId];
    }
  }

  async function fetchData() {
    setLoading(true);
    const [jobsRes, keywordsRes, taggedRes] = await Promise.all([
      supabase
        .from("extraction_jobs")
        .select("*")
        .is("campaign_id", null)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("keywords").select("*").order("created_at", { ascending: false }),
      supabase.from("tagged_accounts").select("*").order("created_at", { ascending: false }),
    ]);

    setJobs((jobsRes.data as ExtractionJob[]) ?? []);
    setKeywords((keywordsRes.data as Keyword[]) ?? []);
    setTaggedAccounts((taggedRes.data as TaggedAccount[]) ?? []);
    setLoading(false);
  }

  function getConfig(sourceId: string): ExtractionConfig {
    return configs[sourceId] ?? { limit: 50, selectedPlatforms: [] };
  }

  function updateConfig(sourceId: string, partial: Partial<ExtractionConfig>) {
    setConfigs((prev) => ({
      ...prev,
      [sourceId]: { ...getConfig(sourceId), ...partial },
    }));
  }

  function toggleSettings(sourceId: string) {
    setExpandedSettings((prev) => ({ ...prev, [sourceId]: !prev[sourceId] }));
  }

  function getEffectivePlatforms(sourceId: string, type: "keyword" | "tagged"): string[] {
    if (type === "tagged") return [...TAGGED_SUPPORTED_PLATFORMS];
    const config = getConfig(sourceId);
    if (config.selectedPlatforms.length > 0) return config.selectedPlatforms;
    return globalPlatforms.length > 0 ? globalPlatforms : ["instagram"];
  }

  function toggleGlobalPlatform(platform: string) {
    setGlobalPlatforms((prev) => {
      if (prev.includes(platform)) {
        const next = prev.filter((p) => p !== platform);
        return next.length > 0 ? next : prev;
      }
      return [...prev, platform];
    });
  }

  function toggleSourcePlatform(sourceId: string, platform: string) {
    const config = getConfig(sourceId);
    const current = config.selectedPlatforms.length > 0 ? config.selectedPlatforms : [...globalPlatforms];
    if (current.includes(platform)) {
      const next = current.filter((p) => p !== platform);
      if (next.length > 0) {
        updateConfig(sourceId, { selectedPlatforms: next });
      }
    } else {
      updateConfig(sourceId, { selectedPlatforms: [...current, platform] });
    }
  }

  async function startExtraction(type: "keyword" | "tagged", sourceId: string) {
    setExtracting(sourceId);
    const config = getConfig(sourceId);
    const platforms = getEffectivePlatforms(sourceId, type);

    try {
      const body: Record<string, unknown> = {
        campaign_id: null,
        type,
        source_id: sourceId,
        platforms,
        limit: config.limit,
      };

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error("추출 실패: " + result.error);
      } else {
        const started = result.total_started ?? 0;
        const failed = result.total_failed ?? 0;
        if (started > 0) {
          const platformNames = (result.jobs as { platform: string; job_id: string }[])
            .map((j) => PLATFORM_LABELS[j.platform] ?? j.platform)
            .join(", ");
          toast.success(`${started}개 플랫폼 추출 시작: ${platformNames}`);
          for (const job of result.jobs) {
            startPolling(job.job_id);
          }
        }
        if (failed > 0 && result.errors) {
          for (const err of result.errors) {
            toast.error(`${PLATFORM_LABELS[err.platform] ?? err.platform}: ${err.error}`);
          }
        }
      }
    } catch {
      toast.error("추출 요청 중 오류가 발생했습니다.");
    }
    setExtracting(null);
  }

  async function startExtractAll(type: "keyword" | "tagged") {
    setExtractingAll(type);
    const items =
      type === "keyword"
        ? filteredKeywords.map((kw) => ({ id: kw.id }))
        : filteredTagged
            .filter((a) => TAGGED_SUPPORTED_PLATFORMS.includes(a.platform))
            .map((acc) => ({ id: acc.id }));

    let totalStarted = 0;
    let totalFailed = 0;

    for (const item of items) {
      const config = getConfig(item.id);
      const platforms = getEffectivePlatforms(item.id, type);
      try {
        const body: Record<string, unknown> = {
          campaign_id: null,
          type,
          source_id: item.id,
          platforms,
          limit: config.limit,
        };

        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const result = await response.json();
        if (response.ok) {
          totalStarted += result.total_started ?? 0;
          totalFailed += result.total_failed ?? 0;
          if (result.jobs) {
            for (const job of result.jobs) {
              startPolling(job.job_id);
            }
          }
        } else {
          totalFailed++;
        }
      } catch {
        totalFailed++;
      }
    }

    if (totalStarted > 0) toast.success(`${totalStarted}건의 추출이 시작되었습니다.`);
    if (totalFailed > 0) toast.error(`${totalFailed}건의 추출이 실패했습니다.`);
    setExtractingAll(null);
  }

  function getSourceName(job: ExtractionJob): string {
    if (job.type === "keyword" && job.source_id) return keywordMap.current[job.source_id] ?? "키워드";
    if (job.type === "tagged" && job.source_id) {
      const username = taggedMap.current[job.source_id];
      return username ? `@${username}` : "태그";
    }
    return job.type === "keyword" ? "키워드" : "태그";
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500",
    running: "bg-primary/10 text-primary",
    completed: "bg-green-500/10 text-green-500",
    failed: "bg-red-500/10 text-red-500",
  };

  const statusLabels: Record<string, string> = {
    pending: "대기 중",
    running: "실행 중",
    completed: "완료",
    failed: "실패",
  };

  const runningJobCount = jobs.filter((j) => j.status === "running" || j.status === "pending").length;

  // Filter by platform
  const filteredKeywords = platformFilter === "all" ? keywords : keywords.filter((kw) => kw.platform === platformFilter);
  const filteredTagged = platformFilter === "all"
    ? taggedAccounts
    : taggedAccounts.filter((acc) => acc.platform === platformFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">인플루언서 추출</h2>
          <p className="text-sm text-muted-foreground mt-1">
            등록된 키워드/태그 계정으로 인플루언서를 추출합니다. 마스터데이터에 자동 반영됩니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="플랫폼" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 플랫폼</SelectItem>
              {PLATFORMS.filter((p) => p.value !== "threads").map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {runningJobCount > 0 && (
            <Badge className="bg-primary/10 text-primary" variant="secondary">
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              {runningJobCount}건 실행 중
            </Badge>
          )}
        </div>
      </div>

      {/* Global platform selection for keyword extraction */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">추출 플랫폼 선택</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            키워드별로 어떤 플랫폼에서 추출할지 선택합니다. 개별 키워드 설정에서 오버라이드 가능합니다.
          </p>
          <div className="flex flex-wrap gap-3">
            {ALL_PLATFORMS.map((platform) => (
              <label
                key={platform}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  globalPlatforms.includes(platform)
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <Checkbox
                  checked={globalPlatforms.includes(platform)}
                  onCheckedChange={() => toggleGlobalPlatform(platform)}
                />
                <Badge className={PLATFORM_COLORS[platform]} variant="secondary">
                  {PLATFORM_LABELS[platform]}
                </Badge>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Keywords extraction */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">키워드 기반 추출</CardTitle>
            {filteredKeywords.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => startExtractAll("keyword")}
                disabled={extractingAll === "keyword"}
              >
                {extractingAll === "keyword" ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <PlayCircle className="w-4 h-4 mr-1" />
                )}
                전체 추출
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredKeywords.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 키워드가 없습니다.</p>
            ) : (
              filteredKeywords.map((kw) => {
                const isExpanded = expandedSettings[kw.id] ?? false;
                const config = getConfig(kw.id);
                const effectivePlatforms = getEffectivePlatforms(kw.id, "keyword");
                return (
                  <div key={kw.id} className="border rounded-lg">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{kw.keyword}</span>
                        {effectivePlatforms.map((p) => (
                          <Badge key={p} className={`${PLATFORM_COLORS[p]} text-xs`} variant="secondary">
                            {PLATFORM_LABELS[p]}
                          </Badge>
                        ))}
                        {kw.campaign_id && (
                          <Badge variant="outline" className="text-[10px]">캠페인</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => toggleSettings(kw.id)} className="text-muted-foreground">
                          <Settings className="w-4 h-4" />
                          {isExpanded ? <ChevronDown className="w-3 h-3 ml-0.5" /> : <ChevronRight className="w-3 h-3 ml-0.5" />}
                        </Button>
                        <Button size="sm" onClick={() => startExtraction("keyword", kw.id)} disabled={extracting === kw.id}>
                          {extracting === kw.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 border-t bg-muted/50 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground pt-2">고급 설정</p>
                        {/* Per-keyword platform override */}
                        <div>
                          <Label className="text-xs text-muted-foreground">플랫폼 (이 키워드만 적용)</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {ALL_PLATFORMS.map((platform) => {
                              const isActive = effectivePlatforms.includes(platform);
                              return (
                                <label
                                  key={platform}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs cursor-pointer ${
                                    isActive ? "border-primary bg-primary/5" : "border-muted"
                                  }`}
                                >
                                  <Checkbox
                                    checked={isActive}
                                    onCheckedChange={() => toggleSourcePlatform(kw.id, platform)}
                                    className="h-3.5 w-3.5"
                                  />
                                  {PLATFORM_LABELS[platform]}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">추출 수량 (플랫폼당)</Label>
                            <Input
                              type="number"
                              min={1}
                              max={1000}
                              value={config.limit}
                              onChange={(e) => updateConfig(kw.id, { limit: parseInt(e.target.value) || 50 })}
                              className="mt-1 h-8 text-sm"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          예상: {effectivePlatforms.length}개 플랫폼 x {config.limit}건 = 약 {effectivePlatforms.length * config.limit}건
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Tagged account extraction */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">태그 계정 기반 추출</CardTitle>
            {filteredTagged.filter((a) => TAGGED_SUPPORTED_PLATFORMS.includes(a.platform)).length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => startExtractAll("tagged")}
                disabled={extractingAll === "tagged"}
              >
                {extractingAll === "tagged" ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <PlayCircle className="w-4 h-4 mr-1" />
                )}
                전체 추출
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredTagged.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 태그 계정이 없습니다.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  태그 기반 추출은 현재 Instagram만 지원합니다.
                </p>
                {filteredTagged.map((acc) => {
                  const isExpanded = expandedSettings[acc.id] ?? false;
                  const config = getConfig(acc.id);
                  const isSupported = TAGGED_SUPPORTED_PLATFORMS.includes(acc.platform);
                  return (
                    <div key={acc.id} className="border rounded-lg">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">@{acc.account_username}</span>
                          <Badge className={`${PLATFORM_COLORS[acc.platform] ?? ""} text-xs`} variant="secondary">
                            {PLATFORM_LABELS[acc.platform] ?? acc.platform}
                          </Badge>
                          {!isSupported && (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <AlertCircle className="w-3 h-3" />
                              키워드 추출만 지원
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {isSupported && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => toggleSettings(acc.id)} className="text-muted-foreground">
                                <Settings className="w-4 h-4" />
                                {isExpanded ? <ChevronDown className="w-3 h-3 ml-0.5" /> : <ChevronRight className="w-3 h-3 ml-0.5" />}
                              </Button>
                              <Button size="sm" onClick={() => startExtraction("tagged", acc.id)} disabled={extracting === acc.id}>
                                {extracting === acc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {isExpanded && isSupported && (
                        <div className="px-3 pb-3 pt-0 border-t bg-muted/50 space-y-3">
                          <p className="text-xs font-medium text-muted-foreground pt-2">고급 설정</p>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground">추출 수량</Label>
                              <Input
                                type="number"
                                min={1}
                                max={1000}
                                value={config.limit}
                                onChange={(e) => updateConfig(acc.id, { limit: parseInt(e.target.value) || 50 })}
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Extraction Jobs History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">추출 작업 내역</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>타입</TableHead>
                <TableHead>소스</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>전체</TableHead>
                <TableHead>신규</TableHead>
                <TableHead>시작일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    추출 작업이 없습니다. 위에서 플랫폼을 선택하고 추출을 시작하세요.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.type === "keyword" ? "키워드" : "태그"}</TableCell>
                    <TableCell className="font-medium text-sm">{getSourceName(job)}</TableCell>
                    <TableCell>
                      <Badge className={`${PLATFORM_COLORS[job.platform] ?? ""} text-xs`} variant="secondary">
                        {PLATFORM_LABELS[job.platform] ?? job.platform}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {(job.status === "running" || job.status === "pending") && (
                          <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        )}
                        <Badge className={statusColors[job.status] ?? ""} variant="secondary">
                          {statusLabels[job.status] ?? job.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{job.total_extracted ?? 0}</TableCell>
                    <TableCell>{job.new_extracted ?? 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.started_at ? new Date(job.started_at).toLocaleString("ko-KR") : "-"}
                    </TableCell>
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
