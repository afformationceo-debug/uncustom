import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Tables } from "@/types/database";
import { Badge } from "@/components/ui/badge";

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
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{campaign.name}</h1>
        <Badge variant="secondary">{campaign.status}</Badge>
      </div>
      {campaign.description && (
        <p className="text-muted-foreground">{campaign.description}</p>
      )}
      <div>{children}</div>
    </div>
  );
}
