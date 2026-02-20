"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Eye, Heart, MessageCircle, Share2, TrendingUp, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { useRealtime } from "@/hooks/use-realtime";

type Upload = Tables<"multi_channel_uploads"> & {
  latest_metrics?: Tables<"content_metrics">;
};

type MetricKey = "views" | "likes" | "comments" | "shares";

export default function MetricsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [chartMetric, setChartMetric] = useState<MetricKey>("views");

  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const [totalShares, setTotalShares] = useState(0);

  useEffect(() => {
    fetchMetrics();
  }, [campaignId]);

  const realtimeCallback = useCallback(() => {
    fetchMetrics();
  }, [campaignId]);
  useRealtime("content_metrics", undefined, realtimeCallback);

  async function fetchMetrics() {
    setLoading(true);

    const { data: uploadData } = await supabase
      .from("multi_channel_uploads")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "published");

    if (uploadData && uploadData.length > 0) {
      const typedUploadData = uploadData as Tables<"multi_channel_uploads">[];
      const uploadIds = typedUploadData.map((u) => u.id);

      const { data: metricsData } = await supabase
        .from("content_metrics")
        .select("*")
        .in("upload_id", uploadIds)
        .order("tracked_at", { ascending: false });

      const latestMetrics: Record<string, Tables<"content_metrics">> = {};
      for (const m of (metricsData as Tables<"content_metrics">[]) ?? []) {
        if (!latestMetrics[m.upload_id]) {
          latestMetrics[m.upload_id] = m;
        }
      }

      const enriched: Upload[] = typedUploadData.map((u) => ({
        ...u,
        latest_metrics: latestMetrics[u.id],
      }));

      setUploads(enriched);

      const metrics = Object.values(latestMetrics);
      setTotalViews(metrics.reduce((sum, m) => sum + (m.views ?? 0), 0));
      setTotalLikes(metrics.reduce((sum, m) => sum + (m.likes ?? 0), 0));
      setTotalComments(metrics.reduce((sum, m) => sum + (m.comments ?? 0), 0));
      setTotalShares(metrics.reduce((sum, m) => sum + (m.shares ?? 0), 0));
    } else {
      setUploads([]);
      setTotalViews(0);
      setTotalLikes(0);
      setTotalComments(0);
      setTotalShares(0);
    }

    setLoading(false);
  }

  async function refreshMetrics() {
    setRefreshing(true);
    try {
      // Start the scraping job (non-blocking)
      const response = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });

      const result = await response.json();
      if (!response.ok || !result.apify_run_id) {
        toast.error("메트릭 업데이트 실패");
        setRefreshing(false);
        return;
      }

      toast.success("메트릭 수집이 시작되었습니다...");

      // Poll for completion
      const runId = result.apify_run_id;
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/metrics", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaign_id: campaignId, apify_run_id: runId }),
          });
          const statusData = await statusRes.json();

          if (statusData.status === "completed") {
            clearInterval(pollInterval);
            toast.success(`메트릭 업데이트 완료 (${statusData.updated}/${statusData.total})`);
            setRefreshing(false);
            fetchMetrics();
          } else if (statusData.status === "failed") {
            clearInterval(pollInterval);
            toast.error("메트릭 수집 실패: " + (statusData.error ?? "Unknown"));
            setRefreshing(false);
          }
        } catch {
          clearInterval(pollInterval);
          setRefreshing(false);
        }
      }, 5000);
    } catch {
      toast.error("오류가 발생했습니다.");
      setRefreshing(false);
    }
  }

  const filteredUploads = useMemo(() => {
    if (platformFilter === "all") return uploads;
    return uploads.filter((u) => u.target_platform === platformFilter);
  }, [uploads, platformFilter]);

  const platforms = useMemo(() => {
    const set = new Set(uploads.map((u) => u.target_platform));
    return Array.from(set);
  }, [uploads]);

  const platformStats = useMemo(() => {
    const stats: Record<string, { views: number; likes: number; comments: number; shares: number; count: number }> = {};
    for (const u of uploads) {
      const p = u.target_platform;
      if (!stats[p]) stats[p] = { views: 0, likes: 0, comments: 0, shares: 0, count: 0 };
      stats[p].count++;
      const m = u.latest_metrics;
      if (m) {
        stats[p].views += m.views ?? 0;
        stats[p].likes += m.likes ?? 0;
        stats[p].comments += m.comments ?? 0;
        stats[p].shares += m.shares ?? 0;
      }
    }
    return stats;
  }, [uploads]);

  const chartData = useMemo(() => {
    const data = filteredUploads
      .filter((u) => u.latest_metrics)
      .map((u) => ({
        label: u.title ?? u.caption?.slice(0, 20) ?? u.target_platform,
        value: u.latest_metrics?.[chartMetric] ?? 0,
        platform: u.target_platform,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const maxVal = Math.max(...data.map((d) => d.value), 1);
    return data.map((d) => ({ ...d, percent: (d.value / maxVal) * 100 }));
  }, [filteredUploads, chartMetric]);

  const statCards = [
    { title: "총 조회수", value: totalViews, icon: Eye, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "총 좋아요", value: totalLikes, icon: Heart, color: "text-red-500", bg: "bg-red-500/10" },
    { title: "총 댓글", value: totalComments, icon: MessageCircle, color: "text-green-500", bg: "bg-green-500/10" },
    { title: "총 공유", value: totalShares, icon: Share2, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  const metricOptions: { value: MetricKey; label: string }[] = [
    { value: "views", label: "조회수" },
    { value: "likes", label: "좋아요" },
    { value: "comments", label: "댓글" },
    { value: "shares", label: "공유" },
  ];

  const platformColor: Record<string, string> = {
    instagram: "bg-pink-500",
    youtube: "bg-red-500",
    tiktok: "bg-cyan-500",
    twitter: "bg-sky-500",
    threads: "bg-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">성과 추적</h2>
          <p className="text-sm text-muted-foreground mt-1">
            게시된 콘텐츠의 성과를 한눈에 확인합니다.
          </p>
        </div>
        <Button variant="outline" onClick={refreshMetrics} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          메트릭 새로고침
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{stat.title}</span>
                <div className={`p-1.5 rounded ${stat.bg}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Platform Breakdown */}
      {Object.keys(platformStats).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              플랫폼별 성과
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(platformStats).map(([platform, stats]) => (
                <div
                  key={platform}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className={`w-2 h-8 rounded-full ${platformColor[platform] ?? "bg-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium capitalize">{platform}</span>
                      <Badge variant="secondary" className="text-xs">{stats.count}개</Badge>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {stats.views.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {stats.likes.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {stats.comments.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                콘텐츠별 비교 (상위 10개)
              </CardTitle>
              <Select value={chartMetric} onValueChange={(v) => setChartMetric(v as MetricKey)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {chartData.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-32 text-xs text-muted-foreground truncate text-right shrink-0">
                    {item.label}
                  </div>
                  <div className="flex-1 h-7 bg-muted/50 rounded-md overflow-hidden relative">
                    <div
                      className={`h-full rounded-md transition-all duration-500 ${platformColor[item.platform] ?? "bg-primary"}`}
                      style={{ width: `${item.percent}%`, opacity: 0.8 }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium">
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                    {item.platform}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">업로드 콘텐츠별 성과</CardTitle>
            {platforms.length > 1 && (
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 플랫폼</SelectItem>
                  {platforms.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>플랫폼</TableHead>
                <TableHead>제목</TableHead>
                <TableHead className="text-right">조회수</TableHead>
                <TableHead className="text-right">좋아요</TableHead>
                <TableHead className="text-right">댓글</TableHead>
                <TableHead className="text-right">공유</TableHead>
                <TableHead className="text-right">참여율</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : filteredUploads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    게시된 콘텐츠가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUploads.map((upload) => {
                  const m = upload.latest_metrics;
                  return (
                    <TableRow key={upload.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-4 rounded-full ${platformColor[upload.target_platform] ?? "bg-muted-foreground"}`} />
                          <Badge variant="secondary" className="capitalize">{upload.target_platform}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {upload.title ?? upload.caption?.slice(0, 50) ?? "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{m?.views?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{m?.likes?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{m?.comments?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{m?.shares?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        {m?.engagement_rate
                          ? <Badge variant="outline" className="tabular-nums">{(Number(m.engagement_rate) * 100).toFixed(2)}%</Badge>
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
