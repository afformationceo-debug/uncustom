"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, LayoutGrid, List, Search, ArrowRight, Pencil,
} from "lucide-react";
import type { Tables } from "@/types/database";

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

  useEffect(() => {
    fetchCampaigns();
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
  });

  const filtered = search
    ? campaigns.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.description ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : campaigns;

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
                <TableHead className="w-[200px]">캠페인명</TableHead>
                <TableHead className="w-[70px]">유형</TableHead>
                <TableHead className="w-[70px]">상태</TableHead>
                <TableHead>타겟 플랫폼</TableHead>
                <TableHead>타겟 국가</TableHead>
                <TableHead className="w-[200px]">설명</TableHead>
                <TableHead className="w-[90px]">생성일</TableHead>
                <TableHead className="w-[90px]">수정일</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const status = STATUS_MAP[c.status] ?? { label: c.status, color: "#94a3b8" };
                const platforms = c.target_platforms ?? [];
                const countries = c.target_countries ?? [];
                return (
                  <TableRow key={c.id} className="group">
                    <TableCell>
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="font-medium text-sm hover:text-primary transition-colors"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
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
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {platforms.map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_DOT[p] ?? "bg-muted"}`} />
                            {PLATFORM_LABELS[p] ?? p}
                          </Badge>
                        ))}
                        {platforms.length === 0 && (
                          <span className="text-[10px] text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-0.5">
                        {countries.map((code) => (
                          <span key={code} className="text-xs" title={code}>
                            {COUNTRY_FLAGS[code] ?? code}
                          </span>
                        ))}
                        {countries.length === 0 && (
                          <span className="text-[10px] text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground truncate block max-w-[200px]" title={c.description ?? ""}>
                        {c.description ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {c.updated_at !== c.created_at
                          ? new Date(c.updated_at).toLocaleDateString("ko-KR")
                          : "-"}
                      </span>
                    </TableCell>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
