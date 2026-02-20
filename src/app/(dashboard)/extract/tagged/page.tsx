"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";
import { useRealtime } from "@/hooks/use-realtime";

type TaggedAccount = Tables<"tagged_accounts">;

export default function MasterTaggedPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<TaggedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [newUsername, setNewUsername] = useState("");
  const [newPlatform, setNewPlatform] = useState<string>("instagram");

  useEffect(() => {
    fetchAccounts();
  }, []);

  const realtimeCallback = useCallback(() => {
    fetchAccounts();
  }, []);
  useRealtime("tagged_accounts", undefined, realtimeCallback);

  async function fetchAccounts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tagged_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("태그 계정 로드 실패");
    } else {
      setAccounts((data as TaggedAccount[]) ?? []);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!newUsername.trim()) {
      toast.error("계정 유저네임을 입력하세요.");
      return;
    }

    const username = newUsername.trim().replace(/^@/, "");

    const { error } = await supabase.from("tagged_accounts").insert({
      campaign_id: null,
      account_username: username,
      platform: newPlatform,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("이미 동일한 계정이 존재합니다.");
      } else {
        toast.error("계정 추가 실패: " + error.message);
      }
    } else {
      toast.success("태그 계정이 추가되었습니다.");
      setNewUsername("");
      fetchAccounts();
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("tagged_accounts").delete().eq("id", id);
    if (error) {
      toast.error("삭제 실패");
    } else {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      toast.success("태그 계정이 삭제되었습니다.");
    }
  }

  const platformColors: Record<string, string> = {
    instagram: "bg-pink-100 text-pink-800",
    tiktok: "bg-gray-100 text-gray-900",
    youtube: "bg-red-100 text-red-800",
    twitter: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">태그됨 계정 관리</h2>
        <p className="text-sm text-muted-foreground mt-1">
          경쟁사나 관련 브랜드 계정을 등록하여 해당 계정을 태그한 인플루언서를 추출합니다.
        </p>
      </div>

      {/* Add account form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">태그 계정 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>계정 유저네임</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="예: nike, glossier"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="w-40">
              <Label>플랫폼</Label>
              <Select value={newPlatform} onValueChange={setNewPlatform}>
                <SelectTrigger>
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
            </div>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-1" />
              추가
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accounts list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            등록된 태그 계정 ({accounts.length}개)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>유저네임</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>캠페인</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    등록된 태그 계정이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">@{acc.account_username}</TableCell>
                    <TableCell>
                      <Badge className={platformColors[acc.platform] ?? ""} variant="secondary">
                        {PLATFORMS.find((p) => p.value === acc.platform)?.label ?? acc.platform}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {acc.campaign_id ? (
                        <Badge variant="outline" className="text-xs">캠페인 소속</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">글로벌</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(acc.created_at).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell>
                      {!acc.campaign_id && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
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
