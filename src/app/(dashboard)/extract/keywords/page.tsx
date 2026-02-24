"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  Upload,
  Download,
  FileUp,
  Search,
  Hash,
  Globe,
  Calendar,
  MoreHorizontal,
  Pencil,
  Check,
  X,
  ChevronDown,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { useRealtime } from "@/hooks/use-realtime";

type Keyword = Tables<"keywords">;
type ExtractionJob = Tables<"extraction_jobs">;

interface KeywordExtractionStats {
  runCount: number;
  totalExtracted: number;
  lastRunAt: string | null;
  lastStatus: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS = [
  { value: "all", label: "전체", color: "bg-muted text-muted-foreground" },
  { value: "instagram", label: "Instagram", color: "bg-pink-500/15 text-pink-700 dark:text-pink-400" },
  { value: "tiktok", label: "TikTok", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400" },
  { value: "youtube", label: "YouTube", color: "bg-red-500/15 text-red-700 dark:text-red-400" },
  { value: "twitter", label: "Twitter/X", color: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
] as const;

const PLATFORM_DOTS: Record<string, string> = {
  all: "bg-muted-foreground",
  instagram: "bg-pink-500",
  tiktok: "bg-cyan-500",
  youtube: "bg-red-500",
  twitter: "bg-sky-500",
};

const TARGET_COUNTRIES = [
  { value: "ALL", label: "전체", flag: "" },
  { value: "KR", label: "한국", flag: "\uD83C\uDDF0\uD83C\uDDF7" },
  { value: "US", label: "미국", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { value: "JP", label: "일본", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { value: "CN", label: "중국", flag: "\uD83C\uDDE8\uD83C\uDDF3" },
  { value: "VN", label: "베트남", flag: "\uD83C\uDDFB\uD83C\uDDF3" },
  { value: "TH", label: "태국", flag: "\uD83C\uDDF9\uD83C\uDDED" },
  { value: "ID", label: "인도네시아", flag: "\uD83C\uDDEE\uD83C\uDDE9" },
  { value: "BR", label: "브라질", flag: "\uD83C\uDDE7\uD83C\uDDF7" },
  { value: "MX", label: "멕시코", flag: "\uD83C\uDDF2\uD83C\uDDFD" },
  { value: "ES", label: "스페인", flag: "\uD83C\uDDEA\uD83C\uDDF8" },
  { value: "FR", label: "프랑스", flag: "\uD83C\uDDEB\uD83C\uDDF7" },
  { value: "DE", label: "독일", flag: "\uD83C\uDDE9\uD83C\uDDEA" },
  { value: "GB", label: "영국", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { value: "AU", label: "호주", flag: "\uD83C\uDDE6\uD83C\uDDFA" },
  { value: "SG", label: "싱가포르", flag: "\uD83C\uDDF8\uD83C\uDDEC" },
  { value: "TW", label: "대만", flag: "\uD83C\uDDF9\uD83C\uDDFC" },
  { value: "HK", label: "홍콩", flag: "\uD83C\uDDED\uD83C\uDDF0" },
] as const;

type DateRange = "7d" | "30d" | "all";

function getCountryInfo(code: string) {
  return TARGET_COUNTRIES.find((c) => c.value === code) ?? TARGET_COUNTRIES[0];
}

function getPlatformInfo(platform: string) {
  return PLATFORMS.find((p) => p.value === platform) ?? PLATFORMS[0];
}

function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`;
  return date.toLocaleDateString("ko-KR");
}

function isWithinDays(dateStr: string, days: number): boolean {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  return diffMs <= days * 86400000;
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function MasterKeywordsPage() {
  const supabase = createClient();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [newKeyword, setNewKeyword] = useState("");
  const [newPlatform, setNewPlatform] = useState<string>("all");
  const [newTargetCountry, setNewTargetCountry] = useState<string>("ALL");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<string>("ALL_FILTER");
  const [filterCountry, setFilterCountry] = useState<string>("ALL_FILTER");
  const [filterDateRange, setFilterDateRange] = useState<DateRange>("all");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKeyword, setEditKeyword] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [editCountry, setEditCountry] = useState("");

  // Dialogs
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<
    { keyword: string; platform: string; target_country: string; isDuplicate?: boolean }[]
  >([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkPlatformOpen, setBulkPlatformOpen] = useState(false);
  const [bulkCountryOpen, setBulkCountryOpen] = useState(false);

  // Extraction stats
  const [extractionStats, setExtractionStats] = useState<Record<string, KeywordExtractionStats>>({});
  const [platformExtractionStats, setPlatformExtractionStats] = useState<Record<string, { runs: number; extracted: number }>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  async function fetchExtractionStats() {
    const { data } = await supabase
      .from("extraction_jobs")
      .select("source_id, platform, total_extracted, new_extracted, status, completed_at, created_at")
      .eq("type", "keyword")
      .order("created_at", { ascending: false });

    if (!data) return;
    const jobs = data as Pick<ExtractionJob, "source_id" | "platform" | "total_extracted" | "new_extracted" | "status" | "completed_at" | "created_at">[];

    // Per-keyword stats
    const kwStats: Record<string, KeywordExtractionStats> = {};
    // Per-platform stats
    const platStats: Record<string, { runs: number; extracted: number }> = {};

    for (const job of jobs) {
      const kwId = job.source_id;
      if (kwId) {
        if (!kwStats[kwId]) {
          kwStats[kwId] = { runCount: 0, totalExtracted: 0, lastRunAt: null, lastStatus: null };
        }
        kwStats[kwId].runCount++;
        kwStats[kwId].totalExtracted += job.total_extracted;
        if (!kwStats[kwId].lastRunAt) {
          kwStats[kwId].lastRunAt = job.completed_at ?? job.created_at;
          kwStats[kwId].lastStatus = job.status;
        }
      }

      const p = job.platform;
      if (!platStats[p]) platStats[p] = { runs: 0, extracted: 0 };
      platStats[p].runs++;
      platStats[p].extracted += job.total_extracted;
    }

    setExtractionStats(kwStats);
    setPlatformExtractionStats(platStats);
  }

  useEffect(() => {
    fetchKeywords();
    fetchExtractionStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const realtimeCallback = useCallback(() => {
    fetchKeywords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useRealtime("keywords", undefined, realtimeCallback);

  async function fetchKeywords() {
    setLoading(true);
    const { data, error } = await supabase
      .from("keywords")
      .select("*")
      .is("campaign_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("키워드 로드 실패");
    } else {
      setKeywords((data as Keyword[]) ?? []);
    }
    setLoading(false);
  }

  // ---------------------------------------------------------------------------
  // Filtered & computed data
  // ---------------------------------------------------------------------------

  const filteredKeywords = useMemo(() => {
    let result = keywords;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((kw) => kw.keyword.toLowerCase().includes(q));
    }

    // Platform filter
    if (filterPlatform !== "ALL_FILTER") {
      result = result.filter((kw) => (kw.platform ?? "all") === filterPlatform);
    }

    // Country filter
    if (filterCountry !== "ALL_FILTER") {
      result = result.filter(
        (kw) => (kw.target_country ?? "ALL") === filterCountry
      );
    }

    // Date range filter
    if (filterDateRange === "7d") {
      result = result.filter((kw) => isWithinDays(kw.created_at, 7));
    } else if (filterDateRange === "30d") {
      result = result.filter((kw) => isWithinDays(kw.created_at, 30));
    }

    return result;
  }, [keywords, searchQuery, filterPlatform, filterCountry, filterDateRange]);

  // Statistics
  const stats = useMemo(() => {
    const platformCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    let thisWeekCount = 0;

    for (const kw of keywords) {
      const p = kw.platform ?? "all";
      platformCounts[p] = (platformCounts[p] ?? 0) + 1;

      const c = kw.target_country ?? "ALL";
      countryCounts[c] = (countryCounts[c] ?? 0) + 1;

      if (isWithinDays(kw.created_at, 7)) {
        thisWeekCount++;
      }
    }

    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Total extraction stats
    let totalRuns = 0;
    let totalExtracted = 0;
    for (const s of Object.values(extractionStats)) {
      totalRuns += s.runCount;
      totalExtracted += s.totalExtracted;
    }

    return {
      total: keywords.length,
      platformCounts,
      topCountries,
      thisWeekCount,
      totalRuns,
      totalExtracted,
    };
  }, [keywords, extractionStats]);

  // Selection helpers
  const allFilteredSelected =
    filteredKeywords.length > 0 &&
    filteredKeywords.every((kw) => selectedIds.has(kw.id));

  const someFilteredSelected =
    filteredKeywords.some((kw) => selectedIds.has(kw.id)) &&
    !allFilteredSelected;

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredKeywords.map((kw) => kw.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // CRUD handlers
  // ---------------------------------------------------------------------------

  async function handleCreate() {
    const rawInput = newKeyword.trim();
    if (!rawInput) {
      toast.error("키워드를 입력하세요.");
      return;
    }

    // Support comma-separated multi-keyword input
    const keywordList = rawInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (keywordList.length === 0) {
      toast.error("키워드를 입력하세요.");
      return;
    }

    // Duplicate check against existing keywords
    const existingSet = new Set(
      keywords.map((kw) => `${kw.keyword.toLowerCase()}|${kw.platform}|${kw.target_country}`)
    );
    const duplicates: string[] = [];
    const newItems: { keyword: string; platform: string; target_country: string; campaign_id: null }[] = [];

    for (const kw of keywordList) {
      const key = `${kw.toLowerCase()}|${newPlatform}|${newTargetCountry}`;
      if (existingSet.has(key)) {
        duplicates.push(kw);
      } else {
        newItems.push({
          keyword: kw,
          platform: newPlatform,
          target_country: newTargetCountry,
          campaign_id: null,
        });
        existingSet.add(key); // prevent duplicates within the batch
      }
    }

    if (duplicates.length > 0 && newItems.length === 0) {
      toast.error(`이미 존재하는 키워드입니다: ${duplicates.join(", ")}`);
      return;
    }

    if (newItems.length === 0) return;

    const { error } = await supabase.from("keywords").insert(newItems);

    if (error) {
      if (error.code === "23505") {
        toast.error("이미 동일한 키워드가 존재합니다.");
      } else {
        toast.error("키워드 생성 실패: " + error.message);
      }
    } else {
      const msg =
        newItems.length === 1
          ? `"${newItems[0].keyword}" 키워드가 추가되었습니다.`
          : `${newItems.length}개 키워드가 추가되었습니다.`;
      if (duplicates.length > 0) {
        toast.success(`${msg} (중복 ${duplicates.length}개 건너뜀)`);
      } else {
        toast.success(msg);
      }
      setNewKeyword("");
      fetchKeywords();
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("keywords").delete().eq("id", id);
    if (error) {
      toast.error("삭제 실패");
    } else {
      setKeywords((prev) => prev.filter((k) => k.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("키워드가 삭제되었습니다.");
    }
    setDeleteConfirmOpen(false);
    setDeleteTargetId(null);
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("keywords")
      .delete()
      .in("id", ids);

    if (error) {
      toast.error("일괄 삭제 실패: " + error.message);
    } else {
      toast.success(`${ids.length}개 키워드가 삭제되었습니다.`);
      setSelectedIds(new Set());
      fetchKeywords();
    }
    setBulkDeleteConfirmOpen(false);
  }

  async function handleBulkPlatformChange(platform: string) {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);

    const { error } = await supabase
      .from("keywords")
      .update({ platform })
      .in("id", ids);

    if (error) {
      toast.error("플랫폼 일괄 변경 실패: " + error.message);
    } else {
      toast.success(`${ids.length}개 키워드의 플랫폼이 변경되었습니다.`);
      setSelectedIds(new Set());
      fetchKeywords();
    }
    setBulkPlatformOpen(false);
  }

  async function handleBulkCountryChange(country: string) {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);

    const { error } = await supabase
      .from("keywords")
      .update({ target_country: country })
      .in("id", ids);

    if (error) {
      toast.error("국가 일괄 변경 실패: " + error.message);
    } else {
      toast.success(`${ids.length}개 키워드의 국가가 변경되었습니다.`);
      setSelectedIds(new Set());
      fetchKeywords();
    }
    setBulkCountryOpen(false);
  }

  // ---------------------------------------------------------------------------
  // Inline editing
  // ---------------------------------------------------------------------------

  function startEditing(kw: Keyword) {
    setEditingId(kw.id);
    setEditKeyword(kw.keyword);
    setEditPlatform(kw.platform ?? "all");
    setEditCountry(kw.target_country ?? "ALL");
    setTimeout(() => editInputRef.current?.focus(), 50);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditKeyword("");
    setEditPlatform("");
    setEditCountry("");
  }

  async function saveEditing() {
    if (!editingId || !editKeyword.trim()) {
      toast.error("키워드를 입력하세요.");
      return;
    }

    const { error } = await supabase
      .from("keywords")
      .update({
        keyword: editKeyword.trim(),
        platform: editPlatform,
        target_country: editCountry,
      })
      .eq("id", editingId);

    if (error) {
      if (error.code === "23505") {
        toast.error("동일한 키워드가 이미 존재합니다.");
      } else {
        toast.error("수정 실패: " + error.message);
      }
    } else {
      toast.success("키워드가 수정되었습니다.");
      fetchKeywords();
    }
    cancelEditing();
  }

  // ---------------------------------------------------------------------------
  // CSV Import / Export
  // ---------------------------------------------------------------------------

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function parseCSV(text: string) {
    const lines = text
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      toast.error("CSV 파일에 헤더 행과 최소 1개의 데이터 행이 필요합니다.");
      return;
    }

    const headerParts = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const keywordIdx = headerParts.indexOf("keyword");

    if (keywordIdx < 0) {
      toast.error(
        "CSV 헤더에 'keyword' 컬럼이 필요합니다. 예: keyword,platform,target_country"
      );
      return;
    }

    const platformIdx = headerParts.indexOf("platform");
    const countryIdx = headerParts.indexOf("target_country");

    const validCountryCodes = TARGET_COUNTRIES.map((c) => c.value as string);
    const validPlatforms = PLATFORMS.map((p) => p.value as string);
    const existingSet = new Set(
      keywords.map(
        (kw) =>
          `${kw.keyword.toLowerCase()}|${kw.platform}|${kw.target_country}`
      )
    );

    const rows: typeof csvPreview = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      const keyword = parts[keywordIdx]?.trim();
      if (!keyword) continue;

      let platform =
        platformIdx >= 0
          ? (parts[platformIdx]?.trim().toLowerCase() ?? "all")
          : "all";
      if (!validPlatforms.includes(platform)) platform = "all";

      let country =
        countryIdx >= 0
          ? (parts[countryIdx]?.trim().toUpperCase() ?? "ALL")
          : "ALL";
      if (!validCountryCodes.includes(country)) country = "ALL";

      const isDuplicate = existingSet.has(
        `${keyword.toLowerCase()}|${platform}|${country}`
      );

      rows.push({ keyword, platform, target_country: country, isDuplicate });
    }

    if (rows.length === 0) {
      toast.error("유효한 키워드가 없습니다.");
      return;
    }

    setCsvPreview(rows);
    setCsvDialogOpen(true);
  }

  async function handleCsvImport() {
    const nonDuplicate = csvPreview.filter((r) => !r.isDuplicate);
    if (nonDuplicate.length === 0) {
      toast.error("가져올 수 있는 새 키워드가 없습니다.");
      return;
    }
    setCsvImporting(true);

    try {
      const insertRows = nonDuplicate.map((row) => ({
        campaign_id: null,
        keyword: row.keyword,
        platform: row.platform,
        target_country: row.target_country,
      }));

      const { error } = await supabase.from("keywords").insert(insertRows);

      if (error) {
        toast.error("CSV 가져오기 실패: " + error.message);
      } else {
        const dupCount = csvPreview.length - nonDuplicate.length;
        const msg = `${nonDuplicate.length}개 키워드를 가져왔습니다.`;
        if (dupCount > 0) {
          toast.success(`${msg} (중복 ${dupCount}개 건너뜀)`);
        } else {
          toast.success(msg);
        }
        setCsvDialogOpen(false);
        setCsvPreview([]);
        fetchKeywords();
      }
    } catch {
      toast.error("CSV 가져오기 중 오류가 발생했습니다.");
    } finally {
      setCsvImporting(false);
    }
  }

  function handleCsvExport() {
    const filtered = filteredKeywords;
    if (filtered.length === 0) {
      toast.error("내보낼 키워드가 없습니다.");
      return;
    }

    const header = "keyword,platform,target_country,created_at";
    const rows = filtered.map((kw) => {
      const keyword = kw.keyword.includes(",")
        ? `"${kw.keyword}"`
        : kw.keyword;
      return `${keyword},${kw.platform ?? "all"},${kw.target_country ?? "ALL"},${kw.created_at}`;
    });

    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keywords_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`${filtered.length}개 키워드를 내보냈습니다.`);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const duplicateCountInCsv = csvPreview.filter((r) => r.isDuplicate).length;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Page Header                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">키워드 관리</h2>
          <p className="text-sm text-muted-foreground mt-1">
            인플루언서 추출에 사용할 키워드를 등록하고 관리합니다. 쉼표로 구분하여 여러 키워드를 한 번에 추가할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                CSV 가져오기
              </Button>
            </TooltipTrigger>
            <TooltipContent>CSV 파일에서 키워드 일괄 가져오기</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleCsvExport}>
                <Download className="w-4 h-4 mr-1.5" />
                CSV 내보내기
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              필터된 키워드를 CSV로 다운로드
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Statistics Dashboard                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Keywords */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  전체 키워드
                </p>
                <p className="text-xl font-bold mt-0.5">{stats.total}</p>
              </div>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Hash className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* This week */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  이번 주 추가
                </p>
                <p className="text-xl font-bold mt-0.5">{stats.thisWeekCount}</p>
              </div>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Extraction Runs */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              총 추출 횟수
            </p>
            <p className="text-xl font-bold mt-0.5">{stats.totalRuns.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* Total Extracted */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              총 추출 결과
            </p>
            <p className="text-xl font-bold mt-0.5">{stats.totalExtracted.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* Platform extraction breakdown */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              플랫폼별 키워드
            </p>
            <div className="space-y-1">
              {PLATFORMS.filter((p) => p.value !== "all").map((p) => {
                const kwCount = stats.platformCounts[p.value] ?? 0;
                const extStats = platformExtractionStats[p.value];
                return (
                  <div key={p.value} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_DOTS[p.value]}`} />
                      <span className="text-muted-foreground">{p.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{kwCount}</span>
                      {extStats && (
                        <span className="text-[10px] text-muted-foreground">
                          ({extStats.extracted.toLocaleString()}명)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {(stats.platformCounts["all"] ?? 0) > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                    <span className="text-muted-foreground">전체</span>
                  </div>
                  <span className="font-medium">{stats.platformCounts["all"]}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Country breakdown */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              국가별 (Top 5)
            </p>
            <div className="space-y-1">
              {stats.topCountries.map(([code, count]) => {
                const info = getCountryInfo(code);
                return (
                  <div key={code} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      {info.flag ? `${info.flag} ` : ""}{info.label}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                );
              })}
              {stats.topCountries.length === 0 && (
                <p className="text-[10px] text-muted-foreground">데이터 없음</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Add Keyword Section                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/[0.03] to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            키워드 추가
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 min-w-0">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                키워드 (쉼표로 여러 개 입력 가능)
              </label>
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="예: 뷰티, skincare, 맛집"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-9"
              />
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                플랫폼
              </label>
              <Select value={newPlatform} onValueChange={setNewPlatform}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                타겟 국가
              </label>
              <Select
                value={newTargetCountry}
                onValueChange={setNewTargetCountry}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.flag ? `${c.flag} ${c.label}` : c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} className="h-9 px-5 shrink-0">
              <Plus className="w-4 h-4 mr-1.5" />
              추가
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Filter Bar                                                          */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="키워드 검색..."
                className="pl-9 h-9"
              />
            </div>

            {/* Platform filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterPlatform("ALL_FILTER")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterPlatform === "ALL_FILTER"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                전체
              </button>
              {PLATFORMS.filter((p) => p.value !== "all").map((p) => (
                <button
                  key={p.value}
                  onClick={() =>
                    setFilterPlatform(
                      filterPlatform === p.value ? "ALL_FILTER" : p.value
                    )
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    filterPlatform === p.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      filterPlatform === p.value
                        ? "bg-primary-foreground"
                        : PLATFORM_DOTS[p.value]
                    }`}
                  />
                  {p.label}
                </button>
              ))}
            </div>

            {/* Country filter */}
            <Select value={filterCountry} onValueChange={setFilterCountry}>
              <SelectTrigger className="w-36 h-9">
                <Globe className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="국가 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_FILTER">전체 국가</SelectItem>
                {TARGET_COUNTRIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.flag ? `${c.flag} ${c.label}` : c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date range filter */}
            <Select
              value={filterDateRange}
              onValueChange={(v) => setFilterDateRange(v as DateRange)}
            >
              <SelectTrigger className="w-36 h-9">
                <Calendar className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 기간</SelectItem>
                <SelectItem value="7d">최근 7일</SelectItem>
                <SelectItem value="30d">최근 30일</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Bulk Action Bar (shown when items selected)                         */}
      {/* ------------------------------------------------------------------ */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium">
            {selectedIds.size}개 선택됨
          </span>
          <div className="flex gap-2 ml-auto">
            {/* Bulk platform change */}
            <DropdownMenu
              open={bulkPlatformOpen}
              onOpenChange={setBulkPlatformOpen}
            >
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  플랫폼 변경
                  <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PLATFORMS.map((p) => (
                  <DropdownMenuItem
                    key={p.value}
                    onClick={() => handleBulkPlatformChange(p.value)}
                  >
                    <span
                      className={`w-2 h-2 rounded-full mr-2 ${PLATFORM_DOTS[p.value]}`}
                    />
                    {p.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Bulk country change */}
            <DropdownMenu
              open={bulkCountryOpen}
              onOpenChange={setBulkCountryOpen}
            >
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  국가 변경
                  <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                {TARGET_COUNTRIES.map((c) => (
                  <DropdownMenuItem
                    key={c.value}
                    onClick={() => handleBulkCountryChange(c.value)}
                  >
                    {c.flag ? `${c.flag} ` : ""}
                    {c.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Bulk delete */}
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setBulkDeleteConfirmOpen(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              삭제
            </Button>

            {/* Clear selection */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              선택 해제
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Keywords Table                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              키워드 목록
              <span className="text-muted-foreground font-normal ml-2">
                {filteredKeywords.length}개
                {filteredKeywords.length !== keywords.length &&
                  ` / 전체 ${keywords.length}개`}
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-12 pl-4">
                  <Checkbox
                    checked={allFilteredSelected}
                    // Use data attribute for indeterminate via CSS/JS
                    ref={(el) => {
                      if (el) {
                        const input = el as unknown as { dataset: DOMStringMap };
                        if (someFilteredSelected) {
                          input.dataset.state = "indeterminate";
                        }
                      }
                    }}
                    onCheckedChange={toggleSelectAll}
                    aria-label="전체 선택"
                  />
                </TableHead>
                <TableHead>키워드</TableHead>
                <TableHead className="w-32">플랫폼</TableHead>
                <TableHead className="w-32">국가</TableHead>
                <TableHead className="w-40">추출 현황</TableHead>
                <TableHead className="w-32">등록일</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-16 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span className="text-sm">키워드를 불러오는 중...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredKeywords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-16 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Hash className="h-8 w-8 text-muted-foreground/40" />
                      <span className="text-sm">
                        {keywords.length === 0
                          ? "등록된 키워드가 없습니다. 위에서 키워드를 추가해 보세요."
                          : "필터 조건에 맞는 키워드가 없습니다."}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredKeywords.map((kw) => {
                  const countryInfo = getCountryInfo(
                    kw.target_country ?? "ALL"
                  );
                  const platformInfo = getPlatformInfo(kw.platform ?? "all");
                  const isEditing = editingId === kw.id;
                  const isSelected = selectedIds.has(kw.id);

                  return (
                    <TableRow
                      key={kw.id}
                      className={`group transition-colors ${
                        isSelected ? "bg-primary/[0.04]" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(kw.id)}
                          aria-label={`${kw.keyword} 선택`}
                        />
                      </TableCell>

                      {/* Keyword */}
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              ref={editInputRef}
                              value={editKeyword}
                              onChange={(e) => setEditKeyword(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEditing();
                                if (e.key === "Escape") cancelEditing();
                              }}
                              className="h-7 text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-emerald-600"
                              onClick={saveEditing}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground"
                              onClick={cancelEditing}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span
                            className="font-medium cursor-pointer hover:text-primary transition-colors"
                            onDoubleClick={() => startEditing(kw)}
                          >
                            {kw.keyword}
                          </span>
                        )}
                      </TableCell>

                      {/* Platform */}
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editPlatform}
                            onValueChange={setEditPlatform}
                          >
                            <SelectTrigger className="h-7 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PLATFORMS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant="secondary"
                            className={`text-xs font-medium ${platformInfo.color}`}
                          >
                            {platformInfo.label}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Country */}
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editCountry}
                            onValueChange={setEditCountry}
                          >
                            <SelectTrigger className="h-7 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TARGET_COUNTRIES.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.flag ? `${c.flag} ${c.label}` : c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-xs font-normal">
                            {countryInfo.flag
                              ? `${countryInfo.flag} ${countryInfo.label}`
                              : countryInfo.label}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Extraction Stats */}
                      <TableCell>
                        {(() => {
                          const es = extractionStats[kw.id];
                          if (!es || es.runCount === 0) {
                            return <span className="text-[11px] text-muted-foreground">미추출</span>;
                          }
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal gap-1">
                                    <span className="font-medium">{es.runCount}회</span>
                                    <span className="text-muted-foreground">/</span>
                                    <span className="font-medium">{es.totalExtracted.toLocaleString()}명</span>
                                  </Badge>
                                  {es.lastStatus === "RUNNING" && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs space-y-0.5">
                                  <div>추출 {es.runCount}회 실행</div>
                                  <div>총 {es.totalExtracted.toLocaleString()}명 추출</div>
                                  {es.lastRunAt && (
                                    <div>마지막: {new Date(es.lastRunAt).toLocaleString("ko-KR")}</div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}
                      </TableCell>

                      {/* Date */}
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-muted-foreground cursor-default">
                              {formatRelativeDate(kw.created_at)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {new Date(kw.created_at).toLocaleString("ko-KR")}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        {!isEditing && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => startEditing(kw)}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-2" />
                                수정
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  setDeleteTargetId(kw.id);
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* ------------------------------------------------------------------ */}
      {/* Delete Confirmation Dialog (single)                                 */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              키워드 삭제
            </DialogTitle>
            <DialogDescription>
              이 키워드를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteTargetId(null);
              }}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTargetId && handleDelete(deleteTargetId)}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Bulk Delete Confirmation Dialog                                      */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={setBulkDeleteConfirmOpen}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              일괄 삭제
            </DialogTitle>
            <DialogDescription>
              선택한 {selectedIds.size}개 키워드를 삭제하시겠습니까? 이 작업은
              되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteConfirmOpen(false)}
            >
              취소
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              {selectedIds.size}개 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* CSV Import Preview Dialog                                           */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="w-5 h-5 text-primary" />
              CSV 가져오기 미리보기
            </DialogTitle>
            <DialogDescription>
              {csvPreview.length}개 키워드 중{" "}
              {csvPreview.length - duplicateCountInCsv}개를 가져옵니다.
              {duplicateCountInCsv > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {" "}
                  (중복 {duplicateCountInCsv}개 건너뜀)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>키워드</TableHead>
                  <TableHead className="w-28">플랫폼</TableHead>
                  <TableHead className="w-28">타겟 국가</TableHead>
                  <TableHead className="w-20">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvPreview.map((row, idx) => {
                  const countryInfo = getCountryInfo(row.target_country);
                  const platformInfo = getPlatformInfo(row.platform);
                  return (
                    <TableRow
                      key={idx}
                      className={row.isDuplicate ? "opacity-50" : ""}
                    >
                      <TableCell className="text-muted-foreground text-xs">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.keyword}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${platformInfo.color}`}
                        >
                          {platformInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {countryInfo.flag
                            ? `${countryInfo.flag} ${countryInfo.label}`
                            : countryInfo.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.isDuplicate ? (
                          <Badge
                            variant="outline"
                            className="text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-600"
                          >
                            중복
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-600"
                          >
                            신규
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setCsvDialogOpen(false);
                setCsvPreview([]);
              }}
            >
              취소
            </Button>
            <Button
              onClick={handleCsvImport}
              disabled={
                csvImporting ||
                csvPreview.length - duplicateCountInCsv === 0
              }
            >
              {csvImporting
                ? "가져오는 중..."
                : `${csvPreview.length - duplicateCountInCsv}개 가져오기`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
