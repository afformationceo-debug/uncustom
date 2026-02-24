"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { User } from "lucide-react";
import { toast } from "sonner";

interface InfluencerInfo {
  real_name?: string | null;
  birth_date?: string | null;
  phone?: string | null;
}

interface InlineInfluencerInfoEditorProps {
  influencerId: string;
  realName: string | null;
  birthDate: string | null;
  phone: string | null;
  displayName: string | null;
  onSaved?: (updated: InfluencerInfo) => void;
}

export function InlineInfluencerInfoEditor({
  influencerId,
  realName,
  birthDate,
  phone,
  displayName,
  onSaved,
}: InlineInfluencerInfoEditorProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InfluencerInfo>({
    real_name: realName,
    birth_date: birthDate,
    phone: phone,
  });
  const [saving, setSaving] = useState(false);

  const hasInfo = realName || birthDate || phone;

  function handleOpen() {
    setForm({
      real_name: realName,
      birth_date: birthDate,
      phone: phone,
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>인플루언서 정보</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
              <Label className="text-xs">연락처</Label>
              <Input
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="전화번호"
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
