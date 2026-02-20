"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Tables } from "@/types/database";
import { CAMPAIGN_INFLUENCER_STATUSES } from "@/types/platform";

type CampaignInfluencer = Tables<"campaign_influencers"> & {
  influencer?: Tables<"influencers">;
};

export default function ManagePage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [items, setItems] = useState<CampaignInfluencer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, [campaignId]);

  async function fetchItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaign_influencers")
      .select(`
        *,
        influencer:influencers(username, display_name, email, platform, follower_count, profile_image_url)
      `)
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (!error) {
      setItems((data as unknown as CampaignInfluencer[]) ?? []);
    }
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("campaign_influencers")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("상태 변경 실패");
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status } : i))
      );
      toast.success("상태가 변경되었습니다.");
    }
  }

  async function updateDate(id: string, field: string, value: string) {
    const { error } = await supabase
      .from("campaign_influencers")
      .update({ [field]: value || null })
      .eq("id", id);

    if (error) {
      toast.error("날짜 변경 실패");
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, [field]: value || null } : i))
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">인플루언서 관리</h2>
        <Badge variant="secondary">{items.length}명</Badge>
      </div>

      {/* Status summary */}
      <div className="flex gap-2 flex-wrap">
        {CAMPAIGN_INFLUENCER_STATUSES.map((s) => {
          const count = items.filter((i) => i.status === s.value).length;
          return (
            <Badge key={s.value} variant="outline" className="px-3 py-1">
              {s.label}: {count}
            </Badge>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>인플루언서</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>팔로워</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>협업일</TableHead>
                <TableHead>방문일</TableHead>
                <TableHead>업로드 마감</TableHead>
                <TableHead>실제 업로드</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    관리할 인플루언서가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const inf = item.influencer as unknown as Tables<"influencers">;
                  const statusConf = CAMPAIGN_INFLUENCER_STATUSES.find((s) => s.value === item.status);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">
                          {inf?.display_name ?? inf?.username ?? "-"}
                        </div>
                        {inf?.email && (
                          <div className="text-xs text-gray-500">{inf.email}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{inf?.platform}</Badge>
                      </TableCell>
                      <TableCell>{inf?.follower_count?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell>
                        <Select
                          value={item.status}
                          onValueChange={(v) => updateStatus(item.id, v)}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CAMPAIGN_INFLUENCER_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={item.agreed_date ?? ""}
                          onChange={(e) => updateDate(item.id, "agreed_date", e.target.value)}
                          className="w-36 h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={item.visit_date ?? ""}
                          onChange={(e) => updateDate(item.id, "visit_date", e.target.value)}
                          className="w-36 h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={item.upload_deadline ?? ""}
                          onChange={(e) => updateDate(item.id, "upload_deadline", e.target.value)}
                          className="w-36 h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={item.actual_upload_date ?? ""}
                          onChange={(e) => updateDate(item.id, "actual_upload_date", e.target.value)}
                          className="w-36 h-8 text-xs"
                        />
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
