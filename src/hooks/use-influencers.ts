"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";
import { useFilterStore } from "@/stores/filter-store";

type Influencer = Tables<"influencers">;

export function useInfluencers(campaignId?: string) {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const supabase = createClient();

  const { platforms, minFollowers, maxFollowers, hasEmail, searchQuery } =
    useFilterStore();

  useEffect(() => {
    async function fetchInfluencers() {
      setLoading(true);

      let query = supabase.from("influencers").select("*", { count: "exact" });

      // Apply filters
      if (platforms.length > 0) {
        query = query.in("platform", platforms);
      }
      if (minFollowers !== null) {
        query = query.gte("follower_count", minFollowers);
      }
      if (maxFollowers !== null) {
        query = query.lte("follower_count", maxFollowers);
      }
      if (hasEmail === true) {
        query = query.not("email", "is", null);
      }
      if (searchQuery) {
        query = query.or(
          `username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`
        );
      }

      // If campaign-specific, join through campaign_influencers
      if (campaignId) {
        const { data: ciData } = await supabase
          .from("campaign_influencers")
          .select("influencer_id")
          .eq("campaign_id", campaignId);

        if (ciData && ciData.length > 0) {
          const influencerIds = ciData.map((ci) => ci.influencer_id);
          query = query.in("id", influencerIds);
        } else {
          setInfluencers([]);
          setTotal(0);
          setLoading(false);
          return;
        }
      }

      query = query.order("follower_count", { ascending: false }).limit(100);

      const { data, error, count } = await query;

      if (error) {
        setError(error.message);
      } else {
        setInfluencers((data as Influencer[]) ?? []);
        setTotal(count ?? 0);
      }
      setLoading(false);
    }

    fetchInfluencers();
  }, [supabase, campaignId, platforms, minFollowers, maxFollowers, hasEmail, searchQuery]);

  return { influencers, loading, error, total };
}
