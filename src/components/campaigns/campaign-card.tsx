"use client";

import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/types/database";

interface CampaignCardProps {
  campaign: Tables<"campaigns">;
}

const statusMap: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "초안", variant: "secondary" },
  active: { label: "진행중", variant: "default" },
  paused: { label: "일시중지", variant: "outline" },
  completed: { label: "완료", variant: "secondary" },
  archived: { label: "보관됨", variant: "destructive" },
};

export function CampaignCard({ campaign }: CampaignCardProps) {
  const status = statusMap[campaign.status] ?? {
    label: campaign.status,
    variant: "outline" as const,
  };

  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg line-clamp-1">
              {campaign.name}
            </CardTitle>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          {campaign.description && (
            <CardDescription className="line-clamp-2">
              {campaign.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              생성일:{" "}
              {new Date(campaign.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>
          {campaign.updated_at !== campaign.created_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Calendar className="h-4 w-4" />
              <span>
                수정일:{" "}
                {new Date(campaign.updated_at).toLocaleDateString("ko-KR")}
              </span>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <div className="flex items-center gap-1 text-sm text-primary">
            <span>상세 보기</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
