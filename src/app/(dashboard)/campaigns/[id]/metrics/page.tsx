"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";

type Upload = Tables<"multi_channel_uploads"> & {
  latest_metrics?: Tables<"content_metrics">;
};

export default function MetricsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Summary
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const [totalShares, setTotalShares] = useState(0);

  useEffect(() => {
    fetchMetrics();
  }, [campaignId]);

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

      // Get latest metrics for each upload
      const { data: metricsData } = await supabase
        .from("content_metrics")
        .select("*")
        .in("upload_id", uploadIds)
        .order("tracked_at", { ascending: false });

      // Group by upload_id, take latest
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

      // Calculate totals
      const metrics = Object.values(latestMetrics);
      setTotalViews(metrics.reduce((sum, m) => sum + (m.views ?? 0), 0));
      setTotalLikes(metrics.reduce((sum, m) => sum + (m.likes ?? 0), 0));
      setTotalComments(metrics.reduce((sum, m) => sum + (m.comments ?? 0), 0));
      setTotalShares(metrics.reduce((sum, m) => sum + (m.shares ?? 0), 0));
    } else {
      setUploads([]);
    }

    setLoading(false);
  }

  async function refreshMetrics() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });

      if (response.ok) {
        toast.success("메트릭이 업데이트되었습니다.");
        fetchMetrics();
      } else {
        toast.error("메트릭 업데이트 실패");
      }
    } catch {
      toast.error("오류가 발생했습니다.");
    }
    setRefreshing(false);
  }

  const statCards = [
    { title: "총 조회수", value: totalViews, icon: Eye, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "총 좋아요", value: totalLikes, icon: Heart, color: "text-red-600", bg: "bg-red-50" },
    { title: "총 댓글", value: totalComments, icon: MessageCircle, color: "text-green-600", bg: "bg-green-50" },
    { title: "총 공유", value: totalShares, icon: Share2, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">성과 추적</h2>
        <Button variant="outline" onClick={refreshMetrics} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          메트릭 새로고침
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{stat.title}</span>
                <div className={`p-1.5 rounded ${stat.bg}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">업로드 콘텐츠별 성과</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>플랫폼</TableHead>
                <TableHead>제목</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>조회수</TableHead>
                <TableHead>좋아요</TableHead>
                <TableHead>댓글</TableHead>
                <TableHead>공유</TableHead>
                <TableHead>참여율</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : uploads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    게시된 콘텐츠가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                uploads.map((upload) => {
                  const m = upload.latest_metrics;
                  return (
                    <TableRow key={upload.id}>
                      <TableCell>
                        <Badge variant="secondary">{upload.target_platform}</Badge>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {upload.title ?? upload.caption?.slice(0, 50) ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800" variant="secondary">
                          게시됨
                        </Badge>
                      </TableCell>
                      <TableCell>{m?.views?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell>{m?.likes?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell>{m?.comments?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell>{m?.shares?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell>
                        {m?.engagement_rate
                          ? `${(Number(m.engagement_rate) * 100).toFixed(2)}%`
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
