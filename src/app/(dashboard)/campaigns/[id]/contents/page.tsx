"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";

type Content = Tables<"influencer_contents"> & {
  influencer?: Tables<"influencers">;
};

export default function ContentsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchContents();
  }, [campaignId]);

  async function fetchContents() {
    setLoading(true);
    const { data, error } = await supabase
      .from("influencer_contents")
      .select(`
        *,
        influencer:influencers(username, display_name, platform)
      `)
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (!error) {
      setContents((data as unknown as Content[]) ?? []);
    }
    setLoading(false);
  }

  async function handleAddContent() {
    if (!newUrl.trim()) return;
    setAdding(true);

    // Detect platform from URL
    let platform = "unknown";
    if (newUrl.includes("instagram.com")) platform = "instagram";
    else if (newUrl.includes("tiktok.com")) platform = "tiktok";
    else if (newUrl.includes("youtube.com") || newUrl.includes("youtu.be")) platform = "youtube";
    else if (newUrl.includes("twitter.com") || newUrl.includes("x.com")) platform = "twitter";

    const { data, error } = await supabase
      .from("influencer_contents")
      .insert({
        campaign_id: campaignId,
        influencer_id: null as unknown as string, // Will be linked later
        original_platform: platform,
        original_url: newUrl.trim(),
      })
      .select()
      .single();

    if (error) {
      toast.error("콘텐츠 추가 실패: " + error.message);
    } else {
      setContents((prev) => [data as unknown as Content, ...prev]);
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

      if (response.ok) {
        toast.success("다운로드가 시작되었습니다.");
        fetchContents();
      } else {
        const result = await response.json();
        toast.error("다운로드 실패: " + result.error);
      }
    } catch {
      toast.error("다운로드 중 오류가 발생했습니다.");
    }
    setDownloading(null);
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
            <Button onClick={handleAddContent} disabled={adding || !newUrl.trim()}>
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "추가"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>플랫폼</TableHead>
                <TableHead>인플루언서</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>다운로드</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="w-24">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : contents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    등록된 콘텐츠가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                contents.map((content) => {
                  const inf = content.influencer as unknown as Tables<"influencers">;
                  return (
                    <TableRow key={content.id}>
                      <TableCell>
                        <Badge variant="secondary">{content.original_platform}</Badge>
                      </TableCell>
                      <TableCell>
                        {inf?.display_name ?? inf?.username ?? "-"}
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        <a
                          href={content.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {content.original_url.slice(0, 50)}...
                        </a>
                      </TableCell>
                      <TableCell>
                        {content.video_downloaded ? (
                          <Badge className="bg-green-100 text-green-800">완료</Badge>
                        ) : (
                          <Badge variant="outline">미완료</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(content.created_at).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!content.video_downloaded && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(content.id)}
                              disabled={downloading === content.id}
                            >
                              {downloading === content.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          <Button variant="outline" size="sm">
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
    </div>
  );
}
