"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";

type Influencer = Tables<"influencers">;
type EmailTemplate = Tables<"email_templates">;

export default function EmailSendPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedInfluencers, setSelectedInfluencers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, [campaignId]);

  async function fetchData() {
    setLoading(true);

    // Fetch influencers with email
    const { data: ciData } = await supabase
      .from("campaign_influencers")
      .select("influencer_id")
      .eq("campaign_id", campaignId);

    if (ciData && ciData.length > 0) {
      const ids = ciData.map((ci) => ci.influencer_id);
      const { data } = await supabase
        .from("influencers")
        .select("*")
        .in("id", ids)
        .not("email", "is", null)
        .order("follower_count", { ascending: false });
      setInfluencers((data as Influencer[]) ?? []);
    }

    // Fetch templates
    const { data: tmplData } = await supabase
      .from("email_templates")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("round_number", { ascending: true });
    setTemplates((tmplData as EmailTemplate[]) ?? []);

    setLoading(false);
  }

  function toggleInfluencer(id: string) {
    setSelectedInfluencers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedInfluencers.size === influencers.length) {
      setSelectedInfluencers(new Set());
    } else {
      setSelectedInfluencers(new Set(influencers.map((i) => i.id)));
    }
  }

  async function handleSend() {
    if (!selectedTemplate) {
      toast.error("템플릿을 선택하세요.");
      return;
    }
    if (selectedInfluencers.size === 0) {
      toast.error("발송할 인플루언서를 선택하세요.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          template_id: selectedTemplate,
          influencer_ids: Array.from(selectedInfluencers),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error("발송 실패: " + result.error);
      } else {
        toast.success(`${result.sent}건 발송 완료`);
        setSelectedInfluencers(new Set());
      }
    } catch {
      toast.error("발송 중 오류가 발생했습니다.");
    }
    setSending(false);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">이메일 발송</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">발송 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">이메일 템플릿</label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="템플릿 선택..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    [{t.round_number}회차] {t.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedInfluencers.size}명 선택됨 / 이메일 보유: {influencers.length}명
            </span>
            <Button
              onClick={handleSend}
              disabled={sending || !selectedTemplate || selectedInfluencers.size === 0}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              발송하기
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={influencers.length > 0 && selectedInfluencers.size === influencers.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>팔로워</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : influencers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    이메일이 있는 인플루언서가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                influencers.map((inf) => (
                  <TableRow key={inf.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedInfluencers.has(inf.id)}
                        onCheckedChange={() => toggleInfluencer(inf.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {inf.display_name ?? inf.username ?? "-"}
                    </TableCell>
                    <TableCell>{inf.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{inf.platform}</Badge>
                    </TableCell>
                    <TableCell>{inf.follower_count?.toLocaleString() ?? "-"}</TableCell>
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
