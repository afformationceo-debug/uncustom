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
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";
import { useRealtime } from "@/hooks/use-realtime";

type TaggedAccount = Tables<"tagged_accounts">;
type PlatformFilter = "all" | "instagram" | "tiktok" | "youtube" | "twitter";

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

export default function MasterTaggedPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<TaggedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [newUsername, setNewUsername] = useState("");
  const [newPlatform, setNewPlatform] = useState<string>("instagram");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // CSV import
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ username: string; platform: string }[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleCreate() {
    const rawInput = newUsername.trim();
    if (!rawInput) { toast.error("계정 유저네임을 입력하세요."); return; }

    // Support comma-separated usernames
    const usernames = rawInput.split(",").map((u) => u.trim().replace(/^@/, "")).filter(Boolean);
    if (usernames.length === 0) { toast.error("유효한 유저네임을 입력하세요."); return; }

    let added = 0;
    let dupes = 0;
    for (const username of usernames) {
      const { error } = await supabase.from("tagged_accounts").insert({
        campaign_id: null,
        account_username: username,
        platform: newPlatform,
      });
      if (error) {
        if (error.code === "23505") dupes++;
        else toast.error(`추가 실패 (${username}): ${error.message}`);
      } else {
        added++;
      }
    }

    if (added > 0) toast.success(`${added}개 태그 계정이 추가되었습니다.`);
    if (dupes > 0) toast.warning(`${dupes}개 중복 계정 건너뜀`);
    setNewUsername("");
    fetchAccounts();
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
      // Skip header if it looks like one
      const startIdx = lines[0]?.toLowerCase().includes("username") ? 1 : 0;
      const parsed: { username: string; platform: string }[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(",").map((s) => s.trim().replace(/"/g, ""));
        if (parts[0]) {
          parsed.push({
            username: parts[0].replace(/^@/, ""),
            platform: parts[1] || "instagram",
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
    const header = "username,platform,created_at";
    const rows = accounts.map((a) => `${a.account_username},${a.platform},${a.created_at}`);
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
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
    if (searchQuery && !acc.account_username.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Stats
  const platformCounts: Record<string, number> = {};
  for (const acc of accounts) {
    platformCounts[acc.platform] = (platformCounts[acc.platform] ?? 0) + 1;
  }

  const allSelected = filteredAccounts.length > 0 && filteredAccounts.every((a) => selectedIds.has(a.id));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">태그됨 계정 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            경쟁사/관련 브랜드 계정을 등록하여 해당 계정을 태그한 인플루언서를 추출합니다
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
            <Button onClick={handleCreate} className="h-10 px-5">
              <Plus className="w-4 h-4 mr-1.5" />추가
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search + Bulk Actions */}
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
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                </TableHead>
                <TableHead>유저네임</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="w-20">링크</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">로딩 중...</TableCell>
                </TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <AtSign className="w-8 h-8 opacity-30" />
                      <p className="font-medium">태그 계정이 없습니다</p>
                      <p className="text-sm">경쟁사나 브랜드 계정을 추가하여 인플루언서를 추출하세요</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((acc) => (
                  <TableRow key={acc.id} className={selectedIds.has(acc.id) ? "bg-primary/5" : ""}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(acc.id)}
                        onCheckedChange={(checked) => handleSelectOne(acc.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-sm">@{acc.account_username}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${PLATFORM_BADGE[acc.platform] ?? ""}`}>
                        {PLATFORMS.find((p) => p.value === acc.platform)?.label ?? acc.platform}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">글로벌</Badge>
                    </TableCell>
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
                    <TableCell>
                      <a
                        href={getProfileUrl(acc.account_username, acc.platform)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        프로필 <ExternalLink className="w-3 h-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)}>
                        <Trash2 className="w-4 h-4 text-destructive/70" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
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
