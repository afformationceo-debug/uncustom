import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hash, AtSign, Users, Mail, MessageSquare, Video, BarChart3 } from "lucide-react";
import { notFound } from "next/navigation";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (!campaign) notFound();

  const [
    { count: keywordCount },
    { count: taggedCount },
    { count: influencerCount },
    { count: emailCount },
    { count: threadCount },
    { count: contentCount },
  ] = await Promise.all([
    supabase.from("keywords").select("*", { count: "exact", head: true }).eq("campaign_id", id),
    supabase.from("tagged_accounts").select("*", { count: "exact", head: true }).eq("campaign_id", id),
    supabase.from("campaign_influencers").select("*", { count: "exact", head: true }).eq("campaign_id", id),
    supabase.from("email_logs").select("*", { count: "exact", head: true }).eq("campaign_id", id),
    supabase.from("email_threads").select("*", { count: "exact", head: true }).eq("campaign_id", id),
    supabase.from("influencer_contents").select("*", { count: "exact", head: true }).eq("campaign_id", id),
  ]);

  const stats = [
    { title: "키워드", value: keywordCount ?? 0, icon: Hash, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "태그 계정", value: taggedCount ?? 0, icon: AtSign, color: "text-purple-600", bg: "bg-purple-50" },
    { title: "인플루언서", value: influencerCount ?? 0, icon: Users, color: "text-green-600", bg: "bg-green-50" },
    { title: "발송 이메일", value: emailCount ?? 0, icon: Mail, color: "text-orange-600", bg: "bg-orange-50" },
    { title: "스레드", value: threadCount ?? 0, icon: MessageSquare, color: "text-pink-600", bg: "bg-pink-50" },
    { title: "콘텐츠", value: contentCount ?? 0, icon: Video, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`p-1.5 rounded ${stat.bg}`}>
                <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
