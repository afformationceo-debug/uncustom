"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useRealtime } from "@/hooks/use-realtime";
import type { Tables } from "@/types/database";

type EmailLog = Tables<"email_logs"> & {
  influencer?: Tables<"influencers">;
  template?: Tables<"email_templates">;
};

const statusConfig: Record<string, { label: string; color: string }> = {
  queued: { label: "대기", color: "bg-gray-100 text-gray-800" },
  sent: { label: "발송됨", color: "bg-blue-100 text-blue-800" },
  delivered: { label: "전달됨", color: "bg-green-100 text-green-800" },
  opened: { label: "열람됨", color: "bg-purple-100 text-purple-800" },
  clicked: { label: "클릭됨", color: "bg-indigo-100 text-indigo-800" },
  bounced: { label: "바운스", color: "bg-red-100 text-red-800" },
  failed: { label: "실패", color: "bg-red-100 text-red-800" },
};

export default function EmailLogsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [campaignId]);

  useRealtime(
    "email_logs",
    `campaign_id=eq.${campaignId}`,
    () => fetchLogs()
  );

  async function fetchLogs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_logs")
      .select(`
        *,
        influencer:influencers(username, display_name, email, platform),
        template:email_templates(subject, round_number)
      `)
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error) {
      setLogs((data as unknown as EmailLog[]) ?? []);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">발송 로그</h2>
        <Badge variant="secondary">{logs.length}건</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Object.entries(statusConfig).map(([key, config]) => {
          const count = logs.filter((l) => l.status === key).length;
          return (
            <Card key={key}>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-gray-500">{config.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>인플루언서</TableHead>
                <TableHead>회차</TableHead>
                <TableHead>제목</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>발송일</TableHead>
                <TableHead>열람</TableHead>
                <TableHead>클릭</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    발송 로그가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const sc = statusConfig[log.status] ?? { label: log.status, color: "" };
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="font-medium">
                          {(log.influencer as unknown as Tables<"influencers">)?.display_name ??
                            (log.influencer as unknown as Tables<"influencers">)?.username ??
                            "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.round_number}회차</Badge>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {(log.template as unknown as Tables<"email_templates">)?.subject ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={sc.color} variant="secondary">
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {log.sent_at
                          ? new Date(log.sent_at).toLocaleString("ko-KR")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.opened_at
                          ? new Date(log.opened_at).toLocaleString("ko-KR")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.clicked_at
                          ? new Date(log.clicked_at).toLocaleString("ko-KR")
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
