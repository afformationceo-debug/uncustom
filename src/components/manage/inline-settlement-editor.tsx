"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CreditCard } from "lucide-react";
import type { Json } from "@/types/database";

interface SettlementInfo {
  paypal_email?: string;
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  swift_code?: string;
  method?: string;
}

interface InlineSettlementEditorProps {
  value: Json | null;
  onSave: (value: SettlementInfo | null) => void;
}

export function InlineSettlementEditor({ value, onSave }: InlineSettlementEditorProps) {
  const [open, setOpen] = useState(false);
  const info = (value as SettlementInfo | null) ?? {};
  const [form, setForm] = useState<SettlementInfo>(info);

  const hasInfo = info.paypal_email || info.bank_name || info.account_number;

  function handleOpen() {
    setForm((value as SettlementInfo | null) ?? {});
    setOpen(true);
  }

  function handleSave() {
    const hasAny = form.paypal_email || form.bank_name || form.account_number || form.account_holder || form.swift_code;
    onSave(hasAny ? form : null);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs hover:bg-accent rounded px-1.5 py-0.5"
      >
        <CreditCard className="w-3 h-3" />
        {hasInfo ? (
          <span className="text-foreground">
            {info.paypal_email ? "PayPal" : info.bank_name ?? "등록됨"}
          </span>
        ) : (
          <span className="text-muted-foreground">미등록</span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>정산 정보</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Payment method selector */}
            <div>
              <Label className="text-xs">정산 방법</Label>
              <Select value={form.method ?? "paypal"} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="bank_transfer">계좌이체</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">PayPal 이메일</Label>
              <Input
                value={form.paypal_email ?? ""}
                onChange={(e) => setForm({ ...form, paypal_email: e.target.value })}
                placeholder="paypal@example.com"
                className="h-8 text-sm"
              />
            </div>
            <div className="border-t pt-3">
              <Label className="text-xs text-muted-foreground">또는 계좌이체</Label>
            </div>
            <div>
              <Label className="text-xs">은행명</Label>
              <Input
                value={form.bank_name ?? ""}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">계좌번호</Label>
              <Input
                value={form.account_number ?? ""}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">예금주</Label>
              <Input
                value={form.account_holder ?? ""}
                onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">SWIFT 코드</Label>
              <Input
                value={form.swift_code ?? ""}
                onChange={(e) => setForm({ ...form, swift_code: e.target.value })}
                placeholder="해외송금 SWIFT 코드"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={handleSave}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
