"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Search,
  Upload,
  Download,
  AtSign,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Building2,
  BarChart3,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";
import { useRealtime } from "@/hooks/use-realtime";

type BrandAccount = Tables<"brand_accounts">;
type PlatformFilter = "all" | "instagram" | "tiktok" | "youtube" | "twitter";

const INDUSTRIES = [
  "Beauty",
  "Fashion",
  "Food & Beverage",
  "Health & Wellness",
  "Technology",
  "Travel",
  "Entertainment",
  "Sports",
  "Education",
  "Finance",
  "Automotive",
  "Home & Living",
  "Pet",
  "Gaming",
  "Other",
];

const TARGET_COUNTRIES = [
  { value: "KR", label: "\uD55C\uAD6D", flag: "\uD83C\uDDF0\uD83C\uDDF7" },
  { value: "US", label: "\uBBF8\uAD6D", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { value: "JP", label: "\uC77C\uBCF8", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { value: "CN", label: "\uC911\uAD6D", flag: "\uD83C\uDDE8\uD83C\uDDF3" },
  { value: "TW", label: "\uB300\uB9CC", flag: "\uD83C\uDDF9\uD83C\uDDFC" },
  { value: "VN", label: "\uBCA0\uD2B8\uB0A8", flag: "\uD83C\uDDFB\uD83C\uDDF3" },
  { value: "TH", label: "\uD0DC\uAD6D", flag: "\uD83C\uDDF9\uD83C\uDDED" },
  { value: "ID", label: "\uC778\uB3C4\uB124\uC2DC\uC544", flag: "\uD83C\uDDEE\uD83C\uDDE9" },
  { value: "SG", label: "\uC2F1\uAC00\uD3EC\uB974", flag: "\uD83C\uDDF8\uD83C\uDDEC" },
  { value: "HK", label: "\uD64D\uCF69", flag: "\uD83C\uDDED\uD83C\uDDF0" },
] as const;

const PLATFORM_BADGE: Record<string, string> = {
  instagram:
    "bg-pink-500/10 text-pink-600 border-pink-200 dark:border-pink-800",
  tiktok:
    "bg-gray-500/10 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700",
  youtube: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800",
  twitter: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
};

const PLATFORM_DOT: Record<string, string> = {
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  tiktok: "bg-black dark:bg-white",
  youtube: "bg-red-500",
  twitter: "bg-blue-400",
};

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getProfileUrl(username: string, platform: string): string {
  switch (platform) {
    case "instagram":
      return `https://instagram.com/${username}`;
    case "tiktok":
      return `https://tiktok.com/@${username}`;
    case "youtube":
      return `https://youtube.com/@${username}`;
    case "twitter":
      return `https://x.com/${username}`;
    default:
      return "#";
  }
}

export default function BrandsPage() {
  const supabase = createClient();
  const [brands, setBrands] = useState<BrandAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string>("");

  // Form state
  const [newUsername, setNewUsername] = useState("");
  const [newPlatform, setNewPlatform] = useState("instagram");
  const [newBrandName, setNewBrandName] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [newTargetCountries, setNewTargetCountries] = useState<string[]>([]);
  const [newSubCategory, setNewSubCategory] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [formExpanded, setFormExpanded] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Analyzing states
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  // CSV import
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<
    { username: string; platform: string; brand_name: string; industry: string }[]
  >([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTeamAndBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const realtimeCallback = useCallback(() => {
    fetchBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useRealtime("brand_accounts", undefined, realtimeCallback);

  async function fetchTeamAndBrands() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: member } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (member) {
      setTeamId(member.team_id);
    }
    await fetchBrands();
  }

  async function fetchBrands() {
    setLoading(true);
    const res = await fetch("/api/brands");
    if (res.ok) {
      const data = await res.json();
      setBrands(data as BrandAccount[]);
    } else {
      toast.error("브랜드 로드 실패");
    }
    setLoading(false);
  }

  async function handleCreate() {
    const username = newUsername.trim().replace(/^@/, "");
    if (!username) {
      toast.error("유저네임을 입력하세요");
      return;
    }
    if (!teamId) {
      toast.error("팀 정보를 불러올 수 없습니다");
      return;
    }

    setCreating(true);
    const res = await fetch("/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_id: teamId,
        platform: newPlatform,
        username,
        brand_name: newBrandName || null,
        industry: newIndustry || null,
        target_countries: newTargetCountries.length > 0 ? newTargetCountries : [],
        sub_category: newSubCategory || null,
        notes: newNotes || null,
      }),
    });

    if (res.ok) {
      toast.success(`@${username} 브랜드가 등록되었습니다`);
      setNewUsername("");
      setNewBrandName("");
      setNewIndustry("");
      setNewTargetCountries([]);
      setNewSubCategory("");
      setNewNotes("");
      setFormExpanded(false);
      await fetchBrands();
    } else {
      const err = await res.json();
      if (err.error?.includes("duplicate") || err.error?.includes("unique")) {
        toast.warning("이미 등록된 브랜드입니다");
      } else {
        toast.error(`등록 실패: ${err.error}`);
      }
    }
    setCreating(false);
  }

  async function handleAnalyze(brandId: string) {
    setAnalyzingIds((prev) => new Set(prev).add(brandId));
    try {
      const res = await fetch(`/api/brands/${brandId}/analyze`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("브랜드 분석이 시작되었습니다");
      } else {
        const err = await res.json();
        toast.error(`분석 실패: ${err.error}`);
      }
    } catch {
      toast.error("분석 중 오류 발생");
    }
    setAnalyzingIds((prev) => {
      const next = new Set(prev);
      next.delete(brandId);
      return next;
    });
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/brands?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setBrands((prev) => prev.filter((b) => b.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("브랜드가 삭제되었습니다");
    } else {
      toast.error("삭제 실패");
    }
  }

  async function handleBulkDelete() {
    let deleted = 0;
    for (const id of selectedIds) {
      const res = await fetch(`/api/brands?id=${id}`, { method: "DELETE" });
      if (res.ok) deleted++;
    }
    toast.success(`${deleted}개 브랜드가 삭제되었습니다`);
    setSelectedIds(new Set());
    setDeleteConfirmOpen(false);
    fetchBrands();
  }

  // CSV Import
  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const startIdx = lines[0]?.toLowerCase().includes("username") ? 1 : 0;
      const parsed: {
        username: string;
        platform: string;
        brand_name: string;
        industry: string;
      }[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(",").map((s) => s.trim().replace(/"/g, ""));
        if (parts[0]) {
          parsed.push({
            username: parts[0].replace(/^@/, ""),
            platform: parts[1] || "instagram",
            brand_name: parts[2] || "",
            industry: parts[3] || "",
          });
        }
      }
      setCsvPreview(parsed);
      setCsvDialogOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleCsvImport() {
    if (!teamId) {
      toast.error("팀 정보를 불러올 수 없습니다");
      return;
    }
    setCsvImporting(true);
    let added = 0;
    let dupes = 0;
    for (const row of csvPreview) {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: teamId,
          platform: row.platform,
          username: row.username,
          brand_name: row.brand_name || null,
          industry: row.industry || null,
        }),
      });
      if (res.ok) {
        added++;
      } else {
        const err = await res.json();
        if (
          err.error?.includes("duplicate") ||
          err.error?.includes("unique")
        ) {
          dupes++;
        }
      }
    }
    toast.success(`${added}개 추가, ${dupes}개 중복 건너뜀`);
    setCsvImporting(false);
    setCsvDialogOpen(false);
    setCsvPreview([]);
    fetchBrands();
  }

  function exportCsv() {
    const header = "username,platform,brand_name,industry,follower_count,engagement_rate,created_at";
    const rows = brands.map(
      (b) =>
        `${b.username},${b.platform},${b.brand_name ?? ""},${b.industry ?? ""},${b.follower_count ?? ""},${b.engagement_rate ?? ""},${b.created_at}`
    );
    const blob = new Blob(["\uFEFF" + header + "\n" + rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `brand_accounts_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Filters
  const filteredBrands = brands.filter((b) => {
    if (platformFilter !== "all" && b.platform !== platformFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !b.username.toLowerCase().includes(q) &&
        !(b.brand_name || "").toLowerCase().includes(q) &&
        !(b.industry || "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  // Stats
  const platformCounts: Record<string, number> = {};
  for (const b of brands) {
    platformCounts[b.platform] = (platformCounts[b.platform] ?? 0) + 1;
  }

  const allSelected =
    filteredBrands.length > 0 &&
    filteredBrands.every((b) => selectedIds.has(b.id));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">타겟 브랜드</h1>
          <p className="text-sm text-muted-foreground mt-1">
            경쟁사/관련 브랜드를 등록하고 인플루언서 협업 패턴을 분석합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvFile}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-1.5" />
            CSV 가져오기
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={brands.length === 0}
          >
            <Download className="w-4 h-4 mr-1.5" />
            내보내기
          </Button>
        </div>
      </div>

      {/* Stats Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setPlatformFilter("all")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
            platformFilter === "all"
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border hover:border-primary/30 text-muted-foreground"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          전체{" "}
          <span className="font-bold text-foreground">{brands.length}</span>
        </button>
        {PLATFORMS.filter((p) => p.value !== "threads").map((p) => (
          <button
            key={p.value}
            onClick={() => setPlatformFilter(p.value as PlatformFilter)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
              platformFilter === p.value
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border hover:border-primary/30 text-muted-foreground"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${PLATFORM_DOT[p.value] ?? "bg-gray-400"}`}
            />
            {p.label}{" "}
            <span className="font-bold text-foreground">
              {platformCounts[p.value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Add Brand Form */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                유저네임 *
              </label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="brand_username"
                  className="pl-10 h-10"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
            </div>
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                플랫폼
              </label>
              <Select value={newPlatform} onValueChange={setNewPlatform}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.filter((p) => p.value !== "threads").map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                브랜드명
              </label>
              <Input
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="브랜드명 (선택)"
                className="h-10"
              />
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                업종
              </label>
              <Select value={newIndustry} onValueChange={setNewIndustry}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3 text-xs"
                onClick={() => setFormExpanded(!formExpanded)}
              >
                {formExpanded ? "접기" : "상세"}
              </Button>
              <Button
                onClick={handleCreate}
                className="h-10 px-5"
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="w-4 h-4 mr-1.5" />
                )}
                등록
              </Button>
            </div>
          </div>

          {/* Extended Form Fields */}
          {formExpanded && (
            <div className="mt-4 pt-4 border-t border-dashed space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  타겟 국가
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TARGET_COUNTRIES.map((c) => {
                    const selected = newTargetCountries.includes(c.value);
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                          setNewTargetCountries((prev) =>
                            selected
                              ? prev.filter((v) => v !== c.value)
                              : [...prev, c.value]
                          );
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          selected
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <span>{c.flag}</span>
                        <span>{c.label}</span>
                        {selected && <X className="w-3 h-3 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    세부 카테고리
                  </label>
                  <Input
                    value={newSubCategory}
                    onChange={(e) => setNewSubCategory(e.target.value)}
                    placeholder="예: 스킨케어, 스트리트웨어"
                    className="h-9"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    메모
                  </label>
                  <Textarea
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="브랜드 관련 메모 (선택)"
                    className="min-h-[36px] text-sm"
                    rows={1}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search + Bulk Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="브랜드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size}개 선택
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              선택 삭제
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              선택 해제
            </Button>
          </div>
        )}
      </div>

      {/* Brand Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(c) => {
                      if (c)
                        setSelectedIds(
                          new Set(filteredBrands.map((b) => b.id))
                        );
                      else setSelectedIds(new Set());
                    }}
                  />
                </TableHead>
                <TableHead className="min-w-[220px]">브랜드</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>업종</TableHead>
                <TableHead className="text-right">팔로워</TableHead>
                <TableHead className="text-right">참여율</TableHead>
                <TableHead>타겟 국가</TableHead>
                <TableHead className="text-right">평균좋아요</TableHead>
                <TableHead className="text-right">평균댓글</TableHead>
                <TableHead className="text-right">평균조회</TableHead>
                <TableHead className="text-right">평균저장</TableHead>
                <TableHead className="text-right">게시물</TableHead>
                <TableHead>품질점수</TableHead>
                <TableHead>포스팅빈도</TableHead>
                <TableHead>마지막 분석</TableHead>
                <TableHead className="w-32">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={16}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : filteredBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Building2 className="w-8 h-8 opacity-30" />
                      <p className="font-medium">등록된 브랜드가 없습니다</p>
                      <p className="text-sm">
                        경쟁사나 타겟 브랜드를 등록하여 인플루언서 패턴을
                        분석하세요
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrands.map((brand) => (
                  <TableRow
                    key={brand.id}
                    className={
                      selectedIds.has(brand.id) ? "bg-primary/5" : ""
                    }
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(brand.id)}
                        onCheckedChange={(c) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (c) next.add(brand.id);
                            else next.delete(brand.id);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {brand.profile_image_url ? (
                          <img
                            src={brand.profile_image_url}
                            alt={brand.username}
                            className="w-9 h-9 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-medium truncate">
                              {brand.brand_name ||
                                brand.display_name ||
                                brand.username}
                            </p>
                            {brand.is_verified && (
                              <Badge variant="secondary" className="text-[8px] px-1 py-0 shrink-0">인증</Badge>
                            )}
                            {brand.is_business_account && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">비즈니스</Badge>
                            )}
                          </div>
                          <a
                            href={getProfileUrl(
                              brand.username,
                              brand.platform
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            @{brand.username}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          {brand.biography && (
                            <p className="text-[10px] text-muted-foreground line-clamp-1 max-w-[200px]" title={brand.biography}>
                              {brand.biography}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${PLATFORM_BADGE[brand.platform] ?? ""}`}
                      >
                        {PLATFORMS.find((p) => p.value === brand.platform)
                          ?.label ?? brand.platform}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{brand.industry || "-"}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-medium tabular-nums">
                        {formatNumber(brand.follower_count)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm tabular-nums">
                        {brand.engagement_rate != null
                          ? `${Number(brand.engagement_rate).toFixed(2)}%`
                          : "-"}
                      </span>
                    </TableCell>
                    {/* 타겟 국가 */}
                    <TableCell>
                      {brand.target_countries && brand.target_countries.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {brand.target_countries.map((code) => {
                            const country = TARGET_COUNTRIES.find((c) => c.value === code);
                            return (
                              <span
                                key={code}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-muted"
                                title={country?.label ?? code}
                              >
                                {country?.flag ?? code}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {/* 평균좋아요 */}
                    <TableCell className="text-right">
                      <span className="text-sm tabular-nums">
                        {formatNumber(brand.avg_likes)}
                      </span>
                    </TableCell>
                    {/* 평균댓글 */}
                    <TableCell className="text-right">
                      <span className="text-sm tabular-nums">
                        {formatNumber(brand.avg_comments)}
                      </span>
                    </TableCell>
                    {/* 평균조회 */}
                    <TableCell className="text-right">
                      <span className="text-sm tabular-nums">
                        {formatNumber(brand.avg_views)}
                      </span>
                    </TableCell>
                    {/* 평균저장 */}
                    <TableCell className="text-right">
                      <span className="text-sm tabular-nums">
                        {formatNumber(brand.avg_saves)}
                      </span>
                    </TableCell>
                    {/* 게시물 */}
                    <TableCell className="text-right">
                      <span className="text-sm tabular-nums">
                        {formatNumber(brand.post_count)}
                      </span>
                    </TableCell>
                    {/* 품질점수 */}
                    <TableCell>
                      {brand.audience_quality_score != null ? (
                        <Badge
                          variant="outline"
                          className={`text-xs tabular-nums ${
                            Number(brand.audience_quality_score) >= 70
                              ? "bg-green-500/10 text-green-700 border-green-300 dark:text-green-400 dark:border-green-800"
                              : Number(brand.audience_quality_score) >= 40
                                ? "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-800"
                                : "bg-gray-500/10 text-gray-600 border-gray-300 dark:text-gray-400 dark:border-gray-700"
                          }`}
                        >
                          {Number(brand.audience_quality_score).toFixed(1)}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {/* 포스팅빈도 */}
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {brand.posting_frequency ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {brand.last_analyzed_at
                          ? new Date(brand.last_analyzed_at).toLocaleDateString(
                              "ko-KR"
                            )
                          : "미분석"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => handleAnalyze(brand.id)}
                          disabled={analyzingIds.has(brand.id)}
                        >
                          {analyzingIds.has(brand.id) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <BarChart3 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Link href={`/brands/${brand.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => handleDelete(brand.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Count */}
      {!loading && filteredBrands.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          총{" "}
          <strong className="text-foreground">{filteredBrands.length}</strong>개
          브랜드
        </p>
      )}

      {/* CSV Import Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>CSV 가져오기 미리보기</DialogTitle>
          </DialogHeader>
          <div className="max-h-[300px] overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>유저네임</TableHead>
                  <TableHead>플랫폼</TableHead>
                  <TableHead>브랜드명</TableHead>
                  <TableHead>업종</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvPreview.slice(0, 50).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      @{row.username}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {row.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.brand_name || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.industry || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {csvPreview.length > 50 && (
            <p className="text-sm text-muted-foreground">
              ... 외 {csvPreview.length - 50}개
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCsvDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCsvImport} disabled={csvImporting}>
              {csvImporting
                ? "가져오는 중..."
                : `${csvPreview.length}개 가져오기`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {selectedIds.size}개 브랜드 삭제
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            선택한 {selectedIds.size}개의 브랜드를 삭제하시겠습니까? 관련 분석
            데이터도 함께 삭제됩니다.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              취소
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
