"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Search,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  MousePointerClick,
  Package,
  Loader2,
  ExternalLink,
  Percent,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";

type CommerceData = Tables<"influencer_commerce"> & {
  influencers?: {
    username: string | null;
    display_name: string | null;
    platform: string;
    profile_image_url: string | null;
    follower_count: number | null;
  };
};

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "-";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(n: number | null | undefined): string {
  if (n == null) return "-";
  return `${(n * 100).toFixed(1)}%`;
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}시간 전`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function CommercePage() {
  const supabase = createClient();
  const [data, setData] = useState<CommerceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: result, error } = await supabase
      .from("influencer_commerce")
      .select("*, influencers(username, display_name, platform, profile_image_url, follower_count)")
      .order("total_revenue", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("이커머스 데이터 로드 실패");
    } else {
      setData((result as unknown as CommerceData[]) ?? []);
    }
    setLoading(false);
  }

  const filteredData = data.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const inf = item.influencers;
    return (
      (inf?.username || "").toLowerCase().includes(q) ||
      (inf?.display_name || "").toLowerCase().includes(q) ||
      (item.top_product || "").toLowerCase().includes(q)
    );
  });

  // Stats
  const totalRevenue = data.reduce((sum, d) => sum + (d.total_revenue || 0), 0);
  const totalOrders = data.reduce((sum, d) => sum + (d.total_orders || 0), 0);
  const totalClicks = data.reduce((sum, d) => sum + (d.total_clicks || 0), 0);
  const avgRoas =
    data.filter((d) => d.roas != null).length > 0
      ? data.reduce((sum, d) => sum + (d.roas || 0), 0) /
        data.filter((d) => d.roas != null).length
      : 0;
  const totalCommission = data.reduce((sum, d) => sum + (d.total_commission || 0), 0);
  const conversionEntries = data.filter((d) => d.conversion_rate != null);
  const avgConversion =
    conversionEntries.length > 0
      ? conversionEntries.reduce((sum, d) => sum + (d.conversion_rate || 0), 0) /
        conversionEntries.length
      : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">이커머스</h1>
        <p className="text-sm text-muted-foreground mt-1">
          인플루언서 이커머스 판매 데이터와 ROAS를 분석합니다
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-500" />
              <p className="text-xs text-muted-foreground">총 매출</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">총 주문</p>
            </div>
            <p className="text-2xl font-bold">{formatNumber(totalOrders)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <MousePointerClick className="w-4 h-4 text-purple-500" />
              <p className="text-xs text-muted-foreground">총 클릭</p>
            </div>
            <p className="text-2xl font-bold">{formatNumber(totalClicks)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <p className="text-xs text-muted-foreground">평균 ROAS</p>
            </div>
            <p className="text-2xl font-bold">{avgRoas > 0 ? `${avgRoas.toFixed(1)}x` : "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">총 커미션</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalCommission)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="w-4 h-4 text-teal-500" />
              <p className="text-xs text-muted-foreground">평균 전환율</p>
            </div>
            <p className="text-2xl font-bold">
              {avgConversion > 0 ? `${(avgConversion * 100).toFixed(1)}%` : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="인플루언서 또는 상품 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
      </div>

      {/* Commerce Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">인플루언서</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead className="text-right">매출</TableHead>
                <TableHead className="text-right">주문</TableHead>
                <TableHead className="text-right">클릭</TableHead>
                <TableHead className="text-right">전환율</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
                <TableHead className="text-right">AOV</TableHead>
                <TableHead className="text-right">커미션</TableHead>
                <TableHead className="text-right">CPA</TableHead>
                <TableHead className="text-right">광고비</TableHead>
                <TableHead className="text-right">커미션율</TableHead>
                <TableHead>커미션모델</TableHead>
                <TableHead>샵 링크</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>인기상품</TableHead>
                <TableHead>소스</TableHead>
                <TableHead>마지막 동기화</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={18} className="text-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <span className="text-muted-foreground">로딩 중...</span>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={18} className="text-center py-12">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-muted-foreground font-medium">이커머스 데이터가 없습니다</p>
                    <p className="text-sm text-muted-foreground">
                      인플루언서의 이커머스 활동이 수집되면 여기에 표시됩니다
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => {
                  const inf = item.influencers;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {inf?.profile_image_url ? (
                            <img
                              src={inf.profile_image_url}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover border"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {inf?.display_name || inf?.username || "-"}
                            </p>
                            {inf?.follower_count && (
                              <p className="text-[10px] text-muted-foreground">
                                {formatNumber(inf.follower_count)} 팔로워
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {inf?.platform || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-sm">
                        {formatCurrency(item.total_revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatNumber(item.total_orders)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatNumber(item.total_clicks)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {item.conversion_rate != null
                          ? `${(item.conversion_rate * 100).toFixed(1)}%`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {item.roas != null ? (
                          <span
                            className={
                              item.roas >= 3
                                ? "text-green-600"
                                : item.roas >= 1
                                  ? "text-foreground"
                                  : "text-red-500"
                            }
                          >
                            {item.roas.toFixed(1)}x
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {item.average_order_value != null
                          ? formatCurrency(item.average_order_value)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(item.total_commission || 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {item.cpa != null ? formatCurrency(item.cpa) : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {item.campaign_spend != null ? formatCurrency(item.campaign_spend) : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatPercent(item.commission_rate)}
                      </TableCell>
                      <TableCell>
                        {item.commission_model ? (
                          <Badge variant="outline" className="text-[10px]">
                            {item.commission_model}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {item.tiktok_shop_url && (
                            <a
                              href={item.tiktok_shop_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="TikTok Shop"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {item.instagram_shop_url && (
                            <a
                              href={item.instagram_shop_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Instagram Shop"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {!item.tiktok_shop_url && !item.instagram_shop_url && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.product_categories && item.product_categories.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {item.product_categories.slice(0, 2).map((cat) => (
                              <Badge key={cat} variant="outline" className="text-[10px] px-1.5 py-0">
                                {cat}
                              </Badge>
                            ))}
                            {item.product_categories.length > 2 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{item.product_categories.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground truncate max-w-[120px] block">
                          {item.top_product || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {item.data_source || "manual"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatRelativeTime(item.last_synced_at)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!loading && filteredData.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          총 <strong className="text-foreground">{filteredData.length}</strong>개 인플루언서
        </p>
      )}
    </div>
  );
}
