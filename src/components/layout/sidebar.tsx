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
  Search,
  Tag,
  Download,
  FileText,
  Mail,
  Send,
  ClipboardList,
  Inbox,
  Settings,
  FileVideo,
  Share2,
  BarChart3,
  Building2,
  MessageSquareText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

const mainNavigation = [
  { name: "대시보드", href: "/home", icon: LayoutDashboard },
  { name: "캠페인 목록", href: "/campaigns", icon: Megaphone },
  { name: "마스터데이터", href: "/master", icon: Database },
];

const extractionNav = [
  { name: "키워드", href: "/extract/keywords", icon: Search },
  { name: "태그됨", href: "/extract/tagged", icon: Tag },
  { name: "추출 실행", href: "/extract/run", icon: Download },
];

const proposalTemplateNav = [
  { name: "제안서 링크", href: "/proposals", icon: FileText },
  { name: "DM/이메일 템플릿", href: "/templates", icon: MessageSquareText },
];

const emailNav = [
  { name: "발송", href: "/email/send", icon: Send },
  { name: "발송 로그", href: "/email/logs", icon: ClipboardList },
];

const communicationNav = [
  { name: "인박스", href: "/inbox", icon: Inbox },
];

const managementNav = [
  { name: "인플루언서 관리", href: "/manage", icon: Settings },
  { name: "콘텐츠", href: "/contents", icon: FileVideo },
  { name: "SNS 계정", href: "/sns-accounts", icon: Share2 },
  { name: "성과", href: "/metrics", icon: BarChart3 },
];

type NavSection = {
  title: string;
  items: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
};

const sections: NavSection[] = [
  { title: "인플루언서 추출", items: extractionNav },
  { title: "제안서 & 템플릿", items: proposalTemplateNav },
  { title: "이메일", items: emailNav },
  { title: "소통", items: communicationNav },
  { title: "관리", items: managementNav },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [teamName, setTeamName] = useState<string>("");

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

    const { data: teamData } = await supabase
      .from("teams")
      .select("name")
      .eq("id", memberData.team_id)
      .single();

    if (teamData) {
      setTeamName((teamData as Tables<"teams">).name);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  function isActive(href: string) {
    if (href === "/home") return pathname === "/home";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex flex-col w-64 bg-card border-r border-border min-h-screen">
      {/* Team Name & Branding */}
      <div className="p-5 border-b border-border">
        <Link href="/home" className="flex items-center gap-2">
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
        {mainNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.name}
          </Link>
        ))}

        {/* Sections */}
        {sections.map((section) => (
          <div key={section.title} className="pt-4">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section.title}
              </span>
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
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
