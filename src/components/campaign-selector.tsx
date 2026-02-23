"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/types/database";

interface CampaignSelectorProps {
  mode: "filter" | "required";
  value: string | null;
  onChange: (campaignId: string | null) => void;
  syncUrl?: boolean;
}

export function CampaignSelector({
  mode,
  value,
  onChange,
  syncUrl = true,
}: CampaignSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<Tables<"campaigns">[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: memberData } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!memberData) return;

    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("team_id", memberData.team_id)
      .order("created_at", { ascending: false });

    if (data) {
      setCampaigns(data as Tables<"campaigns">[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Sync from URL on mount
  useEffect(() => {
    if (!syncUrl) return;
    const urlCampaign = searchParams.get("campaign");
    if (urlCampaign && urlCampaign !== value) {
      onChange(urlCampaign);
    }
  }, []);

  function handleChange(val: string) {
    const campaignId = val === "__all__" ? null : val;
    onChange(campaignId);

    if (syncUrl) {
      const params = new URLSearchParams(searchParams.toString());
      if (campaignId) {
        params.set("campaign", campaignId);
      } else {
        params.delete("campaign");
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="로딩 중..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select
      value={value ?? (mode === "filter" ? "__all__" : "")}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-64">
        <SelectValue
          placeholder={
            mode === "required" ? "캠페인을 선택하세요" : "전체 캠페인"
          }
        />
      </SelectTrigger>
      <SelectContent>
        {mode === "filter" && (
          <SelectItem value="__all__">전체 캠페인</SelectItem>
        )}
        {campaigns.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
        {campaigns.length === 0 && (
          <SelectItem value="__none__" disabled>
            캠페인이 없습니다
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
