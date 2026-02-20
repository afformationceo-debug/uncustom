import { createClient } from "@/lib/supabase/server";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/types/database";

type Campaign = Tables<"campaigns">;

export default async function CampaignsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  const campaigns = (data as Campaign[] | null);

  // Get user's team
  const { data: { user } } = await supabase.auth.getUser();
  const { data: teamMember } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .single();

  const teamId = teamMember?.team_id ?? "";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">캠페인</h1>
        <CampaignForm
          teamId={teamId}
          trigger={
            <Button>
              <Plus className="w-4 h-4 mr-1" />
              새 캠페인
            </Button>
          }
        />
      </div>

      {!campaigns || campaigns.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">캠페인이 없습니다.</p>
          <p className="text-sm">새 캠페인을 만들어 인플루언서 마케팅을 시작하세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
