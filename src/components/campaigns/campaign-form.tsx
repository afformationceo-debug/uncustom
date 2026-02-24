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
      if (isEditing) {
        const { error } = await supabase
          .from("campaigns")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            campaign_type: campaignType,
            target_countries: targetCountries,
            target_platforms: targetPlatforms,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaign.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campaigns").insert({
          team_id: teamId,
          name: name.trim(),
          description: description.trim() || null,
          campaign_type: campaignType,
          target_countries: targetCountries,
          target_platforms: targetPlatforms,
        });
        if (error) throw error;
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
