"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ShoppingCart,
  BarChart3,
  Loader2,
  TrendingUp,
  DollarSign,
  ExternalLink,
  Star,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Calendar,
} from "lucide-react";

interface BrandRelationship {
  id: string;
  brand_account_id: string;
  total_collaborations: number;
  sponsored_count: number;
  organic_count: number;
  avg_views: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  avg_engagement_rate: number | null;
  relationship_strength_score: number | null;
  estimated_collaboration_value: number | null;
  estimated_cpm: number | null;
  likely_payment_model: string | null;
  is_brand_ambassador: boolean;
  is_active: boolean;
  first_collaboration_at: string | null;
  last_collaboration_at: string | null;
  brand_accounts?: {
    brand_name: string | null;
    username: string;
    platform: string;
    profile_image_url: string | null;
  };
}

interface CommerceData {
  id: string;
  platform: string;
  total_revenue: number;
  total_orders: number;
  total_clicks: number;
  conversion_rate: number | null;
  roas: number | null;
  aov: number | null;
  total_commission: number | null;
  commission_rate: number | null;
  commission_model: string | null;
  campaign_spend: number | null;
  cpa: number | null;
  top_products: string[] | null;
  products_sold: string[] | null;
  data_source: string | null;
  last_synced_at: string | null;
}

interface AnalyticsData {
  id: string;
  metric_type: string;
  metric_date: string;
  followers_count: number | null;
  following_count: number | null;
  posts_count: number | null;
  engagement_rate: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  avg_views: number | null;
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number | null | undefined, currency = "USD"): string {
  if (n == null) return "-";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function InfluencerDetailTabs({ influencerId }: { influencerId: string }) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("brands");
  const [brandRels, setBrandRels] = useState<BrandRelationship[]>([]);
  const [commerce, setCommerce] = useState<CommerceData[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingCommerce, setLoadingCommerce] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loaded, setLoaded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeTab === "brands" && !loaded.has("brands")) {
      fetchBrandRelationships();
    } else if (activeTab === "commerce" && !loaded.has("commerce")) {
      fetchCommerce();
    } else if (activeTab === "analytics" && !loaded.has("analytics")) {
      fetchAnalytics();
    }
  }, [activeTab]);

  async function fetchBrandRelationships() {
    setLoadingBrands(true);
    const { data } = await supabase
      .from("brand_influencer_relationships")
      .select("*, brand_accounts(brand_name, username, platform, profile_image_url)")
      .eq("influencer_id", influencerId)
      .order("relationship_strength_score", { ascending: false });
    setBrandRels((data as unknown as BrandRelationship[]) ?? []);
    setLoaded((prev) => new Set(prev).add("brands"));
    setLoadingBrands(false);
  }

  async function fetchCommerce() {
    setLoadingCommerce(true);
    const { data } = await supabase
      .from("influencer_commerce")
      .select("*")
      .eq("influencer_id", influencerId)
      .order("total_revenue", { ascending: false });
    setCommerce((data as CommerceData[]) ?? []);
    setLoaded((prev) => new Set(prev).add("commerce"));
    setLoadingCommerce(false);
  }

  async function fetchAnalytics() {
    setLoadingAnalytics(true);
    const { data } = await supabase
      .from("influencer_analytics")
      .select("*")
      .eq("influencer_id", influencerId)
      .order("metric_date", { ascending: false })
      .limit(30);
    setAnalytics((data as AnalyticsData[]) ?? []);
    setLoaded((prev) => new Set(prev).add("analytics"));
    setLoadingAnalytics(false);
  }

  return (
    <div className="mt-4 border-t border-border/50 pt-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-8">
          <TabsTrigger value="brands" className="text-xs gap-1.5 h-7">
            <Building2 className="w-3 h-3" />
            브랜드 협업
            {loaded.has("brands") && brandRels.length > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">
                {brandRels.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="commerce" className="text-xs gap-1.5 h-7">
            <ShoppingCart className="w-3 h-3" />
            이커머스
            {loaded.has("commerce") && commerce.length > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">
                {commerce.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1.5 h-7">
            <BarChart3 className="w-3 h-3" />
            분석 추이
            {loaded.has("analytics") && analytics.length > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">
                {analytics.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Brand Collaborations Tab */}
        <TabsContent value="brands" className="mt-3">
          {loadingBrands ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">브랜드 협업 데이터 로딩...</span>
            </div>
          ) : brandRels.length === 0 ? (
            <div className="text-center py-6">
              <Building2 className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">브랜드 협업 데이터가 없습니다</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {brandRels.map((rel) => (
                <div
                  key={rel.id}
                  className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors"
                >
                  {/* Brand header */}
                  <div className="flex items-center gap-2">
                    {rel.brand_accounts?.profile_image_url ? (
                      <img
                        src={rel.brand_accounts.profile_image_url}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {rel.brand_accounts?.brand_name || rel.brand_accounts?.username || "Unknown"}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {rel.brand_accounts?.platform}
                        </Badge>
                        {rel.is_brand_ambassador && (
                          <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            <Star className="w-2.5 h-2.5 mr-0.5" /> 앰배서더
                          </Badge>
                        )}
                        {rel.is_active && (
                          <Badge className="text-[9px] px-1 py-0 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                            활성
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Strength score */}
                    {rel.relationship_strength_score != null && (
                      <div className="ml-auto text-center">
                        <div
                          className={`text-lg font-bold ${
                            rel.relationship_strength_score >= 70
                              ? "text-green-600"
                              : rel.relationship_strength_score >= 40
                                ? "text-amber-600"
                                : "text-muted-foreground"
                          }`}
                        >
                          {rel.relationship_strength_score}
                        </div>
                        <p className="text-[9px] text-muted-foreground">강도</p>
                      </div>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-foreground">{rel.total_collaborations}</span>회 협업
                      <span className="text-[10px]">
                        (S:{rel.sponsored_count} / O:{rel.organic_count})
                      </span>
                    </span>
                    {rel.avg_views != null && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> 평균 {formatNumber(rel.avg_views)}
                      </span>
                    )}
                    {rel.avg_likes != null && (
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" /> {formatNumber(rel.avg_likes)}
                      </span>
                    )}
                    {rel.avg_engagement_rate != null && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {rel.avg_engagement_rate.toFixed(2)}%
                      </span>
                    )}
                  </div>

                  {/* Financial */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {rel.estimated_collaboration_value != null && (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <DollarSign className="w-3 h-3" />
                        추정가치 {formatCurrency(rel.estimated_collaboration_value)}
                      </span>
                    )}
                    {rel.estimated_cpm != null && (
                      <span className="text-muted-foreground">
                        CPM {formatCurrency(rel.estimated_cpm)}
                      </span>
                    )}
                    {rel.likely_payment_model && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {rel.likely_payment_model === "gifted"
                          ? "기프티드"
                          : rel.likely_payment_model === "paid"
                            ? "유료"
                            : rel.likely_payment_model === "affiliate"
                              ? "제휴"
                              : rel.likely_payment_model === "ambassador"
                                ? "앰배서더"
                                : rel.likely_payment_model}
                      </Badge>
                    )}
                  </div>

                  {/* Dates */}
                  {(rel.first_collaboration_at || rel.last_collaboration_at) && (
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      {rel.first_collaboration_at && (
                        <span>
                          첫 협업: {new Date(rel.first_collaboration_at).toLocaleDateString("ko-KR")}
                        </span>
                      )}
                      {rel.last_collaboration_at && (
                        <span>
                          최근: {new Date(rel.last_collaboration_at).toLocaleDateString("ko-KR")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Commerce Tab */}
        <TabsContent value="commerce" className="mt-3">
          {loadingCommerce ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">이커머스 데이터 로딩...</span>
            </div>
          ) : commerce.length === 0 ? (
            <div className="text-center py-6">
              <ShoppingCart className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">이커머스 데이터가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {commerce.map((c) => (
                <div key={c.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{c.platform}</Badge>
                      {c.commission_model && (
                        <Badge variant="secondary" className="text-[10px]">
                          {c.commission_model === "percentage"
                            ? "퍼센트"
                            : c.commission_model === "flat"
                              ? "정액"
                              : c.commission_model === "hybrid"
                                ? "하이브리드"
                                : c.commission_model}
                        </Badge>
                      )}
                      {c.data_source && (
                        <span className="text-[10px] text-muted-foreground">{c.data_source}</span>
                      )}
                    </div>
                    {c.roas != null && (
                      <div className="text-right">
                        <span
                          className={`text-lg font-bold ${
                            c.roas >= 3
                              ? "text-green-600"
                              : c.roas >= 1
                                ? "text-amber-600"
                                : "text-red-500"
                          }`}
                        >
                          {c.roas.toFixed(1)}x
                        </span>
                        <p className="text-[9px] text-muted-foreground">ROAS</p>
                      </div>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <div className="text-center p-1.5 bg-muted/50 rounded">
                      <p className="text-xs font-bold">{formatCurrency(c.total_revenue)}</p>
                      <p className="text-[9px] text-muted-foreground">매출</p>
                    </div>
                    <div className="text-center p-1.5 bg-muted/50 rounded">
                      <p className="text-xs font-bold">{formatNumber(c.total_orders)}</p>
                      <p className="text-[9px] text-muted-foreground">주문</p>
                    </div>
                    <div className="text-center p-1.5 bg-muted/50 rounded">
                      <p className="text-xs font-bold">{formatNumber(c.total_clicks)}</p>
                      <p className="text-[9px] text-muted-foreground">클릭</p>
                    </div>
                    <div className="text-center p-1.5 bg-muted/50 rounded">
                      <p className="text-xs font-bold">
                        {c.conversion_rate != null ? `${c.conversion_rate.toFixed(2)}%` : "-"}
                      </p>
                      <p className="text-[9px] text-muted-foreground">전환율</p>
                    </div>
                    <div className="text-center p-1.5 bg-muted/50 rounded">
                      <p className="text-xs font-bold">{formatCurrency(c.aov)}</p>
                      <p className="text-[9px] text-muted-foreground">AOV</p>
                    </div>
                    <div className="text-center p-1.5 bg-muted/50 rounded">
                      <p className="text-xs font-bold">{formatCurrency(c.total_commission)}</p>
                      <p className="text-[9px] text-muted-foreground">커미션</p>
                    </div>
                  </div>

                  {/* Additional info */}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {c.campaign_spend != null && (
                      <span>광고비: {formatCurrency(c.campaign_spend)}</span>
                    )}
                    {c.cpa != null && <span>CPA: {formatCurrency(c.cpa)}</span>}
                    {c.commission_rate != null && (
                      <span>커미션율: {c.commission_rate}%</span>
                    )}
                  </div>

                  {/* Products */}
                  {c.top_products && c.top_products.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.top_products.map((p, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {c.last_synced_at && (
                    <p className="text-[10px] text-muted-foreground">
                      마지막 동기화: {new Date(c.last_synced_at).toLocaleDateString("ko-KR")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-3">
          {loadingAnalytics ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">분석 데이터 로딩...</span>
            </div>
          ) : analytics.length === 0 ? (
            <div className="text-center py-6">
              <BarChart3 className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">분석 추이 데이터가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">날짜</th>
                      <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">유형</th>
                      <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">팔로워</th>
                      <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">참여율</th>
                      <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">평균좋아요</th>
                      <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">평균댓글</th>
                      <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">평균조회</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.map((a) => (
                      <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-1.5 px-2">
                          {new Date(a.metric_date).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="py-1.5 px-2">
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {a.metric_type}
                          </Badge>
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums">
                          {formatNumber(a.followers_count)}
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums">
                          {a.engagement_rate != null
                            ? `${(a.engagement_rate * 100).toFixed(2)}%`
                            : "-"}
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums">
                          {formatNumber(a.avg_likes)}
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums">
                          {formatNumber(a.avg_comments)}
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums">
                          {formatNumber(a.avg_views)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
