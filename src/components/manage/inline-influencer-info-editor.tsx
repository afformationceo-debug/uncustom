"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { User } from "lucide-react";
import { toast } from "sonner";

interface InfluencerInfo {
  real_name?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  gender?: string | null;
  line_id?: string | null;
  country?: string | null;
  email?: string | null;
}

interface InlineInfluencerInfoEditorProps {
  influencerId: string;
  realName: string | null;
  birthDate: string | null;
  phone: string | null;
  displayName: string | null;
  gender?: string | null;
  lineId?: string | null;
  country?: string | null;
  email?: string | null;
  crmUserId?: number | null;
  onSaved?: (updated: InfluencerInfo) => void;
}

export function InlineInfluencerInfoEditor({
  influencerId,
  realName,
  birthDate,
  phone,
  displayName,
  gender,
  lineId,
  country,
  email,
  crmUserId,
  onSaved,
}: InlineInfluencerInfoEditorProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InfluencerInfo>({
    real_name: realName,
    birth_date: birthDate,
    phone: phone,
    gender: gender,
    line_id: lineId,
    country: country,
    email: email,
  });
  const [saving, setSaving] = useState(false);

  const hasInfo = realName || birthDate || phone;

  function handleOpen() {
    setForm({
      real_name: realName,
      birth_date: birthDate,
      phone: phone,
      gender: gender,
      line_id: lineId,
      country: country,
      email: email,
    });
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/influencers/${influencerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          real_name: form.real_name?.trim() || null,
          birth_date: form.birth_date || null,
          phone: form.phone?.trim() || null,
          gender: form.gender || null,
          line_id: form.line_id?.trim() || null,
          country: form.country?.trim() || null,
          email: form.email?.trim() || null,
        }),
      });
      if (res.ok) {
        toast.success("인플루언서 정보가 저장되었습니다.");
        onSaved?.(form);
        setOpen(false);
      } else {
        toast.error("저장 실패");
      }
    } catch {
      toast.error("저장 실패");
    }
    setSaving(false);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs hover:bg-accent rounded px-1.5 py-0.5"
      >
        <User className="w-3 h-3" />
        {hasInfo ? (
          <span className="text-foreground truncate max-w-[80px]">
            {realName ?? displayName ?? "-"}
          </span>
        ) : (
          <span className="text-muted-foreground">미등록</span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>인플루언서 정보</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {crmUserId && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">CRM ID</Label>
                <Badge variant="outline" className="text-[10px]">#{crmUserId}</Badge>
              </div>
            )}
            <div>
              <Label className="text-xs">실제 성함</Label>
              <Input
                value={form.real_name ?? ""}
                onChange={(e) => setForm({ ...form, real_name: e.target.value })}
                placeholder="실제 이름 입력"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">생년월일</Label>
              <Input
                type="date"
                value={form.birth_date ?? ""}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">성별</Label>
              <Select value={form.gender ?? "__none__"} onValueChange={(v) => setForm({ ...form, gender: v === "__none__" ? null : v })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">미지정</SelectItem>
                  <SelectItem value="M">남성</SelectItem>
                  <SelectItem value="F">여성</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">연락처</Label>
              <Input
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="전화번호"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">이메일</Label>
              <Input
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="이메일"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">LINE ID</Label>
              <Input
                value={form.line_id ?? ""}
                onChange={(e) => setForm({ ...form, line_id: e.target.value })}
                placeholder="LINE 메신저 ID"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">국가</Label>
              <Input
                value={form.country ?? ""}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="KR, JP, TW..."
                className="h-8 text-sm"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              마스터데이터(influencers)에 저장됩니다.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
