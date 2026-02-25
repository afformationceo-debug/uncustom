"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Film,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  Loader2,
  Filter,
  Bookmark,
  Hash,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";

type BrandContent = Tables<"brand_influencer_contents">;
type BrandAccount = Tables<"brand_accounts">;

const CONTENT_TYPES = ["all", "reel", "post", "video", "short", "tweet", "story"];

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function ContentAnalysisPage() {
  const supabase = createClient();
  const [contents, setContents] = useState<BrandContent[]>([]);
  const [brands, setBrands] = useState<BrandAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [sponsoredFilter, setSponsoredFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");

  useEffect(() => {
    fetchContents();
    fetchBrands();
  }, []);

  async function fetchContents() {
    setLoading(true);
    const { data, error } = await supabase
      .from("brand_influencer_contents")
      .select("*")
      .order("posted_at", { ascending: false })
      .limit(500);

    if (error) {
      toast.error("콘텐츠 로드 실패");
    } else {
      setContents((data as BrandContent[]) ?? []);
    }
    setLoading(false);
  }

  async function fetchBrands() {
    const { data } = await supabase
      .from("brand_accounts")
      .select("id, brand_name, username, platform")
      .order("brand_name");
    setBrands((data as BrandAccount[]) ?? []);
  }

  const filteredContents = contents.filter((c) => {
    if (platformFilter !== "all" && c.platform !== platformFilter) return false;
    if (contentTypeFilter !== "all" && c.content_type !== contentTypeFilter) return false;
    if (sponsoredFilter === "sponsored" && !c.is_sponsored) return false;
    if (sponsoredFilter === "organic" && !c.is_organic) return false;
    if (brandFilter !== "all" && c.brand_account_id !== brandFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !(c.influencer_username || "").toLowerCase().includes(q) &&
        !(c.caption || "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  // Stats
  const totalViews = contents.reduce((sum, c) => sum + (c.views_count || 0), 0);
  const totalLikes = contents.reduce((sum, c) => sum + (c.likes_count || 0), 0);
  const totalComments = contents.reduce((sum, c) => sum + (c.comments_count || 0), 0);
  const totalShares = contents.reduce((sum, c) => sum + (c.shares_count || 0), 0);
  const totalSaves = contents.reduce((sum, c) => sum + (c.saves_count || 0), 0);
  const avgEngagement =
    contents.length > 0
      ? contents.reduce((sum, c) => sum + (c.engagement_rate || 0), 0) / contents.length
      : 0;
  const sponsoredCount = contents.filter((c) => c.is_sponsored).length;
  const sponsoredPercent =
    contents.length > 0 ? (sponsoredCount / contents.length) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">콘텐츠 분석</h1>
        <p className="text-sm text-muted-foreground mt-1">
          브랜드 태그/멘션 콘텐츠를 분석하고 인플루언서 협업 패턴을 파악합니다
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">총 콘텐츠</p>
            <p className="text-lg font-bold mt-0.5">{formatNumber(contents.length)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">총 조회수</p>
            <p className="text-lg font-bold mt-0.5">{formatNumber(totalViews)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">총 좋아요</p>
            <p className="text-lg font-bold mt-0.5">{formatNumber(totalLikes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">총 댓글</p>
            <p className="text-lg font-bold mt-0.5">{formatNumber(totalComments)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">총 공유</p>
            <p className="text-lg font-bold mt-0.5">{formatNumber(totalShares)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">총 저장</p>
            <p className="text-lg font-bold mt-0.5">{formatNumber(totalSaves)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">평균 참여율</p>
            <p className="text-lg font-bold mt-0.5">{avgEngagement.toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">스폰서드 비율</p>
            <p className="text-lg font-bold mt-0.5">{sponsoredPercent.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="인플루언서 또는 캡션 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue placeholder="플랫폼" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 플랫폼</SelectItem>
            {PLATFORMS.filter((p) => p.value !== "threads").map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue placeholder="유형" />
          </SelectTrigger>
          <SelectContent>
            {CONTENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "all" ? "전체 유형" : t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sponsoredFilter} onValueChange={setSponsoredFilter}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue placeholder="구분" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="sponsored">스폰서드</SelectItem>
            <SelectItem value="organic">오가닉</SelectItem>
          </SelectContent>
        </Select>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="브랜드" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 브랜드</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.brand_name || b.username} ({b.platform})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">인플루언서</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>유형</TableHead>
                <TableHead className="min-w-[250px]">캡션</TableHead>
                <TableHead className="min-w-[120px]">해시태그</TableHead>
                <TableHead className="min-w-[100px]">멘션</TableHead>
                <TableHead className="text-right">조회수</TableHead>
                <TableHead className="text-right">좋아요</TableHead>
                <TableHead className="text-right">댓글</TableHead>
                <TableHead className="text-right">공유</TableHead>
                <TableHead className="text-right">저장</TableHead>
                <TableHead className="text-right">참여율</TableHead>
                <TableHead>멘션타입</TableHead>
                <TableHead>감성</TableHead>
                <TableHead>구분</TableHead>
                <TableHead className="min-w-[100px]">감지상품</TableHead>
                <TableHead>발견경로</TableHead>
                <TableHead>게시일</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={19} className="text-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <span className="text-muted-foreground">로딩 중...</span>
                  </TableCell>
                </TableRow>
              ) : filteredContents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={19} className="text-center py-12">
                    <Film className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-muted-foreground font-medium">콘텐츠가 없습니다</p>
                    <p className="text-sm text-muted-foreground">
                      브랜드를 등록하고 콘텐츠 발견을 실행하세요
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredContents.map((content) => (
                  <TableRow key={content.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {content.thumbnail_url ? (
                          <img
                            src={content.thumbnail_url}
                            alt=""
                            className="w-8 h-8 rounded object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <Film className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-sm font-medium">
                          @{content.influencer_username || "unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {content.platform}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {content.content_type || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground line-clamp-2 max-w-[250px]">
                        {content.caption || "-"}
                      </p>
                    </TableCell>
                    {/* 해시태그 */}
                    <TableCell>
                      {content.hashtags && content.hashtags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {content.hashtags.slice(0, 3).map((tag, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                            >
                              #{tag}
                            </Badge>
                          ))}
                          {content.hashtags.length > 3 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 text-muted-foreground"
                            >
                              +{content.hashtags.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {/* 멘션 */}
                    <TableCell>
                      {content.mentions && content.mentions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {content.mentions.slice(0, 2).map((m, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              @{m}
                            </Badge>
                          ))}
                          {content.mentions.length > 2 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 text-muted-foreground"
                            >
                              +{content.mentions.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatNumber(content.views_count)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatNumber(content.likes_count)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatNumber(content.comments_count)}
                    </TableCell>
                    {/* 공유 */}
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatNumber(content.shares_count)}
                    </TableCell>
                    {/* 저장 */}
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatNumber(content.saves_count)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {content.engagement_rate != null
                        ? `${content.engagement_rate.toFixed(2)}%`
                        : "-"}
                    </TableCell>
                    {/* 멘션타입 */}
                    <TableCell>
                      {content.brand_mention_type ? (
                        <Badge
                          className={`text-[10px] ${
                            content.brand_mention_type === "tagged"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                              : content.brand_mention_type === "mentioned"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400"
                                : content.brand_mention_type === "hashtag"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {content.brand_mention_type}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {/* 감성 */}
                    <TableCell>
                      {content.sentiment_label ? (
                        <Badge
                          className={`text-[10px] ${
                            content.sentiment_label === "positive"
                              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                              : content.sentiment_label === "negative"
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {content.sentiment_label === "positive"
                            ? "긍정"
                            : content.sentiment_label === "negative"
                              ? "부정"
                              : "중립"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {content.is_sponsored ? (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                          스폰서드
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-green-600 border-green-200 dark:border-green-800"
                        >
                          오가닉
                        </Badge>
                      )}
                    </TableCell>
                    {/* 감지상품 */}
                    <TableCell>
                      {content.detected_products && content.detected_products.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {content.detected_products.slice(0, 2).map((p, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {p}
                            </Badge>
                          ))}
                          {content.detected_products.length > 2 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 text-muted-foreground"
                            >
                              +{content.detected_products.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {/* 발견경로 */}
                    <TableCell>
                      {content.discovered_via ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            content.discovered_via === "tagged_scraper"
                              ? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400"
                              : content.discovered_via === "mention_search"
                                ? "border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400"
                                : "border-muted text-muted-foreground"
                          }`}
                        >
                          {content.discovered_via === "tagged_scraper"
                            ? "태그 스크래퍼"
                            : content.discovered_via === "mention_search"
                              ? "멘션 검색"
                              : content.discovered_via === "manual"
                                ? "수동"
                                : content.discovered_via}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {content.posted_at
                          ? new Date(content.posted_at).toLocaleDateString("ko-KR")
                          : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {content.content_url && (
                        <a
                          href={content.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
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

      {!loading && filteredContents.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          총 <strong className="text-foreground">{filteredContents.length}</strong>개 콘텐츠
        </p>
      )}
    </div>
  );
}
