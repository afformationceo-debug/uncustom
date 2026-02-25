"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus, LayoutGrid, List, Search, ArrowRight, Pencil,
  Users, Mail, Send, Upload, CheckCircle2, TrendingUp,
  Globe, BarChart3, Building2,
} from "lucide-react";
import type { Tables } from "@/types/database";
import type { CampaignStats } from "@/app/api/campaigns/stats/route";

type Campaign = Tables<"campaigns">;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "초안", color: "#94a3b8" },
  active: { label: "진행중", color: "#22c55e" },
  paused: { label: "일시중지", color: "#f59e0b" },
  completed: { label: "완료", color: "#6366f1" },
  archived: { label: "보관됨", color: "#ef4444" },
};

const PLATFORM_DOT: Record<string, string> = {
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  tiktok: "bg-black dark:bg-white",
  youtube: "bg-red-500",
  twitter: "bg-blue-400",
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "IG",
  tiktok: "TT",
  youtube: "YT",
  twitter: "X",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  tiktok: "#000000",
  youtube: "#FF0000",
  twitter: "#1DA1F2",
};

const COUNTRY_FLAGS: Record<string, string> = {
  KR: "\uD83C\uDDF0\uD83C\uDDF7", US: "\uD83C\uDDFA\uD83C\uDDF8", JP: "\uD83C\uDDEF\uD83C\uDDF5",
  CN: "\uD83C\uDDE8\uD83C\uDDF3", VN: "\uD83C\uDDFB\uD83C\uDDF3", TH: "\uD83C\uDDF9\uD83C\uDDED",
  ID: "\uD83C\uDDEE\uD83C\uDDE9", BR: "\uD83C\uDDE7\uD83C\uDDF7", MX: "\uD83C\uDDF2\uD83C\uDDFD",
  ES: "\uD83C\uDDEA\uD83C\uDDF8", FR: "\uD83C\uDDEB\uD83C\uDDF7", DE: "\uD83C\uDDE9\uD83C\uDDEA",
  GB: "\uD83C\uDDEC\uD83C\uDDE7", AU: "\uD83C\uDDE6\uD83C\uDDFA", SG: "\uD83C\uDDF8\uD83C\uDDEC",
  TW: "\uD83C\uDDF9\uD83C\uDDFC", HK: "\uD83C\uDDED\uD83C\uDDF0",
};

export default function CampaignsPage() {
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, CampaignStats>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [search, setSearch] = useState("");
  const [teamId, setTeamId] = useState("");

  const fetchCampaigns = useCallback(async () => {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    setCampaigns((data as Campaign[]) ?? []);
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns/stats");
      if (res.ok) {
        const json = await res.json();
        setStatsMap(json.data ?? {});
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCampaigns();
    fetchStats();
    // Get team ID
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();
        setTeamId(tm?.team_id ?? "");
      }
    })();
  }, []);

  // Realtime sync
  useRealtime("campaigns", undefined, () => {
    fetchCampaigns();
    fetchStats();
  });

  const filtered = search
    ? campaigns.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.description ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : campaigns;

  // Global totals from all campaigns
  const globalTotal = Object.values(statsMap).reduce((sum, s) => sum + s.total, 0);
  const globalSent = Object.values(statsMap).reduce((sum, s) => sum + s.emailSent, 0);
  const globalUploaded = Object.values(statsMap).reduce((sum, s) => sum + s.uploaded, 0);
  const globalCompleted = Object.values(statsMap).reduce((sum, s) => sum + s.completed, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">캠페인</h1>
          <p className="text-xs text-muted-foreground">
            {campaigns.length}개 캠페인
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="캠페인 검색..."
              className="h-8 pl-7 w-48 text-xs"
            />
          </div>
          {/* View toggle */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => setViewMode("table")}
            >
              <List className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={() => setViewMode("card")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </Button>
          </div>
          {/* New campaign */}
          <CampaignForm
            teamId={teamId}
            trigger={
              <Button size="sm" className="h-8">
                <Plus className="w-3.5 h-3.5 mr-1" />
                새 캠페인
              </Button>
            }
          />
        </div>
      </div>

      {/* Global Summary Cards */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            icon={<Users className="w-4 h-4" />}
            label="총 배정 인플루언서"
            value={globalTotal}
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-50 dark:bg-blue-950/30"
          />
          <SummaryCard
            icon={<Send className="w-4 h-4" />}
            label="이메일 발송"
            value={globalSent}
            color="text-violet-600 dark:text-violet-400"
            bgColor="bg-violet-50 dark:bg-violet-950/30"
          />
          <SummaryCard
            icon={<Upload className="w-4 h-4" />}
            label="업로드 완료"
            value={globalUploaded}
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-50 dark:bg-orange-950/30"
          />
          <SummaryCard
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="캠페인 완료"
            value={globalCompleted}
            color="text-emerald-600 dark:text-emerald-400"
            bgColor="bg-emerald-50 dark:bg-emerald-950/30"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-20 text-muted-foreground text-sm">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg mb-2">{search ? "검색 결과가 없습니다." : "캠페인이 없습니다."}</p>
          <p className="text-sm">새 캠페인을 만들어 인플루언서 마케팅을 시작하세요.</p>
        </div>
      ) : viewMode === "table" ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">캠페인명</TableHead>
                <TableHead className="w-[60px]">유형</TableHead>
                <TableHead className="w-[70px]">상태</TableHead>
                <TableHead className="w-[90px]">인플루언서</TableHead>
                <TableHead className="w-[140px]">퍼널 진행</TableHead>
                <TableHead className="w-[80px]">발송</TableHead>
                <TableHead className="w-[120px]">국가 분포</TableHead>
                <TableHead className="w-[120px]">플랫폼</TableHead>
                <TableHead className="w-[90px]">CRM</TableHead>
                <TableHead className="w-[70px]">생성일</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const status = STATUS_MAP[c.status] ?? { label: c.status, color: "#94a3b8" };
                const s = statsMap[c.id];
                const total = s?.total ?? 0;
                return (
                  <TableRow key={c.id} className="group">
                    {/* Campaign name */}
                    <TableCell>
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="font-medium text-sm hover:text-primary transition-colors"
                      >
                        {c.name}
                      </Link>
                      {c.description && (
                        <p className="text-[10px] text-muted-foreground truncate max-w-[170px]">{c.description}</p>
                      )}
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          c.campaign_type === "shipping"
                            ? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400"
                            : "border-green-300 text-green-600 dark:border-green-700 dark:text-green-400"
                        }`}
                      >
                        {c.campaign_type === "shipping" ? "배송" : "방문"}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{ borderColor: status.color, color: status.color }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full mr-1"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.label}
                      </Badge>
                    </TableCell>

                    {/* Influencer count */}
                    <TableCell>
                      {total > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-sm font-semibold">{total.toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground">명</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Funnel progress bar */}
                    <TableCell>
                      {total > 0 && s ? (
                        <FunnelMiniBar stats={s} />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Email sent */}
                    <TableCell>
                      {s && s.emailSent > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-violet-500" />
                              <span className="text-xs font-medium">{s.emailSent}</span>
                              {s.emailOpened > 0 && (
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400">
                                  ({Math.round((s.emailOpened / s.emailSent) * 100)}%)
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">발송 {s.emailSent}건 / 열람 {s.emailOpened}건</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Country distribution */}
                    <TableCell>
                      {s && Object.keys(s.byCountry).length > 0 ? (
                        <CountryMiniBar byCountry={s.byCountry} total={total} />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Platform distribution */}
                    <TableCell>
                      {s && Object.keys(s.byPlatform).length > 0 ? (
                        <PlatformMiniBar byPlatform={s.byPlatform} total={total} />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* CRM Hospital */}
                    <TableCell>
                      {c.crm_hospital_id ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 gap-1 border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-400"
                            >
                              <Building2 className="w-2.5 h-2.5" />
                              #{c.crm_hospital_id}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-0.5">
                              <p className="font-medium">CRM 병원 #{c.crm_hospital_id}</p>
                              {c.crm_hospital_code && <p>코드: {c.crm_hospital_code}</p>}
                              {c.address && <p>{c.address}</p>}
                              {c.phone_number && <p>전화: {c.phone_number}</p>}
                              {c.ceo_name && <p>대표: {c.ceo_name}</p>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Created date */}
                    <TableCell>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CampaignForm
                          teamId={teamId}
                          campaign={{
                            id: c.id,
                            name: c.name,
                            description: c.description,
                            campaign_type: c.campaign_type,
                            target_countries: c.target_countries,
                            target_platforms: c.target_platforms,
                            crm_hospital_id: c.crm_hospital_id,
                            crm_hospital_code: c.crm_hospital_code,
                            business_number: c.business_number,
                            commission_rate: c.commission_rate,
                            address: c.address,
                            phone_number: c.phone_number,
                            tax_invoice_email: c.tax_invoice_email,
                            ceo_name: c.ceo_name,
                            operating_hours: c.operating_hours,
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Pencil className="w-3 h-3" />
                            </Button>
                          }
                        />
                        <Link href={`/campaigns/${c.id}`}>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Card view */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign) => {
            const s = statsMap[campaign.id];
            const status = STATUS_MAP[campaign.status] ?? { label: campaign.status, color: "#94a3b8" };
            const total = s?.total ?? 0;
            const platforms = campaign.target_platforms ?? [];
            const countries = campaign.target_countries ?? [];

            return (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <Card className="hover:shadow-md transition-all cursor-pointer h-full group">
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {campaign.name}
                        </h3>
                        {campaign.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{campaign.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            campaign.campaign_type === "shipping"
                              ? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400"
                              : "border-green-300 text-green-600 dark:border-green-700 dark:text-green-400"
                          }`}
                        >
                          {campaign.campaign_type === "shipping" ? "배송" : "방문"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                          style={{ borderColor: status.color, color: status.color }}
                        >
                          {status.label}
                        </Badge>
                      </div>
                    </div>

                    {/* CRM Hospital Badge + Platform + Country */}
                    <div className="flex flex-wrap gap-1">
                      {campaign.crm_hospital_id && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5 border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-400">
                          <Building2 className="w-2.5 h-2.5" />
                          CRM
                        </Badge>
                      )}
                      {platforms.map((p) => (
                        <Badge key={p} variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_DOT[p] ?? "bg-muted"}`} />
                          {PLATFORM_LABELS[p] ?? p}
                        </Badge>
                      ))}
                      {countries.map((code) => (
                        <span key={code} className="text-xs" title={code}>{COUNTRY_FLAGS[code] ?? code}</span>
                      ))}
                    </div>

                    {/* Stats Grid */}
                    {total > 0 && s ? (
                      <div className="space-y-2.5">
                        {/* Key metrics row */}
                        <div className="grid grid-cols-4 gap-2">
                          <MetricPill label="배정" value={total} icon={<Users className="w-3 h-3" />} color="text-blue-600 dark:text-blue-400" />
                          <MetricPill label="발송" value={s.emailSent} icon={<Send className="w-3 h-3" />} color="text-violet-600 dark:text-violet-400" />
                          <MetricPill label="업로드" value={s.uploaded} icon={<Upload className="w-3 h-3" />} color="text-orange-600 dark:text-orange-400" />
                          <MetricPill label="완료" value={s.completed} icon={<CheckCircle2 className="w-3 h-3" />} color="text-emerald-600 dark:text-emerald-400" />
                        </div>

                        {/* Funnel progress */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>퍼널 진행률</span>
                            <span>{total > 0 ? Math.round((s.confirmed / total) * 100) : 0}% 확정</span>
                          </div>
                          <FunnelProgressBar stats={s} />
                        </div>

                        {/* Country breakdown */}
                        {Object.keys(s.byCountry).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(s.byCountry)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 5)
                              .map(([country, count]) => (
                                <span key={country} className="text-[10px] bg-muted/50 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                                  <span>{COUNTRY_FLAGS[country] ?? ""}</span>
                                  <span className="font-medium">{count}</span>
                                </span>
                              ))}
                            {Object.keys(s.byCountry).length > 5 && (
                              <span className="text-[10px] text-muted-foreground">+{Object.keys(s.byCountry).length - 5}</span>
                            )}
                          </div>
                        )}

                        {/* Platform breakdown bar */}
                        {Object.keys(s.byPlatform).length > 0 && (
                          <PlatformBarChart byPlatform={s.byPlatform} total={total} />
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground py-2 text-center bg-muted/30 rounded">
                        배정된 인플루언서가 없습니다
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(campaign.created_at).toLocaleDateString("ko-KR")}
                      </span>
                      <div className="flex items-center gap-0.5 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        상세 <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────── */

function SummaryCard({
  icon, label, value, color, bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`rounded-lg p-2 ${bgColor}`}>
          <div className={color}>{icon}</div>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">{label}</p>
          <p className={`text-lg font-bold ${color}`}>{value.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricPill({
  label, value, icon, color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className={`flex items-center justify-center gap-0.5 ${color}`}>
        {icon}
        <span className="text-sm font-bold">{value.toLocaleString()}</span>
      </div>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

/** Mini funnel progress bar for table view (contacted → confirmed → uploaded → completed) */
function FunnelMiniBar({ stats }: { stats: CampaignStats }) {
  const t = stats.total || 1;
  const segments = [
    { value: stats.contacted, color: "#3B82F6", label: "연락" },
    { value: stats.interested, color: "#8B5CF6", label: "희망" },
    { value: stats.confirmed, color: "#10B981", label: "확정" },
    { value: stats.uploaded, color: "#F97316", label: "업로드" },
    { value: stats.completed, color: "#059669", label: "완료" },
  ];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="space-y-0.5">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-muted gap-px">
            {segments.map((seg) => (
              <div
                key={seg.label}
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max((seg.value / t) * 100, seg.value > 0 ? 3 : 0)}%`, backgroundColor: seg.color }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>{stats.confirmed} 확정</span>
            <span>{stats.uploaded} 업로드</span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5 text-xs">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
              <span>{seg.label}</span>
              <span className="font-medium ml-auto">{seg.value}명 ({Math.round((seg.value / t) * 100)}%)</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** Full funnel progress bar for card view */
function FunnelProgressBar({ stats }: { stats: CampaignStats }) {
  const t = stats.total || 1;
  const segments = [
    { value: stats.total - stats.contacted, color: "#6B7280", label: "추출" },
    { value: stats.contacted - stats.interested, color: "#3B82F6", label: "연락" },
    { value: stats.interested - stats.confirmed, color: "#8B5CF6", label: "희망" },
    { value: stats.confirmed - stats.uploaded, color: "#10B981", label: "확정" },
    { value: stats.uploaded - stats.completed, color: "#F97316", label: "업로드" },
    { value: stats.completed, color: "#059669", label: "완료" },
  ].filter((s) => s.value > 0);

  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-muted">
      {segments.map((seg) => (
        <Tooltip key={seg.label}>
          <TooltipTrigger asChild>
            <div
              className="h-full transition-all hover:opacity-80"
              style={{ width: `${(seg.value / t) * 100}%`, backgroundColor: seg.color }}
            />
          </TooltipTrigger>
          <TooltipContent>
            <span className="text-xs">{seg.label} {seg.value}명 ({Math.round((seg.value / t) * 100)}%)</span>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/** Country mini bar for table view */
function CountryMiniBar({ byCountry, total }: { byCountry: Record<string, number>; total: number }) {
  const sorted = Object.entries(byCountry).sort(([, a], [, b]) => b - a);
  const top3 = sorted.slice(0, 3);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1">
          {top3.map(([country, count]) => (
            <span key={country} className="text-[10px] flex items-center gap-0.5">
              <span>{COUNTRY_FLAGS[country] ?? ""}</span>
              <span className="font-medium">{count}</span>
            </span>
          ))}
          {sorted.length > 3 && (
            <span className="text-[9px] text-muted-foreground">+{sorted.length - 3}</span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5 text-xs">
          {sorted.map(([country, count]) => (
            <div key={country} className="flex items-center gap-2">
              <span>{COUNTRY_FLAGS[country] ?? ""} {country}</span>
              <span className="font-medium ml-auto">{count}명 ({Math.round((count / total) * 100)}%)</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** Platform mini bar for table view */
function PlatformMiniBar({ byPlatform, total }: { byPlatform: Record<string, number>; total: number }) {
  const sorted = Object.entries(byPlatform).sort(([, a], [, b]) => b - a);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1">
          {sorted.map(([platform, count]) => (
            <Badge key={platform} variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_DOT[platform] ?? "bg-muted"}`} />
              {count}
            </Badge>
          ))}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5 text-xs">
          {sorted.map(([platform, count]) => (
            <div key={platform} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${PLATFORM_DOT[platform] ?? "bg-muted"}`} />
              <span>{PLATFORM_LABELS[platform] ?? platform}</span>
              <span className="font-medium ml-auto">{count}명 ({Math.round((count / total) * 100)}%)</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** Platform horizontal bar chart for card view */
function PlatformBarChart({ byPlatform, total }: { byPlatform: Record<string, number>; total: number }) {
  const sorted = Object.entries(byPlatform).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-1">
      {sorted.map(([platform, count]) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        const color = PLATFORM_COLORS[platform] ?? "#6B7280";
        return (
          <div key={platform} className="flex items-center gap-1.5 text-[10px]">
            <span className="w-6 text-right text-muted-foreground">{PLATFORM_LABELS[platform] ?? platform}</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="w-8 text-right font-medium">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
