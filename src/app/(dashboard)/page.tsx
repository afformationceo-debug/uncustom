import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, Users, Mail, BarChart3 } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { count: campaignCount } = await supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true });

  const { count: influencerCount } = await supabase
    .from("campaign_influencers")
    .select("*", { count: "exact", head: true });

  const { count: emailCount } = await supabase
    .from("email_logs")
    .select("*", { count: "exact", head: true });

  const { count: contentCount } = await supabase
    .from("influencer_contents")
    .select("*", { count: "exact", head: true });

  const stats = [
    {
      title: "활성 캠페인",
      value: campaignCount ?? 0,
      icon: Megaphone,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "인플루언서",
      value: influencerCount ?? 0,
      icon: Users,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "발송 이메일",
      value: emailCount ?? 0,
      icon: Mail,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "콘텐츠",
      value: contentCount ?? 0,
      icon: BarChart3,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
