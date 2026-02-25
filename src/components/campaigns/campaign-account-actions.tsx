"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Search, RefreshCw, Sparkles } from "lucide-react";

interface CampaignAccountActionsProps {
  campaignId: string;
  brandAccountId?: string;
  hasSnsAccounts: boolean;
  hasLinkedBrandAccounts: boolean;
}

export function CampaignAccountActions({
  campaignId,
  brandAccountId,
  hasSnsAccounts,
  hasLinkedBrandAccounts,
}: CampaignAccountActionsProps) {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  async function handleAnalyzeAll() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/analyze-accounts`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "계정 분석이 시작되었습니다");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "분석 시작 실패");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDiscoverContent() {
    if (!brandAccountId) return;
    setDiscovering(true);
    try {
      const res = await fetch(`/api/brands/${brandAccountId}/discover-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 200 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "콘텐츠 발견이 시작되었습니다");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "콘텐츠 발견 실패");
    } finally {
      setDiscovering(false);
    }
  }

  async function handleAnalyzeSingle() {
    if (!brandAccountId) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/brands/${brandAccountId}/analyze`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "프로필 분석이 시작되었습니다");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "분석 시작 실패");
    } finally {
      setAnalyzing(false);
    }
  }

  // Register & Analyze All button (when no brand accounts exist yet)
  if (hasSnsAccounts && !hasLinkedBrandAccounts) {
    return (
      <Button
        onClick={handleAnalyzeAll}
        disabled={analyzing}
        size="sm"
        className="gap-1.5"
      >
        {analyzing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {analyzing ? "등록 중..." : "계정 등록 & 분석 시작"}
      </Button>
    );
  }

  // Per-account action buttons
  if (brandAccountId) {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          onClick={handleAnalyzeSingle}
          disabled={analyzing}
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 px-2"
        >
          {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          분석
        </Button>
        <Button
          onClick={handleDiscoverContent}
          disabled={discovering}
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 px-2"
        >
          {discovering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          콘텐츠 발견
        </Button>
      </div>
    );
  }

  // Refresh all accounts
  if (hasLinkedBrandAccounts) {
    return (
      <Button
        onClick={handleAnalyzeAll}
        disabled={analyzing}
        variant="outline"
        size="sm"
        className="gap-1.5"
      >
        {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {analyzing ? "분석 중..." : "전체 새로고침"}
      </Button>
    );
  }

  return null;
}
