"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Plus,
  Trash2,
  Search,
  Upload,
  Download,
  Users,
  AtSign,
  ExternalLink,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";
import { useRealtime } from "@/hooks/use-realtime";

type TaggedAccount = Tables<"tagged_accounts">;
type PlatformFilter = "all" | "instagram" | "tiktok" | "youtube" | "twitter";
type CountryFilter = "all" | string;

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

function getCountryInfo(code: string) {
  return TARGET_COUNTRIES.find((c) => c.value === code) ?? TARGET_COUNTRIES[0];
}

const PLATFORM_BADGE: Record<string, string> = {
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

const PLATFORM_HINT: Record<string, string> = {
  instagram: "태그된 게시물에서 인플루언서 추출",
  tiktok: "@유저네임 검색으로 관련 콘텐츠 추출",
  youtube: "@채널명 검색으로 관련 동영상 추출",
  twitter: "@멘션 검색으로 관련 트윗 추출",
};

function getProfileUrl(username: string, platform: string): string {
  switch (platform) {
    case "instagram": return `https://instagram.com/${username}`;
    case "tiktok": return `https://tiktok.com/@${username}`;
    case "youtube": return `https://youtube.com/@${username}`;
    case "twitter": return `https://x.com/${username}`;
    default: return "#";
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

type VerifyState = { loading: boolean; verified?: boolean; profile?: { display_name: string | null; follower_count: number | null; profile_image_url: string | null; bio: string | null } };

export default function MasterTaggedPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<TaggedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [newUsername, setNewUsername] = useState("");
  const [newPlatform, setNewPlatform] = useState<string>("instagram");
  const [newCountry, setNewCountry] = useState<string>("ALL");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("all");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // CSV import
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ username: string; platform: string; target_country: string }[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verify states per account
  const [verifyStates, setVerifyStates] = useState<Record<string, VerifyState>>({});

  useEffect(() => { fetchAccounts(); }, []);

  const realtimeCallback = useCallback(() => { fetchAccounts(); }, []);
  useRealtime("tagged_accounts", undefined, realtimeCallback);

  async function fetchAccounts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tagged_accounts")
      .select("*")
      .is("campaign_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("태그 계정 로드 실패");
    } else {
      setAccounts((data as TaggedAccount[]) ?? []);
    }
    setLoading(false);
  }

  async function verifyAccount(accountId: string, username: string, platform: string) {
    setVerifyStates((prev) => ({ ...prev, [accountId]: { loading: true } }));
    try {
      const res = await fetch("/api/tagged/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, platform }),
      });
      const data = await res.json();
      setVerifyStates((prev) => ({
        ...prev,
        [accountId]: { loading: false, verified: data.verified, profile: data.profile },
      }));
      if (data.verified) {
        toast.success(`@${username} 검증 완료`);
      } else {
        toast.warning(`@${username} 계정을 찾을 수 없습니다`);
      }
    } catch {
      setVerifyStates((prev) => ({ ...prev, [accountId]: { loading: false, verified: false } }));
      toast.error("검증 중 오류 발생");
    }
  }

  async function handleCreate() {
    const rawInput = newUsername.trim();
    if (!rawInput) { toast.error("계정 유저네임을 입력하세요."); return; }

    // Support comma-separated usernames
    const usernames = rawInput.split(",").map((u) => u.trim().replace(/^@/, "")).filter(Boolean);
    if (usernames.length === 0) { toast.error("유효한 유저네임을 입력하세요."); return; }

    let added = 0;
    let dupes = 0;
    const newIds: string[] = [];
    for (const username of usernames) {
      const { data, error } = await supabase.from("tagged_accounts").insert({
        campaign_id: null,
        account_username: username,
        platform: newPlatform,
        target_country: newCountry,
      }).select("id").single();
      if (error) {
        if (error.code === "23505") dupes++;
        else toast.error(`추가 실패 (${username}): ${error.message}`);
      } else {
        added++;
        if (data) newIds.push(data.id);
      }
    }

    if (added > 0) toast.success(`${added}개 태그 계정이 추가되었습니다.`);
    if (dupes > 0) toast.warning(`${dupes}개 중복 계정 건너뜀`);
    setNewUsername("");
    await fetchAccounts();

    // Auto-verify newly added accounts (single accounts only for efficiency)
    if (usernames.length === 1 && newIds.length === 1) {
      verifyAccount(newIds[0], usernames[0], newPlatform);
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("tagged_accounts").delete().eq("id", id);
    if (error) { toast.error("삭제 실패"); }
    else {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      toast.success("태그 계정이 삭제되었습니다.");
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    let deleted = 0;
    for (const id of ids) {
      const { error } = await supabase.from("tagged_accounts").delete().eq("id", id);
      if (!error) deleted++;
    }
    toast.success(`${deleted}개 태그 계정이 삭제되었습니다.`);
    setSelectedIds(new Set());
    setDeleteConfirmOpen(false);
    fetchAccounts();
  }

  // CSV Import
  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const startIdx = lines[0]?.toLowerCase().includes("username") ? 1 : 0;
      const parsed: { username: string; platform: string; target_country: string }[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(",").map((s) => s.trim().replace(/"/g, ""));
        if (parts[0]) {
          parsed.push({
            username: parts[0].replace(/^@/, ""),
            platform: parts[1] || "instagram",
            target_country: parts[2] || "ALL",
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
    setCsvImporting(true);
    let added = 0;
    let dupes = 0;
    for (const row of csvPreview) {
      const { error } = await supabase.from("tagged_accounts").insert({
        campaign_id: null,
        account_username: row.username,
        platform: row.platform,
        target_country: row.target_country,
      });
      if (error) {
        if (error.code === "23505") dupes++;
      } else {
        added++;
      }
    }
    toast.success(`${added}개 추가, ${dupes}개 중복 건너뜀`);
    setCsvImporting(false);
    setCsvDialogOpen(false);
    setCsvPreview([]);
    fetchAccounts();
  }

  function exportCsv() {
    const header = "username,platform,target_country,created_at";
    const rows = accounts.map((a) => `${a.account_username},${a.platform},${a.target_country ?? "ALL"},${a.created_at}`);
    const blob = new Blob(["\uFEFF" + header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tagged_accounts_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filteredAccounts.map((a) => a.id)));
    else setSelectedIds(new Set());
  };
  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  // Filtered data
  const filteredAccounts = accounts.filter((acc) => {
    if (platformFilter !== "all" && acc.platform !== platformFilter) return false;
    if (countryFilter !== "all" && (acc.target_country ?? "ALL") !== countryFilter) return false;
    if (searchQuery && !acc.account_username.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Stats
  const platformCounts: Record<string, number> = {};
  for (const acc of accounts) {
    platformCounts[acc.platform] = (platformCounts[acc.platform] ?? 0) + 1;
  }

  const countryCounts: Record<string, number> = {};
  for (const acc of accounts) {
    const c = acc.target_country ?? "ALL";
    countryCounts[c] = (countryCounts[c] ?? 0) + 1;
  }
  const usedCountries = Object.keys(countryCounts).filter((c) => c !== "ALL");

  const allSelected = filteredAccounts.length > 0 && filteredAccounts.every((a) => selectedIds.has(a.id));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">태그됨 계정 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            경쟁사/관련 브랜드 계정을 등록하여 인플루언서를 추출합니다. 4개 플랫폼 지원.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1.5" />CSV 가져오기
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={accounts.length === 0}>
            <Download className="w-4 h-4 mr-1.5" />내보내기
          </Button>
        </div>
      </div>

      {/* Stats Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setPlatformFilter("all"); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
            platformFilter === "all" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:border-primary/30 text-muted-foreground"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          전체 <span className="font-bold text-foreground">{accounts.length}</span>
        </button>
        {PLATFORMS.filter((p) => p.value !== "threads").map((p) => (
          <button
            key={p.value}
            onClick={() => setPlatformFilter(p.value as PlatformFilter)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
              platformFilter === p.value ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:border-primary/30 text-muted-foreground"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${PLATFORM_DOT[p.value] ?? "bg-gray-400"}`} />
            {p.label} <span className="font-bold text-foreground">{platformCounts[p.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Add Account - Inline Form */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="유저네임 입력 (쉼표로 여러개: nike, glossier, innisfree)"
                className="pl-10 h-10"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <Select value={newPlatform} onValueChange={setNewPlatform}>
              <SelectTrigger className="w-36 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.filter((p) => p.value !== "threads").map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newCountry} onValueChange={setNewCountry}>
              <SelectTrigger className="w-32 h-10">
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
            <Button onClick={handleCreate} className="h-10 px-5">
              <Plus className="w-4 h-4 mr-1.5" />추가
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 pl-10">
            {PLATFORM_HINT[newPlatform] ?? ""}
          </p>
        </CardContent>
      </Card>

      {/* Search + Country Filter + Bulk Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="계정 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        {usedCountries.length > 0 && (
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-32 h-9">
              <Globe className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="국가" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 국가</SelectItem>
              {TARGET_COUNTRIES.filter((c) => countryCounts[c.value]).map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.flag ? `${c.flag} ${c.label}` : c.label} ({countryCounts[c.value]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">{selectedIds.size}개 선택</span>
            <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="w-4 h-4 mr-1" />선택 삭제
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>선택 해제</Button>
          </div>
        )}
      </div>

      {/* Accounts Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                </TableHead>
                <TableHead className="min-w-[220px]">계정</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>팔로워</TableHead>
                <TableHead className="min-w-[200px]">바이오</TableHead>
                <TableHead>국가</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">로딩 중...</TableCell>
                </TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <AtSign className="w-8 h-8 opacity-30" />
                      <p className="font-medium">태그 계정이 없습니다</p>
                      <p className="text-sm">경쟁사나 브랜드 계정을 추가하여 인플루언서를 추출하세요</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((acc) => {
                  const vState = verifyStates[acc.id];
                  const countryInfo = getCountryInfo(acc.target_country ?? "ALL");
                  const profileUrl = getProfileUrl(acc.account_username, acc.platform);
                  const isVerified = vState?.verified === true;
                  const profile = vState?.profile;
                  return (
                    <TableRow key={acc.id} className={selectedIds.has(acc.id) ? "bg-primary/5" : ""}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(acc.id)}
                          onCheckedChange={(checked) => handleSelectOne(acc.id, !!checked)}
                        />
                      </TableCell>
                      {/* 계정: 프로필사진 + 이름 + @유저네임 (클릭 시 실제 프로필 링크) */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          {isVerified && profile?.profile_image_url ? (
                            <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <img
                                src={profile.profile_image_url}
                                alt={acc.account_username}
                                className="w-9 h-9 rounded-full object-cover border hover:ring-2 hover:ring-primary/30 transition-shadow"
                              />
                            </a>
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <AtSign className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            {isVerified && profile?.display_name && (
                              <p className="text-sm font-medium truncate leading-tight">
                                {profile.display_name}
                              </p>
                            )}
                            <a
                              href={profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              @{acc.account_username}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                        </div>
                      </TableCell>
                      {/* 플랫폼 */}
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${PLATFORM_BADGE[acc.platform] ?? ""}`}>
                          {PLATFORMS.find((p) => p.value === acc.platform)?.label ?? acc.platform}
                        </Badge>
                      </TableCell>
                      {/* 팔로워 */}
                      <TableCell>
                        {isVerified && profile?.follower_count != null ? (
                          <span className="text-sm font-medium tabular-nums">
                            {profile.follower_count >= 1_000_000
                              ? `${(profile.follower_count / 1_000_000).toFixed(1)}M`
                              : profile.follower_count >= 1_000
                                ? `${(profile.follower_count / 1_000).toFixed(1)}K`
                                : profile.follower_count.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {/* 바이오 */}
                      <TableCell>
                        {isVerified && profile?.bio ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-muted-foreground line-clamp-2 max-w-[240px] cursor-default">
                                {profile.bio}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-sm">
                              <p className="text-xs whitespace-pre-wrap">{profile.bio}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {/* 국가 */}
                      <TableCell>
                        {countryInfo.flag ? (
                          <Badge variant="outline" className="text-xs">
                            {countryInfo.flag} {countryInfo.label}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">전체</Badge>
                        )}
                      </TableCell>
                      {/* 검증 상태 */}
                      <TableCell>
                        {vState?.loading ? (
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">검증 중</span>
                          </div>
                        ) : isVerified ? (
                          <Badge variant="outline" className="text-[10px] border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            확인됨
                          </Badge>
                        ) : vState?.verified === false ? (
                          <Badge variant="outline" className="text-[10px] border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950 dark:text-red-400 gap-1">
                            <XCircle className="w-3 h-3" />
                            미확인
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2.5 text-[10px]"
                            onClick={() => verifyAccount(acc.id, acc.account_username, acc.platform)}
                          >
                            <Search className="w-3 h-3 mr-1" />
                            검증
                          </Button>
                        )}
                      </TableCell>
                      {/* 등록일 */}
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground cursor-default">
                              {timeAgo(acc.created_at)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {new Date(acc.created_at).toLocaleString("ko-KR")}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      {/* 삭제 */}
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)}>
                          <Trash2 className="w-4 h-4 text-destructive/70" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Count */}
      {!loading && filteredAccounts.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          총 <strong className="text-foreground">{filteredAccounts.length}</strong>개 계정
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
                  <TableHead>국가</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvPreview.slice(0, 50).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">@{row.username}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{row.platform}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getCountryInfo(row.target_country).flag} {getCountryInfo(row.target_country).label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {csvPreview.length > 50 && (
            <p className="text-sm text-muted-foreground">... 외 {csvPreview.length - 50}개</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCsvDialogOpen(false)}>취소</Button>
            <Button onClick={handleCsvImport} disabled={csvImporting}>
              {csvImporting ? "가져오는 중..." : `${csvPreview.length}개 가져오기`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {selectedIds.size}개 계정 삭제
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            선택한 {selectedIds.size}개의 태그 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>취소</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
