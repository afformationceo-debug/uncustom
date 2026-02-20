"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  ExternalLink,
  Mail,
  Link as LinkIcon,
  RefreshCw,
  Users,
  Send,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import type { Tables } from "@/types/database";
import { PLATFORMS, CAMPAIGN_INFLUENCER_STATUSES } from "@/types/platform";

type Influencer = Tables<"influencers">;
type CampaignInfluencer = Tables<"campaign_influencers">;

type EnrichedInfluencer = Influencer & {
  campaign_status?: string;
  campaign_influencer_id?: string;
  email_source_url?: string | null;
};

// Platform-specific important fields for table columns (concise subset)
const PLATFORM_TABLE_COLUMNS: Record<string, { key: string; label: string; format?: "number" | "boolean" }[]> = {
  instagram: [
    { key: "likesCount", label: "좋아요", format: "number" },
    { key: "commentsCount", label: "댓글", format: "number" },
    { key: "videoPlayCount", label: "조회수", format: "number" },
    { key: "caption", label: "캡션" },
    { key: "hashtags", label: "해시태그" },
    { key: "isVerified", label: "인증", format: "boolean" },
  ],
  tiktok: [
    { key: "authorMeta.heart", label: "총 좋아요", format: "number" },
    { key: "playCount", label: "조회수", format: "number" },
    { key: "diggCount", label: "좋아요", format: "number" },
    { key: "shareCount", label: "공유", format: "number" },
    { key: "commentCount", label: "댓글", format: "number" },
  ],
  youtube: [
    { key: "numberOfSubscribers", label: "구독자", format: "number" },
    { key: "viewCount", label: "조회수", format: "number" },
    { key: "likes", label: "좋아요", format: "number" },
    { key: "commentCount", label: "댓글", format: "number" },
    { key: "title", label: "영상 제목" },
    { key: "duration", label: "길이" },
  ],
  twitter: [
    { key: "author.following", label: "팔로잉", format: "number" },
    { key: "author.isBlueVerified", label: "블루 인증", format: "boolean" },
    { key: "likeCount", label: "좋아요", format: "number" },
    { key: "retweetCount", label: "리트윗", format: "number" },
    { key: "viewCount", label: "조회수", format: "number" },
  ],
};

// Full platform fields for detail dialog
const PLATFORM_FIELDS: Record<string, { key: string; label: string }[]> = {
  instagram: [
    { key: "ownerUsername", label: "유저네임" },
    { key: "ownerFullName", label: "이름" },
    { key: "isVerified", label: "인증 계정" },
    { key: "likesCount", label: "릴스 좋아요" },
    { key: "commentsCount", label: "릴스 댓글" },
    { key: "videoPlayCount", label: "릴스 조회수" },
    { key: "videoDuration", label: "영상 길이(초)" },
    { key: "caption", label: "캡션" },
    { key: "hashtags", label: "해시태그" },
    { key: "shortCode", label: "숏코드" },
    { key: "followersCount", label: "팔로워" },
    { key: "followsCount", label: "팔로잉" },
    { key: "postsCount", label: "게시물 수" },
    { key: "isBusinessAccount", label: "비즈니스 계정" },
    { key: "businessCategoryName", label: "카테고리" },
    { key: "biography", label: "바이오" },
    { key: "externalUrl", label: "외부 링크" },
    { key: "businessEmail", label: "비즈 이메일" },
  ],
  tiktok: [
    { key: "authorMeta.name", label: "유저네임" },
    { key: "authorMeta.nickName", label: "닉네임" },
    { key: "authorMeta.fans", label: "팔로워" },
    { key: "authorMeta.following", label: "팔로잉" },
    { key: "authorMeta.heart", label: "총 좋아요" },
    { key: "authorMeta.video", label: "영상 수" },
    { key: "authorMeta.verified", label: "인증" },
    { key: "authorMeta.signature", label: "바이오" },
    { key: "text", label: "캡션" },
    { key: "diggCount", label: "영상 좋아요" },
    { key: "playCount", label: "영상 조회수" },
    { key: "shareCount", label: "공유수" },
    { key: "commentCount", label: "댓글수" },
    { key: "collectCount", label: "저장수" },
  ],
  youtube: [
    { key: "channelName", label: "채널명" },
    { key: "channelUrl", label: "채널 URL" },
    { key: "numberOfSubscribers", label: "구독자" },
    { key: "viewCount", label: "조회수" },
    { key: "likes", label: "좋아요" },
    { key: "commentCount", label: "댓글" },
    { key: "title", label: "영상 제목" },
    { key: "duration", label: "영상 길이" },
    { key: "date", label: "게시일" },
    { key: "text", label: "설명" },
    { key: "isMonetized", label: "수익화" },
  ],
  twitter: [
    { key: "author.userName", label: "유저네임" },
    { key: "author.name", label: "이름" },
    { key: "author.followers", label: "팔로워" },
    { key: "author.following", label: "팔로잉" },
    { key: "author.statusesCount", label: "트윗 수" },
    { key: "author.favouritesCount", label: "좋아요 수" },
    { key: "author.isBlueVerified", label: "블루 인증" },
    { key: "author.description", label: "바이오" },
    { key: "author.location", label: "위치" },
    { key: "author.joinedAt", label: "가입일" },
    { key: "text", label: "트윗 내용" },
    { key: "likeCount", label: "트윗 좋아요" },
    { key: "retweetCount", label: "리트윗" },
    { key: "viewCount", label: "조회수" },
    { key: "replyCount", label: "답글" },
  ],
};

export default function InfluencersPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [influencers, setInfluencers] = useState<EnrichedInfluencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [emailTotal, setEmailTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [emailFilter, setEmailFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [followerMin, setFollowerMin] = useState("");
  const [followerMax, setFollowerMax] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedInfluencer, setSelectedInfluencer] = useState<EnrichedInfluencer | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchInfluencers = useCallback(async () => {
    setLoading(true);

    const { data: ciData } = await supabase
      .from("campaign_influencers")
      .select("influencer_id, status, id")
      .eq("campaign_id", campaignId);

    if (!ciData || ciData.length === 0) {
      setInfluencers([]);
      setTotal(0);
      setEmailTotal(0);
      setLoading(false);
      return;
    }

    let filteredCi = ciData as { influencer_id: string; status: string; id: string }[];
    if (statusFilter !== "all") {
      filteredCi = filteredCi.filter((ci) => ci.status === statusFilter);
    }

    if (filteredCi.length === 0) {
      setInfluencers([]);
      setTotal(0);
      setEmailTotal(0);
      setLoading(false);
      return;
    }

    const ids = filteredCi.map((ci) => ci.influencer_id);
    const ciMap = new Map(filteredCi.map((ci) => [ci.influencer_id, { status: ci.status, id: ci.id }]));

    let query = supabase
      .from("influencers")
      .select("*", { count: "exact" })
      .in("id", ids);

    if (platformFilter !== "all") {
      query = query.eq("platform", platformFilter);
    }

    if (emailFilter === "has") {
      query = query.not("email", "is", null);
    } else if (emailFilter === "none") {
      query = query.is("email", null);
    }

    if (searchQuery) {
      query = query.or(
        `username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
      );
    }

    if (followerMin) {
      query = query.gte("follower_count", parseInt(followerMin));
    }
    if (followerMax) {
      query = query.lte("follower_count", parseInt(followerMax));
    }

    query = query
      .order("follower_count", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      toast.error("인플루언서 로드 실패: " + error.message);
    } else {
      const infList = (data as Influencer[]) ?? [];
      const infIds = infList.map((i) => i.id);

      // Fetch email source links for influencers with linktree-sourced emails
      const linkInfluencerIds = infList
        .filter((i) => i.email && (i.email_source === "linktree" || i.email_source === "website"))
        .map((i) => i.id);

      let linkMap = new Map<string, string>();
      if (linkInfluencerIds.length > 0) {
        const { data: linksData } = await supabase
          .from("influencer_links")
          .select("influencer_id, url")
          .in("influencer_id", linkInfluencerIds)
          .eq("scraped", true)
          .not("emails_found", "is", null);
        if (linksData) {
          for (const link of linksData as { influencer_id: string; url: string }[]) {
            if (!linkMap.has(link.influencer_id)) {
              linkMap.set(link.influencer_id, link.url);
            }
          }
        }
      }

      const enriched = infList.map((inf) => ({
        ...inf,
        campaign_status: ciMap.get(inf.id)?.status,
        campaign_influencer_id: ciMap.get(inf.id)?.id,
        email_source_url: linkMap.get(inf.id) ?? null,
      }));
      setInfluencers(enriched);
      setTotal(count ?? 0);

      // Separate email count query (across all pages)
      let emailQuery = supabase
        .from("influencers")
        .select("id", { count: "exact", head: true })
        .in("id", ids)
        .not("email", "is", null);
      if (platformFilter !== "all") {
        emailQuery = emailQuery.eq("platform", platformFilter);
      }
      const { count: eCount } = await emailQuery;
      setEmailTotal(eCount ?? 0);
    }
    setLoading(false);
  }, [campaignId, platformFilter, emailFilter, statusFilter, searchQuery, followerMin, followerMax, page]);

  useEffect(() => {
    fetchInfluencers();
  }, [fetchInfluencers]);

  useRealtime(
    "campaign_influencers",
    `campaign_id=eq.${campaignId}`,
    () => fetchInfluencers()
  );

  // Realtime: refresh when influencer data updates (e.g., email extraction)
  useRealtime(
    "influencers",
    undefined,
    () => fetchInfluencers()
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === influencers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(influencers.map((i) => i.id)));
    }
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

  function getRawValue(raw: unknown, key: string): string {
    if (!raw || typeof raw !== "object") return "-";
    const obj = raw as Record<string, unknown>;
    const keys = key.split(".");
    let value: unknown = obj;
    for (const k of keys) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[k];
      } else {
        return "-";
      }
    }
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "number") return value.toLocaleString();
    const str = String(value);
    return str.length > 80 ? str.slice(0, 80) + "..." : str;
  }

  function getRawNumber(raw: unknown, key: string): number | null {
    if (!raw || typeof raw !== "object") return null;
    const keys = key.split(".");
    let value: unknown = raw;
    for (const k of keys) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[k];
      } else {
        return null;
      }
    }
    if (value === null || value === undefined) return null;
    const n = Number(value);
    return isNaN(n) ? null : n;
  }

  const emailSourceBadge: Record<string, { label: string; color: string }> = {
    bio: { label: "바이오", color: "bg-green-500/10 text-green-500" },
    linktree: { label: "링크트리", color: "bg-purple-500/10 text-purple-500" },
    website: { label: "웹사이트", color: "bg-primary/10 text-primary" },
    manual: { label: "수동", color: "bg-yellow-500/10 text-yellow-500" },
    business: { label: "비즈니스", color: "bg-blue-500/10 text-blue-500" },
  };

  const platformColor: Record<string, string> = {
    instagram: "bg-pink-100 text-pink-800",
    tiktok: "bg-muted text-foreground",
    youtube: "bg-red-100 text-red-800",
    twitter: "bg-primary/10 text-primary",
    threads: "bg-muted text-foreground",
  };

  const totalPages = Math.ceil(total / pageSize);
  // emailTotal is set from a separate count query across all pages
  const isPlatformFiltered = platformFilter !== "all";
  const platformCols = isPlatformFiltered ? (PLATFORM_TABLE_COLUMNS[platformFilter] ?? []) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">추출된 인플루언서</h2>
          <p className="text-sm text-muted-foreground mt-1">
            총 {total.toLocaleString()}명 / 이메일 보유: {emailTotal}명
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              onClick={() => {
                const idsParam = Array.from(selectedIds).join(",");
                window.location.href = `/campaigns/${campaignId}/email/send?selected=${idsParam}`;
              }}
            >
              <Send className="w-4 h-4 mr-1" />
              {selectedIds.size}명 이메일 발송
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchInfluencers}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
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
        <Button variant="outline" onClick={handleSearch}>검색</Button>
      </div>

      {/* Advanced Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">이메일</label>
          <Select value={emailFilter} onValueChange={(v) => { setEmailFilter(v); setPage(0); }}>
            <SelectTrigger className="w-28">
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
          <label className="text-xs text-muted-foreground mb-1 block">상태</label>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {CAMPAIGN_INFLUENCER_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">팔로워 최소</label>
          <Input
            placeholder="1000"
            value={followerMin}
            onChange={(e) => setFollowerMin(e.target.value)}
            className="w-24"
            type="number"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">팔로워 최대</label>
          <Input
            placeholder="100000"
            value={followerMax}
            onChange={(e) => setFollowerMax(e.target.value)}
            className="w-24"
            type="number"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleSearch}>필터 적용</Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEmailFilter("all");
            setStatusFilter("all");
            setFollowerMin("");
            setFollowerMax("");
            setPlatformFilter("all");
            setSearchQuery("");
            setPage(0);
          }}
        >
          초기화
        </Button>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString()}명</span>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline" size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span>{page + 1} / {totalPages || 1}</span>
          <Button
            variant="outline" size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Table View */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={influencers.length > 0 && selectedIds.size === influencers.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="w-12">프로필</TableHead>
                  <TableHead>유저네임</TableHead>
                  {!isPlatformFiltered && <TableHead>키워드</TableHead>}
                  <TableHead>플랫폼</TableHead>
                  <TableHead>프로필 링크</TableHead>
                  <TableHead>팔로워</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>이메일 소스</TableHead>
                  {/* Platform-specific columns when filtered */}
                  {isPlatformFiltered && platformCols.map((col) => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                  <TableHead>상태</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isPlatformFiltered ? 11 + platformCols.length : 11} className="text-center py-8 text-muted-foreground">
                      로딩 중...
                    </TableCell>
                  </TableRow>
                ) : influencers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isPlatformFiltered ? 11 + platformCols.length : 11} className="text-center py-8 text-muted-foreground">
                      인플루언서가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  influencers.map((inf) => {
                    const statusConf = CAMPAIGN_INFLUENCER_STATUSES.find((s) => s.value === inf.campaign_status);
                    return (
                      <TableRow key={inf.id} className="cursor-pointer hover:bg-accent">
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(inf.id)}
                            onCheckedChange={() => toggleSelect(inf.id)}
                          />
                        </TableCell>
                        <TableCell onClick={() => setSelectedInfluencer(inf)}>
                          {inf.profile_image_url ? (
                            <img
                              src={inf.profile_image_url}
                              alt=""
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                              <Users className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell onClick={() => setSelectedInfluencer(inf)}>
                          <div>
                            <div className="font-medium text-sm">{inf.display_name ?? "-"}</div>
                            {inf.username && (
                              <div className="text-xs text-muted-foreground">@{inf.username}</div>
                            )}
                          </div>
                        </TableCell>
                        {/* Keyword column - unified view only */}
                        {!isPlatformFiltered && (
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-32">
                              {inf.extracted_keywords && inf.extracted_keywords.length > 0 ? (
                                inf.extracted_keywords.map((kw, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px]">{kw}</Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                          </TableCell>
                        )}
                        {/* Platform */}
                        <TableCell>
                          <Badge className={`text-[10px] ${platformColor[inf.platform] ?? ""}`} variant="secondary">
                            {PLATFORMS.find((p) => p.value === inf.platform)?.label ?? inf.platform}
                          </Badge>
                        </TableCell>
                        {/* Profile Link */}
                        <TableCell>
                          {inf.profile_url ? (
                            <a
                              href={inf.profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs flex items-center gap-1 max-w-40 truncate"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate">{inf.profile_url.replace(/https?:\/\/(www\.)?/, "")}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        {/* Followers */}
                        <TableCell className="font-medium">{formatCount(inf.follower_count)}</TableCell>
                        {/* Email */}
                        <TableCell>
                          {inf.email ? (
                            <div className="max-w-40">
                              <div className="text-xs truncate flex items-center gap-1">
                                <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                                {inf.email}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        {/* Email Source URL */}
                        <TableCell>
                          {inf.email ? (
                            inf.email_source_url ? (
                              <a
                                href={inf.email_source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-xs flex items-center gap-1 max-w-36 truncate"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <LinkIcon className="w-3 h-3 shrink-0" />
                                <span className="truncate">{inf.email_source_url.replace(/https?:\/\/(www\.)?/, "")}</span>
                              </a>
                            ) : (
                              <Badge
                                className={`text-[10px] ${emailSourceBadge[inf.email_source ?? ""]?.color ?? ""}`}
                                variant="secondary"
                              >
                                {emailSourceBadge[inf.email_source ?? ""]?.label ?? inf.email_source ?? "-"}
                              </Badge>
                            )
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        {/* Platform-specific columns */}
                        {isPlatformFiltered && platformCols.map((col) => {
                          if (col.format === "number") {
                            const num = getRawNumber(inf.raw_data, col.key);
                            return (
                              <TableCell key={col.key} className="text-sm">
                                {num !== null ? formatCount(num) : "-"}
                              </TableCell>
                            );
                          }
                          if (col.format === "boolean") {
                            const val = getRawValue(inf.raw_data, col.key);
                            return (
                              <TableCell key={col.key} className="text-sm">
                                {val === "Yes" ? (
                                  <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600">Yes</Badge>
                                ) : val === "No" ? (
                                  <span className="text-muted-foreground">-</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          }
                          return (
                            <TableCell key={col.key} className="text-xs max-w-32 truncate">
                              {getRawValue(inf.raw_data, col.key)}
                            </TableCell>
                          );
                        })}
                        {/* Status */}
                        <TableCell>
                          {statusConf && (
                            <Badge variant="outline" className="text-xs">
                              {statusConf.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedInfluencer(inf)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedInfluencer} onOpenChange={() => setSelectedInfluencer(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedInfluencer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedInfluencer.profile_image_url ? (
                    <img
                      src={selectedInfluencer.profile_image_url}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Users className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <div className="text-lg">
                      {selectedInfluencer.display_name ?? selectedInfluencer.username ?? "Unknown"}
                    </div>
                    {selectedInfluencer.username && (
                      <div className="text-sm font-normal text-muted-foreground">
                        @{selectedInfluencer.username}
                      </div>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="overview" className="mt-4">
                <TabsList>
                  <TabsTrigger value="overview">개요</TabsTrigger>
                  <TabsTrigger value="platform">플랫폼 상세</TabsTrigger>
                  <TabsTrigger value="raw">원본 데이터</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="grid grid-cols-3 gap-3">
                    <Card>
                      <CardContent className="p-3 text-center">
                        <div className="text-xl font-bold">{formatCount(selectedInfluencer.follower_count)}</div>
                        <div className="text-xs text-muted-foreground">팔로워</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <div className="text-xl font-bold">{formatCount(selectedInfluencer.following_count)}</div>
                        <div className="text-xs text-muted-foreground">팔로잉</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <div className="text-xl font-bold">{formatCount(selectedInfluencer.post_count)}</div>
                        <div className="text-xs text-muted-foreground">게시물</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-20">플랫폼</span>
                      <Badge className={platformColor[selectedInfluencer.platform] ?? ""} variant="secondary">
                        {PLATFORMS.find((p) => p.value === selectedInfluencer.platform)?.label ?? selectedInfluencer.platform}
                      </Badge>
                    </div>

                    {selectedInfluencer.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground w-20">이메일</span>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span>{selectedInfluencer.email}</span>
                          {selectedInfluencer.email_source && (
                            <Badge
                              className={emailSourceBadge[selectedInfluencer.email_source]?.color ?? ""}
                              variant="secondary"
                            >
                              {emailSourceBadge[selectedInfluencer.email_source]?.label ?? selectedInfluencer.email_source}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedInfluencer.country && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground w-20">국가</span>
                        <span>{selectedInfluencer.country}</span>
                      </div>
                    )}

                    {selectedInfluencer.engagement_rate && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground w-20">참여율</span>
                        <span>{(Number(selectedInfluencer.engagement_rate) * 100).toFixed(2)}%</span>
                      </div>
                    )}

                    {selectedInfluencer.bio && (
                      <div className="text-sm">
                        <span className="text-muted-foreground block mb-1">바이오</span>
                        <p className="bg-muted/50 p-3 rounded text-foreground whitespace-pre-wrap">
                          {selectedInfluencer.bio}
                        </p>
                      </div>
                    )}

                    {selectedInfluencer.profile_url && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground w-20">프로필</span>
                        <a
                          href={selectedInfluencer.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <LinkIcon className="w-3 h-3" />
                          {selectedInfluencer.profile_url}
                        </a>
                      </div>
                    )}

                    {selectedInfluencer.campaign_status && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground w-20">캠페인 상태</span>
                        <Badge variant="outline">
                          {CAMPAIGN_INFLUENCER_STATUSES.find((s) => s.value === selectedInfluencer.campaign_status)?.label ?? selectedInfluencer.campaign_status}
                        </Badge>
                      </div>
                    )}

                    {selectedInfluencer.extracted_keywords && selectedInfluencer.extracted_keywords.length > 0 && (
                      <div className="text-sm">
                        <span className="text-muted-foreground block mb-1">수집 키워드</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedInfluencer.extracted_keywords.map((kw, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="platform" className="mt-4">
                  <div className="space-y-2">
                    {(PLATFORM_FIELDS[selectedInfluencer.platform] ?? []).map((field) => {
                      const value = getRawValue(selectedInfluencer.raw_data, field.key);
                      if (value === "-") return null;
                      return (
                        <div key={field.key} className="flex items-start gap-2 text-sm py-1.5 border-b last:border-b-0">
                          <span className="text-muted-foreground w-32 shrink-0">{field.label}</span>
                          <span className="text-foreground break-all">{value}</span>
                        </div>
                      );
                    })}
                    {(!PLATFORM_FIELDS[selectedInfluencer.platform] ||
                      PLATFORM_FIELDS[selectedInfluencer.platform].every(
                        (f) => getRawValue(selectedInfluencer.raw_data, f.key) === "-"
                      )) && (
                      <p className="text-muted-foreground text-sm py-4 text-center">
                        플랫폼별 상세 데이터가 없습니다.
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="raw" className="mt-4">
                  {selectedInfluencer.raw_data ? (
                    <pre className="bg-muted/50 p-4 rounded text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                      {JSON.stringify(selectedInfluencer.raw_data, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground text-sm py-4 text-center">
                      원본 데이터가 없습니다.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
