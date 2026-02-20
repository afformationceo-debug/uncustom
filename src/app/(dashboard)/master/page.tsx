"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ExternalLink, Users } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";
import { useRealtime } from "@/hooks/use-realtime";

type Influencer = Tables<"influencers">;
type Campaign = Tables<"campaigns">;

// Map of influencer_id -> array of campaigns they are assigned to
type CampaignAssignmentMap = Record<string, { id: string; name: string }[]>;

const PLATFORM_BADGE_COLORS: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-700 border-pink-200",
  tiktok: "bg-gray-100 text-gray-900 border-gray-300",
  youtube: "bg-red-100 text-red-700 border-red-200",
  twitter: "bg-blue-100 text-blue-700 border-blue-200",
  threads: "bg-gray-100 text-gray-700 border-gray-300",
};

export default function MasterPage() {
  const supabase = createClient();

  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [emailFilter, setEmailFilter] = useState<string>("all");
  const [followerMin, setFollowerMin] = useState("");
  const [followerMax, setFollowerMax] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Campaign assignment state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // Campaign assignments for each influencer (for the "campaign" column)
  const [campaignAssignments, setCampaignAssignments] = useState<CampaignAssignmentMap>({});

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    fetchInfluencers();
  }, [platformFilter, emailFilter, page]);

  // Fetch campaign assignments for current page influencers
  useEffect(() => {
    if (influencers.length > 0) {
      fetchCampaignAssignments(influencers.map((inf) => inf.id));
    }
  }, [influencers]);

  // Clear selection when page changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const realtimeCallback = useCallback(() => {
    fetchInfluencers();
  }, [platformFilter, emailFilter, page]);
  useRealtime("influencers", undefined, realtimeCallback);

  async function fetchCampaigns() {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setCampaigns(data as Campaign[]);
    }
  }

  async function fetchCampaignAssignments(influencerIds: string[]) {
    if (influencerIds.length === 0) return;

    const { data } = await supabase
      .from("campaign_influencers")
      .select("influencer_id, campaign_id, campaigns(id, name)")
      .in("influencer_id", influencerIds);

    if (data) {
      const map: CampaignAssignmentMap = {};
      for (const row of data as unknown as {
        influencer_id: string;
        campaign_id: string;
        campaigns: { id: string; name: string };
      }[]) {
        if (!map[row.influencer_id]) {
          map[row.influencer_id] = [];
        }
        if (row.campaigns) {
          map[row.influencer_id].push({
            id: row.campaigns.id,
            name: row.campaigns.name,
          });
        }
      }
      setCampaignAssignments(map);
    }
  }

  async function fetchInfluencers() {
    setLoading(true);

    let query = supabase
      .from("influencers")
      .select("*", { count: "exact" });

    if (platformFilter !== "all") {
      query = query.eq("platform", platformFilter);
    }

    if (searchQuery) {
      query = query.or(
        `username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
      );
    }

    if (emailFilter === "has") {
      query = query.not("email", "is", null);
    } else if (emailFilter === "none") {
      query = query.is("email", null);
    }

    if (followerMin) {
      query = query.gte("follower_count", parseInt(followerMin));
    }
    if (followerMax) {
      query = query.lte("follower_count", parseInt(followerMax));
    }

    if (countryFilter) {
      query = query.eq("country", countryFilter.toUpperCase());
    }

    query = query
      .order("follower_count", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, error, count } = await query;

    if (!error) {
      setInfluencers((data as Influencer[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }

  function handleSearch() {
    setPage(0);
    fetchInfluencers();
  }

  function formatCount(n: number | null) {
    if (n === null) return "-";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  // Selection handlers
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(influencers.map((inf) => inf.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [influencers]
  );

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const allSelected = influencers.length > 0 && influencers.every((inf) => selectedIds.has(inf.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  // Campaign assignment handler
  async function handleAssignToCampaign() {
    if (!selectedCampaignId) {
      toast.error("캠페인을 선택해주세요.");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("인플루언서를 선택해주세요.");
      return;
    }

    setAssigning(true);

    const rows = Array.from(selectedIds).map((influencer_id) => ({
      campaign_id: selectedCampaignId,
      influencer_id,
      status: "extracted",
    }));

    const { error } = await supabase
      .from("campaign_influencers")
      .upsert(rows, { onConflict: "campaign_id,influencer_id" });

    if (error) {
      toast.error(`배정 실패: ${error.message}`);
    } else {
      const campaignName = campaigns.find((c) => c.id === selectedCampaignId)?.name ?? "";
      toast.success(`${selectedIds.size}명을 "${campaignName}" 캠페인에 배정했습니다.`);
      setSelectedIds(new Set());
      setSelectedCampaignId("");
      // Refresh assignments
      fetchCampaignAssignments(influencers.map((inf) => inf.id));
    }

    setAssigning(false);
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">마스터 데이터</h1>
      <p className="text-muted-foreground">모든 캠페인에서 추출된 인플루언서 통합 데이터</p>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="이름, 유저네임, 이메일 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
          />
        </div>
        <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="플랫폼" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleSearch}>
          검색
        </Button>
      </div>

      {/* Advanced Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">이메일</label>
          <Select value={emailFilter} onValueChange={(v) => { setEmailFilter(v); setPage(0); }}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="has">있음</SelectItem>
              <SelectItem value="none">없음</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">팔로워 최소</label>
          <Input
            placeholder="예: 1000"
            value={followerMin}
            onChange={(e) => setFollowerMin(e.target.value)}
            className="w-28"
            type="number"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">팔로워 최대</label>
          <Input
            placeholder="예: 100000"
            value={followerMax}
            onChange={(e) => setFollowerMax(e.target.value)}
            className="w-28"
            type="number"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">국가</label>
          <Input
            placeholder="KR"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="w-20"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleSearch}>
          필터 적용
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEmailFilter("all");
            setFollowerMin("");
            setFollowerMax("");
            setCountryFilter("");
            setPlatformFilter("all");
            setSearchQuery("");
            setPage(0);
            fetchInfluencers();
          }}
        >
          초기화
        </Button>
      </div>

      {/* Selection Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 border rounded-lg">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{selectedIds.size}명 선택됨</span>
          <div className="h-4 w-px bg-border" />
          <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="캠페인 선택..." />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleAssignToCampaign}
            disabled={assigning || !selectedCampaignId}
          >
            {assigning ? "배정 중..." : "캠페인에 배정"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedIds(new Set());
              setSelectedCampaignId("");
            }}
          >
            선택 해제
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>총 {total.toLocaleString()}명</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            이전
          </Button>
          <span className="flex items-center px-2">
            {page + 1} / {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    aria-label="전체 선택"
                  />
                </TableHead>
                <TableHead>프로필</TableHead>
                <TableHead>유저네임</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>팔로워</TableHead>
                <TableHead>게시물</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>캠페인</TableHead>
                <TableHead>참여율</TableHead>
                <TableHead>국가</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : influencers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    데이터가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                influencers.map((inf) => (
                  <TableRow
                    key={inf.id}
                    className={selectedIds.has(inf.id) ? "bg-muted/40" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(inf.id)}
                        onCheckedChange={(checked) => handleSelectOne(inf.id, !!checked)}
                        aria-label={`${inf.username ?? inf.display_name} 선택`}
                      />
                    </TableCell>
                    <TableCell>
                      {inf.profile_image_url ? (
                        <img
                          src={inf.profile_image_url}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{inf.display_name ?? "-"}</div>
                      {inf.username && (
                        <div className="text-xs text-muted-foreground">@{inf.username}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={PLATFORM_BADGE_COLORS[inf.platform] ?? ""}
                      >
                        {PLATFORMS.find((p) => p.value === inf.platform)?.label ?? inf.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatCount(inf.follower_count)}</TableCell>
                    <TableCell>{formatCount(inf.post_count)}</TableCell>
                    <TableCell>
                      {inf.email ? (
                        <div>
                          <div className="text-sm">{inf.email}</div>
                          {inf.email_source && (
                            <div className="text-xs text-muted-foreground">{inf.email_source}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {campaignAssignments[inf.id]?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {campaignAssignments[inf.id].map((c) => (
                            <Badge key={c.id} variant="secondary" className="text-xs">
                              {c.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {inf.engagement_rate
                        ? `${(Number(inf.engagement_rate) * 100).toFixed(2)}%`
                        : "-"}
                    </TableCell>
                    <TableCell>{inf.country ?? "-"}</TableCell>
                    <TableCell>
                      {inf.profile_url && (
                        <a href={inf.profile_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </a>
                      )}
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
