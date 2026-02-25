"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  Users,
  Mail,
  BarChart3,
  Inbox,
  ArrowRight,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  Send,
  Download,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { AIInsightsBar } from "@/components/ai/ai-insights-bar";

const campaignStatusMap: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "초안", variant: "secondary" },
  active: { label: "진행중", variant: "default" },
  paused: { label: "일시중지", variant: "outline" },
  completed: { label: "완료", variant: "secondary" },
  archived: { label: "보관됨", variant: "destructive" },
};

const extractionStatusMap: Record<string, { label: string; icon: typeof Clock }> = {
  pending: { label: "대기 중", icon: Clock },
  running: { label: "실행 중", icon: Play },
  completed: { label: "완료", icon: CheckCircle2 },
  failed: { label: "실패", icon: XCircle },
};

const extractionStatusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  running: "bg-blue-500/10 text-blue-500",
  completed: "bg-green-500/10 text-green-500",
  failed: "bg-red-500/10 text-red-500",
};

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(dateString).toLocaleDateString("ko-KR");
}

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface ExtractionJobRow {
  id: string;
  status: string;
  type: string;
  platform: string;
  total_extracted: number | null;
  new_extracted: number | null;
  created_at: string;
  campaigns: { name: string } | null;
}

interface EmailLogRow {
  id: string;
  status: string;
  round_number: number | null;
  created_at: string;
  campaigns: { name: string } | null;
  influencers: { username: string | null; display_name: string | null } | null;
}

type ActivityItem =
  | { type: "extraction"; data: ExtractionJobRow; created_at: string }
  | { type: "email"; data: EmailLogRow; created_at: string };

interface DashboardStats {
  campaignCount: number;
  activeCampaignCount: number;
  campaignInfluencerCount: number;
  influencerCount: number;
  emailCount: number;
  sentEmailCount: number;
  contentCount: number;
  unreadThreadCount: number;
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
        <div className="h-8 w-8 bg-muted animate-pulse rounded-lg" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
        <div className="h-3 w-24 bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    campaignCount: 0,
    activeCampaignCount: 0,
    campaignInfluencerCount: 0,
    influencerCount: 0,
    emailCount: 0,
    sentEmailCount: 0,
    contentCount: 0,
    unreadThreadCount: 0,
  });
  const [recentCampaigns, setRecentCampaigns] = useState<CampaignRow[]>([]);
  const [influencerCountByCampaign, setInfluencerCountByCampaign] = useState<Record<string, number>>({});
  const [emailCountByCampaign, setEmailCountByCampaign] = useState<Record<string, number>>({});
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        // --- Stat card queries (all parallel) ---
        const [
          { count: campaignCount },
          { count: activeCampaignCount },
          { count: campaignInfluencerCount },
          { count: influencerCount },
          { count: emailCount },
          { count: sentEmailCount },
          { count: contentCount },
          { count: unreadThreadCount },
        ] = await Promise.all([
          supabase.from("campaigns").select("*", { count: "exact", head: true }),
          supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("campaign_influencers").select("*", { count: "exact", head: true }),
          supabase.from("influencers").select("*", { count: "exact", head: true }),
          supabase.from("email_logs").select("*", { count: "exact", head: true }),
          supabase.from("email_logs").select("*", { count: "exact", head: true }).eq("status", "sent"),
          supabase.from("influencer_contents").select("*", { count: "exact", head: true }),
          supabase.from("email_threads").select("*", { count: "exact", head: true }).eq("unread", true),
        ]);

        setStats({
          campaignCount: campaignCount ?? 0,
          activeCampaignCount: activeCampaignCount ?? 0,
          campaignInfluencerCount: campaignInfluencerCount ?? 0,
          influencerCount: influencerCount ?? 0,
          emailCount: emailCount ?? 0,
          sentEmailCount: sentEmailCount ?? 0,
          contentCount: contentCount ?? 0,
          unreadThreadCount: unreadThreadCount ?? 0,
        });

        // --- Recent campaigns ---
        const { data: recentCampaignsData } = await supabase
          .from("campaigns")
          .select("id, name, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5);

        const campaigns = (recentCampaignsData as CampaignRow[]) ?? [];
        setRecentCampaigns(campaigns);

        // --- Per-campaign counts + activity feed (parallel) ---
        const campaignIds = campaigns.map((c) => c.id);

        const [
          { data: ciData },
          { data: ceData },
          { data: recentJobsData },
          { data: recentEmailsData },
        ] = await Promise.all([
          campaignIds.length > 0
            ? supabase.from("campaign_influencers").select("campaign_id").in("campaign_id", campaignIds)
            : Promise.resolve({ data: [] }),
          campaignIds.length > 0
            ? supabase.from("email_logs").select("campaign_id").in("campaign_id", campaignIds)
            : Promise.resolve({ data: [] }),
          supabase
            .from("extraction_jobs")
            .select("id, status, type, platform, total_extracted, new_extracted, created_at, campaigns(name)")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("email_logs")
            .select("id, status, round_number, created_at, campaigns(name), influencers(username, display_name)")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        // Influencer counts
        const infCountMap: Record<string, number> = {};
        for (const row of (ciData as { campaign_id: string }[]) ?? []) {
          infCountMap[row.campaign_id] = (infCountMap[row.campaign_id] ?? 0) + 1;
        }
        setInfluencerCountByCampaign(infCountMap);

        // Email counts
        const emlCountMap: Record<string, number> = {};
        for (const row of (ceData as { campaign_id: string }[]) ?? []) {
          emlCountMap[row.campaign_id] = (emlCountMap[row.campaign_id] ?? 0) + 1;
        }
        setEmailCountByCampaign(emlCountMap);

        // Activity feed
        const jobs = (recentJobsData as ExtractionJobRow[]) ?? [];
        const emails = (recentEmailsData as EmailLogRow[]) ?? [];
        const feed: ActivityItem[] = [
          ...jobs.map((j) => ({ type: "extraction" as const, data: j, created_at: j.created_at })),
          ...emails.map((e) => ({ type: "email" as const, data: e, created_at: e.created_at })),
        ]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8);

        setActivityFeed(feed);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  const statCards = [
    {
      title: "활성 캠페인",
      value: `${stats.activeCampaignCount} / ${stats.campaignCount}`,
      description: "진행중 / 전체",
      icon: Megaphone,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "인플루언서",
      value: stats.influencerCount.toLocaleString(),
      description: `캠페인별 ${stats.campaignInfluencerCount.toLocaleString()}건 배정`,
      icon: Users,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      title: "발송 이메일",
      value: stats.emailCount.toLocaleString(),
      description: `${stats.sentEmailCount.toLocaleString()}건 발송 완료`,
      icon: Mail,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      title: "콘텐츠",
      value: stats.contentCount.toLocaleString(),
      description: "수집된 인플루언서 콘텐츠",
      icon: BarChart3,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      title: "미확인 수신함",
      value: stats.unreadThreadCount.toLocaleString(),
      description: "읽지 않은 스레드",
      icon: Inbox,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">대시보드</h1>

      {/* AI Insights */}
      <AIInsightsBar pageContext="home" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
          : statCards.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent campaigns */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">최근 캠페인</CardTitle>
              <Link
                href="/campaigns"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                전체 보기
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <CardDescription>최근 생성된 캠페인 5개</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <ListSkeleton />
            ) : recentCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                캠페인이 없습니다.
              </p>
            ) : (
              recentCampaigns.map((campaign) => {
                const status = campaignStatusMap[campaign.status] ?? {
                  label: campaign.status,
                  variant: "outline" as const,
                };
                const infCount = influencerCountByCampaign[campaign.id] ?? 0;
                const emlCount = emailCountByCampaign[campaign.id] ?? 0;

                return (
                  <Link
                    key={campaign.id}
                    href={`/campaigns/${campaign.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {campaign.name}
                        </span>
                        <Badge variant={status.variant} className="shrink-0">
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {infCount}명
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {emlCount}건
                        </span>
                        <span>
                          {new Date(campaign.created_at).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 활동</CardTitle>
            <CardDescription>추출 작업 및 이메일 발송 내역</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <ListSkeleton />
            ) : activityFeed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                최근 활동이 없습니다.
              </p>
            ) : (
              activityFeed.map((item) => {
                if (item.type === "extraction") {
                  const job = item.data;
                  const statusInfo = extractionStatusMap[job.status] ?? {
                    label: job.status,
                    icon: Clock,
                  };
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div
                      key={`job-${job.id}`}
                      className="flex items-start gap-3 p-3 border rounded-lg"
                    >
                      <div className="p-1.5 rounded-md bg-primary/10 mt-0.5">
                        <Download className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            인플루언서 추출
                          </span>
                          <Badge
                            variant="secondary"
                            className={extractionStatusColors[job.status] ?? ""}
                          >
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {job.campaigns?.name ?? "글로벌 추출"} &middot;{" "}
                          {job.type === "keyword" ? "키워드" : "태그"} &middot;{" "}
                          {job.platform}
                          {job.status === "completed" &&
                            ` \u00B7 ${job.total_extracted}건 추출 (신규 ${job.new_extracted}건)`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {timeAgo(job.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                } else {
                  const email = item.data;
                  const influencerName =
                    email.influencers?.display_name ??
                    email.influencers?.username ??
                    "알 수 없음";

                  return (
                    <div
                      key={`email-${email.id}`}
                      className="flex items-start gap-3 p-3 border rounded-lg"
                    >
                      <div className="p-1.5 rounded-md bg-purple-500/10 mt-0.5">
                        <Send className="w-3.5 h-3.5 text-purple-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            이메일 발송
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {email.status === "sent"
                              ? "발송 완료"
                              : email.status === "delivered"
                                ? "전달됨"
                                : email.status === "opened"
                                  ? "열람됨"
                                  : email.status === "bounced"
                                    ? "반송됨"
                                    : email.status === "failed"
                                      ? "실패"
                                      : email.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {email.campaigns?.name ?? "알 수 없는 캠페인"}{" "}
                          &middot; {influencerName} &middot; {email.round_number}
                          차 발송
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {timeAgo(email.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                }
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
