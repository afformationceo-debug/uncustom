import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hash, AtSign, Users, Mail, MessageSquare, Video, TrendingUp, Clock, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Tables } from "@/types/database";
import { CAMPAIGN_INFLUENCER_STATUSES } from "@/types/platform";

type ExtractionJob = Tables<"extraction_jobs">;
type EmailLog = Tables<"email_logs">;

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (!campaign) notFound();

  const [
    { count: keywordCount },
    { count: taggedCount },
    { count: influencerCount },
    { count: emailCount },
    { count: threadCount },
    { count: contentCount },
    { data: statusData },
    { data: recentJobs },
    { data: recentEmails },
    { count: unreadCount },
  ] = await Promise.all([
    supabase.from("keywords").select("*", { count: "exact", head: true }).eq("campaign_id", id),
    supabase.from("tagged_accounts").select("*", { count: "exact", head: true }).eq("campaign_id", id),
    supabase.from("campaign_influencers").select("*", { count: "exact", head: true }).eq("campaign_id", id),
    supabase.from("email_logs").select("*", { count: "exact", head: true }).eq("campaign_id", id),
    supabase.from("email_threads").select("*", { count: "exact", head: true }).eq("campaign_id", id),
    supabase.from("influencer_contents").select("*", { count: "exact", head: true }).eq("campaign_id", id),
    supabase.from("campaign_influencers").select("status").eq("campaign_id", id),
    supabase.from("extraction_jobs").select("*").eq("campaign_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("email_logs").select("*").eq("campaign_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("email_threads").select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("unread", true),
  ]);

  const stats = [
    { title: "키워드", value: keywordCount ?? 0, icon: Hash, color: "text-primary", bg: "bg-primary/10", href: `/extract/keywords` },
    { title: "태그 계정", value: taggedCount ?? 0, icon: AtSign, color: "text-purple-500", bg: "bg-purple-500/10", href: `/extract/tagged` },
    { title: "인플루언서", value: influencerCount ?? 0, icon: Users, color: "text-green-500", bg: "bg-green-500/10", href: `/manage?campaign=${id}` },
    { title: "발송 이메일", value: emailCount ?? 0, icon: Mail, color: "text-orange-500", bg: "bg-orange-500/10", href: `/email/logs?campaign=${id}` },
    { title: "인박스", value: `${unreadCount ?? 0} / ${threadCount ?? 0}`, icon: MessageSquare, color: "text-pink-500", bg: "bg-pink-500/10", href: `/inbox?campaign=${id}` },
    { title: "콘텐츠", value: contentCount ?? 0, icon: Video, color: "text-red-500", bg: "bg-red-500/10", href: `/contents?campaign=${id}` },
  ];

  // Quick links to global pages with this campaign pre-selected
  const quickLinks = [
    { label: "이메일 발송", href: `/email/send?campaign=${id}` },
    { label: "발송 로그", href: `/email/logs?campaign=${id}` },
    { label: "인박스", href: `/inbox?campaign=${id}` },
    { label: "인플루언서 관리", href: `/manage?campaign=${id}` },
    { label: "콘텐츠", href: `/contents?campaign=${id}` },
    { label: "SNS 계정", href: `/sns-accounts?campaign=${id}` },
    { label: "성과", href: `/metrics?campaign=${id}` },
    { label: "제안서", href: `/proposals?campaign=${id}` },
    { label: "템플릿", href: `/templates?campaign=${id}` },
  ];

  // Calculate status pipeline
  const statusCounts: Record<string, number> = {};
  ((statusData as { status: string }[]) ?? []).forEach((item) => {
    statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
  });

  const jobStatusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500",
    running: "bg-blue-500/10 text-blue-500",
    completed: "bg-green-500/10 text-green-500",
    failed: "bg-red-500/10 text-red-500",
  };

  const emailStatusColors: Record<string, string> = {
    queued: "bg-muted text-muted-foreground",
    sent: "bg-blue-500/10 text-blue-500",
    delivered: "bg-green-500/10 text-green-500",
    opened: "bg-emerald-500/10 text-emerald-500",
    clicked: "bg-purple-500/10 text-purple-500",
    bounced: "bg-red-500/10 text-red-500",
    failed: "bg-red-500/10 text-red-500",
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-1.5 rounded ${stat.bg}`}>
                  <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            바로가기
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Badge variant="outline" className="cursor-pointer hover:bg-accent px-3 py-1.5 text-sm">
                  {link.label}
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Influencer Pipeline */}
      {(influencerCount ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              인플루언서 파이프라인
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {CAMPAIGN_INFLUENCER_STATUSES.map((s) => {
                const count = statusCounts[s.value] ?? 0;
                return (
                  <div key={s.value} className="flex items-center gap-1.5 px-3 py-2 bg-muted/50 rounded-lg">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <Badge variant={count > 0 ? "default" : "outline"} className="text-xs">
                      {count}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Extraction Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              최근 추출 작업
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!recentJobs || recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">추출 작업이 없습니다.</p>
            ) : (
              ((recentJobs as ExtractionJob[]) ?? []).map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium">
                      {{ keyword: "키워드", tagged: "태그", enrich: "프로필 보강", email_scrape: "이메일 추출" }[job.type] ?? job.type} · {job.platform}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {job.started_at ? new Date(job.started_at).toLocaleString("ko-KR") : "-"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.total_extracted > 0 && (
                      <span className="text-xs text-muted-foreground">{job.total_extracted}건</span>
                    )}
                    <Badge className={jobStatusColors[job.status] ?? ""} variant="secondary">
                      {job.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Email Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              최근 이메일 활동
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!recentEmails || recentEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground">이메일 활동이 없습니다.</p>
            ) : (
              ((recentEmails as EmailLog[]) ?? []).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium">
                      {log.round_number}회차 발송
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {log.sent_at ? new Date(log.sent_at).toLocaleString("ko-KR") : log.created_at ? new Date(log.created_at).toLocaleString("ko-KR") : "-"}
                    </div>
                  </div>
                  <Badge className={emailStatusColors[log.status] ?? ""} variant="secondary">
                    {log.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
