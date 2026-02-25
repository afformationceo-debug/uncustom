import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Hash, AtSign, Users, Mail, MessageSquare, Video,
  TrendingUp, Clock, ExternalLink, Building2, Phone,
  MapPin, FileText, Globe, Sparkles, Eye, Heart,
  MessageCircle, Share2, Bookmark, BarChart3,
} from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Tables } from "@/types/database";
import { CAMPAIGN_INFLUENCER_STATUSES } from "@/types/platform";
import { CampaignAccountActions } from "@/components/campaigns/campaign-account-actions";

type ExtractionJob = Tables<"extraction_jobs">;
type EmailLog = Tables<"email_logs">;
type BrandAccount = Tables<"brand_accounts">;

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const PLATFORM_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  instagram: { dot: "bg-gradient-to-r from-purple-500 to-pink-500", bg: "bg-gradient-to-r from-purple-500/10 to-pink-500/10", text: "text-purple-600 dark:text-purple-400" },
  tiktok: { dot: "bg-black dark:bg-white", bg: "bg-gray-100 dark:bg-gray-800", text: "text-foreground" },
  youtube: { dot: "bg-red-500", bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400" },
  twitter: { dot: "bg-blue-400", bg: "bg-blue-400/10", text: "text-blue-600 dark:text-blue-400" },
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rawCampaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (!rawCampaign) notFound();
  const campaign = rawCampaign as Tables<"campaigns">;

  const snsAccounts = (campaign.sns_accounts as { platform: string; username: string }[]) ?? [];

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
    { data: crmProcedures },
    { data: brandAccountsRaw },
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
    supabase.from("crm_procedures").select("*").eq("campaign_id", id).order("name"),
    // Query brand_accounts matching campaign's sns_accounts usernames
    // (regardless of campaign_id — accounts may be global or from another campaign)
    (() => {
      const usernames = snsAccounts.map((a) => a.username.replace(/^@/, "")).filter(Boolean);
      if (usernames.length === 0) return supabase.from("brand_accounts").select("*").eq("campaign_id", id).order("platform");
      return supabase.from("brand_accounts").select("*").in("username", usernames).order("platform");
    })(),
  ]);

  const brandAccounts = (brandAccountsRaw as BrandAccount[]) ?? [];

  // Get content/relationship counts for each brand account
  const brandAccountsEnriched = await Promise.all(
    brandAccounts.map(async (acc) => {
      const [{ count: cCount }, { count: rCount }] = await Promise.all([
        supabase.from("brand_influencer_contents").select("*", { count: "exact", head: true }).eq("brand_account_id", acc.id),
        supabase.from("brand_influencer_relationships").select("*", { count: "exact", head: true }).eq("brand_account_id", acc.id),
      ]);
      return { ...acc, content_count: cCount ?? 0, relationship_count: rCount ?? 0 };
    })
  );

  const stats = [
    { title: "키워드", value: keywordCount ?? 0, icon: Hash, color: "text-primary", bg: "bg-primary/10", href: `/extract/keywords` },
    { title: "태그 계정", value: taggedCount ?? 0, icon: AtSign, color: "text-purple-500", bg: "bg-purple-500/10", href: `/extract/tagged` },
    { title: "인플루언서", value: influencerCount ?? 0, icon: Users, color: "text-green-500", bg: "bg-green-500/10", href: `/manage?campaign=${id}` },
    { title: "발송 이메일", value: emailCount ?? 0, icon: Mail, color: "text-orange-500", bg: "bg-orange-500/10", href: `/email/logs?campaign=${id}` },
    { title: "인박스", value: `${unreadCount ?? 0} / ${threadCount ?? 0}`, icon: MessageSquare, color: "text-pink-500", bg: "bg-pink-500/10", href: `/inbox?campaign=${id}` },
    { title: "콘텐츠", value: contentCount ?? 0, icon: Video, color: "text-red-500", bg: "bg-red-500/10", href: `/contents?campaign=${id}` },
  ];

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
      {/* Campaign Info Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          {campaign.description && (
            <p className="text-sm text-muted-foreground">{campaign.description}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {campaign.campaign_type === "visit" ? "방문형" : campaign.campaign_type === "shipping" ? "배송형" : campaign.campaign_type}
            </Badge>
            {(campaign.target_platforms ?? []).map((p: string) => {
              const color = PLATFORM_COLORS[p];
              return (
                <Badge key={p} variant="secondary" className="text-[10px] gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${color?.dot ?? "bg-muted-foreground"}`} />
                  {p}
                </Badge>
              );
            })}
            {(campaign.target_countries ?? []).map((c: string) => (
              <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
            ))}
          </div>
        </div>
      </div>

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

      {/* SNS Account Analysis Section */}
      {(snsAccounts.length > 0 || brandAccounts.length > 0) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              캠페인 SNS 계정 분석
              {brandAccounts.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {brandAccounts.length}개 계정
                </Badge>
              )}
            </CardTitle>
            <CampaignAccountActions
              campaignId={id}
              hasSnsAccounts={snsAccounts.length > 0}
              hasLinkedBrandAccounts={brandAccounts.length > 0}
            />
          </CardHeader>
          <CardContent>
            {brandAccountsEnriched.length > 0 ? (
              <div className="space-y-4">
                {brandAccountsEnriched.map((acc) => {
                  const color = PLATFORM_COLORS[acc.platform] ?? PLATFORM_COLORS.instagram;
                  return (
                    <div
                      key={acc.id}
                      className={`rounded-lg border p-4 ${color.bg}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {acc.profile_image_url ? (
                            <img
                              src={acc.profile_image_url}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <Globe className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">@{acc.username}</span>
                              <Badge variant="outline" className="text-[10px]">
                                <div className={`w-1.5 h-1.5 rounded-full mr-1 ${color.dot}`} />
                                {acc.platform}
                              </Badge>
                              {acc.is_verified && (
                                <Badge variant="secondary" className="text-[9px]">인증됨</Badge>
                              )}
                            </div>
                            {acc.display_name && (
                              <p className="text-xs text-muted-foreground">{acc.display_name}</p>
                            )}
                            {acc.biography && (
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[400px] mt-0.5">
                                {acc.biography}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CampaignAccountActions
                            campaignId={id}
                            brandAccountId={acc.id}
                            hasSnsAccounts={true}
                            hasLinkedBrandAccounts={true}
                          />
                          <Link href={`/brands/${acc.id}`}>
                            <Badge
                              variant="outline"
                              className="text-[10px] cursor-pointer hover:bg-accent gap-1"
                            >
                              상세 <ExternalLink className="w-2.5 h-2.5" />
                            </Badge>
                          </Link>
                        </div>
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-3">
                        <MetricItem
                          icon={Users}
                          label="팔로워"
                          value={formatNumber(acc.follower_count)}
                        />
                        <MetricItem
                          icon={TrendingUp}
                          label="참여율"
                          value={acc.engagement_rate != null ? `${Number(acc.engagement_rate).toFixed(2)}%` : "-"}
                        />
                        <MetricItem
                          icon={FileText}
                          label="게시물"
                          value={formatNumber(acc.post_count)}
                        />
                        <MetricItem
                          icon={Heart}
                          label="평균 좋아요"
                          value={formatNumber(acc.avg_likes)}
                        />
                        <MetricItem
                          icon={MessageCircle}
                          label="평균 댓글"
                          value={formatNumber(acc.avg_comments)}
                        />
                        <MetricItem
                          icon={Eye}
                          label="평균 조회수"
                          value={formatNumber(acc.avg_views)}
                        />
                        <MetricItem
                          icon={Share2}
                          label="평균 공유"
                          value={formatNumber(acc.avg_shares)}
                        />
                        <MetricItem
                          icon={Sparkles}
                          label="발견 콘텐츠"
                          value={acc.content_count.toLocaleString()}
                          highlight={acc.content_count > 0}
                        />
                        <MetricItem
                          icon={Users}
                          label="발견 인플루언서"
                          value={acc.relationship_count.toLocaleString()}
                          highlight={acc.relationship_count > 0}
                        />
                      </div>

                      {/* Additional Info */}
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {acc.top_hashtags && acc.top_hashtags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Hash className="w-3 h-3 text-muted-foreground" />
                            {acc.top_hashtags.slice(0, 4).map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {acc.primary_content_types && acc.primary_content_types.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Video className="w-3 h-3 text-muted-foreground" />
                            {acc.primary_content_types.slice(0, 3).map((t, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {acc.last_analyzed_at && (
                          <span className="text-[10px] text-muted-foreground">
                            마지막 분석: {new Date(acc.last_analyzed_at).toLocaleDateString("ko-KR")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : snsAccounts.length > 0 ? (
              <div className="text-center py-6">
                <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm text-muted-foreground mb-1">
                  등록된 SNS 계정: {snsAccounts.map((a) => `@${a.username} (${a.platform})`).join(", ")}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  위 버튼을 클릭하여 계정을 브랜드 인텔리전스에 등록하고 분석을 시작하세요
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

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

      {/* CRM Hospital Info */}
      {campaign.crm_hospital_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              CRM 병원 정보
              <Badge variant="outline" className="text-[10px] ml-1 border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-400">
                #{campaign.crm_hospital_id}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground">기본 정보</h4>
                {campaign.crm_hospital_code && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">병원코드:</span>
                    <span className="font-medium">{campaign.crm_hospital_code}</span>
                  </div>
                )}
                {campaign.ceo_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">대표:</span>
                    <span className="font-medium">{campaign.ceo_name}</span>
                  </div>
                )}
                {campaign.business_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">사업자번호:</span>
                    <span className="font-medium">{campaign.business_number}</span>
                  </div>
                )}
                {campaign.commission_rate != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">수수료율:</span>
                    <span className="font-medium">{campaign.commission_rate}%</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground">연락처</h4>
                {campaign.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <span>{campaign.address}</span>
                  </div>
                )}
                {campaign.phone_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{campaign.phone_number}</span>
                  </div>
                )}
                {campaign.tax_invoice_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{campaign.tax_invoice_email}</span>
                  </div>
                )}
                {campaign.operating_hours && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{campaign.operating_hours}</span>
                  </div>
                )}
              </div>

              {crmProcedures && crmProcedures.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground">시술 카탈로그 ({crmProcedures.length})</h4>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {(crmProcedures as { id: string; name: string; price: number | null; fee_rate: number | null; is_sponsorable: boolean }[]).map((proc) => (
                      <div key={proc.id} className="flex items-center justify-between py-1 px-2 bg-muted/50 rounded text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{proc.name}</span>
                          {proc.is_sponsorable && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-300 text-green-600">스폰</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {proc.price != null && <span>{proc.price.toLocaleString()}원</span>}
                          {proc.fee_rate != null && <span className="text-[10px]">({proc.fee_rate}%)</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                      {{ keyword: "키워드", tagged: "태그", enrich: "프로필 보강", email_scrape: "이메일 추출", brand_profile: "브랜드 프로필", brand_tagged_content: "브랜드 콘텐츠" }[job.type] ?? job.type} · {job.platform}
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

function MetricItem({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 bg-background/60 rounded-md px-2.5 py-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
        <p className={`text-sm font-semibold tabular-nums ${highlight ? "text-primary" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
