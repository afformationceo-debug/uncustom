"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";

type SnsAccount = Tables<"campaign_sns_accounts">;

export default function SnsAccountsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [accounts, setAccounts] = useState<SnsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [platform, setPlatform] = useState("instagram");
  const [accountName, setAccountName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  useEffect(() => {
    fetchAccounts();
  }, [campaignId]);

  async function fetchAccounts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaign_sns_accounts")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (!error) {
      setAccounts((data as SnsAccount[]) ?? []);
    }
    setLoading(false);
  }

  async function handleAdd() {
    const { data, error } = await supabase
      .from("campaign_sns_accounts")
      .insert({
        campaign_id: campaignId,
        platform,
        account_name: accountName || null,
        account_id: accountId || null,
        access_token: accessToken || null,
        api_key: apiKey || null,
        api_secret: apiSecret || null,
        connected: !!accessToken,
        connected_at: accessToken ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error("이 플랫폼의 계정은 이미 등록되어 있습니다.");
      } else {
        toast.error("추가 실패: " + error.message);
      }
    } else {
      setAccounts((prev) => [data as SnsAccount, ...prev]);
      resetForm();
      toast.success("SNS 계정이 추가되었습니다.");
    }
  }

  function resetForm() {
    setShowForm(false);
    setPlatform("instagram");
    setAccountName("");
    setAccountId("");
    setAccessToken("");
    setApiKey("");
    setApiSecret("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">SNS 계정 관리</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" />
          계정 추가
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SNS 계정 등록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>플랫폼</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>계정 이름</Label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="@uncustom_official"
                />
              </div>
            </div>
            <div>
              <Label>계정 ID (플랫폼별)</Label>
              <Input
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="플랫폼에서 발급한 계정 ID"
              />
            </div>
            <div>
              <Label>Access Token</Label>
              <Input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="API Access Token"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="선택사항"
                />
              </div>
              <div>
                <Label>API Secret</Label>
                <Input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="선택사항"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd}>등록</Button>
              <Button variant="outline" onClick={resetForm}>취소</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-gray-500 col-span-full text-center py-8">로딩 중...</p>
        ) : accounts.length === 0 ? (
          <p className="text-gray-500 col-span-full text-center py-8">등록된 SNS 계정이 없습니다.</p>
        ) : (
          accounts.map((acc) => (
            <Card key={acc.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary">
                    {PLATFORMS.find((p) => p.value === acc.platform)?.label ?? acc.platform}
                  </Badge>
                  {acc.connected ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="text-sm font-medium">{acc.account_name ?? "이름 없음"}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {acc.connected
                    ? `연결됨 (${acc.connected_at ? new Date(acc.connected_at).toLocaleDateString("ko-KR") : ""})`
                    : "미연결"}
                </div>
                <Button variant="outline" size="sm" className="mt-3 w-full">
                  <Settings className="w-4 h-4 mr-1" />
                  설정
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
