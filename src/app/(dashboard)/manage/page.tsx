"use client";

import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { CampaignSelector } from "@/components/campaign-selector";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import {
  Users,
  Mail,
  Search,
  StickyNote,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import type { Tables } from "@/types/database";
import { CAMPAIGN_INFLUENCER_STATUSES, PLATFORMS } from "@/types/platform";

type CampaignInfluencer = Tables<"campaign_influencers"> & {
  influencer?: Tables<"influencers">;
};

export default function ManagePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">로딩 중...</div>}>
      <ManagePageContent />
    </Suspense>
  );
}

function ManagePageContent() {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const supabase = createClient();

  const [items, setItems] = useState<CampaignInfluencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingNote, setEditingNote] = useState<CampaignInfluencer | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    if (campaignId) {
      fetchItems();
    } else {
      setItems([]);
      setLoading(false);
    }
  }, [campaignId]);

  useRealtime(
    "campaign_influencers",
    campaignId ? `campaign_id=eq.${campaignId}` : undefined,
    () => { if (campaignId) fetchItems(); }
  );

  async function fetchItems() {
    if (!campaignId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("campaign_influencers")
      .select(`
        *,
        influencer:influencers(username, display_name, email, platform, follower_count, profile_image_url, profile_url)
      `)
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (!error) {
      setItems((data as unknown as CampaignInfluencer[]) ?? []);
    }
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("campaign_influencers")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("상태 변경 실패");
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status } : i))
      );
      toast.success("상태가 변경되었습니다.");
    }
  }

  async function updateDate(id: string, field: string, value: string) {
    const { error } = await supabase
      .from("campaign_influencers")
      .update({ [field]: value || null })
      .eq("id", id);

    if (error) {
      toast.error("날짜 변경 실패");
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, [field]: value || null } : i))
      );
    }
  }

  async function saveNote() {
    if (!editingNote) return;
    const { error } = await supabase
      .from("campaign_influencers")
      .update({ notes: noteText || null })
      .eq("id", editingNote.id);

    if (error) {
      toast.error("메모 저장 실패");
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === editingNote.id ? { ...i, notes: noteText || null } : i))
      );
      setEditingNote(null);
      toast.success("메모가 저장되었습니다.");
    }
  }

  function formatCount(n: number | null) {
    if (n === null) return "-";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  const filtered = items.filter((item) => {
    const inf = item.influencer as unknown as Tables<"influencers">;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSearch = !searchQuery ||
      (inf?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (inf?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (inf?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesStatus && matchesSearch;
  });

  const statusCounts: Record<string, number> = {};
  items.forEach((item) => {
    statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">인플루언서 관리</h2>
          <p className="text-sm text-muted-foreground mt-1">
            캠페인 협업 인플루언서 상세 관리
          </p>
        </div>
        <CampaignSelector mode="required" value={campaignId} onChange={setCampaignId} />
      </div>

      {!campaignId ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">캠페인을 선택하세요</p>
          <p className="text-sm mt-1">인플루언서를 관리할 캠페인을 먼저 선택해주세요.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{items.length}명</Badge>
          </div>

          {/* Status Pipeline */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
              }`}
            >
              전체 ({items.length})
            </button>
            {CAMPAIGN_INFLUENCER_STATUSES.map((s) => {
              const count = statusCounts[s.value] ?? 0;
              return (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 ${
                    statusFilter === s.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-accent"
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="이름, 유저네임, 이메일 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10">인플루언서</TableHead>
                    <TableHead>플랫폼</TableHead>
                    <TableHead>팔로워</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>협업일</TableHead>
                    <TableHead>방문일</TableHead>
                    <TableHead>업로드 마감</TableHead>
                    <TableHead>실제 업로드</TableHead>
                    <TableHead>메모</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        로딩 중...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        관리할 인플루언서가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => {
                      const inf = item.influencer as unknown as Tables<"influencers">;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="sticky left-0 bg-card z-10">
                            <div className="flex items-center gap-2">
                              {inf?.profile_image_url ? (
                                <img
                                  src={inf.profile_image_url}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                  <Users className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-sm">
                                  {inf?.display_name ?? inf?.username ?? "-"}
                                </div>
                                {inf?.email && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {inf.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {PLATFORMS.find((p) => p.value === inf?.platform)?.label ?? inf?.platform}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatCount(inf?.follower_count ?? null)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.status}
                              onValueChange={(v) => updateStatus(item.id, v)}
                            >
                              <SelectTrigger className="w-28 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CAMPAIGN_INFLUENCER_STATUSES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    <div className="flex items-center gap-1.5">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: s.color }}
                                      />
                                      {s.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={item.agreed_date ?? ""}
                              onChange={(e) => updateDate(item.id, "agreed_date", e.target.value)}
                              className="w-36 h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={item.visit_date ?? ""}
                              onChange={(e) => updateDate(item.id, "visit_date", e.target.value)}
                              className="w-36 h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={item.upload_deadline ?? ""}
                              onChange={(e) => updateDate(item.id, "upload_deadline", e.target.value)}
                              className="w-36 h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={item.actual_upload_date ?? ""}
                              onChange={(e) => updateDate(item.id, "actual_upload_date", e.target.value)}
                              className="w-36 h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            {item.notes ? (
                              <button
                                onClick={() => {
                                  setEditingNote(item);
                                  setNoteText(item.notes ?? "");
                                }}
                                className="text-xs text-muted-foreground truncate max-w-24 block hover:text-primary"
                                title={item.notes}
                              >
                                {item.notes.slice(0, 20)}...
                              </button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  setEditingNote(item);
                                  setNoteText("");
                                }}
                              >
                                <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            {inf?.profile_url && (
                              <a href={inf.profile_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                              </a>
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

          {/* Note Editor Dialog */}
          <Dialog open={!!editingNote} onOpenChange={() => setEditingNote(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>메모 편집</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {editingNote && (
                  <div className="text-sm text-muted-foreground">
                    {(editingNote.influencer as unknown as Tables<"influencers">)?.display_name ??
                      (editingNote.influencer as unknown as Tables<"influencers">)?.username ?? "인플루언서"}
                  </div>
                )}
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="메모를 입력하세요..."
                  rows={5}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingNote(null)}>취소</Button>
                  <Button onClick={saveNote}>저장</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
