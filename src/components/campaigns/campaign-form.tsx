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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const TARGET_COUNTRIES = [
  { value: "KR", label: "한국", flag: "\uD83C\uDDF0\uD83C\uDDF7" },
  { value: "US", label: "미국", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { value: "JP", label: "일본", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { value: "CN", label: "중국", flag: "\uD83C\uDDE8\uD83C\uDDF3" },
  { value: "VN", label: "베트남", flag: "\uD83C\uDDFB\uD83C\uDDF3" },
  { value: "TH", label: "태국", flag: "\uD83C\uDDF9\uD83C\uDDED" },
  { value: "ID", label: "인도네시아", flag: "\uD83C\uDDEE\uD83C\uDDE9" },
  { value: "BR", label: "브라질", flag: "\uD83C\uDDE7\uD83C\uDDF7" },
  { value: "MX", label: "멕시코", flag: "\uD83C\uDDF2\uD83C\uDDFD" },
  { value: "ES", label: "스페인", flag: "\uD83C\uDDEA\uD83C\uDDF8" },
  { value: "FR", label: "프랑스", flag: "\uD83C\uDDEB\uD83C\uDDF7" },
  { value: "DE", label: "독일", flag: "\uD83C\uDDE9\uD83C\uDDEA" },
  { value: "GB", label: "영국", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { value: "AU", label: "호주", flag: "\uD83C\uDDE6\uD83C\uDDFA" },
  { value: "SG", label: "싱가포르", flag: "\uD83C\uDDF8\uD83C\uDDEC" },
  { value: "TW", label: "대만", flag: "\uD83C\uDDF9\uD83C\uDDFC" },
  { value: "HK", label: "홍콩", flag: "\uD83C\uDDED\uD83C\uDDF0" },
] as const;

const TARGET_PLATFORMS = [
  { value: "instagram", label: "Instagram", dot: "bg-gradient-to-r from-purple-500 to-pink-500" },
  { value: "tiktok", label: "TikTok", dot: "bg-black dark:bg-white" },
  { value: "youtube", label: "YouTube", dot: "bg-red-500" },
  { value: "twitter", label: "Twitter/X", dot: "bg-blue-400" },
] as const;

const CAMPAIGN_TYPE_OPTIONS = [
  { value: "visit", label: "방문형", desc: "인플루언서가 매장/장소를 방문" },
  { value: "shipping", label: "배송형", desc: "제품을 인플루언서에게 배송" },
] as const;

interface SnsAccountEntry {
  platform: string;
  username: string;
}

interface CampaignFormProps {
  teamId: string;
  trigger?: React.ReactNode;
  campaign?: {
    id: string;
    name: string;
    description: string | null;
    campaign_type?: string;
    target_countries?: string[];
    target_platforms?: string[];
    sns_accounts?: SnsAccountEntry[];
    // CRM fields
    crm_hospital_id?: number | null;
    crm_hospital_code?: string | null;
    business_number?: string | null;
    commission_rate?: number | null;
    address?: string | null;
    phone_number?: string | null;
    tax_invoice_email?: string | null;
    ceo_name?: string | null;
    operating_hours?: string | null;
  };
}

export function CampaignForm({ teamId, trigger, campaign }: CampaignFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(campaign?.name ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [campaignType, setCampaignType] = useState(campaign?.campaign_type ?? "visit");
  const [targetCountries, setTargetCountries] = useState<string[]>(campaign?.target_countries ?? []);
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>(campaign?.target_platforms ?? []);

  // SNS accounts for campaign analysis
  const [snsAccounts, setSnsAccounts] = useState<SnsAccountEntry[]>(
    campaign?.sns_accounts ?? []
  );

  function updateSnsAccount(platform: string, username: string) {
    setSnsAccounts((prev) => {
      const existing = prev.findIndex((a) => a.platform === platform);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { platform, username };
        return updated;
      }
      if (username.trim()) {
        return [...prev, { platform, username: username.trim() }];
      }
      return prev;
    });
  }

  function getSnsUsername(platform: string): string {
    return snsAccounts.find((a) => a.platform === platform)?.username ?? "";
  }

  // CRM hospital fields
  const [crmHospitalId, setCrmHospitalId] = useState<string>(campaign?.crm_hospital_id?.toString() ?? "");
  const [crmHospitalCode, setCrmHospitalCode] = useState(campaign?.crm_hospital_code ?? "");
  const [businessNumber, setBusinessNumber] = useState(campaign?.business_number ?? "");
  const [commissionRate, setCommissionRate] = useState(campaign?.commission_rate?.toString() ?? "");
  const [crmAddress, setCrmAddress] = useState(campaign?.address ?? "");
  const [crmPhone, setCrmPhone] = useState(campaign?.phone_number ?? "");
  const [taxEmail, setTaxEmail] = useState(campaign?.tax_invoice_email ?? "");
  const [ceoName, setCeoName] = useState(campaign?.ceo_name ?? "");
  const [operatingHours, setOperatingHours] = useState(campaign?.operating_hours ?? "");

  const isEditing = !!campaign;

  function toggleCountry(code: string) {
    setTargetCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function togglePlatform(platform: string) {
    setTargetPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      // Build CRM fields
      const crmFields = {
        crm_hospital_id: crmHospitalId ? parseInt(crmHospitalId) : null,
        crm_hospital_code: crmHospitalCode.trim() || null,
        business_number: businessNumber.trim() || null,
        commission_rate: commissionRate ? parseFloat(commissionRate) : null,
        address: crmAddress.trim() || null,
        phone_number: crmPhone.trim() || null,
        tax_invoice_email: taxEmail.trim() || null,
        ceo_name: ceoName.trim() || null,
        operating_hours: operatingHours.trim() || null,
      };

      const filteredSns = snsAccounts
        .filter((a) => a.username.trim())
        .map((a) => ({ platform: a.platform, username: a.username } as Record<string, string>));

      let campaignId: string | null = null;

      if (isEditing) {
        const { error } = await supabase
          .from("campaigns")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            campaign_type: campaignType,
            target_countries: targetCountries,
            target_platforms: targetPlatforms,
            sns_accounts: filteredSns,
            ...crmFields,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaign.id);
        if (error) throw error;
        campaignId = campaign.id;
      } else {
        const { data: newCampaign, error } = await supabase.from("campaigns").insert({
          team_id: teamId,
          name: name.trim(),
          description: description.trim() || null,
          campaign_type: campaignType,
          target_countries: targetCountries,
          target_platforms: targetPlatforms,
          sns_accounts: filteredSns,
          ...crmFields,
        }).select("id").single();
        if (error) throw error;
        campaignId = newCampaign?.id ?? null;
      }

      // Auto-register SNS accounts as brand_accounts if any accounts were set
      if (campaignId && filteredSns.length > 0) {
        try {
          await fetch(`/api/campaigns/${campaignId}/analyze-accounts`, { method: "POST" });
          toast.success("SNS 계정이 브랜드 인텔리전스에 자동 등록되었습니다");
        } catch {
          // Non-blocking: account registration is not critical for campaign save
        }
      }

      setOpen(false);
      setName("");
      setDescription("");
      setTargetCountries([]);
      setTargetPlatforms([]);
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
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
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

            {/* Campaign Type */}
            <div className="grid gap-2">
              <Label>캠페인 유형</Label>
              <div className="flex gap-2">
                {CAMPAIGN_TYPE_OPTIONS.map((t) => {
                  const isActive = campaignType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setCampaignType(t.value)}
                      className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <span className="font-medium">{t.label}</span>
                      <span className="text-[10px] opacity-70">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Platforms */}
            <div className="grid gap-2">
              <Label>타겟 플랫폼 (선택)</Label>
              <p className="text-xs text-muted-foreground -mt-1">마스터데이터 배정 시 자동 필터링됩니다</p>
              <div className="flex flex-wrap gap-2">
                {TARGET_PLATFORMS.map((p) => {
                  const isActive = targetPlatforms.includes(p.value);
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => togglePlatform(p.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${p.dot}`} />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Countries */}
            <div className="grid gap-2">
              <Label>타겟 국가 (선택)</Label>
              <p className="text-xs text-muted-foreground -mt-1">마스터데이터 배정 시 국가 필터가 자동 적용됩니다</p>
              <div className="flex flex-wrap gap-1.5">
                {TARGET_COUNTRIES.map((c) => {
                  const isActive = targetCountries.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => toggleCountry(c.value)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {c.flag} {c.label}
                    </button>
                  );
                })}
              </div>
              {targetCountries.length > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-muted-foreground">선택:</span>
                  {targetCountries.map((code) => {
                    const info = TARGET_COUNTRIES.find((c) => c.value === code);
                    return (
                      <Badge key={code} variant="secondary" className="text-[10px]">
                        {info?.flag} {info?.label}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Campaign SNS Accounts */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="sns" className="border rounded-lg px-3">
                <AccordionTrigger className="text-sm font-medium py-2">
                  캠페인 SNS 계정 (선택)
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-3">
                  <p className="text-xs text-muted-foreground">
                    캠페인(거래처) SNS 계정을 등록하면 자동 분석이 가능합니다
                  </p>
                  {TARGET_PLATFORMS.map((p) => (
                    <div key={p.value} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 w-24 shrink-0">
                        <div className={`w-2 h-2 rounded-full ${p.dot}`} />
                        <span className="text-xs font-medium">{p.label}</span>
                      </div>
                      <Input
                        placeholder={`@${p.value === "youtube" ? "channel_name" : "username"}`}
                        value={getSnsUsername(p.value)}
                        onChange={(e) => updateSnsAccount(p.value, e.target.value.replace(/^@/, ""))}
                        className="h-8 text-xs flex-1"
                      />
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* CRM Hospital Info (Collapsible) */}
            {campaignType === "visit" && (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="crm" className="border rounded-lg px-3">
                  <AccordionTrigger className="text-sm font-medium py-2">
                    CRM 병원 연동 (선택)
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1">
                        <Label className="text-xs">CRM 병원 ID</Label>
                        <Input
                          type="number"
                          placeholder="MySQL ID"
                          value={crmHospitalId}
                          onChange={(e) => setCrmHospitalId(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">병원 코드</Label>
                        <Input
                          placeholder="hospital_code"
                          value={crmHospitalCode}
                          onChange={(e) => setCrmHospitalCode(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1">
                        <Label className="text-xs">대표자명</Label>
                        <Input
                          placeholder="홍길동"
                          value={ceoName}
                          onChange={(e) => setCeoName(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">사업자번호</Label>
                        <Input
                          placeholder="000-00-00000"
                          value={businessNumber}
                          onChange={(e) => setBusinessNumber(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1">
                        <Label className="text-xs">수수료율</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.15"
                          value={commissionRate}
                          onChange={(e) => setCommissionRate(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">전화번호</Label>
                        <Input
                          placeholder="02-000-0000"
                          value={crmPhone}
                          onChange={(e) => setCrmPhone(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">주소</Label>
                      <Input
                        placeholder="서울시 강남구..."
                        value={crmAddress}
                        onChange={(e) => setCrmAddress(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1">
                        <Label className="text-xs">세금계산서 이메일</Label>
                        <Input
                          type="email"
                          placeholder="tax@hospital.com"
                          value={taxEmail}
                          onChange={(e) => setTaxEmail(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">운영시간</Label>
                        <Input
                          placeholder="09:00-18:00"
                          value={operatingHours}
                          onChange={(e) => setOperatingHours(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
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
