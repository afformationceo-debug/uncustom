"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tables, Json } from "@/types/database";

type CampaignInfluencer = Tables<"campaign_influencers"> & {
  influencer?: Tables<"influencers">;
  campaign?: { id: string; name: string; campaign_type?: string; crm_hospital_id?: number | null; crm_hospital_code?: string | null };
};

interface CrmRegisterDialogProps {
  item: CampaignInfluencer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: (crmReservationId: number) => void;
}

interface CrmProcedure {
  id: string;
  name: string;
  price: number | null;
  fee_rate: number | null;
  is_sponsorable: boolean;
}

interface FormData {
  crm_procedure: string;
  crm_requested_procedure: string;
  visit_scheduled_date: string;
  interpreter_needed: boolean;
  interpreter_name: string;
  notes: string;
  // Influencer info for CRM
  real_name: string;
  email: string;
  phone: string;
  country: string;
}

export function CrmRegisterDialog({ item, open, onOpenChange, onRegistered }: CrmRegisterDialogProps) {
  const [form, setForm] = useState<FormData>({
    crm_procedure: item.crm_procedure ?? "",
    crm_requested_procedure: item.crm_requested_procedure ?? "",
    visit_scheduled_date: item.visit_scheduled_date ?? "",
    interpreter_needed: item.interpreter_needed ?? false,
    interpreter_name: item.interpreter_name ?? "",
    notes: item.notes ?? "",
    real_name: (item.influencer as unknown as Tables<"influencers">)?.real_name ?? "",
    email: (item.influencer as unknown as Tables<"influencers">)?.email ?? "",
    phone: (item.influencer as unknown as Tables<"influencers">)?.phone ?? "",
    country: (item.influencer as unknown as Tables<"influencers">)?.country ?? "",
  });
  const [procedures, setProcedures] = useState<CrmProcedure[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingProc, setLoadingProc] = useState(false);

  const inf = item.influencer as unknown as Tables<"influencers"> | undefined;
  const campaign = item.campaign as { id: string; name: string; crm_hospital_id?: number | null; crm_hospital_code?: string | null } | undefined;
  const hasHospital = !!campaign?.crm_hospital_id;

  // Fetch procedures for this campaign
  useEffect(() => {
    if (!open || !item.campaign_id) return;
    setLoadingProc(true);
    const supabase = createClient();
    supabase
      .from("crm_procedures")
      .select("id, name, price, fee_rate, is_sponsorable")
      .eq("campaign_id", item.campaign_id)
      .order("name")
      .then(({ data }) => {
        setProcedures((data as CrmProcedure[]) ?? []);
        setLoadingProc(false);
      });
  }, [open, item.campaign_id]);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setForm({
        crm_procedure: item.crm_procedure ?? "",
        crm_requested_procedure: item.crm_requested_procedure ?? "",
        visit_scheduled_date: item.visit_scheduled_date ?? "",
        interpreter_needed: item.interpreter_needed ?? false,
        interpreter_name: item.interpreter_name ?? "",
        notes: item.notes ?? "",
        real_name: inf?.real_name ?? "",
        email: inf?.email ?? "",
        phone: inf?.phone ?? "",
        country: inf?.country ?? "",
      });
    }
  }, [open]);

  async function handleRegister() {
    setSaving(true);
    try {
      // 1. Save CRM fields to campaign_influencers first
      const ciUpdate: Record<string, unknown> = {
        crm_procedure: form.crm_procedure || null,
        crm_requested_procedure: form.crm_requested_procedure || null,
        visit_scheduled_date: form.visit_scheduled_date || null,
        interpreter_needed: form.interpreter_needed,
        interpreter_name: form.interpreter_name || null,
        notes: form.notes || null,
      };

      const ciRes = await fetch(`/api/manage/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ciUpdate),
      });
      if (!ciRes.ok) {
        const err = await ciRes.json();
        throw new Error(err.error ?? "필드 저장 실패");
      }

      // 2. Update influencer info if changed
      if (inf) {
        const infUpdate: Record<string, string | null> = {};
        if (form.real_name && form.real_name !== (inf.real_name ?? "")) infUpdate.real_name = form.real_name;
        if (form.email && form.email !== (inf.email ?? "")) infUpdate.email = form.email;
        if (form.phone && form.phone !== (inf.phone ?? "")) infUpdate.phone = form.phone;
        if (form.country && form.country !== (inf.country ?? "")) infUpdate.country = form.country;

        if (Object.keys(infUpdate).length > 0) {
          await fetch(`/api/influencers/${inf.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(infUpdate),
          });
        }
      }

      // 3. Call CRM register API
      const regRes = await fetch("/api/crm/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_influencer_id: item.id }),
      });
      const regData = await regRes.json();

      if (!regRes.ok) {
        // CRM unavailable — still mark as registered locally
        if (regData.error?.includes("no CRM hospital") || regData.error?.includes("Campaign has no CRM")) {
          toast.warning("CRM 병원 미연결 — 로컬 등록만 완료됩니다.");
          // Update locally
          await fetch(`/api/manage/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ crm_registered: true }),
          });
          onRegistered(0);
        } else {
          throw new Error(regData.error ?? "CRM 등록 실패");
        }
      } else {
        toast.success(`CRM 예약 #${regData.crm_reservation_id} 등록 완료`);
        onRegistered(regData.crm_reservation_id);
      }

      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            CRM 예약 등록
          </DialogTitle>
          <DialogDescription>
            인플루언서를 CRM에 예약으로 등록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hospital + Influencer Info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">병원</span>
              <span className="text-sm font-medium">
                {campaign?.name ?? "-"}
                {hasHospital && (
                  <Badge variant="outline" className="ml-1.5 text-[10px]">CRM #{campaign?.crm_hospital_id}</Badge>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">인플루언서</span>
              <span className="text-sm font-medium">
                {inf?.display_name ?? inf?.username ?? "-"}
              </span>
            </div>
            {!hasHospital && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                이 캠페인에 CRM 병원이 연결되지 않았습니다. 로컬 등록만 됩니다.
              </p>
            )}
          </div>

          {/* CRM Required Fields */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CRM 필수 정보</h4>

            {/* Procedure dropdown */}
            <div>
              <Label className="text-xs">시술명 (sponsored)</Label>
              {loadingProc ? (
                <div className="flex items-center gap-2 h-8 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> 시술 목록 로딩...
                </div>
              ) : procedures.length > 0 ? (
                <Select value={form.crm_procedure} onValueChange={(v) => setForm({ ...form, crm_procedure: v })}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="시술 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {procedures.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.price != null && (
                            <span className="text-[10px] text-muted-foreground">
                              {p.price.toLocaleString()}원
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.crm_procedure}
                  onChange={(e) => setForm({ ...form, crm_procedure: e.target.value })}
                  placeholder="시술명 입력"
                  className="h-8 text-sm"
                />
              )}
            </div>

            {/* Requested procedure */}
            <div>
              <Label className="text-xs">요청 시술명</Label>
              <Input
                value={form.crm_requested_procedure}
                onChange={(e) => setForm({ ...form, crm_requested_procedure: e.target.value })}
                placeholder="인플루언서가 요청한 시술"
                className="h-8 text-sm"
              />
            </div>

            {/* Visit date */}
            <div>
              <Label className="text-xs">방문 예정일</Label>
              <Input
                type="date"
                value={form.visit_scheduled_date}
                onChange={(e) => setForm({ ...form, visit_scheduled_date: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            {/* Interpreter */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">통역 필요</Label>
              <Switch
                checked={form.interpreter_needed}
                onCheckedChange={(v) => setForm({ ...form, interpreter_needed: v })}
                className="scale-90"
              />
            </div>
            {form.interpreter_needed && (
              <div>
                <Label className="text-xs">통역사명</Label>
                <Input
                  value={form.interpreter_name}
                  onChange={(e) => setForm({ ...form, interpreter_name: e.target.value })}
                  placeholder="통역사 이름"
                  className="h-8 text-sm"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <Label className="text-xs">메모</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="CRM 등록 메모"
                className="text-sm min-h-[60px]"
              />
            </div>
          </div>

          {/* Influencer CRM Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">인플루언서 정보 (CRM용)</h4>

            <div>
              <Label className="text-xs">실제 성함</Label>
              <Input
                value={form.real_name}
                onChange={(e) => setForm({ ...form, real_name: e.target.value })}
                placeholder="실제 이름"
                className="h-8 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">이메일</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="이메일"
                className="h-8 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">전화번호</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="전화번호"
                className="h-8 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">국가</Label>
              <Input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="KR, JP, TW..."
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleRegister} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                등록 중...
              </>
            ) : (
              "CRM에 등록"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Button + badge display for CRM registration status in funnel table */
export function CrmRegistrationCell({
  item,
  onUpdate,
}: {
  item: CampaignInfluencer;
  onUpdate: (id: string, field: string, value: unknown) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (item.crm_registered && item.crm_reservation_id) {
    // Already registered — show CRM ID badge
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-accent border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
        onClick={() => setDialogOpen(true)}
        title="클릭하여 CRM 정보 확인"
      >
        CRM #{item.crm_reservation_id}
      </Badge>
    );
  }

  if (item.crm_registered) {
    // Registered locally but no CRM ID
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
      >
        로컬등록
      </Badge>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-5 text-[10px] px-2"
        onClick={() => setDialogOpen(true)}
      >
        CRM 등록
      </Button>
      <CrmRegisterDialog
        item={item}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onRegistered={(crmId) => {
          onUpdate(item.id, "crm_registered", true);
          if (crmId) {
            onUpdate(item.id, "crm_reservation_id", crmId);
          }
        }}
      />
    </>
  );
}
