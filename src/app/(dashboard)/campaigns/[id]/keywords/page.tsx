"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";

type Keyword = Tables<"keywords">;

export default function KeywordsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [newPlatform, setNewPlatform] = useState("instagram");
  const [newCountry, setNewCountry] = useState("KR");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchKeywords();
  }, [campaignId]);

  async function fetchKeywords() {
    setLoading(true);
    const { data, error } = await supabase
      .from("keywords")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("키워드 로드 실패: " + error.message);
    } else {
      setKeywords((data as Keyword[]) ?? []);
    }
    setLoading(false);
  }

  async function handleAdd() {
    if (!newKeyword.trim()) return;
    setAdding(true);

    const { data, error } = await supabase
      .from("keywords")
      .insert({
        campaign_id: campaignId,
        keyword: newKeyword.trim(),
        platform: newPlatform,
        country: newCountry || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error("이미 등록된 키워드입니다.");
      } else {
        toast.error("키워드 추가 실패: " + error.message);
      }
    } else {
      setKeywords((prev) => [data as Keyword, ...prev]);
      setNewKeyword("");
      toast.success("키워드가 추가되었습니다.");
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("keywords").delete().eq("id", id);
    if (error) {
      toast.error("삭제 실패: " + error.message);
    } else {
      setKeywords((prev) => prev.filter((k) => k.id !== id));
      toast.success("키워드가 삭제되었습니다.");
    }
  }

  const platformColor: Record<string, string> = {
    instagram: "bg-pink-100 text-pink-800",
    tiktok: "bg-gray-100 text-gray-800",
    youtube: "bg-red-100 text-red-800",
    twitter: "bg-blue-100 text-blue-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">키워드 관리</h2>
        <Badge variant="secondary">{keywords.length}개 등록</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">키워드 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="키워드 입력 (예: #맛집, #카페)"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <Select value={newPlatform} onValueChange={setNewPlatform}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.filter((p) => p.value !== "threads").map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="국가"
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
              className="w-20"
            />
            <Button onClick={handleAdd} disabled={adding || !newKeyword.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              추가
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>키워드</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>국가</TableHead>
                <TableHead>예상 수</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : keywords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    등록된 키워드가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                keywords.map((kw) => (
                  <TableRow key={kw.id}>
                    <TableCell className="font-medium">{kw.keyword}</TableCell>
                    <TableCell>
                      <Badge className={platformColor[kw.platform] ?? ""} variant="secondary">
                        {PLATFORMS.find((p) => p.value === kw.platform)?.label ?? kw.platform}
                      </Badge>
                    </TableCell>
                    <TableCell>{kw.country ?? "-"}</TableCell>
                    <TableCell>{kw.estimated_count?.toLocaleString() ?? "-"}</TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(kw.created_at).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(kw.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
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
