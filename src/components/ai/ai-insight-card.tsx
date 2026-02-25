"use client";

import { Button } from "@/components/ui/button";
import {
  X,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  AlertCircle,
  Target,
} from "lucide-react";
import type { AIInsight } from "@/lib/ai/types";

const INSIGHT_ICONS: Record<string, typeof AlertTriangle> = {
  trend_alert: TrendingUp,
  anomaly: AlertCircle,
  opportunity: Lightbulb,
  bottleneck: AlertTriangle,
  recommendation: Target,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "border-red-500 bg-red-50 dark:bg-red-950/30",
  high: "border-orange-500 bg-orange-50 dark:bg-orange-950/30",
  normal: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
  low: "border-gray-300 bg-gray-50 dark:bg-gray-950/30",
};

interface AIInsightCardProps {
  insight: AIInsight;
  onDismiss?: (id: string) => void;
  onAction?: (insight: AIInsight) => void;
}

export function AIInsightCard({
  insight,
  onDismiss,
  onAction,
}: AIInsightCardProps) {
  const Icon = INSIGHT_ICONS[insight.insight_type] || Lightbulb;
  const colorClass =
    PRIORITY_COLORS[insight.priority] || PRIORITY_COLORS.normal;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border-l-4 ${colorClass}`}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{insight.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {insight.body}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onAction && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => onAction(insight)}
          >
            자세히
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onDismiss(insight.id)}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
