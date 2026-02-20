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

type TaggedAccount = Tables<"tagged_accounts">;

export default function TaggedPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [accounts, setAccounts] = useState<TaggedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [newPlatform, setNewPlatform] = useState("instagram");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, [campaignId]);

  async function fetchAccounts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tagged_accounts")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("태그 계정 로드 실패: " + error.message);
    } else {
      setAccounts((data as TaggedAccount[]) ?? []);
    }
    setLoading(false);
  }

  async function handleAdd() {
    if (!newUsername.trim()) return;
    setAdding(true);

    const { data, error } = await supabase
      .from("tagged_accounts")
      .insert({
        campaign_id: campaignId,
        account_username: newUsername.trim().replace("@", ""),
        platform: newPlatform,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error("이미 등록된 계정입니다.");
      } else {
        toast.error("추가 실패: " + error.message);
      }
    } else {
      setAccounts((prev) => [data as TaggedAccount, ...prev]);
      setNewUsername("");
      toast.success("태그 계정이 추가되었습니다.");
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("tagged_accounts").delete().eq("id", id);
    if (error) {
      toast.error("삭제 실패: " + error.message);
    } else {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      toast.success("태그 계정이 삭제되었습니다.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">태그됨 관리</h2>
        <Badge variant="secondary">{accounts.length}개 등록</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">경쟁사 계정 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            경쟁사 계정에 태그된 인플루언서를 추출할 수 있습니다.
          </p>
          <div className="flex gap-3">
            <Input
              placeholder="계정 이름 (예: @starbucks_kr)"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
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
            <Button onClick={handleAdd} disabled={adding || !newUsername.trim()}>
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
                <TableHead>계정</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>예상 수</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    등록된 태그 계정이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">@{acc.account_username}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {PLATFORMS.find((p) => p.value === acc.platform)?.label ?? acc.platform}
                      </Badge>
                    </TableCell>
                    <TableCell>{acc.estimated_count?.toLocaleString() ?? "-"}</TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(acc.created_at).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)}>
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
