"use client";

import { useAIInsights } from "@/hooks/use-ai-insights";
import { AIInsightCard } from "./ai-insight-card";
import type { AIInsight } from "@/lib/ai/types";

interface AIInsightsBarProps {
  pageContext: string;
  onAction?: (insight: AIInsight) => void;
}

export function AIInsightsBar({ pageContext, onAction }: AIInsightsBarProps) {
  const { insights, dismissInsight } = useAIInsights(pageContext);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      {insights.slice(0, 3).map((insight) => (
        <AIInsightCard
          key={insight.id}
          insight={insight}
          onDismiss={dismissInsight}
          onAction={onAction}
        />
      ))}
    </div>
  );
}
