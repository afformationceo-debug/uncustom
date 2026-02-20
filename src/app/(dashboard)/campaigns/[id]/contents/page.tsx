"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Upload,
  ExternalLink,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpCircle,
  Link2,
  Video,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { PLATFORMS } from "@/types/platform";
import type { Platform } from "@/types/platform";
import type { Tables } from "@/types/database";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type Content = Tables<"influencer_contents"> & {
  influencer?: Tables<"influencers">;
  uploads?: Tables<"multi_channel_uploads">[];
};

type SnsAccount = Tables<"campaign_sns_accounts">;

type PlatformFields = {
  caption: string;
  title: string;
  description: string;
  tags: string;
  tweetText: string;
};

const UPLOAD_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: "대기중", color: "bg-muted text-muted-foreground", icon: Clock },
  uploading: {
    label: "업로드중",
    color: "bg-blue-500/10 text-blue-500",
    icon: ArrowUpCircle,
  },
  published: {
    label: "게시됨",
    color: "bg-green-500/10 text-green-500",
    icon: CheckCircle,
  },
  failed: {
    label: "실패",
    color: "bg-destructive/10 text-destructive",
    icon: XCircle,
  },
};

function getPlatformIcon(platform: string): string {
  switch (platform) {
    case "instagram":
      return "IG";
    case "youtube":
      return "YT";
    case "tiktok":
      return "TT";
    case "twitter":
      return "X";
    case "threads":
      return "TH";
    default:
      return "?";
  }
}

function getVideoThumbnail(url: string): string | null {
  // Extract YouTube thumbnail
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
  }
  return null;
}

export default function ContentsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [platformFields, setPlatformFields] = useState<
    Record<string, PlatformFields>
  >({});
  const [snsAccounts, setSnsAccounts] = useState<SnsAccount[]>([]);
  const [selectedSnsAccounts, setSelectedSnsAccounts] = useState<
    Record<string, string>
  >({});
  const [uploading, setUploading] = useState(false);

  // Link influencer dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkContent, setLinkContent] = useState<Content | null>(null);
  const [influencers, setInfluencers] = useState<Tables<"influencers">[]>([]);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState("");
  const [linkingInfluencer, setLinkingInfluencer] = useState(false);

  useEffect(() => {
    fetchContents();
    fetchSnsAccounts();
  }, [campaignId]);

  // Real-time updates for multi_channel_uploads
  const handleUploadChange = useCallback(
    (
      payload: RealtimePostgresChangesPayload<
        Record<string, unknown>
      >
    ) => {
      const newRecord = payload.new as Tables<"multi_channel_uploads"> | undefined;
      if (!newRecord) return;

      setContents((prev) =>
        prev.map((content) => {
          if (content.id === newRecord.content_id) {
            const existingUploads = content.uploads ?? [];
            const uploadIndex = existingUploads.findIndex(
              (u) => u.id === newRecord.id
            );
            const updatedUploads =
              uploadIndex >= 0
                ? existingUploads.map((u) =>
                    u.id === newRecord.id ? newRecord : u
                  )
                : [...existingUploads, newRecord];
            return { ...content, uploads: updatedUploads };
          }
          return content;
        })
      );
    },
    []
  );

  useRealtime(
    "multi_channel_uploads",
    `campaign_id=eq.${campaignId}`,
    handleUploadChange
  );

  async function fetchContents() {
    setLoading(true);
    const { data, error } = await supabase
      .from("influencer_contents")
      .select(
        `
        *,
        influencer:influencers(id, username, display_name, platform, profile_image_url)
      `
      )
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const typedData = data as unknown as Content[];

      // Fetch uploads for these contents
      const contentIds = typedData.map((c) => c.id);
      if (contentIds.length > 0) {
        const { data: uploadsData } = await supabase
          .from("multi_channel_uploads")
          .select("*")
          .in("content_id", contentIds);

        const uploadsByContent: Record<
          string,
          Tables<"multi_channel_uploads">[]
        > = {};
        for (const upload of (uploadsData as Tables<"multi_channel_uploads">[]) ??
          []) {
          if (!uploadsByContent[upload.content_id]) {
            uploadsByContent[upload.content_id] = [];
          }
          uploadsByContent[upload.content_id].push(upload);
        }

        const enriched: Content[] = typedData.map((c) => ({
          ...c,
          uploads: uploadsByContent[c.id] ?? [],
        }));
        setContents(enriched);
      } else {
        setContents(typedData);
      }
    }
    setLoading(false);
  }

  async function fetchSnsAccounts() {
    const { data } = await supabase
      .from("campaign_sns_accounts")
      .select("*")
      .eq("campaign_id", campaignId);

    setSnsAccounts((data as SnsAccount[]) ?? []);
  }

  async function fetchInfluencers() {
    const { data } = await supabase
      .from("campaign_influencers")
      .select(
        `
        influencer_id,
        influencer:influencers(id, username, display_name, platform, profile_image_url)
      `
      )
      .eq("campaign_id", campaignId);

    if (data) {
      const infList = (data as unknown as { influencer: Tables<"influencers"> }[])
        .map((d) => d.influencer)
        .filter(Boolean);
      setInfluencers(infList);
    }
  }

  async function handleAddContent() {
    if (!newUrl.trim()) return;
    setAdding(true);

    let platform = "unknown";
    if (newUrl.includes("instagram.com")) platform = "instagram";
    else if (newUrl.includes("tiktok.com")) platform = "tiktok";
    else if (newUrl.includes("youtube.com") || newUrl.includes("youtu.be"))
      platform = "youtube";
    else if (newUrl.includes("twitter.com") || newUrl.includes("x.com"))
      platform = "twitter";

    const { data, error } = await supabase
      .from("influencer_contents")
      .insert({
        campaign_id: campaignId,
        influencer_id: null as unknown as string,
        original_platform: platform,
        original_url: newUrl.trim(),
      })
      .select()
      .single();

    if (error) {
      toast.error("콘텐츠 추가 실패: " + error.message);
    } else {
      setContents((prev) => [
        { ...(data as unknown as Content), uploads: [] },
        ...prev,
      ]);
      setNewUrl("");
      toast.success("콘텐츠가 추가되었습니다.");
    }
    setAdding(false);
  }

  async function handleDownload(contentId: string) {
    setDownloading(contentId);
    try {
      const response = await fetch("/api/contents/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_id: contentId }),
      });

      const result = await response.json();
      if (!response.ok || !result.run_id) {
        toast.error("다운로드 실패: " + (result.error ?? "Unknown error"));
        setDownloading(null);
        return;
      }

      toast.success("다운로드가 시작되었습니다. 완료까지 잠시 기다려주세요...");

      // Poll for completion
      const runId = result.run_id;
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `/api/contents/download?content_id=${contentId}&run_id=${runId}`
          );
          const statusData = await statusRes.json();

          if (statusData.status === "completed") {
            clearInterval(pollInterval);
            toast.success("다운로드 완료!");
            setDownloading(null);
            fetchContents();
          } else if (statusData.status === "failed") {
            clearInterval(pollInterval);
            toast.error("다운로드 실패: " + (statusData.error ?? "Unknown"));
            setDownloading(null);
          }
        } catch {
          clearInterval(pollInterval);
          setDownloading(null);
        }
      }, 5000);
    } catch {
      toast.error("다운로드 중 오류가 발생했습니다.");
      setDownloading(null);
    }
  }

  function openUploadDialog(content: Content) {
    setSelectedContent(content);
    setSelectedPlatforms([]);
    setPlatformFields({});
    setSelectedSnsAccounts({});
    setUploadDialogOpen(true);
  }

  function handlePlatformToggle(platform: Platform, checked: boolean) {
    if (checked) {
      setSelectedPlatforms((prev) => [...prev, platform]);
      // Initialize fields for this platform with content's existing caption
      setPlatformFields((prev) => ({
        ...prev,
        [platform]: {
          caption: selectedContent?.caption ?? "",
          title: "",
          description: "",
          tags: "",
          tweetText: "",
        },
      }));
    } else {
      setSelectedPlatforms((prev) => prev.filter((p) => p !== platform));
      setPlatformFields((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
      setSelectedSnsAccounts((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
    }
  }

  function updatePlatformField(
    platform: string,
    field: keyof PlatformFields,
    value: string
  ) {
    setPlatformFields((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value,
      },
    }));
  }

  async function handleUpload() {
    if (!selectedContent || selectedPlatforms.length === 0) return;
    setUploading(true);

    const uploads = selectedPlatforms.map((platform) => {
      const fields = platformFields[platform];
      const snsAccountId = selectedSnsAccounts[platform] || null;

      let caption = fields?.caption ?? "";
      let title: string | null = null;
      let tags: string[] | null = null;

      if (platform === "youtube") {
        title = fields?.title || null;
        caption = fields?.description || caption;
        tags = fields?.tags
          ? fields.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : null;
      } else if (platform === "twitter") {
        caption = fields?.tweetText || caption;
      }

      return {
        content_id: selectedContent.id,
        campaign_id: campaignId,
        target_platform: platform,
        sns_account_id: snsAccountId,
        caption,
        title,
        tags,
      };
    });

    try {
      const response = await fetch("/api/contents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploads }),
      });

      if (response.ok) {
        toast.success(
          `${selectedPlatforms.length}개 플랫폼에 업로드가 시작되었습니다.`
        );
        setUploadDialogOpen(false);
        fetchContents();
      } else {
        const result = await response.json();
        toast.error("업로드 실패: " + result.error);
      }
    } catch {
      toast.error("업로드 중 오류가 발생했습니다.");
    }
    setUploading(false);
  }

  function openLinkDialog(content: Content) {
    setLinkContent(content);
    setSelectedInfluencerId("");
    setLinkDialogOpen(true);
    fetchInfluencers();
  }

  async function handleLinkInfluencer() {
    if (!linkContent || !selectedInfluencerId) return;
    setLinkingInfluencer(true);

    const { error } = await supabase
      .from("influencer_contents")
      .update({ influencer_id: selectedInfluencerId })
      .eq("id", linkContent.id);

    if (error) {
      toast.error("연결 실패: " + error.message);
    } else {
      toast.success("인플루언서가 연결되었습니다.");
      setLinkDialogOpen(false);
      fetchContents();
    }
    setLinkingInfluencer(false);
  }

  function getOverallUploadStatus(
    uploads?: Tables<"multi_channel_uploads">[]
  ): string | null {
    if (!uploads || uploads.length === 0) return null;
    if (uploads.some((u) => u.status === "uploading")) return "uploading";
    if (uploads.every((u) => u.status === "published")) return "published";
    if (uploads.some((u) => u.status === "failed")) return "failed";
    if (uploads.some((u) => u.status === "pending")) return "pending";
    return "pending";
  }

  function getConnectedAccountsForPlatform(platform: string): SnsAccount[] {
    return snsAccounts.filter(
      (a) => a.platform === platform && a.connected
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">콘텐츠 관리</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">콘텐츠 URL 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="콘텐츠 URL 입력 (Instagram, TikTok, YouTube, X)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddContent()}
              className="flex-1"
            />
            <Button
              onClick={handleAddContent}
              disabled={adding || !newUrl.trim()}
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "추가"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">미리보기</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>인플루언서</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>다운로드</TableHead>
                <TableHead>업로드 상태</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="w-32">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : contents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    등록된 콘텐츠가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                contents.map((content) => {
                  const inf = content.influencer as
                    | Tables<"influencers">
                    | undefined;
                  const thumbnail = getVideoThumbnail(content.original_url);
                  const overallStatus = getOverallUploadStatus(content.uploads);
                  const statusConfig = overallStatus
                    ? UPLOAD_STATUS_CONFIG[overallStatus]
                    : null;

                  return (
                    <TableRow key={content.id}>
                      {/* Thumbnail */}
                      <TableCell>
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt="Thumbnail"
                            className="w-14 h-10 object-cover rounded"
                          />
                        ) : (
                          <div className="w-14 h-10 bg-muted rounded flex items-center justify-center">
                            <Video className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>

                      {/* Platform */}
                      <TableCell>
                        <Badge variant="secondary">
                          {content.original_platform}
                        </Badge>
                      </TableCell>

                      {/* Influencer */}
                      <TableCell>
                        {inf ? (
                          <div className="flex items-center gap-2">
                            {inf.profile_image_url ? (
                              <img
                                src={inf.profile_image_url}
                                alt=""
                                className="w-6 h-6 rounded-full"
                              />
                            ) : (
                              <User className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className="text-sm">
                              {inf.display_name ?? inf.username ?? "-"}
                            </span>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground"
                            onClick={() => openLinkDialog(content)}
                          >
                            <Link2 className="w-3 h-3 mr-1" />
                            연결
                          </Button>
                        )}
                      </TableCell>

                      {/* URL */}
                      <TableCell className="max-w-48 truncate">
                        <a
                          href={content.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {content.original_url.slice(0, 50)}
                            {content.original_url.length > 50 ? "..." : ""}
                          </span>
                        </a>
                      </TableCell>

                      {/* Download status */}
                      <TableCell>
                        {content.video_downloaded ? (
                          <Badge className="bg-green-500/10 text-green-500">
                            완료
                          </Badge>
                        ) : (
                          <Badge variant="outline">미완료</Badge>
                        )}
                      </TableCell>

                      {/* Upload status */}
                      <TableCell>
                        {content.uploads && content.uploads.length > 0 ? (
                          <div className="space-y-1">
                            <div className="flex gap-1 flex-wrap">
                              {content.uploads.map((upload) => {
                                const uConfig =
                                  UPLOAD_STATUS_CONFIG[upload.status] ??
                                  UPLOAD_STATUS_CONFIG.pending;
                                const StatusIcon = uConfig.icon;
                                return (
                                  <div
                                    key={upload.id}
                                    className="flex items-center gap-0.5"
                                    title={`${upload.target_platform}: ${uConfig.label}`}
                                  >
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {getPlatformIcon(upload.target_platform)}
                                    </span>
                                    <StatusIcon className={`w-3.5 h-3.5 ${
                                      upload.status === "published"
                                        ? "text-green-500"
                                        : upload.status === "failed"
                                        ? "text-red-500"
                                        : upload.status === "uploading"
                                        ? "text-blue-500"
                                        : "text-muted-foreground"
                                    }`} />
                                  </div>
                                );
                              })}
                            </div>
                            {statusConfig && (
                              <Badge
                                className={`text-xs ${statusConfig.color}`}
                                variant="secondary"
                              >
                                {statusConfig.label}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* Created date */}
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(content.created_at).toLocaleDateString(
                          "ko-KR"
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex gap-1">
                          {!content.video_downloaded && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(content.id)}
                              disabled={downloading === content.id}
                              title="다운로드"
                            >
                              {downloading === content.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openUploadDialog(content)}
                            title="멀티채널 업로드"
                          >
                            <Upload className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Multi-Channel Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>멀티채널 업로드</DialogTitle>
            <DialogDescription>
              콘텐츠를 업로드할 플랫폼을 선택하고, 플랫폼별 설정을
              입력하세요.
            </DialogDescription>
          </DialogHeader>

          {selectedContent && (
            <div className="space-y-6">
              {/* Content info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {getVideoThumbnail(selectedContent.original_url) ? (
                  <img
                    src={
                      getVideoThumbnail(selectedContent.original_url) ?? ""
                    }
                    alt=""
                    className="w-20 h-14 object-cover rounded"
                  />
                ) : (
                  <div className="w-20 h-14 bg-muted rounded flex items-center justify-center">
                    <Video className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Badge variant="secondary" className="mb-1">
                    {selectedContent.original_platform}
                  </Badge>
                  <p className="text-sm text-muted-foreground truncate">
                    {selectedContent.original_url}
                  </p>
                </div>
              </div>

              {/* Platform selection */}
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  업로드 대상 플랫폼
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PLATFORMS.map((p) => {
                    const connectedAccounts = getConnectedAccountsForPlatform(
                      p.value
                    );
                    const isSelected = selectedPlatforms.includes(p.value);

                    return (
                      <label
                        key={p.value}
                        className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-border/80"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            handlePlatformToggle(
                              p.value,
                              checked === true
                            )
                          }
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium">
                            {p.label}
                          </span>
                          {connectedAccounts.length > 0 ? (
                            <p className="text-xs text-green-600">
                              {connectedAccounts.length}개 계정 연결됨
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              연결된 계정 없음
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Platform-specific fields */}
              {selectedPlatforms.length > 0 && (
                <div className="space-y-4">
                  {selectedPlatforms.map((platform) => {
                    const fields = platformFields[platform];
                    const connectedAccounts =
                      getConnectedAccountsForPlatform(platform);
                    const platformInfo = PLATFORMS.find(
                      (p) => p.value === platform
                    );

                    return (
                      <div
                        key={platform}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor:
                                platformInfo?.color ?? "#888",
                            }}
                          />
                          {platformInfo?.label ?? platform}
                        </h4>

                        {/* SNS Account selector */}
                        {connectedAccounts.length > 0 && (
                          <div>
                            <Label className="text-xs">SNS 계정</Label>
                            <Select
                              value={
                                selectedSnsAccounts[platform] ?? ""
                              }
                              onValueChange={(val) =>
                                setSelectedSnsAccounts((prev) => ({
                                  ...prev,
                                  [platform]: val,
                                }))
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="계정 선택" />
                              </SelectTrigger>
                              <SelectContent>
                                {connectedAccounts.map((acc) => (
                                  <SelectItem
                                    key={acc.id}
                                    value={acc.id}
                                  >
                                    {acc.account_name ??
                                      acc.account_id ??
                                      "계정"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* YouTube fields */}
                        {platform === "youtube" && (
                          <>
                            <div>
                              <Label className="text-xs">제목</Label>
                              <Input
                                value={fields?.title ?? ""}
                                onChange={(e) =>
                                  updatePlatformField(
                                    platform,
                                    "title",
                                    e.target.value
                                  )
                                }
                                placeholder="YouTube 영상 제목"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">설명</Label>
                              <Textarea
                                value={fields?.description ?? ""}
                                onChange={(e) =>
                                  updatePlatformField(
                                    platform,
                                    "description",
                                    e.target.value
                                  )
                                }
                                placeholder="YouTube 영상 설명"
                                className="mt-1"
                                rows={3}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">
                                태그 (쉼표로 구분)
                              </Label>
                              <Input
                                value={fields?.tags ?? ""}
                                onChange={(e) =>
                                  updatePlatformField(
                                    platform,
                                    "tags",
                                    e.target.value
                                  )
                                }
                                placeholder="태그1, 태그2, 태그3"
                                className="mt-1"
                              />
                            </div>
                          </>
                        )}

                        {/* Twitter fields */}
                        {platform === "twitter" && (
                          <div>
                            <Label className="text-xs">
                              트윗 텍스트{" "}
                              <span className="text-muted-foreground">
                                (
                                {fields?.tweetText?.length ?? 0}
                                /280)
                              </span>
                            </Label>
                            <Textarea
                              value={fields?.tweetText ?? ""}
                              onChange={(e) => {
                                if (e.target.value.length <= 280) {
                                  updatePlatformField(
                                    platform,
                                    "tweetText",
                                    e.target.value
                                  );
                                }
                              }}
                              placeholder="트윗 내용을 입력하세요"
                              className="mt-1"
                              rows={3}
                              maxLength={280}
                            />
                          </div>
                        )}

                        {/* Instagram/TikTok/Threads caption */}
                        {(platform === "instagram" ||
                          platform === "tiktok" ||
                          platform === "threads") && (
                          <div>
                            <Label className="text-xs">캡션</Label>
                            <Textarea
                              value={fields?.caption ?? ""}
                              onChange={(e) =>
                                updatePlatformField(
                                  platform,
                                  "caption",
                                  e.target.value
                                )
                              }
                              placeholder="캡션을 입력하세요"
                              className="mt-1"
                              rows={3}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              disabled={uploading}
            >
              취소
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                uploading || selectedPlatforms.length === 0
              }
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Upload className="w-4 h-4 mr-1" />
              )}
              업로드 ({selectedPlatforms.length}개 플랫폼)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Influencer Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>인플루언서 연결</DialogTitle>
            <DialogDescription>
              이 콘텐츠에 연결할 인플루언서를 선택하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {influencers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                캠페인에 등록된 인플루언서가 없습니다.
              </p>
            ) : (
              <Select
                value={selectedInfluencerId}
                onValueChange={setSelectedInfluencerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="인플루언서 선택" />
                </SelectTrigger>
                <SelectContent>
                  {influencers.map((inf) => (
                    <SelectItem key={inf.id} value={inf.id}>
                      {inf.display_name ?? inf.username ?? inf.id} (
                      {inf.platform})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkDialogOpen(false)}
              disabled={linkingInfluencer}
            >
              취소
            </Button>
            <Button
              onClick={handleLinkInfluencer}
              disabled={!selectedInfluencerId || linkingInfluencer}
            >
              {linkingInfluencer ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Link2 className="w-4 h-4 mr-1" />
              )}
              연결
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
