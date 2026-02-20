"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Download } from "lucide-react";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";

type Influencer = Tables<"influencers">;

export default function MasterPage() {
  const supabase = createClient();

  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    fetchInfluencers();
  }, [platformFilter, page]);

  async function fetchInfluencers() {
    setLoading(true);

    let query = supabase
      .from("influencers")
      .select("*", { count: "exact" });

    if (platformFilter !== "all") {
      query = query.eq("platform", platformFilter);
    }

    if (searchQuery) {
      query = query.or(
        `username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
      );
    }

    query = query
      .order("follower_count", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, error, count } = await query;

    if (!error) {
      setInfluencers((data as Influencer[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }

  function handleSearch() {
    setPage(0);
    fetchInfluencers();
  }

  function formatCount(n: number | null) {
    if (n === null) return "-";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">마스터 데이터</h1>
      <p className="text-gray-500">모든 캠페인에서 추출된 인플루언서 통합 데이터</p>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="이름, 유저네임, 이메일 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
          />
        </div>
        <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40">
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
        <Button variant="outline" onClick={handleSearch}>
          검색
        </Button>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>총 {total.toLocaleString()}명</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            이전
          </Button>
          <span className="flex items-center px-2">
            {page + 1} / {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
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
                <TableHead>게시물</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>참여율</TableHead>
                <TableHead>국가</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : influencers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    데이터가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                influencers.map((inf) => (
                  <TableRow key={inf.id}>
                    <TableCell>
                      {inf.profile_image_url ? (
                        <img
                          src={inf.profile_image_url}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{inf.display_name ?? "-"}</div>
                      {inf.username && (
                        <div className="text-xs text-gray-500">@{inf.username}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {PLATFORMS.find((p) => p.value === inf.platform)?.label ?? inf.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatCount(inf.follower_count)}</TableCell>
                    <TableCell>{formatCount(inf.post_count)}</TableCell>
                    <TableCell>
                      {inf.email ? (
                        <div>
                          <div className="text-sm">{inf.email}</div>
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
                    <TableCell>{inf.country ?? "-"}</TableCell>
                    <TableCell>
                      {inf.profile_url && (
                        <a href={inf.profile_url} target="_blank" rel="noopener noreferrer">
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
