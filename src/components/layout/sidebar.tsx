"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Megaphone,
  Database,
  LogOut,
  ChevronRight,
  Plus,
  Search,
  Tag,
  Download,
  Users,
  Mail,
  Send,
  ClipboardList,
  Inbox,
  Settings,
  FileVideo,
  Share2,
  BarChart3,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

const campaignSubNav = [
  { name: "키워드", path: "keywords", icon: Search },
  { name: "태그됨", path: "tagged", icon: Tag },
  { name: "추출", path: "extract", icon: Download },
  { name: "인플루언서", path: "influencers", icon: Users },
  { name: "이메일 템플릿", path: "email/templates", icon: Mail },
  { name: "이메일 발송", path: "email/send", icon: Send },
  { name: "발송 로그", path: "email/logs", icon: ClipboardList },
  { name: "인박스", path: "inbox", icon: Inbox },
  { name: "관리", path: "manage", icon: Settings },
  { name: "콘텐츠", path: "contents", icon: FileVideo },
  { name: "SNS 계정", path: "sns-accounts", icon: Share2 },
  { name: "성과", path: "metrics", icon: BarChart3 },
];

const mainNavigation = [
  {
    name: "대시보드",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "캠페인 목록",
    href: "/campaigns",
    icon: Megaphone,
  },
  {
    name: "마스터데이터",
    href: "/master",
    icon: Database,
  },
];

const extractionNav = [
  { name: "키워드", href: "/extract/keywords", icon: Search },
  { name: "태그됨", href: "/extract/tagged", icon: Tag },
  { name: "추출 실행", href: "/extract/run", icon: Download },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [campaigns, setCampaigns] = useState<Tables<"campaigns">[]>([]);
  const [teamName, setTeamName] = useState<string>("");
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(
    new Set()
  );

  const activeCampaignId = pathname.match(/^\/campaigns\/([^/]+)/)?.[1] ?? null;

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: memberData } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!memberData) return;

    const teamId = memberData.team_id;

    const { data: teamData } = await supabase
      .from("teams")
      .select("name")
      .eq("id", teamId)
      .single();

    if (teamData) {
      setTeamName((teamData as Tables<"teams">).name);
    }

    const { data: campaignData } = await supabase
      .from("campaigns")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (campaignData) {
      setCampaigns(campaignData as Tables<"campaigns">[]);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeCampaignId) {
      setExpandedCampaigns((prev) => {
        const next = new Set(prev);
        next.add(activeCampaignId);
        return next;
      });
    }
  }, [activeCampaignId]);

  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="flex flex-col w-64 bg-card border-r border-border min-h-screen">
      {/* Team Name & Branding */}
      <div className="p-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-primary-foreground">U</span>
          </div>
          <span className="text-xl font-bold text-foreground">Uncustom</span>
        </Link>
        {teamName && (
          <div className="flex items-center gap-1.5 mt-2">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {teamName}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Main Navigation */}
        {mainNavigation.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}

        {/* Extraction Section */}
        <div className="pt-4">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              인플루언서 추출
            </span>
          </div>
          <div className="space-y-0.5">
            {extractionNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Campaigns Section */}
        <div className="pt-4">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              캠페인
            </span>
            <Link
              href="/campaigns?new=true"
              className="flex items-center justify-center w-5 h-5 rounded bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title="새 캠페인"
            >
              <Plus className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-0.5">
            {campaigns.map((campaign) => {
              const isExpanded = expandedCampaigns.has(campaign.id);
              const isCampaignActive = activeCampaignId === campaign.id;

              return (
                <div key={campaign.id}>
                  {/* Campaign Row */}
                  <button
                    onClick={() => toggleCampaign(campaign.id)}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                      isCampaignActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200",
                        isExpanded && "rotate-90"
                      )}
                    />
                    <Megaphone className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{campaign.name}</span>
                  </button>

                  {/* Sub-navigation */}
                  {isExpanded && (
                    <div className="ml-4 pl-3 border-l border-border mt-0.5 mb-1 space-y-0.5">
                      {campaignSubNav.map((subItem) => {
                        const subHref = `/campaigns/${campaign.id}/${subItem.path}`;
                        const isSubActive = pathname === subHref;

                        return (
                          <Link
                            key={subItem.path}
                            href={subHref}
                            className={cn(
                              "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                              isSubActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <subItem.icon className="w-3.5 h-3.5 flex-shrink-0" />
                            {subItem.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {campaigns.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                캠페인이 없습니다
              </p>
            )}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
