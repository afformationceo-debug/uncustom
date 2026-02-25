"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AIInsight } from "@/lib/ai/types";

export function useAIInsights(pageContext: string) {
  const supabase = createClient();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_insights")
      .select("*")
      .eq("page_context", pageContext)
      .eq("dismissed", false)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(5);

    if (!error && data) {
      setInsights(data as unknown as AIInsight[]);
    }
    setLoading(false);
  }, [pageContext]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const dismissInsight = useCallback(async (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("ai_insights").update({ dismissed: true }).eq("id", id);
  }, []);

  return { insights, loading, dismissInsight, refetch: fetchInsights };
}
