"use client";

import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Search,
  ExternalLink,
  Users,
  Mail,
  UserCheck,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Globe,
  Hash,
  Tag,
  Link2,
  Heart,
  MessageCircle,
  Eye,
  Play,
  Image as ImageIcon,
  X,
  Copy,
  CheckCircle2,
  LayoutGrid,
  Table2,
  Upload,
  Download,
  FileSpreadsheet,
  Loader2,
  Zap,
  ArrowRight,
  Calendar,
  DollarSign,
  Send,
  Briefcase,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS, FUNNEL_STATUSES } from "@/types/platform";
import type { FunnelStatus } from "@/types/platform";
import { InfluencerDetailTabs } from "@/components/master/influencer-detail-tabs";
import { useRealtime } from "@/hooks/use-realtime";

type Influencer = Tables<"influencers">;
type Campaign = Tables<"campaigns">;
type InfluencerLink = Tables<"influencer_links">;

type CampaignAssignment = {
  id: string; // campaign_influencer id
  campaign_id: string;
  name: string;
  campaign_type: string | null;
  campaign_status: string | null;
  funnel_status: string;
  outreach_round: number;
  last_outreach_at: string | null;
  reply_date: string | null;
  interest_confirmed: boolean;
  client_approved: boolean;
  final_confirmed: boolean;
  visit_scheduled_date: string | null;
  visit_completed: boolean;
  upload_deadline: string | null;
  actual_upload_date: string | null;
  upload_url: string | null;
  payment_amount: number | null;
  payment_currency: string | null;
  influencer_payment_status: string | null;
  client_payment_status: string | null;
  notes: string | null;
  created_at: string;
};
type CampaignAssignmentMap = Record<string, CampaignAssignment[]>;
type SortField = string; // Any DB column name
type SortDir = "asc" | "desc";
type PlatformFilter = "instagram" | "tiktok" | "youtube" | "twitter";

/** Map column key → DB column name for sorting. Keys not listed here are not sortable. */
const COLUMN_SORT_MAP: Record<string, string> = {
  username: "username",
  channel: "display_name",
  country: "country",
  followers: "follower_count",
  subscribers: "follower_count",
  following: "following_count",
  posts: "post_count",
  videos: "post_count",
  engagement: "engagement_rate",
  email: "email",
  email_source: "email_source",
  is_verified: "is_verified",
  is_business: "is_business",
  category: "category",
  external_url: "external_url",
  avg_likes: "avg_likes",
  avg_comments: "avg_comments",
  avg_views: "avg_views",
  avg_shares: "avg_shares",
  heart_count: "heart_count",
  total_views: "total_views",
  share_count: "share_count",
  language: "language",
  location: "location",
  source_content_created_at: "source_content_created_at",
  content_language: "content_language",
  video_duration: "video_duration",
  is_private: "is_private",
  is_sponsored: "is_sponsored",
  product_type: "product_type",
  bookmark_count: "bookmark_count",
  quote_count: "quote_count",
  favourites_count: "favourites_count",
  listed_count: "listed_count",
  media_count: "media_count",
  is_blue_verified: "is_blue_verified",
  is_monetized: "is_monetized",
  keywords: "created_at",
  created_at: "created_at",
  crm_user_id: "crm_user_id",
  gender: "gender",
  line_id: "line_id",
  default_settlement_info: "created_at",
  influence_score: "influence_score",
  content_quality_score: "content_quality_score",
  audience_authenticity_score: "audience_authenticity_score",
  brand_collab_count: "brand_collab_count",
  last_content_at: "last_content_at",
  commerce_enabled: "commerce_enabled",
};

/** Escape LIKE/ILIKE wildcard characters */
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, (c) => `\\${c}`);
}
type ViewMode = "card" | "table";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_BADGE_COLORS: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800",
  tiktok: "bg-gray-100 text-gray-900 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600",
  youtube: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  twitter: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  threads: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
};

const PLATFORM_DOT_COLORS: Record<string, string> = {
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  tiktok: "bg-black dark:bg-white",
  youtube: "bg-red-500",
  twitter: "bg-blue-400",
  threads: "bg-gray-500",
};

const PLATFORM_BORDER_COLORS: Record<string, string> = {
  instagram: "border-l-pink-500",
  tiktok: "border-l-gray-900 dark:border-l-gray-300",
  youtube: "border-l-red-500",
  twitter: "border-l-blue-400",
  threads: "border-l-gray-500",
};

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "created_at", label: "최신순" },
  { value: "follower_count", label: "팔로워" },
  { value: "engagement_rate", label: "참여율" },
  { value: "avg_likes", label: "평균좋아요" },
  { value: "avg_views", label: "평균조회" },
  { value: "influence_score", label: "영향력 점수" },
  { value: "content_quality_score", label: "콘텐츠 품질" },
  { value: "audience_authenticity_score", label: "진성 오디언스" },
  { value: "brand_collab_count", label: "브랜드 협업" },
  { value: "last_content_at", label: "최근 콘텐츠" },
];

// Platform-specific column definitions
type ColumnDef = {
  key: string;
  label: string;
  render: (inf: Influencer, helpers: RenderHelpers) => React.ReactNode;
  width?: string;
};

type RenderHelpers = {
  formatCount: (n: number | null) => string;
  formatEngagement: (rate: number | string | null) => string | null;
  getProfileUrl: (inf: Influencer) => string;
  getRawField: (inf: Influencer, field: string) => unknown;
  onYtEmail?: (id: string, username: string | null) => void;
};

function getProfileUrl(inf: Influencer): string {
  if (inf.profile_url) return inf.profile_url;
  const username = inf.username;
  if (!username) return "#";
  switch (inf.platform) {
    case "instagram":
      return `https://instagram.com/${username}`;
    case "tiktok":
      return `https://tiktok.com/@${username}`;
    case "youtube":
      return `https://youtube.com/@${username}`;
    case "twitter":
      return `https://x.com/${username}`;
    default:
      return "#";
  }
}

function getRawField(inf: Influencer, field: string): unknown {
  const raw = inf.raw_data as Record<string, unknown> | null;
  if (!raw) return null;
  return raw[field] ?? null;
}

function getEmailSourceBadge(source: string | null) {
  if (!source) return null;
  const sourceMap: Record<string, { label: string; className: string }> = {
    bio: { label: "Bio", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    business: { label: "Biz", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
    linktree: { label: "Link", className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
    "social-scraper": { label: "Social", className: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
    location: { label: "위치", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300" },
    manual: { label: "수동", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  };
  const key = source.includes(":") ? source.split(":")[0] : source;
  return sourceMap[key] ?? { label: source.length > 10 ? source.split(":")[0] : source, className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
}

// Common columns appended to every platform view
function getCommonTailColumns(): ColumnDef[] {
  const keywordsCol: ColumnDef = {
    key: "keywords",
    label: "추출 키워드",
    render: (inf) => {
      const kws = inf.extracted_keywords as string[] | null;
      const tags = inf.extracted_from_tags as string[] | null;
      if (!kws?.length && !tags?.length) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <div className="flex items-center gap-1 flex-wrap">
          {kws?.slice(0, 2).map((kw) => (
            <span key={kw} className="inline-flex items-center gap-0.5 text-[10px] bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300 px-1.5 py-0 rounded">
              <Hash className="w-2.5 h-2.5" />{kw}
            </span>
          ))}
          {tags?.slice(0, 1).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0 rounded">
              <Tag className="w-2.5 h-2.5" />{tag}
            </span>
          ))}
          {((kws?.length ?? 0) + (tags?.length ?? 0)) > 3 && (
            <span className="text-[10px] text-muted-foreground">+{(kws?.length ?? 0) + (tags?.length ?? 0) - 3}</span>
          )}
        </div>
      );
    },
  };

  const dateCol: ColumnDef = {
    key: "created_at",
    label: "추출일",
    render: (inf) => {
      const date = inf.last_updated_at ?? inf.created_at;
      if (!date) return <span className="text-muted-foreground text-xs">-</span>;
      const d = new Date(date);
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground whitespace-nowrap cursor-default">
              {d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {d.toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </TooltipContent>
        </Tooltip>
      );
    },
  };

  // CRM columns — show only when data exists
  const crmIdCol: ColumnDef = {
    key: "crm_user_id",
    label: "CRM",
    render: (inf) => {
      if (!inf.crm_user_id) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-400">
          #{inf.crm_user_id}
        </Badge>
      );
    },
  };

  const genderCol: ColumnDef = {
    key: "gender",
    label: "성별",
    render: (inf) => {
      if (!inf.gender) return <span className="text-muted-foreground text-xs">-</span>;
      const labels: Record<string, string> = { M: "남", F: "여", other: "기타" };
      return <span className="text-xs">{labels[inf.gender] ?? inf.gender}</span>;
    },
  };

  const lineIdCol: ColumnDef = {
    key: "line_id",
    label: "LINE",
    render: (inf) => {
      if (!inf.line_id) return <span className="text-muted-foreground text-xs">-</span>;
      return <span className="text-xs truncate max-w-[80px] block">{inf.line_id}</span>;
    },
  };

  const settlementCol: ColumnDef = {
    key: "default_settlement_info",
    label: "정산정보",
    render: (inf) => {
      const info = inf.default_settlement_info as { paypal_email?: string; bank_name?: string; method?: string } | null;
      if (!info) return <span className="text-muted-foreground text-xs">-</span>;
      if (info.paypal_email) return <span className="text-[10px] text-orange-600 dark:text-orange-400">PayPal</span>;
      if (info.bank_name) return <span className="text-[10px] text-blue-600 dark:text-blue-400">{info.bank_name}</span>;
      return <span className="text-muted-foreground text-xs">-</span>;
    },
  };

  const influenceScoreCol: ColumnDef = {
    key: "influence_score",
    label: "영향력",
    render: (inf) => {
      const score = (inf as Record<string, unknown>).influence_score as number | null;
      if (score == null) return <span className="text-muted-foreground text-xs">-</span>;
      const color = score >= 70 ? "text-green-600 dark:text-green-400" : score >= 40 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
      return <span className={`text-xs font-medium tabular-nums ${color}`}>{score.toFixed(0)}</span>;
    },
  };

  const contentQualityCol: ColumnDef = {
    key: "content_quality_score",
    label: "콘텐츠품질",
    render: (inf) => {
      const score = (inf as Record<string, unknown>).content_quality_score as number | null;
      if (score == null) return <span className="text-muted-foreground text-xs">-</span>;
      const color = score >= 70 ? "text-green-600 dark:text-green-400" : score >= 40 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
      return <span className={`text-xs font-medium tabular-nums ${color}`}>{score.toFixed(0)}</span>;
    },
  };

  const brandCollabCol: ColumnDef = {
    key: "brand_collab_count",
    label: "브랜드협업",
    render: (inf) => {
      const count = (inf as Record<string, unknown>).brand_collab_count as number | null;
      if (!count) return <span className="text-muted-foreground text-xs">-</span>;
      return <span className="text-xs tabular-nums">{count}</span>;
    },
  };

  const commerceCol: ColumnDef = {
    key: "commerce_enabled",
    label: "이커머스",
    render: (inf) => {
      const enabled = (inf as Record<string, unknown>).commerce_enabled as boolean | null;
      if (!enabled) return <span className="text-muted-foreground text-xs">-</span>;
      return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">활성</Badge>;
    },
  };

  const audienceAuthCol: ColumnDef = {
    key: "audience_authenticity_score",
    label: "진성오디언스",
    render: (inf) => {
      const score = (inf as Record<string, unknown>).audience_authenticity_score as number | null;
      if (score == null) return <span className="text-muted-foreground text-xs">-</span>;
      const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-amber-600" : "text-red-500";
      return <span className={`text-xs font-medium tabular-nums ${color}`}>{score.toFixed(1)}</span>;
    },
  };

  const lastContentCol: ColumnDef = {
    key: "last_content_at",
    label: "최근콘텐츠",
    render: (inf) => {
      const dt = (inf as Record<string, unknown>).last_content_at as string | null;
      if (!dt) return <span className="text-muted-foreground text-xs">-</span>;
      return <span className="text-xs tabular-nums">{new Date(dt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>;
    },
  };

  return [keywordsCol, influenceScoreCol, contentQualityCol, audienceAuthCol, brandCollabCol, commerceCol, lastContentCol, crmIdCol, genderCol, lineIdCol, settlementCol, dateCol];
}

// ---------------------------------------------------------------------------
// Column factory helpers (reduce duplication)
// ---------------------------------------------------------------------------

function colContentUrl(label: string): ColumnDef {
  return {
    key: "source_content_url",
    label,
    render: (inf) => {
      const url = inf.source_content_url;
      if (!url) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      );
    },
  };
}

function colContentText(label: string): ColumnDef {
  return {
    key: "source_content_text",
    label,
    render: (inf) => {
      const text = inf.source_content_text;
      if (!text) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground truncate max-w-[120px] block cursor-default">
              {text.slice(0, 40)}{text.length > 40 ? "..." : ""}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-md whitespace-pre-wrap">{text.slice(0, 500)}</TooltipContent>
        </Tooltip>
      );
    },
  };
}

function colContentDate(label: string): ColumnDef {
  return {
    key: "source_content_created_at",
    label,
    render: (inf) => {
      const date = inf.source_content_created_at;
      if (!date) return <span className="text-muted-foreground text-xs">-</span>;
      const d = new Date(date);
      if (isNaN(d.getTime())) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground whitespace-nowrap cursor-default">
              {d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
            </span>
          </TooltipTrigger>
          <TooltipContent>{d.toLocaleString("ko-KR")}</TooltipContent>
        </Tooltip>
      );
    },
  };
}

function colContentLang(label: string): ColumnDef {
  return {
    key: "content_language",
    label,
    render: (inf) => inf.content_language ? (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{inf.content_language}</Badge>
    ) : (
      <span className="text-muted-foreground text-xs">-</span>
    ),
  };
}

function colContentHashtags(label: string): ColumnDef {
  return {
    key: "content_hashtags",
    label,
    render: (inf) => {
      const tags = inf.content_hashtags as string[] | null;
      if (!tags?.length) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <div className="flex items-center gap-0.5 flex-wrap">
          {tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300 px-1 py-0 rounded">
              #{t}
            </span>
          ))}
          {tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>}
        </div>
      );
    },
  };
}

function colLanguage(): ColumnDef {
  return {
    key: "language",
    label: "언어",
    render: (inf) => inf.language ? (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{inf.language}</Badge>
    ) : (
      <span className="text-muted-foreground text-xs">-</span>
    ),
  };
}

function colCountry(): ColumnDef {
  return {
    key: "country",
    label: "국가",
    render: (inf) => inf.country ? (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{inf.country}</Badge>
    ) : (
      <span className="text-muted-foreground text-xs">-</span>
    ),
  };
}

function colPrivate(): ColumnDef {
  return {
    key: "is_private",
    label: "비공개",
    render: (inf) => inf.is_private ? (
      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">비공개</Badge>
    ) : (
      <span className="text-muted-foreground text-xs">-</span>
    ),
  };
}

function colVideoDuration(): ColumnDef {
  return {
    key: "video_duration",
    label: "영상길이",
    render: (inf) => {
      const sec = inf.video_duration;
      if (sec === null || sec === undefined) return <span className="text-muted-foreground text-xs">-</span>;
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return <span className="text-xs text-muted-foreground">{m}:{String(s).padStart(2, "0")}</span>;
    },
  };
}

function colVideoTitle(): ColumnDef {
  return {
    key: "video_title",
    label: "영상제목",
    render: (inf) => {
      const title = inf.video_title;
      if (!title) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs truncate max-w-[120px] block cursor-default">{title.slice(0, 40)}{title.length > 40 ? "..." : ""}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm">{title}</TooltipContent>
        </Tooltip>
      );
    },
  };
}

function colAccountCreated(): ColumnDef {
  return {
    key: "account_created_at",
    label: "계정등록일",
    render: (inf) => {
      const date = inf.account_created_at;
      if (!date) return <span className="text-muted-foreground text-xs">-</span>;
      const d = new Date(date);
      if (isNaN(d.getTime())) return <span className="text-muted-foreground text-xs">-</span>;
      return <span className="text-xs text-muted-foreground">{d.toLocaleDateString("ko-KR", { year: "numeric", month: "short" })}</span>;
    },
  };
}

function colCount(key: string, label: string): ColumnDef {
  return {
    key,
    label,
    render: (inf, helpers) => {
      const val = (inf as Record<string, unknown>)[key] as number | null;
      return <span className="text-sm">{helpers.formatCount(val)}</span>;
    },
  };
}

function colBool(key: string, label: string, trueLabel: string): ColumnDef {
  return {
    key,
    label,
    render: (inf) => {
      const val = (inf as Record<string, unknown>)[key];
      return val ? (
        <Badge variant="outline" className="text-[10px] px-1 py-0">{trueLabel}</Badge>
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      );
    },
  };
}

function colMentions(): ColumnDef {
  return {
    key: "mentions",
    label: "멘션",
    render: (inf) => {
      const mentions = inf.mentions as string[] | null;
      if (!mentions?.length) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <div className="flex items-center gap-0.5 flex-wrap">
          {mentions.slice(0, 2).map((m) => (
            <span key={m} className="text-[10px] bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 px-1 py-0 rounded">
              @{m}
            </span>
          ))}
          {mentions.length > 2 && <span className="text-[10px] text-muted-foreground">+{mentions.length - 2}</span>}
        </div>
      );
    },
  };
}

function colMusicInfo(): ColumnDef {
  return {
    key: "music_info",
    label: "음악",
    render: (inf) => {
      const info = inf.music_info as Record<string, unknown> | null;
      if (!info) return <span className="text-muted-foreground text-xs">-</span>;
      const artist = (info.music_author ?? info.authorName ?? info.artist ?? "") as string;
      const title = (info.music_title ?? info.title ?? info.musicName ?? "") as string;
      const display = [artist, title].filter(Boolean).join(" - ");
      if (!display) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground truncate max-w-[100px] block cursor-default">{display.slice(0, 30)}{display.length > 30 ? "..." : ""}</span>
          </TooltipTrigger>
          <TooltipContent>{display}</TooltipContent>
        </Tooltip>
      );
    },
  };
}

function colProductType(): ColumnDef {
  return {
    key: "product_type",
    label: "유형",
    render: (inf) => {
      const pt = inf.product_type;
      if (!pt) return <span className="text-muted-foreground text-xs">-</span>;
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{pt}</Badge>;
    },
  };
}

function colLocation(): ColumnDef {
  return {
    key: "location",
    label: "위치",
    render: (inf) => {
      if (!inf.location) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground truncate max-w-[80px] block cursor-default">
              {inf.location.slice(0, 20)}{inf.location.length > 20 ? "..." : ""}
            </span>
          </TooltipTrigger>
          <TooltipContent>{inf.location}</TooltipContent>
        </Tooltip>
      );
    },
  };
}

function colCoverImage(): ColumnDef {
  return {
    key: "cover_image_url",
    label: "커버",
    render: (inf) => {
      const url = inf.cover_image_url;
      if (!url) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <img src={url} alt="" className="w-8 h-5 rounded object-cover cursor-pointer" referrerPolicy="no-referrer" loading="lazy" />
          </TooltipTrigger>
          <TooltipContent><img src={url} alt="" className="w-48 rounded" referrerPolicy="no-referrer" /></TooltipContent>
        </Tooltip>
      );
    },
  };
}

// Columns for each platform view
function getColumnsForPlatform(platform: PlatformFilter): ColumnDef[] {
  const tail = getCommonTailColumns();

  const profileCol: ColumnDef = {
    key: "profile",
    label: "",
    width: "w-10",
    render: (inf) => {
      const needsEnrich = inf.platform === "instagram" && (!inf.follower_count || !inf.profile_image_url);
      return (
        <div className="flex items-center justify-center relative">
          {inf.profile_image_url ? (
            <img
              src={inf.profile_image_url}
              alt=""
              className="w-8 h-8 rounded-full object-cover ring-1 ring-muted"
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={(e) => {
                // CDN URL expired - show fallback
                (e.target as HTMLImageElement).style.display = "none";
                const fallback = (e.target as HTMLImageElement).nextElementSibling;
                if (fallback) (fallback as HTMLElement).style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
            style={{ display: inf.profile_image_url ? "none" : "flex" }}
          >
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          {needsEnrich && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border border-background" />
              </TooltipTrigger>
              <TooltipContent>프로필 보강 필요 (팔로워/프로필사진 미수집)</TooltipContent>
            </Tooltip>
          )}
        </div>
      );
    },
  };

  const usernameCol: ColumnDef = {
    key: "username",
    label: "유저네임",
    render: (inf, helpers) => (
      <div className="flex items-center gap-1.5 min-w-0">
        <a
          href={helpers.getProfileUrl(inf)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:text-primary transition-colors truncate max-w-[180px]"
          title={`@${inf.username ?? ""}`}
        >
          @{inf.username ?? "-"}
        </a>
        {inf.display_name && inf.display_name !== inf.username && (
          <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={inf.display_name}>
            {inf.display_name}
          </span>
        )}
      </div>
    ),
  };

  const emailCol: ColumnDef = {
    key: "email",
    label: "이메일",
    render: (inf, helpers) =>
      inf.email ? (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-950 flex-shrink-0">
            <Mail className="w-3 h-3 text-green-600 dark:text-green-400" />
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs truncate max-w-[140px] block cursor-default font-medium text-green-700 dark:text-green-400">
                {inf.email}
              </span>
            </TooltipTrigger>
            <TooltipContent>{inf.email}</TooltipContent>
          </Tooltip>
        </div>
      ) : inf.platform === "youtube" && inf.email_source === "not_found" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded cursor-default">
              찾기 실패
            </span>
          </TooltipTrigger>
          <TooltipContent>이메일을 찾을 수 없었습니다 (재추출하려면 선택 후 YT 이메일 추출)</TooltipContent>
        </Tooltip>
      ) : inf.platform === "youtube" && helpers.onYtEmail ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); helpers.onYtEmail!(inf.id, inf.username); }}
              className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            >
              <Zap className="w-3 h-3" />
              <span>이메일 추출</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>YouTube 채널에서 비즈니스 이메일 추출 ($0.005)</TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      ),
  };

  const followersCol: ColumnDef = {
    key: "followers",
    label: "팔로워",
    render: (inf, helpers) => {
      if (inf.follower_count === null && inf.platform === "instagram") {
        return <span className="text-[10px] text-amber-500">보강 대기</span>;
      }
      return <span className="text-sm font-medium">{helpers.formatCount(inf.follower_count)}</span>;
    },
  };

  const bioCol: ColumnDef = {
    key: "bio",
    label: "바이오",
    render: (inf) =>
      inf.bio ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground truncate max-w-[200px] block cursor-default">
              {inf.bio.slice(0, 50)}{inf.bio.length > 50 ? "..." : ""}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-md whitespace-pre-wrap">
            {inf.bio}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      ),
  };

  if (platform === "instagram") {
    return [
      profileCol,
      usernameCol,
      {
        key: "country",
        label: "국가",
        render: (inf) => inf.country ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{inf.country}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      },
      followersCol,
      {
        key: "following",
        label: "팔로잉",
        render: (inf, helpers) => (
          <span className="text-sm">{helpers.formatCount(inf.following_count)}</span>
        ),
      },
      {
        key: "posts",
        label: "게시물",
        render: (inf, helpers) => (
          <span className="text-sm">{helpers.formatCount(inf.post_count)}</span>
        ),
      },
      {
        key: "engagement",
        label: "참여율 ℹ️",
        render: (inf, helpers) => {
          const val = helpers.formatEngagement(inf.engagement_rate);
          return val ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-green-600 dark:text-green-400 font-medium cursor-default">{val}</span>
              </TooltipTrigger>
              <TooltipContent>Instagram: (좋아요+댓글) / 팔로워</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          );
        },
      },
      bioCol,
      emailCol,
      {
        key: "email_source",
        label: "출처",
        render: (inf) => {
          if (!inf.email_source) return <span className="text-muted-foreground text-xs">-</span>;
          const badge = getEmailSourceBadge(inf.email_source);
          if (!badge) return <span className="text-muted-foreground text-xs">-</span>;
          return <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>;
        },
      },
      {
        key: "is_verified",
        label: "인증",
        render: (inf) => inf.is_verified ? (
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      },
      {
        key: "is_business",
        label: "비즈",
        render: (inf) => inf.is_business ? (
          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">Biz</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      },
      {
        key: "category",
        label: "카테고리",
        render: (inf) => inf.category ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs truncate max-w-[80px] block cursor-default">{inf.category}</span>
            </TooltipTrigger>
            <TooltipContent>{inf.category}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      },
      {
        key: "external_url",
        label: "외부 URL",
        render: (inf) => {
          const url = inf.external_url;
          if (!url) return <span className="text-muted-foreground text-xs">-</span>;
          let hostname = "";
          try { hostname = new URL(url).hostname.replace("www.", ""); } catch { hostname = url.slice(0, 30); }
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 truncate max-w-[120px] block"
                >
                  {hostname}
                </a>
              </TooltipTrigger>
              <TooltipContent>{url}</TooltipContent>
            </Tooltip>
          );
        },
      },
      colCount("avg_likes", "평균좋아요"),
      colCount("avg_comments", "평균댓글"),
      colCount("avg_views", "평균조회"),
      colLanguage(),
      colContentUrl("콘텐츠URL"),
      colContentText("캡션"),
      colContentDate("콘텐츠일"),
      colContentLang("콘텐츠언어"),
      colContentHashtags("해시태그"),
      colPrivate(),
      colVideoDuration(),
      colBool("is_sponsored", "광고", "Ad"),
      colMentions(),
      colMusicInfo(),
      colProductType(),
      colLocation(),
      ...tail,
    ];
  }

  if (platform === "tiktok") {
    return [
      profileCol,
      usernameCol,
      followersCol,
      {
        key: "following",
        label: "팔로잉",
        render: (inf, helpers) => (
          <span className="text-sm">{helpers.formatCount(inf.following_count)}</span>
        ),
      },
      {
        key: "heart_count",
        label: "총 좋아요",
        render: (inf, helpers) => (
          <span className="text-sm">{helpers.formatCount(inf.heart_count)}</span>
        ),
      },
      {
        key: "videos",
        label: "동영상",
        render: (inf, helpers) => {
          const videoCount = (helpers.getRawField(inf, "videoCount") ?? inf.post_count) as number | null;
          return <span className="text-sm">{helpers.formatCount(videoCount ?? null)}</span>;
        },
      },
      {
        key: "engagement",
        label: "참여율 ℹ️",
        render: (inf, helpers) => {
          const val = helpers.formatEngagement(inf.engagement_rate);
          return val ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-green-600 dark:text-green-400 font-medium cursor-default">{val}</span>
              </TooltipTrigger>
              <TooltipContent>TikTok: (좋아요+댓글+공유) / 조회수</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          );
        },
      },
      bioCol,
      emailCol,
      {
        key: "email_source",
        label: "출처",
        render: (inf) => {
          if (!inf.email_source) return <span className="text-muted-foreground text-xs">-</span>;
          const badge = getEmailSourceBadge(inf.email_source);
          if (!badge) return <span className="text-muted-foreground text-xs">-</span>;
          return <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>;
        },
      },
      colCount("avg_likes", "평균좋아요"),
      colCount("avg_comments", "평균댓글"),
      colCount("avg_shares", "평균공유"),
      colCount("avg_views", "평균재생"),
      colCountry(),
      colLanguage(),
      ...tail,
    ];
  }

  if (platform === "youtube") {
    return [
      profileCol,
      {
        key: "channel",
        label: "채널명",
        render: (inf, helpers) => (
          <a
            href={helpers.getProfileUrl(inf)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:text-primary transition-colors truncate max-w-[180px] block"
          >
            {inf.display_name ?? inf.username ?? "-"}
          </a>
        ),
      },
      {
        key: "subscribers",
        label: "구독자",
        render: (inf, helpers) => (
          <span className="text-sm font-medium">{helpers.formatCount(inf.follower_count)}</span>
        ),
      },
      {
        key: "videos",
        label: "동영상",
        render: (inf, helpers) => {
          const videoCount = (helpers.getRawField(inf, "videoCount") ?? inf.post_count) as number | null;
          return <span className="text-sm">{helpers.formatCount(videoCount ?? null)}</span>;
        },
      },
      {
        key: "total_views",
        label: "총 조회수",
        render: (inf, helpers) => (
          <span className="text-sm">{helpers.formatCount(inf.total_views)}</span>
        ),
      },
      {
        key: "description",
        label: "설명",
        render: (inf) => {
          const desc = inf.bio;
          if (!desc) return <span className="text-muted-foreground text-xs">-</span>;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground truncate max-w-[200px] block cursor-default">
                  {desc.slice(0, 50)}{desc.length > 50 ? "..." : ""}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-md whitespace-pre-wrap">{desc}</TooltipContent>
            </Tooltip>
          );
        },
      },
      emailCol,
      {
        key: "email_source",
        label: "출처",
        render: (inf) => {
          if (!inf.email_source) return <span className="text-muted-foreground text-xs">-</span>;
          const badge = getEmailSourceBadge(inf.email_source);
          if (!badge) return <span className="text-muted-foreground text-xs">-</span>;
          return <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>;
        },
      },
      {
        key: "is_monetized",
        label: "수익화",
        render: (inf) => inf.is_monetized ? (
          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300">수익화</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      },
      {
        key: "location",
        label: "국가",
        render: (inf) => inf.location ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{inf.location}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      },
      {
        key: "channel_joined_date",
        label: "채널생성일",
        render: (inf) => inf.channel_joined_date ? (
          <span className="text-xs text-muted-foreground">{new Date(inf.channel_joined_date).toLocaleDateString("ko-KR", { year: "numeric", month: "short" })}</span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      },
      colCount("avg_views", "평균조회"),
      colCount("avg_likes", "평균좋아요"),
      colCount("avg_comments", "평균댓글"),
      {
        key: "external_url",
        label: "채널URL",
        render: (inf) => {
          if (!inf.external_url) return <span className="text-muted-foreground text-xs">-</span>;
          return (
            <a href={inf.external_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          );
        },
      },
      colCountry(),
      colLanguage(),
      colContentUrl("콘텐츠URL"),
      colVideoTitle(),
      colContentText("영상설명"),
      colContentDate("게시일"),
      colContentLang("콘텐츠언어"),
      colContentHashtags("태그"),
      colAccountCreated(),
      colVideoDuration(),
      colProductType(),
      ...tail,
    ];
  }

  if (platform === "twitter") {
    return [
      profileCol,
      usernameCol,
      {
        key: "display_name",
        label: "표시명",
        render: (inf) => inf.display_name ? (
          <span className="text-xs truncate max-w-[120px] block">{inf.display_name}</span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      },
      followersCol,
      {
        key: "following",
        label: "팔로잉",
        render: (inf, helpers) => (
          <span className="text-sm">{helpers.formatCount(inf.following_count)}</span>
        ),
      },
      {
        key: "tweets",
        label: "트윗",
        render: (inf, helpers) => (
          <span className="text-sm">{helpers.formatCount(inf.post_count)}</span>
        ),
      },
      bioCol,
      emailCol,
      {
        key: "email_source",
        label: "출처",
        render: (inf) => {
          if (!inf.email_source) return <span className="text-muted-foreground text-xs">-</span>;
          const badge = getEmailSourceBadge(inf.email_source);
          if (!badge) return <span className="text-muted-foreground text-xs">-</span>;
          return <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>;
        },
      },
      {
        key: "is_verified",
        label: "인증",
        render: (inf) => inf.is_verified ? (
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      },
      {
        key: "is_blue_verified",
        label: "Blue",
        render: (inf) => inf.is_blue_verified ? (
          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">Blue</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      },
      {
        key: "verified_type",
        label: "인증유형",
        render: (inf) => inf.verified_type ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{inf.verified_type}</span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      },
      {
        key: "location",
        label: "위치",
        render: (inf) => {
          if (!inf.location) return <span className="text-muted-foreground text-xs">-</span>;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground truncate max-w-[100px] block cursor-default">
                  {inf.location.slice(0, 20)}{inf.location.length > 20 ? "..." : ""}
                </span>
              </TooltipTrigger>
              <TooltipContent>{inf.location}</TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        key: "external_url",
        label: "웹사이트",
        render: (inf) => {
          if (!inf.external_url) return <span className="text-muted-foreground text-xs">-</span>;
          let hostname = "";
          try { hostname = new URL(inf.external_url).hostname.replace("www.", ""); } catch { hostname = (inf.external_url).slice(0, 20); }
          return (
            <a href={inf.external_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 truncate max-w-[100px] block">
              {hostname}
            </a>
          );
        },
      },
      colCount("avg_likes", "평균좋아요"),
      colCount("avg_shares", "평균RT"),
      colCount("avg_comments", "평균답글"),
      colCount("avg_views", "평균조회"),
      colContentUrl("트윗URL"),
      colContentText("트윗"),
      colContentDate("트윗일"),
      colContentLang("트윗언어"),
      colContentHashtags("해시태그"),
      colAccountCreated(),
      colCoverImage(),
      colCount("bookmark_count", "북마크"),
      colCount("quote_count", "인용"),
      colCount("favourites_count", "좋아요한수"),
      colCount("listed_count", "리스트수"),
      colCount("media_count", "미디어수"),
      colBool("is_retweet", "RT여부", "RT"),
      colBool("is_reply", "답글여부", "Reply"),
      colMentions(),
      colCountry(),
      colLanguage(),
      ...tail,
    ];
  }

  // Fallback: use instagram columns (should not be reached since "all" tab is removed)
  return [
    profileCol,
    usernameCol,
    followersCol,
    bioCol,
    emailCol,
    ...tail,
  ];
}


// ---------------------------------------------------------------------------
// Content thumbnails extraction from raw_data
// ---------------------------------------------------------------------------

type ContentPost = {
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  likes?: number;
  comments?: number;
  views?: number;
  url?: string;
  type?: string; // image, video, Image, Video, etc.
};

function getContentPosts(inf: Influencer): ContentPost[] {
  const raw = inf.raw_data as Record<string, unknown> | null;
  if (!raw) return [];
  const posts: ContentPost[] = [];
  const MAX_POSTS = 12;
  const seenUrls = new Set<string>();

  function addPost(p: ContentPost) {
    if (posts.length >= MAX_POSTS) return;
    const key = p.imageUrl || p.videoUrl || p.url || "";
    if (key && seenUrls.has(key)) return;
    if (key) seenUrls.add(key);
    posts.push(p);
  }

  function isValidUrl(u: unknown): u is string {
    return typeof u === "string" && u.startsWith("http");
  }

  // Source 1: latestPosts from Instagram Profile Scraper (best source - has multiple posts)
  const latestPosts = (raw.latestPosts ?? raw.recentPosts) as Record<string, unknown>[] | undefined;
  if (Array.isArray(latestPosts)) {
    for (const post of latestPosts) {
      const imgUrl = (post?.displayUrl ?? post?.thumbnailSrc ?? post?.imageUrl) as string | undefined;
      const vidUrl = (post?.videoUrl) as string | undefined;
      if (isValidUrl(imgUrl) || isValidUrl(vidUrl)) {
        addPost({
          imageUrl: isValidUrl(imgUrl) ? imgUrl : undefined,
          videoUrl: isValidUrl(vidUrl) ? vidUrl : undefined,
          caption: (post?.caption as string) ?? undefined,
          likes: (post?.likesCount as number) ?? undefined,
          comments: (post?.commentsCount as number) ?? undefined,
          views: (post?.videoViewCount as number) ?? undefined,
          url: (post?.url as string) ?? undefined,
          type: (post?.type as string) ?? (isValidUrl(vidUrl) ? "Video" : "Image"),
        });
      }
    }
  }

  // Source 2: _collectedPosts from extraction pipeline (accumulated posts per user)
  const collectedPosts = raw._collectedPosts as Record<string, unknown>[] | undefined;
  if (Array.isArray(collectedPosts)) {
    for (const post of collectedPosts) {
      const imgUrl = post?.displayUrl as string | undefined;
      const vidUrl = post?.videoUrl as string | undefined;
      if (isValidUrl(imgUrl) || isValidUrl(vidUrl)) {
        addPost({
          imageUrl: isValidUrl(imgUrl) ? imgUrl : undefined,
          videoUrl: isValidUrl(vidUrl) ? vidUrl : undefined,
          caption: (post?.caption as string) ?? undefined,
          likes: (post?.likesCount as number) ?? undefined,
          comments: (post?.commentsCount as number) ?? undefined,
          views: (post?.viewCount as number) ?? undefined,
          url: (post?.url as string) ?? undefined,
          type: (post?.type as string) ?? (isValidUrl(vidUrl) ? "Video" : "Image"),
        });
      }
    }
  }

  // Source 3: Single post at top level (hashtag/reel scraper - single item)
  if (posts.length === 0) {
    const imgUrl = (raw.displayUrl ?? raw.thumbnailSrc) as string | undefined;
    const vidUrl = raw.videoUrl as string | undefined;
    if (isValidUrl(imgUrl) || isValidUrl(vidUrl)) {
      addPost({
        imageUrl: isValidUrl(imgUrl) ? imgUrl : undefined,
        videoUrl: isValidUrl(vidUrl) ? vidUrl : undefined,
        caption: (raw.caption as string) ?? undefined,
        likes: (raw.likesCount as number) ?? undefined,
        comments: (raw.commentsCount as number) ?? undefined,
        url: (raw.url as string) ?? undefined,
        type: isValidUrl(vidUrl) ? "Video" : "Image",
      });
    }
  }

  // Source 4: TikTok video cover
  if (posts.length === 0) {
    const videoMeta = raw.videoMeta as Record<string, unknown> | undefined;
    const covers = raw.covers as Record<string, unknown> | undefined;
    const coverUrl = (videoMeta?.coverUrl ?? covers?.default) as string | undefined;
    const vidUrl = (raw.videoUrl ?? videoMeta?.downloadAddr) as string | undefined;
    if (isValidUrl(coverUrl)) {
      addPost({
        imageUrl: coverUrl,
        videoUrl: isValidUrl(vidUrl) ? vidUrl : undefined,
        caption: (raw.text as string) ?? undefined,
        likes: (raw.diggCount as number) ?? undefined,
        comments: (raw.commentCount as number) ?? undefined,
        views: (raw.playCount as number) ?? undefined,
        url: (raw.webVideoUrl ?? raw.url) as string | undefined,
        type: "Video",
      });
    }
  }

  // Source 5: YouTube thumbnail
  if (posts.length === 0) {
    const thumbUrl = (raw.thumbnailUrl ?? raw.thumbnail) as string | undefined;
    if (isValidUrl(thumbUrl)) {
      addPost({
        imageUrl: thumbUrl,
        caption: (raw.title as string) ?? undefined,
        views: (raw.viewCount as number) ?? undefined,
        url: (raw.url as string) ?? undefined,
        type: "Video",
      });
    }
  }

  // Source 6: Twitter media array
  if (posts.length === 0 && Array.isArray(raw.media)) {
    for (const m of raw.media as Record<string, unknown>[]) {
      const mUrl = (m?.media_url_https ?? m?.url) as string | undefined;
      const vidVariants = m?.video_info as Record<string, unknown> | undefined;
      const vidUrl = (vidVariants?.variants as Record<string, unknown>[] | undefined)?.[0]?.url as string | undefined;
      if (isValidUrl(mUrl)) {
        addPost({
          imageUrl: mUrl,
          videoUrl: isValidUrl(vidUrl) ? vidUrl : undefined,
          type: m?.type === "video" ? "Video" : "Image",
        });
      }
    }
  }

  // Source 7: Generic posts array
  if (posts.length === 0 && Array.isArray(raw.posts)) {
    for (const post of raw.posts as Record<string, unknown>[]) {
      const imgUrl = (post?.displayUrl ?? post?.thumbnailSrc ?? post?.thumbnailUrl ?? post?.coverUrl) as string | undefined;
      const vidUrl = post?.videoUrl as string | undefined;
      if (isValidUrl(imgUrl)) {
        addPost({
          imageUrl: imgUrl,
          videoUrl: isValidUrl(vidUrl) ? vidUrl : undefined,
          caption: (post?.caption as string) ?? undefined,
          likes: (post?.likesCount as number) ?? undefined,
          comments: (post?.commentsCount as number) ?? undefined,
          url: (post?.url as string) ?? undefined,
        });
      }
    }
  }

  return posts;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function MasterPage() {
  const supabase = createClient();

  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("instagram");
  const [emailFilter, setEmailFilter] = useState<string>("all");
  const [followerMin, setFollowerMin] = useState("");
  const [followerMax, setFollowerMax] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<string>("all");
  const [businessFilter, setBusinessFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [enrichedFilter, setEnrichedFilter] = useState<string>("all");
  const [importSourceFilter, setImportSourceFilter] = useState("");
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const pageSize = 50;

  // Stats
  const [platformCounts, setPlatformCounts] = useState<Record<string, number>>({});
  const [emailCount, setEmailCount] = useState(0);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Campaign assignment state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [ytEmailLoading, setYtEmailLoading] = useState(false);
  const ytEmailPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Campaign assignments for each influencer
  const [campaignAssignments, setCampaignAssignments] = useState<CampaignAssignmentMap>({});

  // Influencer links
  const [influencerLinks, setInfluencerLinks] = useState<Record<string, InfluencerLink[]>>({});

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // View mode: table (default) or card
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Video modal state
  const [modalPost, setModalPost] = useState<ContentPost | null>(null);

  // Excel import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>("");
  const [importResult, setImportResult] = useState<{
    total_parsed: number;
    duplicates_removed: number;
    unique_rows: number;
    upserted: number;
    errors: number;
    sheets: { sheet: string; country: string; rows: number }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enrichment dashboard state
  const [enrichStats, setEnrichStats] = useState<{
    total: number;
    enriched: number;
    unenriched: number;
    high_priority_unenriched: number;
    with_email: number;
    enrichment_rate: number;
    running_jobs: { id: string; apify_run_id: string; created_at: string }[];
  } | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [showEnrichPanel, setShowEnrichPanel] = useState(false);

  // CSV state
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCampaigns();
    fetchPlatformCounts();
    return () => { if (ytEmailPollRef.current) clearInterval(ytEmailPollRef.current); };
  }, []);

  useEffect(() => {
    fetchInfluencers();
  }, [platformFilter, emailFilter, page, sortField, sortDir, verifiedFilter, businessFilter, enrichedFilter, countryFilter, followerMin, followerMax, categoryFilter, importSourceFilter]);

  // Defer campaign assignments & links fetch until actually needed (expand row)
  const assignmentsFetched = useRef(false);
  useEffect(() => { assignmentsFetched.current = false; }, [influencers]);

  async function ensureAssignmentsLoaded() {
    if (assignmentsFetched.current || influencers.length === 0) return;
    assignmentsFetched.current = true;
    const ids = influencers.map((inf) => inf.id);
    fetchCampaignAssignments(ids);
    fetchInfluencerLinks(ids);
  }

  // Selection persists across pages - no reset on page change

  // Debounced realtime callback to prevent re-fetch storms on bulk updates
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeCallback = useCallback(() => {
    if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = setTimeout(() => {
      fetchInfluencers();
      fetchPlatformCounts();
    }, 2000);
  }, [platformFilter, emailFilter, page, sortField, sortDir, countryFilter, followerMin, followerMax]);
  useRealtime("influencers", `platform=eq.${platformFilter}`, realtimeCallback);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  async function fetchPlatformCounts() {
    const [platformResults, emailResult] = await Promise.all([
      Promise.all(
        PLATFORMS.map(async (p) => {
          const { count } = await supabase
            .from("influencers")
            .select("id", { count: "exact", head: true })
            .eq("platform", p.value);
          return { platform: p.value, count: count ?? 0 };
        })
      ),
      supabase
        .from("influencers")
        .select("id", { count: "exact", head: true })
        .not("email", "is", null),
    ]);

    const counts: Record<string, number> = {};
    for (const r of platformResults) counts[r.platform] = r.count;
    setPlatformCounts(counts);
    setEmailCount(emailResult.count ?? 0);
  }

  async function fetchCampaigns() {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCampaigns(data as Campaign[]);
  }

  // Auto-filter state tracking
  const [autoFilterActive, setAutoFilterActive] = useState(false);

  function handleCampaignSelect(campaignId: string) {
    setSelectedCampaignId(campaignId);
    if (!campaignId) {
      setAutoFilterActive(false);
      return;
    }
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) return;

    const tc = campaign.target_countries ?? [];
    const tp = campaign.target_platforms ?? [];
    let applied = false;

    if (tp.length > 0) {
      // Auto-apply platform filter (use first platform since filter is single-select)
      setPlatformFilter(tp[0] as PlatformFilter);
      applied = true;
    }
    if (tc.length > 0) {
      // Auto-apply country filter (use first country)
      setCountryFilter(tc[0]);
      applied = true;
    }
    setAutoFilterActive(applied);
    if (applied) {
      setPage(0);
    }
  }

  async function fetchCampaignAssignments(influencerIds: string[]) {
    if (influencerIds.length === 0) return;
    const { data } = await supabase
      .from("campaign_influencers")
      .select(`
        id, influencer_id, campaign_id, funnel_status, status,
        outreach_round, last_outreach_at, reply_date,
        interest_confirmed, client_approved, final_confirmed,
        visit_scheduled_date, visit_completed,
        upload_deadline, actual_upload_date, upload_url,
        payment_amount, payment_currency,
        influencer_payment_status, client_payment_status,
        notes, created_at,
        campaign:campaigns!campaign_id(id, name, campaign_type, status)
      `)
      .in("influencer_id", influencerIds);

    if (data) {
      const map: CampaignAssignmentMap = {};
      for (const row of data as unknown as {
        id: string;
        influencer_id: string;
        campaign_id: string;
        funnel_status: string;
        status: string;
        outreach_round: number;
        last_outreach_at: string | null;
        reply_date: string | null;
        interest_confirmed: boolean;
        client_approved: boolean;
        final_confirmed: boolean;
        visit_scheduled_date: string | null;
        visit_completed: boolean;
        upload_deadline: string | null;
        actual_upload_date: string | null;
        upload_url: string | null;
        payment_amount: number | null;
        payment_currency: string | null;
        influencer_payment_status: string | null;
        client_payment_status: string | null;
        notes: string | null;
        created_at: string;
        campaign: { id: string; name: string; campaign_type: string | null; status: string | null };
      }[]) {
        if (!map[row.influencer_id]) map[row.influencer_id] = [];
        if (row.campaign) {
          map[row.influencer_id].push({
            id: row.id,
            campaign_id: row.campaign.id,
            name: row.campaign.name,
            campaign_type: row.campaign.campaign_type,
            campaign_status: row.campaign.status,
            funnel_status: row.funnel_status ?? "extracted",
            outreach_round: row.outreach_round ?? 0,
            last_outreach_at: row.last_outreach_at,
            reply_date: row.reply_date,
            interest_confirmed: row.interest_confirmed ?? false,
            client_approved: row.client_approved ?? false,
            final_confirmed: row.final_confirmed ?? false,
            visit_scheduled_date: row.visit_scheduled_date,
            visit_completed: row.visit_completed ?? false,
            upload_deadline: row.upload_deadline,
            actual_upload_date: row.actual_upload_date,
            upload_url: row.upload_url,
            payment_amount: row.payment_amount,
            payment_currency: row.payment_currency,
            influencer_payment_status: row.influencer_payment_status,
            client_payment_status: row.client_payment_status,
            notes: row.notes,
            created_at: row.created_at,
          });
        }
      }
      setCampaignAssignments(map);
    }
  }

  async function fetchInfluencerLinks(influencerIds: string[]) {
    if (influencerIds.length === 0) return;
    const { data } = await supabase
      .from("influencer_links")
      .select("*")
      .in("influencer_id", influencerIds);
    if (data) {
      const map: Record<string, InfluencerLink[]> = {};
      for (const link of data as InfluencerLink[]) {
        if (!map[link.influencer_id]) map[link.influencer_id] = [];
        map[link.influencer_id].push(link);
      }
      setInfluencerLinks(map);
    }
  }

  // On-demand raw_data cache for expanded rows
  const [rawDataCache, setRawDataCache] = useState<Record<string, Record<string, unknown>>>({});

  async function fetchRawData(infId: string) {
    if (rawDataCache[infId]) return;
    const { data } = await supabase
      .from("influencers")
      .select("raw_data")
      .eq("id", infId)
      .single();
    if (data?.raw_data) {
      setRawDataCache((prev) => ({ ...prev, [infId]: data.raw_data as Record<string, unknown> }));
    }
  }

  // Select all columns EXCEPT raw_data (which is large JSONB) for performance
  const INFLUENCER_SELECT = "id,platform,platform_id,username,display_name,profile_url,profile_image_url,email,email_source,bio,follower_count,following_count,post_count,engagement_rate,country,language,extracted_keywords,extracted_from_tags,is_verified,is_business,category,import_source,is_blue_verified,verified_type,location,heart_count,share_count,total_views,channel_joined_date,is_monetized,external_url,avg_likes,avg_comments,avg_views,avg_shares,source_content_url,source_content_text,source_content_media,source_content_created_at,content_language,content_hashtags,account_created_at,is_private,cover_image_url,bookmark_count,quote_count,favourites_count,video_duration,video_title,listed_count,media_count,is_sponsored,is_retweet,is_reply,mentions,music_info,product_type,last_updated_at,created_at,crm_user_id,gender,line_id,default_settlement_info,real_name,birth_date,phone";

  async function fetchInfluencers() {
    setLoading(true);

    let query = supabase.from("influencers").select(INFLUENCER_SELECT, { count: "exact" });

    query = query.eq("platform", platformFilter);
    if (searchQuery) {
      const escaped = escapeLike(searchQuery);
      query = query.or(
        `username.ilike.%${escaped}%,display_name.ilike.%${escaped}%,email.ilike.%${escaped}%`
      );
    }
    if (emailFilter === "has") query = query.not("email", "is", null);
    else if (emailFilter === "none") query = query.is("email", null);
    if (followerMin) query = query.gte("follower_count", parseInt(followerMin));
    if (followerMax) query = query.lte("follower_count", parseInt(followerMax));
    if (countryFilter) query = query.eq("country", countryFilter.toUpperCase());
    if (verifiedFilter === "yes") query = query.eq("is_verified", true);
    if (businessFilter === "yes") query = query.eq("is_business", true);
    if (categoryFilter) query = query.ilike("category", `%${escapeLike(categoryFilter)}%`);
    if (importSourceFilter) query = query.ilike("import_source", `%${escapeLike(importSourceFilter)}%`);
    if (enrichedFilter === "enriched") query = query.not("bio", "is", null);
    else if (enrichedFilter === "unenriched") query = query.is("bio", null);

    query = query
      .order(sortField, { ascending: sortDir === "asc", nullsFirst: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, error, count } = await query;

    if (!error) {
      setInfluencers((data as Influencer[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }

  function handleSearch() {
    setPage(0);
    fetchInfluencers();
  }

  function formatCount(n: number | null) {
    if (n === null || n === undefined) return "-";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  function formatEngagement(rate: number | string | null) {
    if (rate === null) return null;
    const n = Number(rate);
    if (isNaN(n)) return null;
    return `${(n * 100).toFixed(1)}%`;
  }

  // Selection handlers
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) setSelectedIds(new Set(influencers.map((inf) => inf.id)));
      else setSelectedIds(new Set());
    },
    [influencers]
  );

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const allSelected = influencers.length > 0 && influencers.every((inf) => selectedIds.has(inf.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  async function handleAssignToCampaign() {
    if (!selectedCampaignId) { toast.error("캠페인을 선택해주세요."); return; }
    if (selectedIds.size === 0) { toast.error("인플루언서를 선택해주세요."); return; }

    setAssigning(true);
    const rows = Array.from(selectedIds).map((influencer_id) => ({
      campaign_id: selectedCampaignId,
      influencer_id,
      status: "extracted",
    }));

    const { error } = await supabase
      .from("campaign_influencers")
      .upsert(rows, { onConflict: "campaign_id,influencer_id" });

    if (error) {
      toast.error(`배정 실패: ${error.message}`);
    } else {
      const campaignName = campaigns.find((c) => c.id === selectedCampaignId)?.name ?? "";
      toast.success(`${selectedIds.size}명을 "${campaignName}" 캠페인에 배정했습니다.`);
      setSelectedIds(new Set());
      setSelectedCampaignId("");
      fetchCampaignAssignments(influencers.map((inf) => inf.id));
    }
    setAssigning(false);
  }

  function startYtEmailPolling(jobId: string, channelCount: number) {
    if (ytEmailPollRef.current) clearInterval(ytEmailPollRef.current);
    setYtEmailLoading(true);

    async function checkStatus() {
      try {
        const res = await fetch(`/api/extract/status?job_id=${jobId}`);
        if (!res.ok) return false;
        const data = await res.json();
        if (data.status === "completed") {
          if (ytEmailPollRef.current) { clearInterval(ytEmailPollRef.current); ytEmailPollRef.current = null; }
          setYtEmailLoading(false);
          const found = data.new_extracted ?? 0;
          const processed = data.total_extracted ?? channelCount;
          if (found > 0) {
            toast.success(`이메일 추출 완료: ${processed}채널 중 ${found}개 이메일 발견`, { duration: 8000 });
          } else {
            toast(`이메일 추출 완료: ${processed}채널 검색했으나 이메일을 찾지 못했습니다`, { duration: 8000 });
          }
          fetchInfluencers();
          return true;
        } else if (data.status === "failed") {
          if (ytEmailPollRef.current) { clearInterval(ytEmailPollRef.current); ytEmailPollRef.current = null; }
          setYtEmailLoading(false);
          toast.error("이메일 추출 실패");
          return true;
        }
        return false;
      } catch { return false; }
    }

    // Check immediately after 3 seconds (endspec actor usually finishes in ~2s)
    setTimeout(async () => {
      const done = await checkStatus();
      if (!done) {
        ytEmailPollRef.current = setInterval(() => checkStatus(), 5000);
      }
    }, 3000);
  }

  async function handleYtEmailExtraction() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { toast.error("인플루언서를 선택해주세요."); return; }
    const ytIds = influencers.filter((inf) => inf.platform === "youtube" && ids.includes(inf.id)).map((inf) => inf.id);
    if (ytIds.length === 0) { toast.error("선택된 YouTube 인플루언서가 없습니다."); return; }
    setYtEmailLoading(true);
    try {
      const res = await fetch("/api/extract/youtube-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ influencer_ids: ytIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.existing_job_id) {
          toast("이미 실행 중인 추출이 있습니다. 결과를 기다리는 중...", { duration: 5000 });
          startYtEmailPolling(data.existing_job_id, ytIds.length);
          return;
        }
        toast.error(data.error ?? "YouTube 이메일 추출 실패");
        setYtEmailLoading(false);
        return;
      }
      toast(`YouTube 이메일 추출 중: ${data.total_channels}채널 ($${(data.total_channels * 0.005).toFixed(3)})`, { duration: 5000 });
      startYtEmailPolling(data.job_id, data.total_channels);
    } catch {
      toast.error("YouTube 이메일 추출 요청 실패");
      setYtEmailLoading(false);
    }
  }

  async function handleSingleYtEmail(influencerId: string, username: string | null) {
    try {
      const res = await fetch("/api/extract/youtube-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ influencer_ids: [influencerId] }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.existing_job_id) {
          toast("이미 실행 중인 추출이 있습니다. 결과를 기다리는 중...", { duration: 5000 });
          startYtEmailPolling(data.existing_job_id, 1);
          return;
        }
        toast.error(data.error ?? "이메일 추출 실패");
        return;
      }
      toast(`${username ?? "YouTube"} 이메일 추출 중... ($0.005)`, { duration: 5000 });
      startYtEmailPolling(data.job_id, 1);
    } catch {
      toast.error("이메일 추출 요청 실패");
    }
  }

  async function fetchEnrichStats() {
    try {
      const res = await fetch("/api/import/enrich-batch");
      if (res.ok) {
        const data = await res.json();
        setEnrichStats(data);
      }
    } catch {
      // silent fail
    }
  }

  async function handleStartEnrichment(priority: "high" | "all") {
    setEnriching(true);
    try {
      const res = await fetch("/api/import/enrich-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          min_followers: priority === "high" ? 10000 : 0,
          priority,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(`보강 실패: ${result.error}`);
        return;
      }

      if (result.remaining === 0 && result.count === undefined) {
        toast.info(result.message);
        return;
      }

      toast.success(`${result.count}명 프로필 보강 시작! (남은: ${result.remaining?.toLocaleString() ?? "?"}명)`);
      fetchEnrichStats();
    } catch (err) {
      toast.error("보강 요청 실패");
    } finally {
      setEnriching(false);
    }
  }

  async function handleExcelImport(file: File) {
    setImporting(true);
    setImportProgress("파일 업로드 중...");
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      setImportProgress("엑셀 파싱 및 임포트 진행 중...");

      const res = await fetch("/api/import/excel", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(`임포트 실패: ${result.error}`);
        setImportProgress("");
        return;
      }

      setImportResult(result.stats);
      setImportProgress("완료!");
      toast.success(`${result.stats.upserted.toLocaleString()}명 임포트 완료!`);

      // Refresh data
      fetchInfluencers();
      fetchPlatformCounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      toast.error(`임포트 실패: ${msg}`);
      setImportProgress("");
    } finally {
      setImporting(false);
    }
  }

  // CSV functions
  function handleCsvTemplateDownload() {
    const plat = platformFilter;
    window.open(`/api/csv/template?platform=${plat}`, "_blank");
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    try {
      const plat = platformFilter;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("platform", plat);
      const response = await fetch("/api/csv/import", { method: "POST", body: formData });
      const result = await response.json();
      if (response.ok) {
        toast.success(`CSV 가져오기 완료: ${result.upserted}건 ${result.errors > 0 ? `(오류 ${result.errors}건)` : ""}`);
        fetchInfluencers();
        fetchPlatformCounts();
      } else {
        toast.error("CSV 가져오기 실패: " + result.error);
      }
    } catch {
      toast.error("CSV 가져오기 중 오류가 발생했습니다.");
    } finally {
      setCsvImporting(false);
      if (csvFileRef.current) csvFileRef.current.value = "";
    }
  }

  async function handleCsvExport(exportPlatform?: string) {
    setCsvExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("platform", exportPlatform ?? platformFilter);
      if (searchQuery) params.set("search", searchQuery);
      if (emailFilter === "has") params.set("email", "with");
      else if (emailFilter === "none") params.set("email", "without");
      if (countryFilter) params.set("country", countryFilter);
      if (verifiedFilter !== "all") params.set("verified", verifiedFilter);
      if (followerMin) params.set("follower_min", followerMin);
      if (followerMax) params.set("follower_max", followerMax);
      window.open(`/api/csv/export?${params.toString()}`, "_blank");
    } finally {
      setCsvExporting(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize);
  const totalAll = Object.values(platformCounts).reduce((a, b) => a + b, 0);

  const columns = getColumnsForPlatform(platformFilter);
  const helpers: RenderHelpers = { formatCount, formatEngagement, getProfileUrl, getRawField, onYtEmail: handleSingleYtEmail };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">마스터 데이터</h1>
          {/* View mode toggle */}
          <div className="flex items-center border rounded-md">
            <button
              onClick={() => setViewMode("card")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-sm transition-colors rounded-l-md ${
                viewMode === "card"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="카드 뷰"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-sm transition-colors rounded-r-md ${
                viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="테이블 뷰"
            >
              <Table2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar - Left aligned, prominent */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleExcelImport(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="h-8 font-medium"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            )}
            {importing ? importProgress : "엑셀 임포트"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowEnrichPanel(!showEnrichPanel); if (!enrichStats) fetchEnrichStats(); }}
            className="h-8 font-medium"
          >
            <TrendingUp className="w-4 h-4 mr-1.5" />
            프로필 보강
          </Button>

          <div className="border-l h-5 mx-1" />

          <Button variant="outline" size="sm" onClick={handleCsvTemplateDownload} className="h-8 font-medium">
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            CSV 템플릿
          </Button>
          <input
            ref={csvFileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvImport}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => csvFileRef.current?.click()}
            disabled={csvImporting}
            className="h-8 font-medium"
          >
            {csvImporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
            CSV 가져오기
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                disabled={csvExporting}
                className="h-8 font-medium"
              >
                {csvExporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                CSV 내보내기
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => handleCsvExport(platformFilter)}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                현재 플랫폼 ({PLATFORMS.find(p => p.value === platformFilter)?.label ?? platformFilter})
                <span className="ml-auto text-xs text-muted-foreground">{total.toLocaleString()}건</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {PLATFORMS.map((p) => (
                <DropdownMenuItem key={p.value} onClick={() => handleCsvExport(p.value)}>
                  <span className={`w-2 h-2 rounded-full mr-2 ${
                    p.value === "instagram" ? "bg-gradient-to-r from-purple-500 to-pink-500" :
                    p.value === "tiktok" ? "bg-black dark:bg-white" :
                    p.value === "youtube" ? "bg-red-500" : "bg-blue-400"
                  }`} />
                  {p.label}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {(platformCounts[p.value] ?? 0).toLocaleString()}건
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleCsvExport("all")}>
                <Globe className="w-4 h-4 mr-2" />
                전체 플랫폼
                <span className="ml-auto text-xs text-muted-foreground">{totalAll.toLocaleString()}건</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  엑셀 임포트 완료
                </h3>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">전체 파싱</span>
                    <p className="font-bold">{importResult.total_parsed.toLocaleString()}명</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">중복 제거</span>
                    <p className="font-bold">{importResult.duplicates_removed.toLocaleString()}명</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">임포트</span>
                    <p className="font-bold text-green-700 dark:text-green-300">{importResult.upserted.toLocaleString()}명</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">오류</span>
                    <p className="font-bold">{importResult.errors.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {importResult.sheets.map((s) => (
                    <Badge key={s.sheet} variant="secondary" className="text-xs">
                      {s.sheet} ({s.country}): {s.rows.toLocaleString()}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setImportResult(null)}
                className="text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enrichment Dashboard Panel */}
      {showEnrichPanel && (
        <Card className="border-blue-200 dark:border-blue-900">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                프로필 보강 대시보드
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchEnrichStats}
                  className="text-xs"
                >
                  새로고침
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowEnrichPanel(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {enrichStats ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm mb-3">
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <span className="text-muted-foreground text-xs">전체 IG</span>
                    <p className="font-bold text-lg">{enrichStats.total.toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground text-xs">보강 완료</span>
                    <p className="font-bold text-lg text-green-700 dark:text-green-300">{enrichStats.enriched.toLocaleString()}</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground text-xs">미보강</span>
                    <p className="font-bold text-lg text-amber-700 dark:text-amber-300">{enrichStats.unenriched.toLocaleString()}</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground text-xs">10K+ 미보강</span>
                    <p className="font-bold text-lg text-purple-700 dark:text-purple-300">{enrichStats.high_priority_unenriched.toLocaleString()}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground text-xs">이메일 보유</span>
                    <p className="font-bold text-lg text-blue-700 dark:text-blue-300">{enrichStats.with_email.toLocaleString()}</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>보강률</span>
                    <span>{enrichStats.enrichment_rate}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${enrichStats.enrichment_rate}%` }}
                    />
                  </div>
                </div>
                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleStartEnrichment("high")}
                    disabled={enriching || enrichStats.high_priority_unenriched === 0}
                  >
                    {enriching ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5 mr-1.5" />}
                    10K+ 우선 보강 (200명)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartEnrichment("all")}
                    disabled={enriching || enrichStats.unenriched === 0}
                  >
                    {enriching ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Users className="w-3.5 h-3.5 mr-1.5" />}
                    전체 보강 (200명)
                  </Button>
                </div>
                {enrichStats.running_jobs.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {enrichStats.running_jobs.length}개 보강 작업 실행 중
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> 통계 로딩 중...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Overview - Platform Pill Buttons */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.value}
            onClick={() => { setPlatformFilter(p.value as PlatformFilter); setPage(0); setExpandedId(null); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
              platformFilter === p.value ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:border-primary/30 text-muted-foreground"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${PLATFORM_DOT_COLORS[p.value] ?? "bg-gray-400"}`} />
            {p.label} <span className="font-bold text-foreground">{(platformCounts[p.value] ?? 0).toLocaleString()}</span>
          </button>
        ))}
        <button
          onClick={() => { setEmailFilter(emailFilter === "has" ? "all" : "has"); setPage(0); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
            emailFilter === "has" ? "border-green-500 bg-green-50 text-green-700 font-medium" : "border-border hover:border-green-300 text-muted-foreground"
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          이메일 <span className="font-bold text-foreground">{emailCount.toLocaleString()}</span>
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="이름, 유저네임, 이메일 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 h-9"
          />
        </div>

        <Select value={emailFilter} onValueChange={(v) => { setEmailFilter(v); setPage(0); }}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue placeholder="이메일" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">이메일 전체</SelectItem>
            <SelectItem value="has">있음</SelectItem>
            <SelectItem value="none">없음</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="팔로워 min"
          value={followerMin}
          onChange={(e) => setFollowerMin(e.target.value)}
          className="w-24 h-9"
          type="number"
        />
        <Input
          placeholder="팔로워 max"
          value={followerMax}
          onChange={(e) => setFollowerMax(e.target.value)}
          className="w-24 h-9"
          type="number"
        />
        <Select value={countryFilter || "all"} onValueChange={(v) => { setCountryFilter(v === "all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue placeholder="국가" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">국가 전체</SelectItem>
            <SelectItem value="HK">HK 홍콩</SelectItem>
            <SelectItem value="MY">MY 말레이시아</SelectItem>
            <SelectItem value="SG">SG 싱가포르</SelectItem>
            <SelectItem value="TW">TW 대만</SelectItem>
            <SelectItem value="JP">JP 일본</SelectItem>
            <SelectItem value="KR">KR 한국</SelectItem>
            <SelectItem value="US">US 미국</SelectItem>
            <SelectItem value="GB">GB 영국</SelectItem>
            <SelectItem value="EN">EN 영미권</SelectItem>
            <SelectItem value="TH">TH 태국</SelectItem>
            <SelectItem value="PH">PH 필리핀</SelectItem>
            <SelectItem value="ID">ID 인도네시아</SelectItem>
            <SelectItem value="VN">VN 베트남</SelectItem>
            <SelectItem value="IN">IN 인도</SelectItem>
            <SelectItem value="AU">AU 호주</SelectItem>
          </SelectContent>
        </Select>

        <Select value={verifiedFilter} onValueChange={(v) => { setVerifiedFilter(v); setPage(0); }}>
          <SelectTrigger className="w-24 h-9">
            <SelectValue placeholder="인증" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">인증 전체</SelectItem>
            <SelectItem value="yes">인증만</SelectItem>
          </SelectContent>
        </Select>

        <Select value={businessFilter} onValueChange={(v) => { setBusinessFilter(v); setPage(0); }}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue placeholder="비즈니스" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">비즈니스 전체</SelectItem>
            <SelectItem value="yes">비즈니스만</SelectItem>
          </SelectContent>
        </Select>

        <Select value={enrichedFilter} onValueChange={(v) => { setEnrichedFilter(v); setPage(0); }}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue placeholder="보강상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">보강 전체</SelectItem>
            <SelectItem value="enriched">보강 완료</SelectItem>
            <SelectItem value="unenriched">미보강</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortField} onValueChange={(v) => { setSortField(v as SortField); setPage(0); }}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0"
          onClick={() => { setSortDir(sortDir === "desc" ? "asc" : "desc"); setPage(0); }}
          title={sortDir === "desc" ? "내림차순 (높은→낮은)" : "오름차순 (낮은→높은)"}
        >
          {sortDir === "desc" ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
        </Button>

        <Button variant="outline" size="sm" onClick={handleSearch} className="h-9">
          검색
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => {
            setEmailFilter("all"); setFollowerMin(""); setFollowerMax(""); setCountryFilter("");
            setPlatformFilter("instagram"); setSearchQuery(""); setPage(0); setSortField("created_at"); setSortDir("desc");
            setVerifiedFilter("all"); setBusinessFilter("all"); setCategoryFilter("");
            setEnrichedFilter("all"); setImportSourceFilter("");
            fetchInfluencers();
          }}
        >
          초기화
        </Button>
      </div>

      {/* Selection Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <UserCheck className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{selectedIds.size}명 선택됨</span>
          <div className="h-4 w-px bg-border" />
          <Select value={selectedCampaignId} onValueChange={handleCampaignSelect}>
            <SelectTrigger className="w-64 h-9">
              <SelectValue placeholder="캠페인 선택..." />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => {
                const tp = c.target_platforms ?? [];
                const tc = c.target_countries ?? [];
                return (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {(tp.length > 0 || tc.length > 0) && (
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {tp.length > 0 && `[${tp.map((p: string) => p === "instagram" ? "IG" : p === "tiktok" ? "TT" : p === "youtube" ? "YT" : "X").join(",")}]`}
                        {tc.length > 0 && ` ${tc.join(",")}`}
                      </span>
                    )}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {autoFilterActive && (
            <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 whitespace-nowrap">
              캠페인 타겟 필터 적용 중
            </Badge>
          )}
          <Button size="sm" onClick={handleAssignToCampaign} disabled={assigning || !selectedCampaignId}>
            {assigning ? "배정 중..." : "캠페인에 배정"}
          </Button>
          {influencers.some((inf) => inf.platform === "youtube" && selectedIds.has(inf.id)) && (
            <>
              <div className="h-4 w-px bg-border" />
              <Button
                size="sm"
                variant="outline"
                onClick={handleYtEmailExtraction}
                disabled={ytEmailLoading}
                className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
              >
                {ytEmailLoading ? "추출 중..." : "YT 이메일 추출"}
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => { setSelectedIds(new Set()); setSelectedCampaignId(""); setAutoFilterActive(false); }}>
            선택 해제
          </Button>
        </div>
      )}

      {/* Count + Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={(checked) => handleSelectAll(!!checked)}
            aria-label="전체 선택"
          />
          <span>총 <strong className="text-foreground">{total.toLocaleString()}</strong>명</span>
          {selectedIds.size > 0 && (
            <span className="text-xs text-primary font-medium ml-2">({selectedIds.size}명 선택)</span>
          )}
        </div>
        <div className="flex gap-1.5 items-center">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page === 0} onClick={() => setPage(0)}>처음</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>이전</Button>
          <div className="flex items-center gap-1 px-1">
            <Input
              type="number"
              min={1}
              max={totalPages || 1}
              value={page + 1}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= totalPages) setPage(val - 1);
              }}
              className="w-14 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-xs text-muted-foreground">/ {totalPages || 1}</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>다음</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>마지막</Button>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3 bg-card border rounded-lg animate-pulse">
              <div className="w-4 h-4 rounded bg-muted" />
              <div className="w-1.5 h-8 rounded-full bg-muted" />
              <div className="w-8 h-8 rounded-full bg-muted" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 bg-muted rounded w-32" />
                <div className="h-2.5 bg-muted rounded w-20" />
              </div>
              <div className="h-3 bg-muted rounded w-16" />
              <div className="h-3 bg-muted rounded w-12" />
              <div className="h-3 bg-muted rounded w-20" />
            </div>
          ))}
        </div>
      ) : influencers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">데이터가 없습니다.</div>
      ) : viewMode === "card" ? (
        /* ================================================================
         * CARD VIEW - Compact row style for bulk selection
         * ================================================================ */
        <div className="space-y-1.5">
          {influencers.map((inf) => {
            const infWithRaw = { ...inf, raw_data: rawDataCache[inf.id] ?? inf.raw_data ?? null } as Influencer;
            const contentPosts = getContentPosts(infWithRaw);
            const profileUrl = getProfileUrl(inf);
            const engagementVal = formatEngagement(inf.engagement_rate);
            const assignments = campaignAssignments[inf.id] ?? [];
            const kws = inf.extracted_keywords as string[] | null;
            const tags = inf.extracted_from_tags as string[] | null;
            const isExpanded = expandedId === inf.id;

            return (
              <div
                key={inf.id}
                className={`relative bg-card border rounded-lg overflow-hidden transition-all hover:shadow-sm ${
                  selectedIds.has(inf.id) ? "ring-2 ring-primary/40 bg-primary/[0.02]" : ""
                }`}
              >
                {/* Compact row */}
                <div className="flex items-center gap-3 px-3 py-2">
                  {/* Checkbox */}
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(inf.id)}
                      onCheckedChange={(checked) => handleSelectOne(inf.id, !!checked)}
                    />
                  </div>

                  {/* Platform color dot */}
                  <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${
                    inf.platform === "instagram" ? "bg-gradient-to-b from-purple-500 to-pink-500" :
                    inf.platform === "tiktok" ? "bg-black dark:bg-white" :
                    inf.platform === "youtube" ? "bg-red-500" :
                    inf.platform === "twitter" ? "bg-blue-400" : "bg-gray-400"
                  }`} />

                  {/* Profile image */}
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    {inf.profile_image_url ? (
                      <img
                        src={inf.profile_image_url}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-muted"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div className={`w-9 h-9 rounded-full bg-muted flex items-center justify-center ${inf.profile_image_url ? "hidden" : ""}`}>
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </a>

                  {/* Username + display name */}
                  <div className="min-w-0 w-40 flex-shrink-0">
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold hover:text-primary transition-colors truncate block"
                    >
                      @{inf.username ?? "-"}
                    </a>
                    {inf.display_name && inf.display_name !== inf.username && (
                      <p className="text-[11px] text-muted-foreground truncate">{inf.display_name}</p>
                    )}
                  </div>

                  {/* Stats inline */}
                  <div className="flex items-center gap-4 flex-shrink-0 text-sm">
                    <div className="w-16 text-right">
                      <span className="font-bold">{formatCount(inf.follower_count)}</span>
                      <span className="text-[10px] text-muted-foreground ml-0.5">팔</span>
                    </div>
                    {engagementVal && (
                      <span className="text-green-600 font-medium w-14 text-right">{engagementVal}</span>
                    )}
                    {inf.country && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{inf.country}</Badge>
                    )}
                  </div>

                  {/* Email */}
                  <div className="flex-1 min-w-0">
                    {inf.email ? (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-green-600 flex-shrink-0" />
                        <span className="text-xs text-green-700 dark:text-green-400 truncate font-medium">{inf.email}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">-</span>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {inf.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />}
                    {inf.is_business && <span className="text-[9px] px-1 py-0 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Biz</span>}
                    {inf.category && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[9px] px-1 py-0 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 truncate max-w-[60px]">{inf.category}</span>
                        </TooltipTrigger>
                        <TooltipContent>{inf.category}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Keywords compact */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {kws?.slice(0, 1).map((kw) => (
                      <span key={kw} className="text-[9px] bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300 px-1 rounded">{kw}</span>
                    ))}
                    {((kws?.length ?? 0) + (tags?.length ?? 0)) > 1 && (
                      <span className="text-[9px] text-muted-foreground">+{(kws?.length ?? 0) + (tags?.length ?? 0) - 1}</span>
                    )}
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => { const newId = isExpanded ? null : inf.id; setExpandedId(newId); if (newId) { fetchRawData(newId); ensureAssignmentsLoaded(); } }}
                    className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Expanded: bio + content grid + campaigns */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
                    {inf.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{inf.bio}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {assignments.map((a) => {
                        const fInfo = FUNNEL_STATUSES.find((f) => f.value === a.funnel_status);
                        return (
                          <a key={a.id} href={`/manage?campaign=${a.campaign_id}`} onClick={(e) => e.stopPropagation()}>
                            <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-accent transition-colors">
                              {a.name}
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: fInfo?.color ?? "#6B7280" }} />
                              <span style={{ color: fInfo?.color ?? "#6B7280" }}>{fInfo?.label ?? a.funnel_status}</span>
                            </Badge>
                          </a>
                        );
                      })}
                      {inf.email_source && (() => {
                        const badge = getEmailSourceBadge(inf.email_source);
                        return badge ? <span className={`text-[10px] px-1.5 py-0 rounded ${badge.className}`}>출처: {badge.label}</span> : null;
                      })()}
                      {inf.following_count !== null && <span className="text-[10px] text-muted-foreground">팔로잉 {formatCount(inf.following_count)}</span>}
                      {inf.post_count !== null && <span className="text-[10px] text-muted-foreground">게시물 {formatCount(inf.post_count)}</span>}
                    </div>
                    {contentPosts.length > 0 && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                      {contentPosts.slice(0, 12).map((post, idx) => {
                        const isVideo = post.type?.toLowerCase() === "video" || !!post.videoUrl;
                        return (
                          <div
                            key={idx}
                            className="group/thumb relative aspect-[4/5] bg-muted rounded-lg overflow-hidden"
                          >
                            {/* Video: show <video> with poster, Image: show <img> */}
                            {isVideo && post.videoUrl ? (
                              <video
                                src={post.videoUrl}
                                poster={post.imageUrl}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="none"
                                onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                                onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                onError={(e) => {
                                  // Fallback to poster image on video error
                                  const el = e.currentTarget;
                                  if (post.imageUrl) {
                                    const img = document.createElement("img");
                                    img.src = post.imageUrl;
                                    img.className = el.className;
                                    img.loading = "lazy";
                                    el.replaceWith(img);
                                  }
                                }}
                              />
                            ) : (
                              <img
                                src={post.imageUrl}
                                alt=""
                                className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  // CDN URL expired - show muted background
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            )}
                            {/* Hover overlay with engagement metrics */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-200 flex items-end p-2 pointer-events-none">
                              <div className="flex items-center gap-2.5 text-white text-xs">
                                {post.likes !== undefined && (
                                  <span className="flex items-center gap-1">
                                    <Heart className="w-3 h-3 fill-current" />{formatCount(post.likes)}
                                  </span>
                                )}
                                {post.comments !== undefined && (
                                  <span className="flex items-center gap-1">
                                    <MessageCircle className="w-3 h-3" />{formatCount(post.comments)}
                                  </span>
                                )}
                                {post.views !== undefined && (
                                  <span className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />{formatCount(post.views)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Video indicator */}
                            {isVideo && (
                              <div className="absolute top-1.5 right-1.5 pointer-events-none">
                                <div className="bg-black/60 rounded-full p-1">
                                  <Play className="w-3 h-3 text-white fill-white" />
                                </div>
                              </div>
                            )}
                            {/* Caption on hover */}
                            {post.caption && (
                              <div className="absolute top-0 left-0 right-0 p-2 opacity-0 group-hover/thumb:opacity-100 transition-opacity pointer-events-none">
                                <p className="text-[10px] text-white line-clamp-2 drop-shadow-lg">{post.caption.slice(0, 80)}</p>
                              </div>
                            )}
                            {/* Click to open modal */}
                            <button
                              className="absolute inset-0 z-10 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); setModalPost(post); }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* No content placeholder */}
                  {contentPosts.length === 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 px-4 bg-muted/30 rounded-lg">
                      <ImageIcon className="w-4 h-4" />
                      콘텐츠 데이터 없음 — 프로필 보강 후 표시됩니다
                    </div>
                  )}
                </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ================================================================
         * TABLE VIEW (existing)
         * ================================================================ */
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[1400px] compact-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                  </TableHead>
                  {columns.map((col) => {
                    const dbCol = COLUMN_SORT_MAP[col.key];
                    const isSortable = !!dbCol;
                    const isActive = sortField === dbCol;
                    return (
                      <TableHead
                        key={col.key}
                        className={`${col.width ?? ""} ${isSortable ? "cursor-pointer select-none hover:bg-muted/50 transition-colors" : ""}`}
                        onClick={isSortable ? () => {
                          if (isActive) {
                            setSortDir(sortDir === "desc" ? "asc" : "desc");
                          } else {
                            setSortField(dbCol);
                            setSortDir("desc");
                          }
                          setPage(0);
                        } : undefined}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {isSortable && (
                            isActive ? (
                              sortDir === "asc"
                                ? <ArrowUp className="w-3 h-3 text-primary flex-shrink-0" />
                                : <ArrowDown className="w-3 h-3 text-primary flex-shrink-0" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                            )
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {influencers.map((inf) => (
                  <Fragment key={inf.id}>
                    {/* Main compact row */}
                    <TableRow
                      className={`cursor-pointer ${selectedIds.has(inf.id) ? "bg-primary/5" : ""} ${expandedId === inf.id ? "border-b-0 bg-muted/30" : ""}`}
                      onClick={(e) => {
                        // Don't toggle expand if clicking checkbox
                        if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
                        if ((e.target as HTMLElement).closest("a")) return;
                        const newId = expandedId === inf.id ? null : inf.id;
                        setExpandedId(newId);
                        if (newId) { fetchRawData(newId); ensureAssignmentsLoaded(); }
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(inf.id)}
                          onCheckedChange={(checked) => handleSelectOne(inf.id, !!checked)}
                        />
                      </TableCell>
                      {columns.map((col) => (
                        <TableCell key={col.key}>
                          {col.render(inf, helpers)}
                        </TableCell>
                      ))}
                      <TableCell>
                        {expandedId === inf.id ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {expandedId === inf.id && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={columns.length + 2} className="p-0">
                          <ExpandedDetail
                            inf={{ ...inf, raw_data: rawDataCache[inf.id] ?? inf.raw_data ?? null } as Influencer}
                            links={influencerLinks[inf.id] ?? []}
                            assignments={campaignAssignments[inf.id] ?? []}
                            formatCount={formatCount}
                            onOpenModal={setModalPost}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Bottom pagination */}
      {!loading && influencers.length > 0 && (
        <div className="flex justify-center gap-2 pb-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>이전</Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">{page + 1} / {totalPages || 1}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>다음</Button>
        </div>
      )}

      {/* Mobile-style Video/Image Modal */}
      {modalPost && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setModalPost(null)}
        >
          <div
            className="relative bg-black rounded-3xl overflow-hidden shadow-2xl max-w-[380px] w-full"
            style={{ maxHeight: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Phone-style top bar */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
              <span className="text-white text-sm font-medium truncate max-w-[200px]">
                {modalPost.caption?.slice(0, 40) || "콘텐츠"}
              </span>
              <button
                onClick={() => setModalPost(null)}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="aspect-[9/16] bg-black flex items-center justify-center">
              {(modalPost.type?.toLowerCase() === "video" || modalPost.videoUrl) && modalPost.videoUrl ? (
                <video
                  src={modalPost.videoUrl}
                  poster={modalPost.imageUrl}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  playsInline
                  onError={(e) => {
                    // Fallback to image on video error
                    const el = e.currentTarget;
                    if (modalPost.imageUrl) {
                      const img = document.createElement("img");
                      img.src = modalPost.imageUrl;
                      img.className = "w-full h-full object-contain";
                      el.replaceWith(img);
                    }
                  }}
                />
              ) : modalPost.imageUrl ? (
                <img
                  src={modalPost.imageUrl}
                  alt=""
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-white/50 text-sm">미리보기 없음</div>
              )}
            </div>

            {/* Bottom metrics bar */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center gap-4 text-white text-sm">
                {modalPost.likes !== undefined && (
                  <span className="flex items-center gap-1.5">
                    <Heart className="w-4 h-4 fill-current" />{formatCount(modalPost.likes)}
                  </span>
                )}
                {modalPost.comments !== undefined && (
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4" />{formatCount(modalPost.comments)}
                  </span>
                )}
                {modalPost.views !== undefined && (
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4" />{formatCount(modalPost.views)}
                  </span>
                )}
                {modalPost.url && (
                  <a
                    href={modalPost.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-1 text-white/80 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="text-xs">원본</span>
                  </a>
                )}
              </div>
              {modalPost.caption && (
                <p className="text-white/80 text-xs mt-2 line-clamp-3 leading-relaxed">{modalPost.caption}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded Detail Component
// ---------------------------------------------------------------------------

function ExpandedDetail({
  inf,
  links,
  assignments,
  formatCount,
  onOpenModal,
}: {
  inf: Influencer;
  links: InfluencerLink[];
  assignments: CampaignAssignment[];
  formatCount: (n: number | null) => string;
  onOpenModal?: (post: ContentPost) => void;
}) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const contentPosts = getContentPosts(inf);
  const raw = inf.raw_data as Record<string, unknown> | null;
  const profileUrl = getProfileUrl(inf);

  const handleCopyEmail = () => {
    if (inf.email) {
      navigator.clipboard.writeText(inf.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <div className="px-6 py-5 space-y-5 border-t border-dashed border-border/50">
      {/* Top section: Profile + Info + Stats */}
      <div className="flex gap-6">
        {/* Profile image */}
        <div className="flex-shrink-0">
          {inf.profile_image_url ? (
            <img
              src={inf.profile_image_url}
              alt=""
              className="w-20 h-20 rounded-full object-cover ring-2 ring-muted"
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`w-20 h-20 rounded-full bg-muted flex items-center justify-center ${inf.profile_image_url ? "hidden" : ""}`}>
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">{inf.display_name ?? inf.username ?? "-"}</h3>
            <Badge
              variant="outline"
              className={`text-xs ${PLATFORM_BADGE_COLORS[inf.platform] ?? ""}`}
            >
              {PLATFORMS.find((p) => p.value === inf.platform)?.label ?? inf.platform}
            </Badge>
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              @{inf.username} <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Metrics row */}
          <div className="flex flex-wrap gap-4 text-sm">
            {inf.follower_count !== null && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-medium">{formatCount(inf.follower_count)}</span>
                <span className="text-muted-foreground text-xs">팔로워</span>
              </div>
            )}
            {inf.following_count !== null && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{formatCount(inf.following_count)}</span>
                <span className="text-muted-foreground text-xs">팔로잉</span>
              </div>
            )}
            {inf.post_count !== null && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{formatCount(inf.post_count)}</span>
                <span className="text-muted-foreground text-xs">게시물</span>
              </div>
            )}
            {inf.engagement_rate !== null && (
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                <span className="font-medium text-green-600">{(Number(inf.engagement_rate) * 100).toFixed(1)}%</span>
                <span className="text-muted-foreground text-xs">참여율</span>
              </div>
            )}
            {inf.country && (
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{inf.country}</span>
              </div>
            )}
            {inf.language && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs">언어:</span>
                <span>{inf.language}</span>
              </div>
            )}
          </div>

          {/* Email */}
          {inf.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-green-500" />
              <span className="text-sm">{inf.email}</span>
              {inf.email_source && (() => {
                const badge = getEmailSourceBadge(inf.email_source);
                return badge ? (
                  <span className={`text-[10px] px-1.5 py-0 rounded ${badge.className}`}>{badge.label}</span>
                ) : null;
              })()}
              <button
                onClick={handleCopyEmail}
                className="p-1 rounded hover:bg-muted transition-colors"
                title="이메일 복사"
              >
                {copiedEmail ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
            </div>
          )}

          {/* Personal Info (real_name, birth_date, phone) */}
          {(inf.real_name || inf.birth_date || inf.phone) && (
            <div className="flex items-center gap-3 text-sm">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              {inf.real_name && <span className="font-medium">{inf.real_name}</span>}
              {inf.birth_date && <span className="text-muted-foreground">{new Date(inf.birth_date).toLocaleDateString("ko-KR")}</span>}
              {inf.phone && <span className="text-muted-foreground">{inf.phone}</span>}
            </div>
          )}

          {/* Bio */}
          {inf.bio && (
            <div className="text-sm text-muted-foreground leading-relaxed max-w-2xl whitespace-pre-wrap">
              {inf.bio}
            </div>
          )}
        </div>
      </div>

      {/* Keywords & Tags */}
      {((inf.extracted_keywords as string[] | null)?.length || (inf.extracted_from_tags as string[] | null)?.length) ? (
        <div className="flex flex-wrap gap-1.5">
          {(inf.extracted_keywords as string[] | null)?.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-0.5 text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
              <Hash className="w-3 h-3" />{kw}
            </span>
          ))}
          {(inf.extracted_from_tags as string[] | null)?.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-0.5 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
              <Tag className="w-3 h-3" />{tag}
            </span>
          ))}
        </div>
      ) : null}

      {/* Collaboration History */}
      {assignments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" />
            협업 이력 ({assignments.length}개 캠페인)
          </h4>
          <div className="grid gap-2">
            {assignments.map((a) => {
              const funnelInfo = FUNNEL_STATUSES.find((f) => f.value === a.funnel_status);
              const funnelLabel = funnelInfo?.label ?? a.funnel_status;
              const funnelColor = funnelInfo?.color ?? "#6B7280";
              const isTerminal = a.funnel_status === "declined" || a.funnel_status === "dropped";
              const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" }) : null;
              const formatCurrency = (amount: number | null, currency: string | null) => {
                if (amount == null) return null;
                const c = currency ?? "KRW";
                return new Intl.NumberFormat("ko-KR", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(amount);
              };

              return (
                <div
                  key={a.id}
                  className={`border rounded-lg p-3 space-y-2 ${isTerminal ? "opacity-60 border-dashed" : "border-border"}`}
                >
                  {/* Campaign header row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <a
                        href={`/campaigns/${a.campaign_id}`}
                        className="font-medium text-sm hover:text-primary transition-colors truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {a.name}
                      </a>
                      {a.campaign_type && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${
                          a.campaign_type === "shipping"
                            ? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400"
                            : "border-green-300 text-green-600 dark:border-green-700 dark:text-green-400"
                        }`}>
                          {a.campaign_type === "shipping" ? "배송" : "방문"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{ borderColor: funnelColor, color: funnelColor }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: funnelColor }} />
                        {funnelLabel}
                      </Badge>
                      <a
                        href={`/manage?campaign=${a.campaign_id}`}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                        title="인플루언서 관리 페이지로 이동"
                      >
                        관리 <ArrowRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Detail grid */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {/* Outreach */}
                    {a.outreach_round > 0 && (
                      <span className="flex items-center gap-1">
                        <Send className="w-3 h-3" />
                        {a.outreach_round}차 발송
                        {a.last_outreach_at && ` (${formatDate(a.last_outreach_at)})`}
                      </span>
                    )}
                    {a.reply_date && (
                      <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                        <MessageCircle className="w-3 h-3" />
                        회신 {formatDate(a.reply_date)}
                      </span>
                    )}

                    {/* Confirmations */}
                    {a.interest_confirmed && (
                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                        <CheckCircle2 className="w-3 h-3" /> 희망회신
                      </span>
                    )}
                    {a.client_approved && (
                      <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                        <CheckCircle2 className="w-3 h-3" /> 거래처컨펌
                      </span>
                    )}
                    {a.final_confirmed && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> 최종확정
                      </span>
                    )}

                    {/* Dates */}
                    {a.visit_scheduled_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        방문 {formatDate(a.visit_scheduled_date)}
                        {a.visit_completed && " (완료)"}
                      </span>
                    )}
                    {a.upload_deadline && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        업로드마감 {formatDate(a.upload_deadline)}
                      </span>
                    )}
                    {a.actual_upload_date && (
                      <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                        <Upload className="w-3 h-3" />
                        업로드 {formatDate(a.actual_upload_date)}
                      </span>
                    )}
                    {a.upload_url && (
                      <a
                        href={a.upload_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" /> 콘텐츠 보기
                      </a>
                    )}

                    {/* Payment */}
                    {a.payment_amount != null && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        지급 {formatCurrency(a.payment_amount, a.payment_currency)}
                        {a.influencer_payment_status && a.influencer_payment_status !== "unpaid" && (
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ml-0.5 ${
                            a.influencer_payment_status === "paid"
                              ? "border-green-300 text-green-600"
                              : "border-amber-300 text-amber-600"
                          }`}>
                            {a.influencer_payment_status === "paid" ? "완료" : "진행중"}
                          </Badge>
                        )}
                      </span>
                    )}

                    {/* Assigned date */}
                    <span className="flex items-center gap-1">
                      배정일 {formatDate(a.created_at)}
                    </span>
                  </div>

                  {/* Notes */}
                  {a.notes && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 truncate" title={a.notes}>
                      {a.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Links */}
      {links.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">바이오 링크</h4>
          <div className="flex flex-wrap gap-2">
            {links.map((link) => {
              let hostname = "";
              try { hostname = new URL(link.url).hostname.replace("www.", ""); } catch { hostname = link.url; }
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full transition-colors"
                  title={link.url}
                >
                  <Link2 className="w-3 h-3" />
                  {hostname}
                  {link.scraped && link.emails_found?.length ? (
                    <Mail className="w-3 h-3 text-green-500" />
                  ) : link.scraped ? (
                    <X className="w-3 h-3 text-red-400" />
                  ) : null}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Content Preview Grid - with video playback */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          콘텐츠 미리보기 ({contentPosts.length}개)
        </h4>
        {contentPosts.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {contentPosts.map((post, idx) => {
              const isVid = post.type?.toLowerCase() === "video" || !!post.videoUrl;
              return (
                <div
                  key={idx}
                  className="group/thumb relative aspect-square bg-muted rounded-lg overflow-hidden"
                >
                  {isVid && post.videoUrl ? (
                    <video
                      src={post.videoUrl}
                      poster={post.imageUrl}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="none"
                      onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                      onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                      onError={(e) => {
                        const el = e.currentTarget;
                        if (post.imageUrl) {
                          const img = document.createElement("img");
                          img.src = post.imageUrl;
                          img.className = el.className;
                          img.loading = "lazy";
                          el.replaceWith(img);
                        }
                      }}
                    />
                  ) : (
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  {/* Overlay with metrics */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-end p-1.5 pointer-events-none">
                    <div className="flex items-center gap-2 text-white text-xs">
                      {post.likes !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <Heart className="w-3 h-3 fill-current" />{formatCount(post.likes)}
                        </span>
                      )}
                      {post.comments !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <MessageCircle className="w-3 h-3" />{formatCount(post.comments)}
                        </span>
                      )}
                      {post.views !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <Eye className="w-3 h-3" />{formatCount(post.views)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Video indicator */}
                  {isVid && (
                    <div className="absolute top-1 right-1 pointer-events-none">
                      <div className="bg-black/60 rounded-full p-0.5">
                        <Play className="w-3 h-3 text-white fill-white" />
                      </div>
                    </div>
                  )}
                  {/* Click to open modal */}
                  <button
                    className="absolute inset-0 z-10 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onOpenModal?.(post); }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 px-4 bg-muted/30 rounded-lg">
            <ImageIcon className="w-4 h-4" />
            콘텐츠 데이터가 없습니다. 추출을 다시 실행해주세요.
          </div>
        )}
      </div>

      {/* Detail Tabs: Brand Collaborations, Commerce, Analytics */}
      <InfluencerDetailTabs influencerId={inf.id} />

      {/* Raw data preview (collapsed by default) */}
      {raw && <RawDataPreview raw={raw} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Raw Data Preview (toggle)
// ---------------------------------------------------------------------------

function RawDataPreview({ raw }: { raw: Record<string, unknown> }) {
  const [showRaw, setShowRaw] = useState(false);

  // Pick some interesting fields to show
  const previewKeys = Object.keys(raw).filter(
    (k) => !["latestPosts", "posts", "media"].includes(k)
  ).slice(0, 20);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowRaw(!showRaw)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
      >
        {showRaw ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        원본 데이터 (raw_data)
      </button>
      {showRaw && (
        <div className="bg-muted/50 rounded-lg p-4 overflow-x-auto max-h-[400px] overflow-y-auto">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
            {JSON.stringify(
              Object.fromEntries(previewKeys.map((k) => [k, raw[k]])),
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
