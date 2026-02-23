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

const PLATFORM_DOT: Record<string, string> = {
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  tiktok: "bg-black dark:bg-white",
  youtube: "bg-red-500",
  twitter: "bg-blue-400",
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "IG",
  tiktok: "TT",
  youtube: "YT",
  twitter: "X",
};

const COUNTRY_FLAGS: Record<string, string> = {
  KR: "\uD83C\uDDF0\uD83C\uDDF7", US: "\uD83C\uDDFA\uD83C\uDDF8", JP: "\uD83C\uDDEF\uD83C\uDDF5",
  CN: "\uD83C\uDDE8\uD83C\uDDF3", VN: "\uD83C\uDDFB\uD83C\uDDF3", TH: "\uD83C\uDDF9\uD83C\uDDED",
  ID: "\uD83C\uDDEE\uD83C\uDDE9", BR: "\uD83C\uDDE7\uD83C\uDDF7", MX: "\uD83C\uDDF2\uD83C\uDDFD",
  ES: "\uD83C\uDDEA\uD83C\uDDF8", FR: "\uD83C\uDDEB\uD83C\uDDF7", DE: "\uD83C\uDDE9\uD83C\uDDEA",
  GB: "\uD83C\uDDEC\uD83C\uDDE7", AU: "\uD83C\uDDE6\uD83C\uDDFA", SG: "\uD83C\uDDF8\uD83C\uDDEC",
  TW: "\uD83C\uDDF9\uD83C\uDDFC", HK: "\uD83C\uDDED\uD83C\uDDF0",
};

export function CampaignCard({ campaign }: CampaignCardProps) {
  const status = statusMap[campaign.status] ?? {
    label: campaign.status,
    variant: "outline" as const,
  };

  const targetPlatforms = campaign.target_platforms ?? [];
  const targetCountries = campaign.target_countries ?? [];

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
          {/* Target badges */}
          {(targetPlatforms.length > 0 || targetCountries.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {targetPlatforms.map((p) => (
                <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_DOT[p] ?? "bg-gray-400"}`} />
                  {PLATFORM_LABELS[p] ?? p}
                </Badge>
              ))}
              {targetCountries.map((c) => (
                <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">
                  {COUNTRY_FLAGS[c] ?? ""} {c}
                </Badge>
              ))}
            </div>
          )}
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
