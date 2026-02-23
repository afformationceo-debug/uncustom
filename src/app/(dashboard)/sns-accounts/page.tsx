"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { CampaignSelector } from "@/components/campaign-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, CheckCircle, XCircle, Trash2, Edit2, Save, Wifi } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";
import { useRealtime } from "@/hooks/use-realtime";

type SnsAccount = Tables<"campaign_sns_accounts">;

export default function SnsAccountsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">로딩 중...</div>}>
      <SnsAccountsPageContent />
    </Suspense>
  );
}

function SnsAccountsPageContent() {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const supabase = createClient();

  const [accounts, setAccounts] = useState<SnsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SnsAccount | null>(null);
  const [platform, setPlatform] = useState("instagram");
  const [accountName, setAccountName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  useEffect(() => {
    if (campaignId) {
      fetchAccounts();
    } else {
      setAccounts([]);
      setLoading(false);
    }
  }, [campaignId]);

  const realtimeCallback = useCallback(() => {
    if (campaignId) fetchAccounts();
  }, [campaignId]);
  useRealtime(
    "campaign_sns_accounts",
    campaignId ? `campaign_id=eq.${campaignId}` : undefined,
    realtimeCallback
  );

  async function fetchAccounts() {
    if (!campaignId) return;
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
    if (!campaignId) return;
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

  async function handleUpdate() {
    if (!editingAccount) return;
    const { error } = await supabase
      .from("campaign_sns_accounts")
      .update({
        account_name: accountName || null,
        account_id: accountId || null,
        access_token: accessToken || null,
        api_key: apiKey || null,
        api_secret: apiSecret || null,
        connected: !!accessToken,
        connected_at: accessToken ? new Date().toISOString() : null,
      })
      .eq("id", editingAccount.id);

    if (error) {
      toast.error("수정 실패: " + error.message);
    } else {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingAccount.id
            ? { ...a, account_name: accountName || null, account_id: accountId || null, access_token: accessToken || null, api_key: apiKey || null, api_secret: apiSecret || null, connected: !!accessToken, connected_at: accessToken ? new Date().toISOString() : a.connected_at }
            : a
        )
      );
      setEditingAccount(null);
      resetForm();
      toast.success("계정이 수정되었습니다.");
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from("campaign_sns_accounts")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("삭제 실패: " + error.message);
    } else {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      toast.success("계정이 삭제되었습니다.");
    }
  }

  function openEdit(acc: SnsAccount) {
    setEditingAccount(acc);
    setPlatform(acc.platform);
    setAccountName(acc.account_name ?? "");
    setAccountId(acc.account_id ?? "");
    setAccessToken(acc.access_token ?? "");
    setApiKey(acc.api_key ?? "");
    setApiSecret(acc.api_secret ?? "");
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
        <div>
          <h2 className="text-xl font-bold">SNS 계정 관리</h2>
          <p className="text-sm text-muted-foreground mt-1">
            캠페인에 사용할 SNS 계정을 관리합니다.
          </p>
        </div>
        <CampaignSelector mode="required" value={campaignId} onChange={setCampaignId} />
      </div>

      {!campaignId ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wifi className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">캠페인을 선택하세요</p>
          <p className="text-sm mt-1">SNS 계정을 관리할 캠페인을 먼저 선택해주세요.</p>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
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
              <p className="text-muted-foreground col-span-full text-center py-8">로딩 중...</p>
            ) : accounts.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8">등록된 SNS 계정이 없습니다.</p>
            ) : (
              accounts.map((acc) => (
                <Card key={acc.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="secondary">
                        {PLATFORMS.find((p) => p.value === acc.platform)?.label ?? acc.platform}
                      </Badge>
                      {acc.connected ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-xs text-green-500">연결됨</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">미연결</span>
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium">{acc.account_name ?? "이름 없음"}</div>
                    {acc.account_id && (
                      <div className="text-xs text-muted-foreground mt-0.5">ID: {acc.account_id}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {acc.connected_at
                        ? `연결: ${new Date(acc.connected_at).toLocaleDateString("ko-KR")}`
                        : "연결 정보 없음"}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(acc)}>
                        <Edit2 className="w-3.5 h-3.5 mr-1" />
                        수정
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(acc.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Edit Dialog */}
          <Dialog open={!!editingAccount} onOpenChange={() => { setEditingAccount(null); resetForm(); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>계정 수정</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>플랫폼</Label>
                  <div className="mt-1">
                    <Badge variant="secondary">
                      {PLATFORMS.find((p) => p.value === platform)?.label ?? platform}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>계정 이름</Label>
                  <Input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="@uncustom_official"
                  />
                </div>
                <div>
                  <Label>계정 ID</Label>
                  <Input
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="플랫폼 계정 ID"
                  />
                </div>
                <div>
                  <Label>Access Token</Label>
                  <Input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="변경하려면 입력"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>API Secret</Label>
                    <Input
                      type="password"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setEditingAccount(null); resetForm(); }}>
                    취소
                  </Button>
                  <Button onClick={handleUpdate}>
                    <Save className="w-4 h-4 mr-1" />
                    저장
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
