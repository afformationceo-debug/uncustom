"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Users,
  Heart,
  MessageCircle,
  Eye as EyeIcon,
  BarChart3,
  TrendingUp,
  Calendar,
  Loader2,
  Hash,
  FileVideo,
  Handshake,
  Globe,
  RefreshCw,
  Search,
  UserPlus,
  CheckCircle,
  Briefcase,
  Link2,
  Share2,
  Bookmark,
  FileText,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { PLATFORMS } from "@/types/platform";
import { useRealtime } from "@/hooks/use-realtime";

type BrandAccount = Tables<"brand_accounts">;
type BrandInfluencerContent = Tables<"brand_influencer_contents">;
type BrandInfluencerRelationship = Tables<"brand_influencer_relationships">;
type BrandAccountAnalysis = Tables<"brand_account_analysis">;

const PLATFORM_BADGE: Record<string, string> = {
  instagram:
    "bg-pink-500/10 text-pink-600 border-pink-200 dark:border-pink-800",
  tiktok:
    "bg-gray-500/10 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700",
  youtube: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800",
  twitter: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
};

const POSTING_FREQ_LABEL: Record<string, string> = {
  daily: "매일",
  several_per_week: "주 3-6회",
  weekly: "주 1회",
  biweekly: "2주 1회",
  monthly_or_less: "월 1회 이하",
};

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getProfileUrl(username: string, platform: string): string {
  switch (platform) {
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

export default function BrandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [brand, setBrand] = useState<BrandAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  // Job polling
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [jobType, setJobType] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tab data
  const [contents, setContents] = useState<BrandInfluencerContent[]>([]);
  const [relationships, setRelationships] = useState<
    (BrandInfluencerRelationship & { influencer?: { username: string | null; display_name: string | null; profile_image_url: string | null; follower_count: number | null; platform: string } })[]
  >([]);
  const [analyses, setAnalyses] = useState<BrandAccountAnalysis[]>([]);
  const [contentsLoading, setContentsLoading] = useState(false);
  const [relationshipsLoading, setRelationshipsLoading] = useState(false);

  useEffect(() => {
    if (id) fetchBrand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const realtimeCallback = useCallback(() => {
    fetchBrand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useRealtime("brand_accounts", `id=eq.${id}`, realtimeCallback);

  async function fetchBrand() {
    setLoading(true);
    const res = await fetch(`/api/brands/${id}`);
    if (res.ok) {
      const data = await res.json();
      setBrand(data as BrandAccount);
    } else {
      toast.error("브랜드 정보를 불러올 수 없습니다");
      router.push("/brands");
    }
    setLoading(false);
  }

  async function fetchContents() {
    setContentsLoading(true);
    const { data, error } = await supabase
      .from("brand_influencer_contents")
      .select("*")
      .eq("brand_account_id", id)
      .order("posted_at", { ascending: false })
      .limit(500);

    if (!error && data) {
      setContents(data as BrandInfluencerContent[]);
    }
    setContentsLoading(false);
  }

  async function fetchRelationships() {
    setRelationshipsLoading(true);
    const { data, error } = await supabase
      .from("brand_influencer_relationships")
      .select("*, influencer:influencers(username, display_name, profile_image_url, follower_count, platform)")
      .eq("brand_account_id", id)
      .order("relationship_strength_score", { ascending: false })
      .limit(500);

    if (!error && data) {
      setRelationships(
        data as unknown as (BrandInfluencerRelationship & {
          influencer?: {
            username: string | null;
            display_name: string | null;
            profile_image_url: string | null;
            follower_count: number | null;
            platform: string;
          };
        })[]
      );
    }
    setRelationshipsLoading(false);
  }

  async function fetchAnalyses() {
    const { data, error } = await supabase
      .from("brand_account_analysis")
      .select("*")
      .eq("brand_account_id", id)
      .order("analysis_period_end", { ascending: false })
      .limit(20);

    if (!error && data) {
      setAnalyses(data as BrandAccountAnalysis[]);
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(jobId: string, jType: string) {
    setActiveJobId(jobId);
    setJobStatus("running");
    setJobProgress(0);
    setJobType(jType);

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/extract/status?job_id=${jobId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setJobStatus("completed");
          setActiveJobId(null);
          setJobType(null);

          if (jType === "brand_profile") {
            const summary = data.profile_summary;
            toast.success(
              `프로필 분석 완료! 팔로워: ${formatNumber(summary?.follower_count)}, 참여율: ${summary?.engagement_rate ? `${Number(summary.engagement_rate).toFixed(2)}%` : '-'}${data.discover_job_id ? " → 콘텐츠 발견 자동 시작" : ""}`
            );
            fetchBrand();
            fetchAnalyses();
            if (data.discover_job_id) {
              startPolling(data.discover_job_id, "brand_tagged_content");
            }
          } else if (jType === "brand_tagged_content") {
            toast.success(`콘텐츠 발견 완료! ${data.total_extracted ?? 0}개 콘텐츠, ${data.new_relationships ?? 0}개 인플루언서`);
            fetchContents();
            fetchRelationships();
          }
        } else if (data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setJobStatus("failed");
          setActiveJobId(null);
          setJobType(null);
          toast.error(`작업 실패: ${data.error || "알 수 없는 오류"}`);
        } else {
          setJobProgress(data.total_extracted || 0);
        }
      } catch {
        // Network error — keep polling
      }
    }, 5000);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/brands/${id}/analyze`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success("프로필 분석 시작됨 (Apify 실행 중...)");
        if (data.job_id) {
          startPolling(data.job_id, "brand_profile");
        }
        fetchBrand();
      } else {
        const err = await res.json();
        toast.error(`분석 실패: ${err.error}`);
      }
    } catch {
      toast.error("분석 중 오류 발생");
    }
    setAnalyzing(false);
  }

  async function handleDiscoverContent() {
    setDiscovering(true);
    try {
      const res = await fetch(`/api/brands/${id}/discover-content`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success("콘텐츠 발견 시작됨 (Apify 실행 중...)");
        if (data.job_id) {
          startPolling(data.job_id, "brand_tagged_content");
        }
      } else {
        const err = await res.json();
        toast.error(`콘텐츠 발견 실패: ${err.error}`);
      }
    } catch {
      toast.error("콘텐츠 발견 중 오류 발생");
    }
    setDiscovering(false);
  }

  function handleTabChange(value: string) {
    if (value === "content" && contents.length === 0) {
      fetchContents();
    } else if (value === "influencers" && relationships.length === 0) {
      fetchRelationships();
    } else if (value === "overview" && analyses.length === 0) {
      fetchAnalyses();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        브랜드를 찾을 수 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/brands">
          <Button variant="ghost" size="sm" className="mt-1">
            <ArrowLeft className="w-4 h-4 mr-1" />
            목록
          </Button>
        </Link>

        <div className="flex items-center gap-4 flex-1">
          {brand.profile_image_url ? (
            <img
              src={brand.profile_image_url}
              alt={brand.username}
              className="w-16 h-16 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-border">
              <Building2 className="w-7 h-7 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold truncate">
                {brand.brand_name || brand.display_name || brand.username}
              </h1>
              <Badge
                variant="outline"
                className={`text-xs ${PLATFORM_BADGE[brand.platform] ?? ""}`}
              >
                {PLATFORMS.find((p) => p.value === brand.platform)?.label ??
                  brand.platform}
              </Badge>
              {brand.is_verified && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <CheckCircle className="w-3 h-3" />
                  인증됨
                </Badge>
              )}
              {brand.is_business_account && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Briefcase className="w-3 h-3" />
                  비즈니스
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <a
                href={getProfileUrl(brand.username, brand.platform)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                @{brand.username}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {brand.display_name && brand.display_name !== brand.brand_name && (
                <span className="text-xs text-muted-foreground">{brand.display_name}</span>
              )}
              {brand.industry && (
                <Badge variant="secondary" className="text-xs">
                  {brand.industry}
                </Badge>
              )}
              {brand.business_category && (
                <Badge variant="outline" className="text-xs">
                  {brand.business_category}
                </Badge>
              )}
              {brand.target_countries && brand.target_countries.length > 0 && (
                <div className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {brand.target_countries.join(", ")}
                  </span>
                </div>
              )}
              {brand.external_url && (
                <a
                  href={brand.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                  <Link2 className="w-3 h-3" />
                  {brand.external_url.replace(/^https?:\/\//, "").slice(0, 30)}
                </a>
              )}
            </div>
            {brand.biography && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 max-w-2xl">
                {brand.biography}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={handleDiscoverContent}
              disabled={discovering || !!activeJobId}
            >
              {discovering ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Search className="w-4 h-4 mr-1.5" />
              )}
              콘텐츠 발견
            </Button>
            <Button onClick={handleAnalyze} disabled={analyzing || !!activeJobId}>
              {analyzing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1.5" />
              )}
              프로필 분석
            </Button>
          </div>
        </div>
      </div>

      {/* Job Progress Banner */}
      {activeJobId && jobStatus === "running" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">
              {jobType === "brand_profile" ? "프로필 분석" : "콘텐츠 발견"} 실행 중...{" "}
              {jobProgress > 0 && `(${jobProgress}개 항목 수집됨)`}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Restricted Profile Warning */}
      {(() => {
        const raw = brand.raw_profile_data as Record<string, unknown> | null;
        if (!raw || typeof raw !== "object" || Array.isArray(raw) || !raw.isRestrictedProfile) return null;
        const reason = String(raw.restrictionReason || "Instagram이 이 프로필의 상세 데이터 접근을 제한하고 있습니다.");
        return (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-3 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-amber-700 dark:text-amber-400">제한된 프로필</span>
                <span className="text-muted-foreground ml-2">
                  {reason} 팔로워 수, 게시물 등 일부 메트릭이 표시되지 않을 수 있습니다.
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Key Metrics - 10 cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Users className="w-3.5 h-3.5" />
              <span className="text-[10px]">팔로워</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {formatNumber(brand.follower_count)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <UserPlus className="w-3.5 h-3.5" />
              <span className="text-[10px]">팔로잉</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {formatNumber(brand.following_count)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-[10px]">참여율</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {brand.engagement_rate != null
                ? `${Number(brand.engagement_rate).toFixed(2)}%`
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Heart className="w-3.5 h-3.5" />
              <span className="text-[10px]">평균 좋아요</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {formatNumber(brand.avg_likes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="text-[10px]">평균 댓글</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {formatNumber(brand.avg_comments)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <EyeIcon className="w-3.5 h-3.5" />
              <span className="text-[10px]">평균 조회수</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {formatNumber(brand.avg_views)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Share2 className="w-3.5 h-3.5" />
              <span className="text-[10px]">평균 공유</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {formatNumber(brand.avg_shares)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Bookmark className="w-3.5 h-3.5" />
              <span className="text-[10px]">평균 저장</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {formatNumber(brand.avg_saves)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <FileVideo className="w-3.5 h-3.5" />
              <span className="text-[10px]">게시물 수</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {formatNumber(brand.post_count)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Activity className="w-3.5 h-3.5" />
              <span className="text-[10px]">품질 점수</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {brand.audience_quality_score != null
                ? Number(brand.audience_quality_score).toFixed(1)
                : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            개요
          </TabsTrigger>
          <TabsTrigger value="content">
            <FileVideo className="w-4 h-4 mr-1.5" />
            콘텐츠 피드
            {contents.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{contents.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="influencers">
            <Handshake className="w-4 h-4 mr-1.5" />
            인플루언서
            {relationships.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{relationships.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="competitors">
            <Building2 className="w-4 h-4 mr-1.5" />
            경쟁사
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Brand Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">브랜드 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <span className="text-muted-foreground text-xs">브랜드명</span>
                    <p className="font-medium">{brand.brand_name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">브랜드 그룹</span>
                    <p className="font-medium">{brand.brand_group || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">업종</span>
                    <p className="font-medium">{brand.industry || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">서브 카테고리</span>
                    <p className="font-medium">{brand.sub_category || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">비즈니스 카테고리</span>
                    <p className="font-medium">{brand.business_category || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">인증 상태</span>
                    <p className="font-medium">
                      {brand.is_verified ? "✓ 인증됨" : "-"}{" "}
                      {brand.is_business_account ? "/ 비즈니스" : ""}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">콘텐츠 빈도</span>
                    <p className="font-medium">
                      {brand.posting_frequency
                        ? POSTING_FREQ_LABEL[brand.posting_frequency] || brand.posting_frequency
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">품질 점수</span>
                    <p className="font-medium">
                      {brand.audience_quality_score != null
                        ? `${Number(brand.audience_quality_score).toFixed(1)} / 100`
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">자동 분석</span>
                    <p className="font-medium">
                      {brand.analysis_enabled
                        ? `매 ${brand.analysis_interval_hours}시간`
                        : "비활성"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">타겟 국가</span>
                    <p className="font-medium">
                      {brand.target_countries?.length > 0
                        ? brand.target_countries.join(", ")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">타겟 인구통계</span>
                    <p className="font-medium">
                      {brand.target_demographics && typeof brand.target_demographics === "object" && !Array.isArray(brand.target_demographics)
                        ? Object.entries(brand.target_demographics as Record<string, unknown>)
                            .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                            .join(", ")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">캠페인 연결</span>
                    <p className="font-medium">{brand.campaign_id ? "연결됨" : "글로벌"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">다음 분석 예정</span>
                    <p className="font-medium">
                      {brand.next_analysis_at
                        ? new Date(brand.next_analysis_at).toLocaleDateString("ko-KR")
                        : "-"}
                    </p>
                  </div>
                </div>
                {brand.biography && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground text-xs">바이오</span>
                    <p className="mt-0.5 text-xs whitespace-pre-wrap">{brand.biography}</p>
                  </div>
                )}
                {brand.external_url && (
                  <div>
                    <span className="text-muted-foreground text-xs">외부 링크</span>
                    <p className="mt-0.5">
                      <a href={brand.external_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        {brand.external_url}
                      </a>
                    </p>
                  </div>
                )}
                {brand.brand_voice && (
                  <div>
                    <span className="text-muted-foreground text-xs">브랜드 보이스</span>
                    <p className="mt-0.5 text-xs">{brand.brand_voice}</p>
                  </div>
                )}
                {brand.notes && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground text-xs">메모</span>
                    <p className="mt-0.5 text-xs">{brand.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Content Analysis */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">콘텐츠 분석</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {brand.primary_content_types && brand.primary_content_types.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">주요 콘텐츠 유형</span>
                    <div className="flex flex-wrap gap-1.5">
                      {brand.primary_content_types.map((type, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">{type}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {brand.content_style && brand.content_style.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">콘텐츠 스타일</span>
                    <div className="flex flex-wrap gap-1.5">
                      {brand.content_style.map((style, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">{style}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {brand.top_hashtags && brand.top_hashtags.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">
                      주요 해시태그 ({brand.top_hashtags.length}개)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {brand.top_hashtags.slice(0, 20).map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs text-primary">
                          <Hash className="w-3 h-3 mr-0.5" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(!brand.primary_content_types || brand.primary_content_types.length === 0) &&
                  (!brand.top_hashtags || brand.top_hashtags.length === 0) && (
                    <div className="text-center py-6 text-muted-foreground">
                      <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">
                        분석 데이터가 없습니다. &quot;프로필 분석&quot; 버튼을 클릭하세요.
                      </p>
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Metrics Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">성과 요약</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1.5 text-sm">
                  {[
                    { label: "팔로워", value: formatNumber(brand.follower_count), icon: Users },
                    { label: "팔로잉", value: formatNumber(brand.following_count), icon: UserPlus },
                    { label: "참여율", value: brand.engagement_rate != null ? `${Number(brand.engagement_rate).toFixed(2)}%` : "-", icon: TrendingUp },
                    { label: "평균 좋아요", value: formatNumber(brand.avg_likes), icon: Heart },
                    { label: "평균 댓글", value: formatNumber(brand.avg_comments), icon: MessageCircle },
                    { label: "평균 조회수", value: formatNumber(brand.avg_views), icon: EyeIcon },
                    { label: "평균 공유", value: formatNumber(brand.avg_shares), icon: Share2 },
                    { label: "평균 저장", value: formatNumber(brand.avg_saves), icon: Bookmark },
                    { label: "게시물 수", value: formatNumber(brand.post_count), icon: FileVideo },
                    { label: "콘텐츠 빈도", value: brand.posting_frequency ? (POSTING_FREQ_LABEL[brand.posting_frequency] || brand.posting_frequency) : "-", icon: Calendar },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-xs">{label}</span>
                      </div>
                      <span className="font-medium tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analysis History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                분석 히스토리
                {analyses.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{analyses.length}회</Badge>
                )}
              </CardTitle>
            </CardHeader>
            {analyses.length > 0 ? (
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>기간</TableHead>
                      <TableHead>팔로워 변화</TableHead>
                      <TableHead>성장률</TableHead>
                      <TableHead>게시물 증감</TableHead>
                      <TableHead>평균 참여율</TableHead>
                      <TableHead>평균 좋아요</TableHead>
                      <TableHead>평균 댓글</TableHead>
                      <TableHead>평균 조회수</TableHead>
                      <TableHead>평균 공유</TableHead>
                      <TableHead>평균 저장</TableHead>
                      <TableHead>콘텐츠 유형</TableHead>
                      <TableHead>카테고리 분포</TableHead>
                      <TableHead>오디언스</TableHead>
                      <TableHead>해시태그</TableHead>
                      <TableHead>인플루언서 멘션</TableHead>
                      <TableHead>새 파트너</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyses.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(a.analysis_period_start).toLocaleDateString("ko-KR")}
                          {" ~ "}
                          {new Date(a.analysis_period_end).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {formatNumber(a.follower_count_start)} → {formatNumber(a.follower_count_end)}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {a.follower_growth_rate != null
                            ? `${Number(a.follower_growth_rate) > 0 ? "+" : ""}${Number(a.follower_growth_rate).toFixed(2)}%`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {a.post_count_delta != null ? (
                            <span className={Number(a.post_count_delta) > 0 ? "text-green-600 dark:text-green-400" : ""}>
                              {Number(a.post_count_delta) > 0 ? "+" : ""}{a.post_count_delta}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {a.avg_engagement_rate != null
                            ? `${Number(a.avg_engagement_rate).toFixed(2)}%`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {formatNumber(a.avg_likes)}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {formatNumber(a.avg_comments)}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {formatNumber(a.avg_views)}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {formatNumber(a.avg_shares)}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {formatNumber(a.avg_saves)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.content_type_breakdown && typeof a.content_type_breakdown === "object" && !Array.isArray(a.content_type_breakdown) ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(a.content_type_breakdown as Record<string, number>).map(([type, count]) => (
                                <Badge key={type} variant="outline" className="text-[10px]">{type}: {count}</Badge>
                              ))}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.content_category_breakdown && typeof a.content_category_breakdown === "object" && !Array.isArray(a.content_category_breakdown) ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(a.content_category_breakdown as Record<string, number>).slice(0, 3).map(([cat, count]) => (
                                <Badge key={cat} variant="secondary" className="text-[10px]">{cat}: {count}</Badge>
                              ))}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.audience_demographics && typeof a.audience_demographics === "object" && !Array.isArray(a.audience_demographics) ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(a.audience_demographics as Record<string, unknown>).slice(0, 2).map(([key, val]) => (
                                <Badge key={key} variant="outline" className="text-[9px]">{key}: {typeof val === "object" ? "..." : String(val)}</Badge>
                              ))}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.new_hashtags && a.new_hashtags.length > 0 ? (
                            <div className="flex flex-wrap gap-0.5 max-w-[100px]">
                              {a.new_hashtags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-[10px] text-primary">#{tag}</span>
                              ))}
                              {a.new_hashtags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{a.new_hashtags.length - 3}</span>
                              )}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {a.influencer_mentions_count ?? "-"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {a.new_influencer_partners ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            ) : (
              <CardContent className="py-6 text-center text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">분석 히스토리가 없습니다</p>
              </CardContent>
            )}
          </Card>

          {/* Timing info */}
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              등록일: {new Date(brand.created_at).toLocaleDateString("ko-KR")}
            </div>
            {brand.last_analyzed_at && (
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                마지막 분석: {new Date(brand.last_analyzed_at).toLocaleDateString("ko-KR")}
              </div>
            )}
            {brand.next_analysis_at && (
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                다음 분석: {new Date(brand.next_analysis_at).toLocaleDateString("ko-KR")}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Content Feed Tab */}
        <TabsContent value="content" className="space-y-4">
          {contentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : contents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileVideo className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-sm font-medium text-muted-foreground">
                  콘텐츠 데이터가 없습니다
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  &quot;콘텐츠 발견&quot; 버튼을 클릭하면 인플루언서 콘텐츠가 수집됩니다
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12" />
                      <TableHead className="min-w-[160px]">인플루언서</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead className="min-w-[200px]">캡션</TableHead>
                      <TableHead>조회수</TableHead>
                      <TableHead>좋아요</TableHead>
                      <TableHead>댓글</TableHead>
                      <TableHead>공유</TableHead>
                      <TableHead>저장</TableHead>
                      <TableHead>참여율</TableHead>
                      <TableHead>해시태그</TableHead>
                      <TableHead>멘션</TableHead>
                      <TableHead>멘션타입</TableHead>
                      <TableHead>스폰서</TableHead>
                      <TableHead>스폰서지표</TableHead>
                      <TableHead>감지상품</TableHead>
                      <TableHead>감성</TableHead>
                      <TableHead>게시일</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contents.map((content) => (
                      <TableRow key={content.id}>
                        <TableCell>
                          {content.thumbnail_url ? (
                            <img src={content.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <FileVideo className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">@{content.influencer_username || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{content.content_type || "-"}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="text-xs text-muted-foreground line-clamp-2">{content.caption || "-"}</span>
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{formatNumber(content.views_count)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatNumber(content.likes_count)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatNumber(content.comments_count)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatNumber(content.shares_count)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatNumber(content.saves_count)}</TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {content.engagement_rate != null ? `${Number(content.engagement_rate).toFixed(2)}%` : "-"}
                        </TableCell>
                        <TableCell>
                          {content.hashtags && content.hashtags.length > 0 ? (
                            <div className="flex flex-wrap gap-0.5 max-w-[120px]">
                              {content.hashtags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-[10px] text-primary">#{tag}</span>
                              ))}
                              {content.hashtags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{content.hashtags.length - 3}</span>
                              )}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {content.mentions && content.mentions.length > 0 ? (
                            <div className="flex flex-wrap gap-0.5 max-w-[100px]">
                              {content.mentions.slice(0, 2).map((m, i) => (
                                <span key={i} className="text-[10px] text-blue-600 dark:text-blue-400">@{m}</span>
                              ))}
                              {content.mentions.length > 2 && (
                                <span className="text-[10px] text-muted-foreground">+{content.mentions.length - 2}</span>
                              )}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {content.brand_mention_type ? (
                            <Badge variant="outline" className={`text-[10px] ${
                              content.brand_mention_type === "tagged"
                                ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400"
                                : "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-400"
                            }`}>{content.brand_mention_type}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {content.is_sponsored ? (
                            <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400">스폰서</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">오가닉</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {content.sponsorship_indicators && content.sponsorship_indicators.length > 0 ? (
                            <div className="flex flex-wrap gap-0.5 max-w-[100px]">
                              {content.sponsorship_indicators.slice(0, 2).map((s, i) => (
                                <Badge key={i} variant="secondary" className="text-[9px] px-1">{s}</Badge>
                              ))}
                              {content.sponsorship_indicators.length > 2 && (
                                <span className="text-[10px] text-muted-foreground">+{content.sponsorship_indicators.length - 2}</span>
                              )}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {content.detected_products && content.detected_products.length > 0 ? (
                            <div className="flex flex-wrap gap-0.5 max-w-[100px]">
                              {content.detected_products.slice(0, 2).map((p, i) => (
                                <span key={i} className="text-[10px] text-muted-foreground">{p}</span>
                              ))}
                              {content.detected_products.length > 2 && (
                                <span className="text-[10px] text-muted-foreground">+{content.detected_products.length - 2}</span>
                              )}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {content.sentiment_label ? (
                            <Badge variant="outline" className={`text-[10px] ${
                              content.sentiment_label === "positive" ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
                              : content.sentiment_label === "negative" ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400"
                              : "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400"
                            }`}>
                              {content.sentiment_label === "positive" ? "긍정" : content.sentiment_label === "negative" ? "부정" : "중립"}
                              {content.sentiment_score != null && ` ${Number(content.sentiment_score).toFixed(1)}`}
                            </Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {content.posted_at ? new Date(content.posted_at).toLocaleDateString("ko-KR") : "-"}
                        </TableCell>
                        <TableCell>
                          {content.content_url && (
                            <a href={content.content_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm" className="h-7 px-2">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          {contents.length > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              총 <strong className="text-foreground">{contents.length}</strong>개 콘텐츠
            </p>
          )}
        </TabsContent>

        {/* Influencers Tab */}
        <TabsContent value="influencers" className="space-y-4">
          {relationshipsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : relationships.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Handshake className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-sm font-medium text-muted-foreground">인플루언서 협업 데이터가 없습니다</p>
                <p className="text-xs text-muted-foreground mt-1">&quot;콘텐츠 발견&quot;을 실행하면 협업 인플루언서가 자동 수집됩니다</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">인플루언서</TableHead>
                      <TableHead>총 협업</TableHead>
                      <TableHead>스폰서</TableHead>
                      <TableHead>오가닉</TableHead>
                      <TableHead>평균 조회수</TableHead>
                      <TableHead>평균 좋아요</TableHead>
                      <TableHead>평균 댓글</TableHead>
                      <TableHead>평균 공유</TableHead>
                      <TableHead>총 조회수</TableHead>
                      <TableHead>평균 참여율</TableHead>
                      <TableHead>관계 강도</TableHead>
                      <TableHead>협업가치</TableHead>
                      <TableHead>예상 CPM</TableHead>
                      <TableHead>평균 간격</TableHead>
                      <TableHead>최근성</TableHead>
                      <TableHead>첫 협업</TableHead>
                      <TableHead>마지막 협업</TableHead>
                      <TableHead>활성</TableHead>
                      <TableHead>독점</TableHead>
                      <TableHead>유형</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relationships.map((rel) => (
                      <TableRow key={rel.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {rel.influencer?.profile_image_url ? (
                              <img src={rel.influencer.profile_image_url} alt="" className="w-8 h-8 rounded-full object-cover border" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{rel.influencer?.display_name || rel.influencer?.username || "-"}</p>
                              {rel.influencer?.username && (
                                <p className="text-xs text-muted-foreground">@{rel.influencer.username}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium tabular-nums">{rel.total_collaborations ?? 0}</TableCell>
                        <TableCell className="text-sm tabular-nums">{rel.sponsored_count ?? 0}</TableCell>
                        <TableCell className="text-sm tabular-nums">{rel.organic_count ?? 0}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatNumber(rel.avg_views)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatNumber(rel.avg_likes)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatNumber(rel.avg_comments)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatNumber(rel.avg_shares)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatNumber(rel.total_views)}</TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {rel.avg_engagement_rate != null ? `${Number(rel.avg_engagement_rate).toFixed(2)}%` : "-"}
                        </TableCell>
                        <TableCell>
                          {rel.relationship_strength_score != null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${Math.min(Number(rel.relationship_strength_score), 100)}%` }}
                                />
                              </div>
                              <span className="text-xs tabular-nums">{Number(rel.relationship_strength_score).toFixed(0)}</span>
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {rel.estimated_collaboration_value != null ? `$${Number(rel.estimated_collaboration_value).toFixed(0)}` : "-"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {rel.estimated_cpm != null ? `$${Number(rel.estimated_cpm).toFixed(0)}` : "-"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">
                          {rel.avg_days_between_collabs != null ? `${Number(rel.avg_days_between_collabs).toFixed(0)}일` : "-"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {rel.collaboration_recency_days != null ? (
                            <span className={Number(rel.collaboration_recency_days) <= 30 ? "text-green-600 dark:text-green-400" : Number(rel.collaboration_recency_days) <= 90 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                              {rel.collaboration_recency_days}일전
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {rel.first_collaboration_at ? new Date(rel.first_collaboration_at).toLocaleDateString("ko-KR") : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {rel.last_collaboration_at ? new Date(rel.last_collaboration_at).toLocaleDateString("ko-KR") : "-"}
                        </TableCell>
                        <TableCell>
                          {rel.is_active ? (
                            <Badge variant="outline" className="text-[10px] border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400">활성</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">비활성</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {rel.is_exclusive ? (
                            <Badge variant="outline" className="text-[10px] border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">독점</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {rel.is_brand_ambassador ? (
                            <Badge variant="outline" className="text-[10px] border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-400">앰배서더</Badge>
                          ) : rel.likely_payment_model ? (
                            <Badge variant="secondary" className="text-[10px]">{rel.likely_payment_model}</Badge>
                          ) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          {relationships.length > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              총 <strong className="text-foreground">{relationships.length}</strong>명 인플루언서
            </p>
          )}
        </TabsContent>

        {/* Competitors Tab */}
        <TabsContent value="competitors" className="space-y-4">
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
              <p className="text-sm font-medium text-muted-foreground">경쟁사 비교 분석</p>
              <p className="text-xs text-muted-foreground mt-1">
                동일 업종 브랜드를 등록하면 팔로워 성장률, 참여율, 인플루언서 활용 전략을 비교할 수 있습니다.
              </p>
              {brand.competitor_of && brand.competitor_of.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">연결된 경쟁사:</p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {brand.competitor_of.map((compId, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">{compId}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <Link href="/brands" className="mt-4 inline-block">
                <Button variant="outline" size="sm">
                  <Building2 className="w-4 h-4 mr-1.5" />
                  브랜드 목록으로 이동
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
