"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Play, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { useRealtime } from "@/hooks/use-realtime";

type ExtractionJob = Tables<"extraction_jobs">;
type Keyword = Tables<"keywords">;
type TaggedAccount = Tables<"tagged_accounts">;

export default function ExtractPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [taggedAccounts, setTaggedAccounts] = useState<TaggedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [campaignId]);

  useRealtime<ExtractionJob>(
    "extraction_jobs",
    `campaign_id=eq.${campaignId}`,
    (payload) => {
      if (payload.eventType === "INSERT") {
        setJobs((prev) => [payload.new as ExtractionJob, ...prev]);
      } else if (payload.eventType === "UPDATE") {
        setJobs((prev) =>
          prev.map((j) => (j.id === (payload.new as ExtractionJob).id ? (payload.new as ExtractionJob) : j))
        );
      }
    }
  );

  async function fetchData() {
    setLoading(true);
    const [jobsRes, keywordsRes, taggedRes] = await Promise.all([
      supabase
        .from("extraction_jobs")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false }),
      supabase
        .from("keywords")
        .select("*")
        .eq("campaign_id", campaignId),
      supabase
        .from("tagged_accounts")
        .select("*")
        .eq("campaign_id", campaignId),
    ]);

    setJobs((jobsRes.data as ExtractionJob[]) ?? []);
    setKeywords((keywordsRes.data as Keyword[]) ?? []);
    setTaggedAccounts((taggedRes.data as TaggedAccount[]) ?? []);
    setLoading(false);
  }

  async function startExtraction(type: "keyword" | "tagged", sourceId: string, platform: string) {
    setExtracting(sourceId);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          type,
          source_id: sourceId,
          platform,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error("추출 실패: " + result.error);
      } else {
        toast.success("추출이 시작되었습니다.");
      }
    } catch {
      toast.error("추출 요청 중 오류가 발생했습니다.");
    }
    setExtracting(null);
  }

  async function checkStatus(jobId: string) {
    try {
      const response = await fetch(`/api/extract/status?job_id=${jobId}`);
      const result = await response.json();
      if (!response.ok) {
        toast.error("상태 확인 실패: " + result.error);
      } else {
        toast.success(`상태: ${result.status} (추출: ${result.total_extracted ?? 0}건)`);
      }
    } catch {
      toast.error("상태 확인 중 오류가 발생했습니다.");
    }
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    running: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  const statusLabels: Record<string, string> = {
    pending: "대기 중",
    running: "실행 중",
    completed: "완료",
    failed: "실패",
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">인플루언서 추출</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Keywords extraction */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">키워드 기반 추출</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {keywords.length === 0 ? (
              <p className="text-sm text-gray-500">등록된 키워드가 없습니다.</p>
            ) : (
              keywords.map((kw) => (
                <div
                  key={kw.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <span className="font-medium">{kw.keyword}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {kw.platform}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => startExtraction("keyword", kw.id, kw.platform)}
                    disabled={extracting === kw.id}
                  >
                    {extracting === kw.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Tagged account extraction */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">태그 계정 기반 추출</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {taggedAccounts.length === 0 ? (
              <p className="text-sm text-gray-500">등록된 태그 계정이 없습니다.</p>
            ) : (
              taggedAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <span className="font-medium">@{acc.account_username}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {acc.platform}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => startExtraction("tagged", acc.id, acc.platform)}
                    disabled={extracting === acc.id}
                  >
                    {extracting === acc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Extraction Jobs History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">추출 작업 내역</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>타입</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>전체</TableHead>
                <TableHead>신규</TableHead>
                <TableHead>시작일</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    추출 작업이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.type === "keyword" ? "키워드" : "태그"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{job.platform}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[job.status] ?? ""} variant="secondary">
                        {statusLabels[job.status] ?? job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{job.total_extracted}</TableCell>
                    <TableCell>{job.new_extracted}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {job.started_at
                        ? new Date(job.started_at).toLocaleString("ko-KR")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {(job.status === "running" || job.status === "pending") && (
                        <Button variant="ghost" size="sm" onClick={() => checkStatus(job.id)}>
                          <RefreshCw className="w-4 h-4" />
                        </Button>
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
