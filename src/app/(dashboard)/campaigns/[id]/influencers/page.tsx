"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";

type Influencer = Tables<"influencers">;

export default function InfluencersPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchInfluencers();
  }, [campaignId, platformFilter]);

  async function fetchInfluencers() {
    setLoading(true);

    // Get influencer IDs from campaign_influencers
    const { data: ciData } = await supabase
      .from("campaign_influencers")
      .select("influencer_id")
      .eq("campaign_id", campaignId);

    if (!ciData || ciData.length === 0) {
      setInfluencers([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const ids = ciData.map((ci) => ci.influencer_id);
    let query = supabase
      .from("influencers")
      .select("*", { count: "exact" })
      .in("id", ids);

    if (platformFilter !== "all") {
      query = query.eq("platform", platformFilter);
    }

    query = query.order("follower_count", { ascending: false }).limit(100);

    const { data, error, count } = await query;

    if (error) {
      toast.error("인플루언서 로드 실패: " + error.message);
    } else {
      setInfluencers((data as Influencer[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }

  const filtered = searchQuery
    ? influencers.filter(
        (i) =>
          i.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : influencers;

  function formatCount(n: number | null) {
    if (n === null) return "-";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">추출된 인플루언서</h2>
        <Badge variant="secondary">{total}명</Badge>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="이름 또는 유저네임 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="플랫폼" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchInfluencers}>
          새로고침
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>프로필</TableHead>
                <TableHead>유저네임</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>팔로워</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>참여율</TableHead>
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
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    인플루언서가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inf) => (
                  <TableRow key={inf.id}>
                    <TableCell>
                      {inf.profile_image_url ? (
                        <img
                          src={inf.profile_image_url}
                          alt={inf.username ?? ""}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{inf.display_name ?? inf.username}</div>
                        {inf.username && (
                          <div className="text-xs text-gray-500">@{inf.username}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {PLATFORMS.find((p) => p.value === inf.platform)?.label ?? inf.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCount(inf.follower_count)}
                    </TableCell>
                    <TableCell>
                      {inf.email ? (
                        <div className="text-sm">
                          <div>{inf.email}</div>
                          {inf.email_source && (
                            <div className="text-xs text-gray-400">{inf.email_source}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {inf.engagement_rate
                        ? `${(Number(inf.engagement_rate) * 100).toFixed(2)}%`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {inf.profile_url && (
                        <a
                          href={inf.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                        </a>
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
