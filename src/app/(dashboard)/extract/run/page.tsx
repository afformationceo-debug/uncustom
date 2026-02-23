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
import { PLATFORM_ADVANCED_INPUTS, type AdvancedInputField, estimateKeywordCost, estimateTaggedCost, estimatePipelineCost, estimateTaggedPipelineCost, PLATFORM_KEYWORD_ACTORS, APIFY_COST_ESTIMATES } from "@/lib/apify/actors";

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

const TAGGED_SUPPORTED_PLATFORMS = ["instagram", "tiktok", "youtube", "twitter"];

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
      const record = payload.new as ExtractionJob;
      if (!record?.id) return; // Guard against empty payloads
      if (payload.eventType === "INSERT") {
        setJobs((prev) => {
          // Deduplicate: skip if already exists
          if (prev.some((j) => j.id === record.id)) return prev;
          return [record, ...prev];
        });
      } else if (payload.eventType === "UPDATE") {
        setJobs((prev) => prev.map((j) => (j.id === record.id ? record : j)));
        if (record.status === "completed" || record.status === "failed") {
          stopPolling(record.id);
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
        } else if (result.status === "running" && result.total_extracted != null) {
          // Update real-time extraction count while RUNNING
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? { ...j, total_extracted: result.total_extracted ?? j.total_extracted }
                : j
            )
          );
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
    if (type === "tagged") {
      // For tagged accounts, use the account's own platform
      const acc = taggedAccounts.find((a) => a.id === sourceId);
      return acc ? [acc.platform] : ["instagram"];
    }
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
      : filteredTagged.map((acc) => ({ id: acc.id }));

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
          {/* Pipeline visualization + cost breakdown */}
          {(() => {
            const sourceCount = Math.max(filteredKeywords.length, 1);
            const defaultLimit = 200;
            const pipeline = estimatePipelineCost(globalPlatforms, defaultLimit, sourceCount);
            const hasIG = globalPlatforms.includes("instagram");
            return (
              <div className="mt-3 bg-muted/40 rounded-lg px-3 py-2.5 space-y-2">
                {/* Pipeline flow */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>파이프라인:</span>
                  <span className="font-medium text-foreground">추출</span>
                  <ArrowRight className="w-3 h-3" />
                  {hasIG && (
                    <>
                      <span className="text-pink-600 dark:text-pink-400 font-medium">[IG] 프로필 보강</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                  <span className="text-purple-600 dark:text-purple-400 font-medium">[전체] 이메일 추출</span>
                </div>
                {/* Cost breakdown */}
                {sourceCount > 0 && (
                  <div className="flex items-start gap-4 text-[10px] text-muted-foreground pl-5 border-t border-border/40 pt-2">
                    <div className="space-y-0.5">
                      <span className="block">├ 추출 (키워드×플랫폼): <span className="text-amber-600 dark:text-amber-400 font-medium">~${pipeline.extraction.toFixed(2)}</span></span>
                      {hasIG && (
                        <span className="block">├ IG 프로필 보강: <span className="text-amber-600 dark:text-amber-400 font-medium">~${pipeline.enrichment.toFixed(2)}</span></span>
                      )}
                      <span className="block">├ 이메일 추출 (~30%): <span className="text-amber-600 dark:text-amber-400 font-medium">~${pipeline.email.toFixed(2)}</span></span>
                    </div>
                    <div className="ml-auto flex-shrink-0 text-right">
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        총 ~${pipeline.total.toFixed(2)}
                      </span>
                      <span className="block text-[9px] text-muted-foreground">
                        소스 {sourceCount}개 × {defaultLimit}건 기준
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
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
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    ~${(filteredKeywords.reduce((sum, kw) => {
                      const ep = getEffectivePlatforms(kw.id, "keyword");
                      const cfg = getConfig(kw.id);
                      return sum + estimateKeywordCost(ep, cfg.limit);
                    }, 0)).toFixed(2)}
                  </span>
                  <Button size="sm" onClick={() => startExtractAll("keyword")} disabled={extractingAll === "keyword"} className="h-8">
                    {extractingAll === "keyword" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <PlayCircle className="w-3.5 h-3.5 mr-1.5" />}
                    전체 추출
                  </Button>
                </div>
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
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[9px] text-amber-600 dark:text-amber-400">
                          ~${estimateKeywordCost(effectivePlatforms, config.limit).toFixed(2)}
                        </span>
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
                          <div className="pt-5 space-y-0.5">
                            <span className="text-xs text-muted-foreground">
                              예상 약 <strong className="text-foreground">{effectivePlatforms.length * config.limit}</strong>건
                            </span>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              ~${estimateKeywordCost(effectivePlatforms, config.limit).toFixed(2)}
                            </p>
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
              {filteredTagged.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    ~${(filteredTagged
                      .reduce((sum, acc) => sum + estimateTaggedCost(acc.platform, getConfig(acc.id).limit), 0)
                    ).toFixed(2)}
                  </span>
                  <Button size="sm" onClick={() => startExtractAll("tagged")} disabled={extractingAll === "tagged"} className="h-8">
                    {extractingAll === "tagged" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <PlayCircle className="w-3.5 h-3.5 mr-1.5" />}
                    전체 추출
                  </Button>
                </div>
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
                  {/* Pipeline cost summary */}
                  {(() => {
                    const taggedCostAccounts = filteredTagged.map((a) => ({
                      platform: a.platform,
                      limit: getConfig(a.id).limit,
                    }));
                    if (taggedCostAccounts.length === 0) return null;
                    const pipeline = estimateTaggedPipelineCost(taggedCostAccounts);
                    const hasIG = taggedCostAccounts.some((a) => a.platform === "instagram");
                    return (
                      <div className="px-3 py-2 bg-muted/40 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <span>파이프라인:</span>
                          <span className="font-medium text-foreground">추출</span>
                          <ArrowRight className="w-3 h-3" />
                          {hasIG && (
                            <>
                              <span className="text-pink-600 dark:text-pink-400 font-medium">[IG] 프로필 보강</span>
                              <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                          <span className="text-purple-600 dark:text-purple-400 font-medium">[전체] 이메일 추출</span>
                        </div>
                        <div className="flex items-start gap-4 text-[10px] text-muted-foreground pl-5">
                          <div className="space-y-0.5">
                            <span className="block">├ 추출 ({taggedCostAccounts.length}개 계정): <span className="text-amber-600 dark:text-amber-400 font-medium">~${pipeline.extraction.toFixed(2)}</span></span>
                            {hasIG && (
                              <span className="block">├ IG 프로필 보강: <span className="text-amber-600 dark:text-amber-400 font-medium">~${pipeline.enrichment.toFixed(2)}</span></span>
                            )}
                            <span className="block">├ 이메일 추출 (~30%): <span className="text-amber-600 dark:text-amber-400 font-medium">~${pipeline.email.toFixed(2)}</span></span>
                          </div>
                          <div className="ml-auto flex-shrink-0 text-right">
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                              총 ~${pipeline.total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="px-3 py-2 bg-blue-500/5 text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    Instagram: 태그 추출 | Twitter: @멘션 검색 | TikTok/YouTube: @유저네임 검색
                  </div>
                  {filteredTagged.map((acc) => {
                    const isExpanded = expandedSettings[acc.id] ?? false;
                    const config = getConfig(acc.id);
                    const countryCode = (acc as TaggedAccount & { target_country?: string }).target_country;
                    return (
                      <div key={acc.id}>
                        <div className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">@{acc.account_username}</span>
                            <Badge variant="outline" className={`text-[10px] ${PLATFORM_COLORS[acc.platform]}`}>
                              {PLATFORM_LABELS[acc.platform] ?? acc.platform}
                            </Badge>
                            {countryCode && countryCode !== "ALL" && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">{countryCode}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-amber-600 dark:text-amber-400">
                              ~${estimateTaggedCost(acc.platform, getConfig(acc.id).limit).toFixed(2)}
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => toggleSettings(acc.id)} className="h-7 w-7 p-0">
                              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                            <Button size="sm" onClick={() => startExtraction("tagged", acc.id)} disabled={extracting === acc.id} className="h-7 px-2">
                              {extracting === acc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>
                        {isExpanded && (
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

      {/* ================================================================
       * ACTIVE JOBS - Running/Pending shown as prominent cards
       * ================================================================ */}
      {(() => {
        const activeJobs = jobs.filter((j) => j.status === "running" || j.status === "pending");
        if (activeJobs.length === 0) return null;
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <h3 className="font-semibold text-sm">실행 중인 작업</h3>
              <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">{activeJobs.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeJobs.map((job) => {
                const extracted = job.total_extracted ?? 0;
                const cfg = job.input_config as Record<string, unknown> | null;
                const limit = Number(cfg?.resultsLimit ?? cfg?.resultsPerPage ?? cfg?.maxResults ?? cfg?.maxItems ?? 0);
                const progress = limit > 0 && extracted > 0 ? Math.min((extracted / limit) * 100, 100) : 0;
                const typeLabels: Record<string, string> = { keyword: "키워드 추출", tagged: "태그 추출", enrich: "프로필 보강", email_scrape: "이메일 추출" };
                const typeIcons: Record<string, typeof Zap> = { keyword: SearchIcon, tagged: AtSign, enrich: Sparkles, email_scrape: Zap };
                const TypeIcon = typeIcons[job.type] ?? Zap;

                return (
                  <Card key={job.id} className="border-primary/30 bg-primary/[0.02] overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${PLATFORM_COLORS[job.platform] ?? "bg-muted"}`}>
                            <TypeIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{getSourceName(job)}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className={`text-[9px] px-1 py-0 ${PLATFORM_COLORS[job.platform] ?? ""}`}>
                                {PLATFORM_LABELS[job.platform] ?? job.platform}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{typeLabels[job.type] ?? job.type}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-primary">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs font-medium">
                            {job.status === "pending" ? "대기 중" : "추출 중"}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">진행률</span>
                          <span className="font-medium">
                            {extracted > 0 ? (
                              <span className="text-primary">{extracted.toLocaleString()}건</span>
                            ) : (
                              <span className="text-muted-foreground">시작 중...</span>
                            )}
                            {limit > 0 && <span className="text-muted-foreground"> / {limit.toLocaleString()}</span>}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${progress > 0 ? Math.max(progress, 5) : 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-[10px] text-muted-foreground">
                        시작: {job.started_at ? new Date(job.started_at).toLocaleString("ko-KR") : "-"}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ================================================================
       * COMPLETED JOBS - Grouped by date with filters
       * ================================================================ */}
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

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />로딩 중...
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="w-8 h-8 opacity-10 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {jobFilter === "all" ? "추출 작업이 없습니다" : `${jobFilter === "running" ? "실행 중인" : jobFilter === "completed" ? "완료된" : "실패한"} 작업이 없습니다`}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {(() => {
                // Group jobs by date
                const grouped: Record<string, ExtractionJob[]> = {};
                for (const job of filteredJobs.slice(0, 50)) {
                  const dateStr = job.started_at
                    ? new Date(job.started_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
                    : "날짜 없음";
                  if (!grouped[dateStr]) grouped[dateStr] = [];
                  grouped[dateStr].push(job);
                }

                return Object.entries(grouped).map(([dateLabel, dateJobs]) => {
                  const completedCount = dateJobs.filter((j) => j.status === "completed").length;
                  const failedCount = dateJobs.filter((j) => j.status === "failed").length;
                  const totalExtractedInGroup = dateJobs.filter((j) => j.status === "completed").reduce((s, j) => s + (j.total_extracted ?? 0), 0);

                  return (
                    <div key={dateLabel}>
                      {/* Date header */}
                      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 sticky top-0 z-10">
                        <span className="text-xs font-semibold text-muted-foreground">{dateLabel}</span>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          {completedCount > 0 && (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                              {completedCount}건 완료
                            </span>
                          )}
                          {failedCount > 0 && (
                            <span className="flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-destructive" />
                              {failedCount}건 실패
                            </span>
                          )}
                          {totalExtractedInGroup > 0 && (
                            <span className="font-medium text-foreground">{totalExtractedInGroup.toLocaleString()}명 추출</span>
                          )}
                        </div>
                      </div>

                      {/* Jobs in this date group */}
                      {dateJobs.map((job, idx) => {
                        const extracted = job.total_extracted ?? 0;
                        const newCount = job.new_extracted ?? 0;
                        const cfg = job.input_config as Record<string, unknown> | null;
                        const limit = Number(cfg?.resultsLimit ?? cfg?.resultsPerPage ?? cfg?.maxResults ?? cfg?.maxItems ?? 0);
                        const isShort = job.status === "completed" && limit > 0 && extracted < limit;
                        const typeLabels: Record<string, { label: string; color: string }> = {
                          keyword: { label: "키워드", color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
                          tagged: { label: "태그", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
                          enrich: { label: "보강", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
                          email_scrape: { label: "이메일", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
                        };
                        const typeInfo = typeLabels[job.type] ?? { label: job.type, color: "bg-muted text-muted-foreground" };

                        return (
                          <div
                            key={job.id || `job-${idx}`}
                            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors ${
                              job.status === "failed" ? "opacity-60" : ""
                            }`}
                          >
                            {/* Status indicator */}
                            <div className="flex-shrink-0">
                              {(job.status === "running" || job.status === "pending") && (
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                </div>
                              )}
                              {job.status === "completed" && (
                                <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                </div>
                              )}
                              {job.status === "failed" && (
                                <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
                                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                                </div>
                              )}
                            </div>

                            {/* Type badge */}
                            <Badge className={`text-[10px] px-1.5 py-0 border-0 font-medium ${typeInfo.color}`}>
                              {typeInfo.label}
                            </Badge>

                            {/* Source name */}
                            <span className="font-medium text-sm min-w-0 truncate">{getSourceName(job)}</span>

                            {/* Platform */}
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 flex-shrink-0 ${PLATFORM_COLORS[job.platform] ?? ""}`}>
                              {PLATFORM_LABELS[job.platform] ?? job.platform}
                            </Badge>

                            {/* Spacer */}
                            <div className="flex-1" />

                            {/* Stats */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {/* Request count */}
                              {limit > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  요청 {limit.toLocaleString()}
                                </span>
                              )}

                              {/* Extracted count */}
                              {(job.status === "running" || job.status === "pending") ? (
                                <span className="flex items-center gap-1 text-xs text-primary font-medium min-w-[50px] justify-end">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  {extracted > 0 ? extracted.toLocaleString() : "-"}
                                </span>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={`text-xs font-semibold min-w-[50px] text-right ${
                                      isShort ? "text-amber-600 cursor-help" : "text-foreground"
                                    }`}>
                                      {extracted.toLocaleString()}
                                      {isShort && <span className="text-[9px] ml-0.5">⚠</span>}
                                    </span>
                                  </TooltipTrigger>
                                  {isShort && (
                                    <TooltipContent side="left" className="max-w-[240px]">
                                      <p className="text-xs font-medium">요청: {limit.toLocaleString()} → 결과: {extracted.toLocaleString()}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {job.type === "keyword" || job.type === "tagged" ? "동일 사용자 중복 제거됨" : "추출 결과"}
                                      </p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              )}

                              {/* New count */}
                              {newCount > 0 && (
                                <span className="text-[10px] text-green-600 font-semibold bg-green-500/10 px-1.5 py-0.5 rounded">
                                  +{newCount}
                                </span>
                              )}

                              {/* Time */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[10px] text-muted-foreground w-14 text-right cursor-default">
                                    {timeAgo(job.started_at)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {job.started_at ? new Date(job.started_at).toLocaleString("ko-KR") : "-"}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </div>
          )}

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
