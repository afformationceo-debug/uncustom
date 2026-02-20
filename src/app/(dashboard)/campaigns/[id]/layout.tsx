import { createClient } from "@/lib/supabase/server";
import { CampaignNav } from "@/components/campaigns/campaign-nav";
import { notFound } from "next/navigation";
import type { Tables } from "@/types/database";

type Campaign = Tables<"campaigns">;

export default async function CampaignLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  const campaign = data as Campaign | null;

  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{campaign.name}</h1>
        {campaign.description && (
          <p className="text-muted-foreground mt-1">{campaign.description}</p>
        )}
      </div>
      <CampaignNav campaignId={id} />
      <div>{children}</div>
    </div>
  );
}
