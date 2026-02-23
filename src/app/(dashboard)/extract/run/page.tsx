"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Play,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Settings,
  PlayCircle,
  AlertCircle,
  Zap,
  Search as SearchIcon,
  Hash,
  AtSign,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";
import { useRealtime } from "@/hooks/use-realtime";
import { PLATFORM_ADVANCED_INPUTS, type AdvancedInputField } from "@/lib/apify/actors";

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

const PLATFORM_DESCRIPTIONS: Record<string, string> = {
  instagram: "해시태그 기반 게시물 검색. 추출 후 프로필 보강 자동 실행",
  tiktok: "검색어 기반 동영상/사용자 검색",
  youtube: "키워드 동영상 검색 → 채널 정보 추출",
  twitter: "트윗 검색 → 작성자 프로필 추출",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-600 border-pink-200 dark:border-pink-800",
  tiktok: "bg-gray-500/10 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700",
  youtube: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800",
  twitter: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
};

const PLATFORM_DOT: Record<string, string> = {
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  tiktok: "bg-black dark:bg-white",
  youtube: "bg-red-500",
  twitter: "bg-blue-400",
};

const TAGGED_SUPPORTED_PLATFORMS = ["instagram"];

interface ExtractionConfig {
  limit: number;
  selectedPlatforms: string[];
  platformInputs: Record<string, Record<string, unknown>>;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "-";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function MasterExtractPage() {
  const supabase = createClient();

  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [taggedAccounts, setTaggedAccounts] = useState<TaggedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [extractingAll, setExtractingAll] = useState<"keyword" | "tagged" | null>(null);

  // Global platform selection
  const [globalPlatforms, setGlobalPlatforms] = useState<string[]>(["instagram"]);

  // Per-source settings
  const [expandedSettings, setExpandedSettings] = useState<Record<string, boolean>>({});
  const [configs, setConfigs] = useState<Record<string, ExtractionConfig>>({});

  // Filter
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [sourceSearch, setSourceSearch] = useState("");

  // Polling refs
  const pollingIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const keywordMap = useRef<Record<string, string>>({});
  const taggedMap = useRef<Record<string, string>>({});

  useEffect(() => {
    fetchData();
    return () => { Object.values(pollingIntervals.current).forEach(clearInterval); };
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
  }, [jobs]);

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
            const currentJob = jobs.find((j) => j.id === jobId);
            if (currentJob?.type === "enrich") {
              toast.success(`프로필 보강 완료: ${result.total_extracted ?? 0}명 (이메일 ${result.new_extracted ?? 0}건)`);
            } else if (currentJob?.type === "email_scrape") {
              toast.success(`이메일 추출 완료: ${result.total_extracted ?? 0}건`);
            } else if (currentJob?.type === "email_social") {
              toast.success(`소셜 이메일 추출 완료: ${result.new_extracted ?? 0}건 발견`);
            } else {
              toast.success(`추출 완료: ${result.total_extracted ?? 0}건 (신규 ${result.new_extracted ?? 0}건)`);
              // If enrichment job was auto-triggered, start polling for it
              if (result.enrich_job_id) {
                toast.info("Instagram 프로필 보강이 자동 시작되었습니다 (팔로워, 프로필사진 등)");
                startPolling(result.enrich_job_id);
              }
              // If social email extraction was auto-triggered, start polling
              if (result.social_email_job_id) {
                toast.info("소셜미디어 이메일 추출이 자동 시작되었습니다");
                startPolling(result.social_email_job_id);
              }
            }
          } else {
            toast.error(`추출 실패: ${result.error ?? "알 수 없는 오류"}`);
          }
        }
      } catch { /* polling error, silently ignore */ }
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
      supabase.from("extraction_jobs").select("*").is("campaign_id", null).order("created_at", { ascending: false }).limit(100),
      supabase.from("keywords").select("*").is("campaign_id", null).order("created_at", { ascending: false }),
      supabase.from("tagged_accounts").select("*").is("campaign_id", null).order("created_at", { ascending: false }),
    ]);
    setJobs((jobsRes.data as ExtractionJob[]) ?? []);
    setKeywords((keywordsRes.data as Keyword[]) ?? []);
    setTaggedAccounts((taggedRes.data as TaggedAccount[]) ?? []);
    setLoading(false);
  }

  function getConfig(sourceId: string): ExtractionConfig {
    return configs[sourceId] ?? { limit: 200, selectedPlatforms: [], platformInputs: {} };
  }

  function updateConfig(sourceId: string, partial: Partial<ExtractionConfig>) {
    setConfigs((prev) => ({ ...prev, [sourceId]: { ...getConfig(sourceId), ...partial } }));
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
      if (next.length > 0) updateConfig(sourceId, { selectedPlatforms: next });
    } else {
      updateConfig(sourceId, { selectedPlatforms: [...current, platform] });
    }
  }

  function updatePlatformInput(sourceId: string, platform: string, key: string, value: unknown) {
    const config = getConfig(sourceId);
    const existing = config.platformInputs[platform] ?? {};
    updateConfig(sourceId, {
      platformInputs: {
        ...config.platformInputs,
        [platform]: { ...existing, [key]: value },
      },
    });
  }

  async function startExtraction(type: "keyword" | "tagged", sourceId: string) {
    setExtracting(sourceId);
    const config = getConfig(sourceId);
    const platforms = getEffectivePlatforms(sourceId, type);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: null,
          type,
          source_id: sourceId,
          platforms,
          limit: config.limit,
          platform_inputs: Object.keys(config.platformInputs).length > 0 ? config.platformInputs : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error("추출 실패: " + result.error);
      } else {
        const started = result.total_started ?? 0;
        if (started > 0) {
          const names = (result.jobs as { platform: string; job_id: string }[]).map((j) => PLATFORM_LABELS[j.platform]).join(", ");
          toast.success(`${started}개 플랫폼 추출 시작: ${names}`);
          for (const job of result.jobs) startPolling(job.job_id);
        }
        if (result.total_failed > 0 && result.errors) {
          for (const err of result.errors) toast.error(`${PLATFORM_LABELS[err.platform]}: ${err.error}`);
        }
      }
    } catch { toast.error("추출 요청 중 오류가 발생했습니다."); }
    setExtracting(null);
  }

  async function startExtractAll(type: "keyword" | "tagged") {
    setExtractingAll(type);
    const items = type === "keyword"
      ? filteredKeywords.map((kw) => ({ id: kw.id }))
      : filteredTagged.filter((a) => TAGGED_SUPPORTED_PLATFORMS.includes(a.platform)).map((acc) => ({ id: acc.id }));

    let totalStarted = 0;
    let totalFailed = 0;
    for (const item of items) {
      const platforms = getEffectivePlatforms(item.id, type);
      const config = getConfig(item.id);
      try {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaign_id: null, type, source_id: item.id, platforms, limit: config.limit, platform_inputs: Object.keys(config.platformInputs).length > 0 ? config.platformInputs : undefined }),
        });
        const result = await response.json();
        if (response.ok) {
          totalStarted += result.total_started ?? 0;
          totalFailed += result.total_failed ?? 0;
          if (result.jobs) for (const job of result.jobs) startPolling(job.job_id);
        } else { totalFailed++; }
      } catch { totalFailed++; }
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
    if (job.type === "enrich") return "프로필 보강";
    if (job.type === "email_scrape") return "이메일 추출";
    if (job.type === "email_social") return "소셜 이메일";
    return job.type === "keyword" ? "키워드" : "태그";
  }

  const runningJobCount = jobs.filter((j) => j.status === "running" || j.status === "pending").length;
  const completedToday = jobs.filter((j) => j.status === "completed" && j.completed_at && new Date(j.completed_at).toDateString() === new Date().toDateString()).length;
  const totalExtracted = jobs.filter((j) => j.status === "completed").reduce((sum, j) => sum + (j.total_extracted ?? 0), 0);

  // Filter sources
  const filteredKeywords = keywords.filter((kw) => !sourceSearch || kw.keyword.toLowerCase().includes(sourceSearch.toLowerCase()));
  const filteredTagged = taggedAccounts.filter((acc) => !sourceSearch || acc.account_username.toLowerCase().includes(sourceSearch.toLowerCase()));

  // Filter jobs
  const filteredJobs = jobs.filter((j) => {
    if (jobFilter === "all") return true;
    return j.status === jobFilter;
  });

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            인플루언서 추출
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            키워드/태그 계정으로 멀티 플랫폼 동시 추출. 마스터데이터에 자동 반영됩니다.
          </p>
        </div>
        {runningJobCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium text-primary">{runningJobCount}건 추출 중...</span>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalExtracted.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">총 추출 수</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedToday}</p>
              <p className="text-xs text-muted-foreground">오늘 완료</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{keywords.length + taggedAccounts.length}</p>
              <p className="text-xs text-muted-foreground">소스 (키워드+태그)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Selection - Visual */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm">추출 플랫폼</h3>
              <p className="text-xs text-muted-foreground mt-0.5">선택한 플랫폼에서 동시에 추출합니다</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {globalPlatforms.length}개 선택
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ALL_PLATFORMS.map((platform) => {
              const isActive = globalPlatforms.includes(platform);
              return (
                <Tooltip key={platform}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => toggleGlobalPlatform(platform)}
                      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                        isActive
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-muted-foreground/30 opacity-60"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${PLATFORM_DOT[platform]}`} />
                      <span className={`font-medium text-sm ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {PLATFORM_LABELS[platform]}
                      </span>
                      {isActive && (
                        <CheckCircle2 className="w-4 h-4 text-primary absolute top-2 right-2" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {PLATFORM_DESCRIPTIONS[platform]}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          {/* Pipeline visualization */}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span>파이프라인:</span>
            <span className="font-medium text-foreground">추출</span>
            <ArrowRight className="w-3 h-3" />
            {globalPlatforms.includes("instagram") && (
              <>
                <span className="text-pink-600 dark:text-pink-400 font-medium">[IG] 프로필 보강</span>
                <ArrowRight className="w-3 h-3" />
              </>
            )}
            <span className="text-purple-600 dark:text-purple-400 font-medium">[전체] 이메일 추출</span>
          </div>
        </CardContent>
      </Card>

      {/* Source Search */}
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="키워드 또는 계정 검색..."
          value={sourceSearch}
          onChange={(e) => setSourceSearch(e.target.value)}
          className="pl-10 h-9"
        />
      </div>

      {/* Two-Column Extraction Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Keywords */}
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-violet-500" />
                <h3 className="font-semibold text-sm">키워드 추출</h3>
                <Badge variant="secondary" className="text-[10px]">{filteredKeywords.length}</Badge>
              </div>
              {filteredKeywords.length > 0 && (
                <Button size="sm" onClick={() => startExtractAll("keyword")} disabled={extractingAll === "keyword"} className="h-8">
                  {extractingAll === "keyword" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <PlayCircle className="w-3.5 h-3.5 mr-1.5" />}
                  전체 추출
                </Button>
              )}
            </div>
            <div className="divide-y max-h-[500px] overflow-auto">
              {filteredKeywords.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Hash className="w-8 h-8 opacity-20 mx-auto mb-2" />
                  <p className="text-sm">등록된 키워드가 없습니다</p>
                  <p className="text-xs mt-1">키워드 관리에서 추가하세요</p>
                </div>
              ) : filteredKeywords.map((kw) => {
                const isExpanded = expandedSettings[kw.id] ?? false;
                const config = getConfig(kw.id);
                const effectivePlatforms = getEffectivePlatforms(kw.id, "keyword");
                return (
                  <div key={kw.id}>
                    <div className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-medium text-sm truncate">{kw.keyword}</span>
                        {kw.platform && kw.platform !== "all" && (
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${PLATFORM_COLORS[kw.platform] ?? ""}`}>
                            {PLATFORM_LABELS[kw.platform] ?? kw.platform}
                          </Badge>
                        )}
                        <div className="flex gap-1">
                          {effectivePlatforms.map((p) => (
                            <span key={p} className={`w-2 h-2 rounded-full ${PLATFORM_DOT[p]}`} title={PLATFORM_LABELS[p]} />
                          ))}
                        </div>
                        {kw.target_country && kw.target_country !== "ALL" && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">{kw.target_country}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => toggleSettings(kw.id)} className="h-7 w-7 p-0">
                          <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button size="sm" onClick={() => startExtraction("keyword", kw.id)} disabled={extracting === kw.id} className="h-7 px-2">
                          {extracting === kw.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-3 bg-muted/30 space-y-3 border-t border-dashed">
                        <p className="text-[10px] font-medium text-muted-foreground pt-2 uppercase tracking-wider">고급 설정</p>
                        <div>
                          <Label className="text-xs text-muted-foreground">플랫폼 오버라이드</Label>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {ALL_PLATFORMS.map((platform) => {
                              const isActive = effectivePlatforms.includes(platform);
                              return (
                                <button
                                  key={platform}
                                  onClick={() => toggleSourcePlatform(kw.id, platform)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors ${
                                    isActive ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                                  }`}
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full ${PLATFORM_DOT[platform]}`} />
                                  {PLATFORM_LABELS[platform]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">플랫폼당 수량</Label>
                            <Input
                              type="number"
                              min={1}
                              max={1000}
                              value={config.limit}
                              onChange={(e) => updateConfig(kw.id, { limit: parseInt(e.target.value) || 200 })}
                              className="mt-1 h-7 text-xs w-24"
                            />
                          </div>
                          <div className="pt-5">
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <div className="pt-5">
                            <span className="text-xs text-muted-foreground">
                              예상 약 <strong className="text-foreground">{effectivePlatforms.length * config.limit}</strong>건
                            </span>
                          </div>
                        </div>
                        {/* Platform-specific advanced inputs */}
                        {effectivePlatforms.map((plat) => {
                          const fields = PLATFORM_ADVANCED_INPUTS[plat];
                          if (!fields || fields.length === 0) return null;
                          const platInputs = config.platformInputs[plat] ?? {};
                          return (
                            <div key={plat} className="space-y-2 pt-1">
                              <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_DOT[plat]}`} />
                                {PLATFORM_LABELS[plat]} 고급 옵션
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {fields.map((field) => (
                                  <div key={field.key}>
                                    {field.type === "select" && field.options ? (
                                      <div>
                                        <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                                        <Select
                                          value={String(platInputs[field.key] ?? field.defaultValue ?? "")}
                                          onValueChange={(v) => updatePlatformInput(kw.id, plat, field.key, v)}
                                        >
                                          <SelectTrigger className="h-7 text-xs mt-0.5">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {field.options.map((opt) => (
                                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                {opt.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    ) : field.type === "number" ? (
                                      <div>
                                        <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                                        <Input
                                          type="number"
                                          value={Number(platInputs[field.key] ?? field.defaultValue ?? 0)}
                                          onChange={(e) => updatePlatformInput(kw.id, plat, field.key, parseInt(e.target.value) || 0)}
                                          className="h-7 text-xs mt-0.5 w-20"
                                        />
                                      </div>
                                    ) : field.type === "boolean" ? (
                                      <label className="flex items-center gap-1.5 cursor-pointer pt-2">
                                        <Checkbox
                                          checked={!!platInputs[field.key]}
                                          onCheckedChange={(v) => updatePlatformInput(kw.id, plat, field.key, !!v)}
                                        />
                                        <span className="text-[10px] text-muted-foreground">{field.label}</span>
                                      </label>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tagged Accounts */}
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <AtSign className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-sm">태그 계정 추출</h3>
                <Badge variant="secondary" className="text-[10px]">{filteredTagged.length}</Badge>
              </div>
              {filteredTagged.filter((a) => TAGGED_SUPPORTED_PLATFORMS.includes(a.platform)).length > 0 && (
                <Button size="sm" onClick={() => startExtractAll("tagged")} disabled={extractingAll === "tagged"} className="h-8">
                  {extractingAll === "tagged" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <PlayCircle className="w-3.5 h-3.5 mr-1.5" />}
                  전체 추출
                </Button>
              )}
            </div>
            <div className="divide-y max-h-[500px] overflow-auto">
              {filteredTagged.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <AtSign className="w-8 h-8 opacity-20 mx-auto mb-2" />
                  <p className="text-sm">등록된 태그 계정이 없습니다</p>
                  <p className="text-xs mt-1">태그됨 관리에서 추가하세요</p>
                </div>
              ) : (
                <>
                  <div className="px-3 py-2 bg-amber-500/5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" />
                    태그 기반 추출은 현재 Instagram만 지원합니다
                  </div>
                  {filteredTagged.map((acc) => {
                    const isExpanded = expandedSettings[acc.id] ?? false;
                    const config = getConfig(acc.id);
                    const isSupported = TAGGED_SUPPORTED_PLATFORMS.includes(acc.platform);
                    return (
                      <div key={acc.id}>
                        <div className={`flex items-center justify-between p-3 hover:bg-muted/30 transition-colors ${!isSupported ? "opacity-40" : ""}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">@{acc.account_username}</span>
                            <Badge variant="outline" className={`text-[10px] ${PLATFORM_COLORS[acc.platform]}`}>
                              {PLATFORM_LABELS[acc.platform] ?? acc.platform}
                            </Badge>
                            {!isSupported && (
                              <span className="text-[10px] text-amber-600">미지원</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {isSupported && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => toggleSettings(acc.id)} className="h-7 w-7 p-0">
                                  <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                                <Button size="sm" onClick={() => startExtraction("tagged", acc.id)} disabled={extracting === acc.id} className="h-7 px-2">
                                  {extracting === acc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {isExpanded && isSupported && (
                          <div className="px-3 pb-3 bg-muted/30 space-y-2 border-t border-dashed">
                            <div className="pt-2">
                              <Label className="text-xs text-muted-foreground">추출 수량</Label>
                              <Input
                                type="number"
                                min={1}
                                max={1000}
                                value={config.limit}
                                onChange={(e) => updateConfig(acc.id, { limit: parseInt(e.target.value) || 200 })}
                                className="mt-1 h-7 text-xs w-24"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Extraction Jobs History */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">작업 내역</h3>
              <Badge variant="secondary" className="text-[10px]">{jobs.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex border rounded-lg overflow-hidden">
                {[
                  { value: "all", label: "전체" },
                  { value: "running", label: "실행 중" },
                  { value: "completed", label: "완료" },
                  { value: "failed", label: "실패" },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setJobFilter(tab.value)}
                    className={`px-2.5 py-1 text-xs transition-colors ${
                      jobFilter === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={fetchData} className="h-8 w-8 p-0">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>타입</TableHead>
                <TableHead>소스</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">전체</TableHead>
                <TableHead className="text-right">신규</TableHead>
                <TableHead>시작</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />로딩 중...
                  </TableCell>
                </TableRow>
              ) : filteredJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Zap className="w-8 h-8 opacity-10 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {jobFilter === "all" ? "추출 작업이 없습니다" : `${jobFilter === "running" ? "실행 중인" : jobFilter === "completed" ? "완료된" : "실패한"} 작업이 없습니다`}
                    </p>
                  </TableCell>
                </TableRow>
              ) : filteredJobs.slice(0, 50).map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {{ keyword: "키워드", tagged: "태그", enrich: "보강", email_scrape: "이메일", email_social: "소셜이메일" }[job.type] ?? job.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{getSourceName(job)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${PLATFORM_COLORS[job.platform] ?? ""}`}>
                      {PLATFORM_LABELS[job.platform] ?? job.platform}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {(job.status === "running" || job.status === "pending") && (
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      )}
                      {job.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                      {job.status === "failed" && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                      <span className={`text-xs font-medium ${
                        job.status === "completed" ? "text-green-600" :
                        job.status === "failed" ? "text-destructive" :
                        job.status === "running" ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {{ pending: "대기", running: "추출 중", completed: "완료", failed: "실패" }[job.status] ?? job.status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{job.total_extracted ?? 0}</TableCell>
                  <TableCell className="text-right">
                    {(job.new_extracted ?? 0) > 0 ? (
                      <span className="text-green-600 font-medium">+{job.new_extracted}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground cursor-default">
                          {timeAgo(job.started_at)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {job.started_at ? new Date(job.started_at).toLocaleString("ko-KR") : "-"}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredJobs.length > 50 && (
            <div className="p-3 text-center text-xs text-muted-foreground border-t">
              최근 50건만 표시 (전체 {filteredJobs.length}건)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
