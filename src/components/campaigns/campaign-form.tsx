"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface CampaignFormProps {
  teamId: string;
  trigger?: React.ReactNode;
  campaign?: {
    id: string;
    name: string;
    description: string | null;
  };
}

export function CampaignForm({ teamId, trigger, campaign }: CampaignFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(campaign?.name ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");

  const isEditing = !!campaign;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (isEditing) {
        const { error } = await supabase
          .from("campaigns")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaign.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campaigns").insert({
          team_id: teamId,
          name: name.trim(),
          description: description.trim() || null,
        });
        if (error) throw error;
      }
      setOpen(false);
      setName("");
      setDescription("");
      router.refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "알 수 없는 오류";
      toast.error(`캠페인 저장 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button>새 캠페인</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "캠페인 수정" : "새 캠페인 만들기"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "캠페인 정보를 수정합니다."
                : "새로운 인플루언서 마케팅 캠페인을 만듭니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="campaign-name">캠페인 이름</Label>
              <Input
                id="campaign-name"
                placeholder="예: 2026 봄 신상품 캠페인"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campaign-description">설명 (선택)</Label>
              <Textarea
                id="campaign-description"
                placeholder="캠페인에 대한 간단한 설명을 입력하세요"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "저장 중..." : isEditing ? "수정하기" : "만들기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
