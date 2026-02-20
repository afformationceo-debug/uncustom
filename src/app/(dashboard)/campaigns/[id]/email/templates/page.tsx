"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";

type EmailTemplate = Tables<"email_templates">;

export default function EmailTemplatesPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Form state
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [roundNumber, setRoundNumber] = useState(1);

  useEffect(() => {
    fetchTemplates();
  }, [campaignId]);

  async function fetchTemplates() {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("round_number", { ascending: true });

    if (error) {
      toast.error("템플릿 로드 실패");
    } else {
      setTemplates((data as EmailTemplate[]) ?? []);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast.error("제목과 본문을 입력하세요.");
      return;
    }

    const { data, error } = await supabase
      .from("email_templates")
      .insert({
        campaign_id: campaignId,
        round_number: roundNumber,
        subject,
        body_html: bodyHtml,
        sender_name: senderName || null,
        sender_email: senderEmail || null,
      })
      .select()
      .single();

    if (error) {
      toast.error("템플릿 생성 실패: " + error.message);
    } else {
      setTemplates((prev) => [...prev, data as EmailTemplate]);
      resetForm();
      setShowNew(false);
      toast.success("템플릿이 생성되었습니다.");
    }
  }

  async function handleUpdate(id: string) {
    const { error } = await supabase
      .from("email_templates")
      .update({
        subject,
        body_html: bodyHtml,
        sender_name: senderName || null,
        sender_email: senderEmail || null,
        round_number: roundNumber,
      })
      .eq("id", id);

    if (error) {
      toast.error("수정 실패: " + error.message);
    } else {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, subject, body_html: bodyHtml, sender_name: senderName, sender_email: senderEmail, round_number: roundNumber } : t
        )
      );
      setEditing(null);
      resetForm();
      toast.success("템플릿이 수정되었습니다.");
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("email_templates").delete().eq("id", id);
    if (error) {
      toast.error("삭제 실패");
    } else {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("템플릿이 삭제되었습니다.");
    }
  }

  function startEdit(template: EmailTemplate) {
    setEditing(template.id);
    setSubject(template.subject);
    setBodyHtml(template.body_html);
    setSenderName(template.sender_name ?? "");
    setSenderEmail(template.sender_email ?? "");
    setRoundNumber(template.round_number);
    setShowNew(false);
  }

  function resetForm() {
    setSubject("");
    setBodyHtml("");
    setSenderName("");
    setSenderEmail("");
    setRoundNumber(templates.length + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">이메일 템플릿</h2>
        <Button
          onClick={() => {
            setShowNew(true);
            setEditing(null);
            resetForm();
          }}
        >
          <Plus className="w-4 h-4 mr-1" />
          새 템플릿
        </Button>
      </div>

      {(showNew || editing) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? "템플릿 수정" : "새 템플릿"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>회차</Label>
                <Input
                  type="number"
                  min={1}
                  value={roundNumber}
                  onChange={(e) => setRoundNumber(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label>보내는 이름</Label>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Uncustom"
                />
              </div>
              <div>
                <Label>보내는 이메일</Label>
                <Input
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="hello@uncustom.com"
                />
              </div>
            </div>
            <div>
              <Label>제목</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="이메일 제목"
              />
            </div>
            <div>
              <Label>본문 (HTML)</Label>
              <Textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                placeholder="<p>안녕하세요, {{name}}님!</p>"
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                변수: {"{{name}}"}, {"{{username}}"}, {"{{email}}"} 사용 가능
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={editing ? () => handleUpdate(editing) : handleCreate}>
                <Save className="w-4 h-4 mr-1" />
                {editing ? "수정" : "생성"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNew(false);
                  setEditing(null);
                  resetForm();
                }}
              >
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-gray-500 text-center py-8">로딩 중...</p>
        ) : templates.length === 0 ? (
          <p className="text-gray-500 text-center py-8">등록된 템플릿이 없습니다.</p>
        ) : (
          templates.map((tmpl) => (
            <Card key={tmpl.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary">{tmpl.round_number}회차</Badge>
                      <span className="font-medium">{tmpl.subject}</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {tmpl.sender_name && `${tmpl.sender_name} `}
                      {tmpl.sender_email && `<${tmpl.sender_email}>`}
                    </p>
                    <div className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {tmpl.body_html.replace(/<[^>]*>/g, "").slice(0, 200)}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-4">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(tmpl)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(tmpl.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
