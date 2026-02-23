"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Send,
  Inbox,
  BarChart3,
  Check,
  Eye,
  MousePointer,
  Globe,
  Image,
  Tag,
  Gift,
  MessageCircle,
  Clock,
  TrendingUp,
  Users,
  Heart,
  Share2,
  Play,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Mail,
  ExternalLink,
  Star,
} from "lucide-react";
import { InstagramLogo, TikTokLogo, YoutubeLogo } from "./platform-logos";

/* ── Browser Frame ── */
function BrowserFrame({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a12] overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.025] border-b border-white/[0.06]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
        </div>
        <div className="flex-1 mx-3 flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/[0.04]">
          <Globe className="w-3 h-3 text-white/20" />
          <span className="text-[10px] text-white/30 font-mono truncate">
            {url}
          </span>
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/* ── App Window ── */
function AppWindow({
  title,
  tabs,
  activeTab,
  children,
}: {
  title: string;
  tabs?: string[];
  activeTab?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a12] overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.025] border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
          </div>
          <span className="text-[10px] text-white/40 font-medium">{title}</span>
        </div>
        {tabs && (
          <div className="flex items-center gap-1">
            {tabs.map((tab, i) => (
              <div
                key={tab}
                className={`px-2.5 py-1 rounded-md text-[9px] font-medium transition-colors ${
                  i === (activeTab ?? 0)
                    ? "bg-white/[0.08] text-white/70"
                    : "text-white/25 hover:text-white/40"
                }`}
              >
                {tab}
              </div>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Feature 1: 제안서 링크 빌더 ── */
function ProposalMockup() {
  return (
    <BrowserFrame url="uncustom.ai/p/summer-beauty-2025">
      <div className="max-h-[420px] overflow-hidden relative">
        {/* Hero Image */}
        <div className="h-32 rounded-xl bg-gradient-to-br from-purple-600/40 via-fuchsia-500/30 to-pink-500/20 border border-white/[0.06] mb-3 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IGZpbGw9InVybCgjZykiIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiLz48L3N2Zz4=')] opacity-50" />
          <div className="text-center relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-2">
              <span className="text-sm font-black text-white">B</span>
            </div>
            <div className="text-xs font-bold text-white/90">
              Brand Beauty Korea
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="mb-3">
          <div className="text-sm font-bold text-white/90 mb-1">
            Summer Beauty Campaign 2025
          </div>
          <div className="text-[10px] text-white/30">
            Brand Beauty Korea x Influencer Collaboration
          </div>
        </div>

        {/* Mission Section */}
        <div className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.06] mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-[10px] font-bold text-white/60">MISSION</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <Check className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
              <span className="text-[10px] text-white/40">
                제품 언박싱 리뷰 콘텐츠 1건 업로드
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
              <span className="text-[10px] text-white/40">
                스토리 2건 + 피드 1건 (Instagram)
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
              <span className="text-[10px] text-white/40">
                필수 태그: #BrandBeauty #AD 포함
              </span>
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Gift className="w-3 h-3 text-fuchsia-400" />
            <span className="text-[10px] font-bold text-white/60">
              제공 제품
            </span>
          </div>
          <div className="flex gap-2">
            {[
              { name: "글로우 세럼", color: "from-pink-500/20 to-purple-500/20" },
              { name: "수분 크림", color: "from-blue-500/20 to-cyan-500/20" },
              { name: "립 틴트 SET", color: "from-red-500/20 to-orange-500/20" },
            ].map((product) => (
              <div
                key={product.name}
                className="flex-1 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-center"
              >
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${product.color} mx-auto mb-1`}
                />
                <div className="text-[8px] text-white/40">{product.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Required Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {["#BrandBeauty", "#AD", "#SummerGlow", "#뷰티리뷰"].map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/15 text-[9px] text-purple-300/70"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Reward */}
        <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/15 mb-3">
          <div className="flex items-center gap-1.5">
            <Star className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-300/80">
              리워드: 제품 무상 제공 + 50만원 고료
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-center">
          <span className="text-[11px] font-bold text-white">
            참여 신청하기
          </span>
        </div>

        {/* Fade overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0a0a12] to-transparent" />
      </div>
    </BrowserFrame>
  );
}

/* ── Feature 2: DM/이메일 자동 발송 ── */
function EmailMockup() {
  const recipients = [
    {
      name: "beauty_star",
      email: "beauty@gmail.com",
      status: "열람",
      statusColor: "bg-green-500/15 text-green-400",
      opened: true,
      clicked: true,
    },
    {
      name: "travel_kim",
      email: "travel.kim@naver.com",
      status: "클릭",
      statusColor: "bg-blue-500/15 text-blue-400",
      opened: true,
      clicked: true,
    },
    {
      name: "food_master",
      email: "foodmaster@gmail.com",
      status: "발송",
      statusColor: "bg-purple-500/15 text-purple-400",
      opened: false,
      clicked: false,
    },
    {
      name: "style_guru",
      email: "style.guru@yahoo.com",
      status: "열람",
      statusColor: "bg-green-500/15 text-green-400",
      opened: true,
      clicked: false,
    },
    {
      name: "life_daily",
      email: "life.daily@gmail.com",
      status: "바운스",
      statusColor: "bg-red-500/15 text-red-400",
      opened: false,
      clicked: false,
    },
  ];

  return (
    <AppWindow
      title="Uncustom - 이메일 발송"
      tabs={["발송 현황", "템플릿"]}
      activeTab={0}
    >
      <div className="p-3">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: "총 발송", value: "248", icon: Send, color: "text-purple-400" },
            { label: "열람률", value: "67%", icon: Eye, color: "text-green-400" },
            { label: "클릭률", value: "34%", icon: MousePointer, color: "text-blue-400" },
            { label: "회신률", value: "12%", icon: MessageCircle, color: "text-amber-400" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-2 rounded-lg bg-white/[0.025] border border-white/[0.05] text-center"
            >
              <stat.icon className={`w-3 h-3 ${stat.color} mx-auto mb-1`} />
              <div className="text-[11px] font-bold text-white/80">
                {stat.value}
              </div>
              <div className="text-[8px] text-white/25">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Email Template Preview */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-3 h-3 text-purple-400" />
            <span className="text-[10px] font-bold text-white/50">
              현재 템플릿
            </span>
          </div>
          <div className="text-[10px] text-white/30 mb-1">
            제목:{" "}
            <span className="text-white/50">
              안녕하세요{" "}
              <span className="px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px]">
                {"{{name}}"}
              </span>
              님, 브랜드 협업 제안드립니다
            </span>
          </div>
          <div className="text-[9px] text-white/20 leading-relaxed">
            안녕하세요{" "}
            <span className="px-1 py-0.5 rounded bg-purple-500/15 text-purple-300/70 text-[8px]">
              {"{{name}}"}
            </span>
            님! 팔로워{" "}
            <span className="px-1 py-0.5 rounded bg-blue-500/15 text-blue-300/70 text-[8px]">
              {"{{follower_count}}"}
            </span>
            명의 멋진 계정을 보고 연락드립니다. 저희 캠페인 제안서를 확인해주세요:{" "}
            <span className="px-1 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-300/70 text-[8px]">
              {"{{proposal_link}}"}
            </span>
          </div>
        </div>

        {/* Recipient Table */}
        <div className="rounded-xl border border-white/[0.05] overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 px-3 py-2 bg-white/[0.02] text-[9px] text-white/25 font-medium border-b border-white/[0.04]">
            <span>인플루언서</span>
            <span>이메일</span>
            <span className="text-center">열람</span>
            <span className="text-center">클릭</span>
            <span className="text-center">상태</span>
          </div>
          {/* Rows */}
          {recipients.map((r) => (
            <div
              key={r.name}
              className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-center px-3 py-2 border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.01] transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30" />
                <span className="text-[10px] text-white/50 truncate">
                  @{r.name}
                </span>
              </div>
              <span className="text-[9px] text-white/25 truncate">
                {r.email}
              </span>
              <div className="flex justify-center">
                {r.opened ? (
                  <Check className="w-3 h-3 text-green-400/60" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-white/10" />
                )}
              </div>
              <div className="flex justify-center">
                {r.clicked ? (
                  <Check className="w-3 h-3 text-blue-400/60" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-white/10" />
                )}
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${r.statusColor}`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppWindow>
  );
}

/* ── Feature 3: 인박스 & 회신 관리 ── */
function InboxMockup() {
  const threads = [
    {
      name: "beauty_star",
      preview: "안녕하세요! 제안 감사합니다. 제품 관련해서 몇 가지...",
      time: "2분 전",
      unread: true,
      status: "답변 대기",
      statusColor: "bg-amber-500/15 text-amber-400",
    },
    {
      name: "travel_kim",
      preview: "네, 참여하겠습니다! 배송 주소는 어디로 보내면...",
      time: "1시간 전",
      unread: true,
      status: "확정",
      statusColor: "bg-green-500/15 text-green-400",
    },
    {
      name: "food_master",
      preview: "리워드 조건을 좀 더 자세히 알 수 있을까요?",
      time: "3시간 전",
      unread: false,
      status: "답변 완료",
      statusColor: "bg-blue-500/15 text-blue-400",
    },
  ];

  return (
    <AppWindow
      title="Uncustom - 인박스"
      tabs={["전체", "미확인", "확정"]}
      activeTab={0}
    >
      <div className="flex h-[380px]">
        {/* Thread List */}
        <div className="w-[45%] border-r border-white/[0.05] overflow-hidden">
          <div className="p-2">
            <div className="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] mb-2">
              <span className="text-[9px] text-white/20">
                검색...
              </span>
            </div>
          </div>
          {threads.map((t, i) => (
            <div
              key={t.name}
              className={`px-3 py-2.5 border-b border-white/[0.03] cursor-default transition-colors ${
                i === 0
                  ? "bg-purple-500/[0.06] border-l-2 border-l-purple-500"
                  : "hover:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {t.unread && (
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  )}
                  <span
                    className={`text-[10px] ${
                      t.unread
                        ? "font-bold text-white/80"
                        : "text-white/50"
                    }`}
                  >
                    @{t.name}
                  </span>
                </div>
                <span className="text-[8px] text-white/20">{t.time}</span>
              </div>
              <div className="text-[9px] text-white/25 truncate mb-1.5">
                {t.preview}
              </div>
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[7px] font-medium ${t.statusColor}`}
              >
                {t.status}
              </span>
            </div>
          ))}
        </div>

        {/* Thread Detail */}
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-2 border-b border-white/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-500/30" />
              <div>
                <div className="text-[10px] font-bold text-white/70">
                  @beauty_star
                </div>
                <div className="text-[8px] text-white/25">
                  beauty@gmail.com
                </div>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-amber-500/15 text-amber-400">
              답변 대기
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 space-y-3 overflow-hidden">
            {/* Outbound */}
            <div className="flex justify-end">
              <div className="max-w-[85%] p-2.5 rounded-xl rounded-tr-sm bg-purple-500/15 border border-purple-500/10">
                <div className="text-[9px] text-white/50 leading-relaxed">
                  안녕하세요 beauty_star님! Brand Beauty Korea 마케팅
                  담당자입니다. 팔로워 152K의 멋진 계정을 보고 연락드립니다.
                  저희 Summer Beauty Campaign 제안서를 확인해주세요.
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  <ExternalLink className="w-2.5 h-2.5 text-purple-400/60" />
                  <span className="text-[8px] text-purple-300/60 underline">
                    제안서 보기
                  </span>
                </div>
                <div className="text-[7px] text-white/15 text-right mt-1">
                  어제 14:30
                </div>
              </div>
            </div>

            {/* Inbound */}
            <div className="flex justify-start">
              <div className="max-w-[85%] p-2.5 rounded-xl rounded-tl-sm bg-white/[0.04] border border-white/[0.06]">
                <div className="text-[9px] text-white/50 leading-relaxed">
                  안녕하세요! 제안 감사합니다. 제품 관련해서 몇 가지
                  여쭤볼게요. 글로우 세럼은 어떤 타입인가요? 그리고 콘텐츠
                  업로드 기한이 어떻게 되나요?
                </div>
                <div className="text-[7px] text-white/15 mt-1">
                  오늘 09:15
                </div>
              </div>
            </div>

            {/* Reply Composer */}
            <div className="mt-auto pt-2 border-t border-white/[0.04]">
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[9px] text-white/20">
                    답장 작성...
                  </span>
                </div>
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Send className="w-3 h-3 text-purple-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

/* ── Feature 4: 성과 추적 대시보드 ── */
function MetricsMockup() {
  const barData = [30, 50, 45, 70, 60, 85, 75, 95, 80, 65, 90, 100];
  const linePoints = barData
    .map((v, i) => `${(i / (barData.length - 1)) * 100},${100 - v}`)
    .join(" ");

  const influencerPerformance = [
    {
      name: "beauty_star",
      platform: "instagram",
      views: "45.2K",
      likes: "3.8K",
      comments: "156",
      status: "완료",
    },
    {
      name: "travel_kim",
      platform: "youtube",
      views: "128K",
      likes: "5.2K",
      comments: "342",
      status: "완료",
    },
    {
      name: "food_master",
      platform: "tiktok",
      views: "890K",
      likes: "45K",
      comments: "2.1K",
      status: "업로드됨",
    },
  ];

  return (
    <AppWindow
      title="Uncustom - 성과 추적"
      tabs={["개요", "인플루언서", "콘텐츠"]}
      activeTab={0}
    >
      <div className="p-3">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            {
              label: "총 도달",
              value: "1.2M",
              change: "+23%",
              up: true,
              icon: Users,
              color: "text-purple-400",
            },
            {
              label: "총 조회수",
              value: "4.8M",
              change: "+18%",
              up: true,
              icon: Eye,
              color: "text-blue-400",
            },
            {
              label: "참여율",
              value: "6.8%",
              change: "+2.1%",
              up: true,
              icon: Heart,
              color: "text-pink-400",
            },
            {
              label: "예상 ROI",
              value: "340%",
              change: "+45%",
              up: true,
              icon: TrendingUp,
              color: "text-green-400",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.05]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                <span className="text-[8px] text-green-400 font-medium">
                  {kpi.change}
                </span>
              </div>
              <div className="text-sm font-bold text-white/80">{kpi.value}</div>
              <div className="text-[8px] text-white/25">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-white/50">
              주간 조회수 추이
            </span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[8px] text-white/25">
                <div className="w-2 h-2 rounded-full bg-purple-500/50" />
                조회수
              </span>
              <span className="flex items-center gap-1 text-[8px] text-white/25">
                <div className="w-2 h-2 rounded-full bg-blue-500/50" />
                참여
              </span>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="relative h-24">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="0.5"
                />
              ))}
              {/* Area fill */}
              <polygon
                points={`0,100 ${linePoints} 100,100`}
                fill="url(#chart-gradient)"
              />
              {/* Line */}
              <polyline
                points={linePoints}
                fill="none"
                stroke="#A855F7"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Dots */}
              {barData.map((v, i) => (
                <circle
                  key={i}
                  cx={(i / (barData.length - 1)) * 100}
                  cy={100 - v}
                  r="1.5"
                  fill="#A855F7"
                  stroke="#0a0a12"
                  strokeWidth="0.5"
                />
              ))}
              <defs>
                <linearGradient
                  id="chart-gradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#A855F7" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="flex justify-between mt-1 text-[7px] text-white/15">
            {["1주", "2주", "3주", "4주", "5주", "6주"].map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        </div>

        {/* Influencer Performance Table */}
        <div className="rounded-xl border border-white/[0.05] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 px-3 py-2 bg-white/[0.02] text-[8px] text-white/25 font-medium border-b border-white/[0.04]">
            <span>인플루언서</span>
            <span>플랫폼</span>
            <span className="text-right">조회수</span>
            <span className="text-right">좋아요</span>
            <span className="text-right">댓글</span>
            <span className="text-center">상태</span>
          </div>
          {influencerPerformance.map((inf) => (
            <div
              key={inf.name}
              className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 items-center px-3 py-2 border-b border-white/[0.03] last:border-b-0"
            >
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30" />
                <span className="text-[9px] text-white/50">@{inf.name}</span>
              </div>
              <div className="flex justify-center">
                {inf.platform === "instagram" && (
                  <InstagramLogo className="w-3.5 h-3.5" />
                )}
                {inf.platform === "youtube" && (
                  <YoutubeLogo className="w-3.5 h-3.5" />
                )}
                {inf.platform === "tiktok" && (
                  <TikTokLogo className="w-3.5 h-3.5" />
                )}
              </div>
              <span className="text-[9px] text-white/50 text-right font-mono">
                {inf.views}
              </span>
              <span className="text-[9px] text-white/35 text-right font-mono">
                {inf.likes}
              </span>
              <span className="text-[9px] text-white/35 text-right font-mono">
                {inf.comments}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[7px] font-medium bg-green-500/15 text-green-400 text-center">
                {inf.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppWindow>
  );
}

/* ── Feature data ── */
const features = [
  {
    icon: FileText,
    title: "제안서 링크 빌더",
    badge: "Landing Page Generator",
    desc: "브랜드 맞춤 제안서를 폼으로 작성하면 깔끔한 공개 랜딩페이지 URL이 자동 생성됩니다. 인플루언서가 링크를 통해 미션, 리워드, 제품을 한눈에 확인하고 바로 참여 신청까지.",
    gradient: "from-purple-500 to-fuchsia-500",
    color: "#A855F7",
    highlights: [
      "제안서 URL 자동 생성",
      "미션 / 리워드 / 제품 소개",
      "참여 신청 폼 내장",
      "DM·이메일 템플릿에 자동 삽입",
    ],
    mockup: <ProposalMockup />,
    reverse: false,
  },
  {
    icon: Send,
    title: "DM/이메일 자동 발송",
    badge: "Personalized Outreach",
    desc: "개인화 태그(이름, 팔로워수, 제안서 링크)를 자동 삽입하여 대량 발송. 열람, 클릭, 바운스를 실시간으로 추적하며 N회차 후속 이메일까지 자동 관리합니다.",
    gradient: "from-blue-500 to-cyan-500",
    color: "#3B82F6",
    highlights: [
      "개인화 태그 자동 삽입",
      "열람·클릭·바운스 실시간 추적",
      "N회차 자동 후속 발송",
      "DM + 이메일 통합 관리",
    ],
    mockup: <EmailMockup />,
    reverse: true,
  },
  {
    icon: Inbox,
    title: "인박스 & 회신 관리",
    badge: "Thread Management",
    desc: "인플루언서 회신을 스레드별로 깔끔하게 관리합니다. 답장 상태가 자동으로 업데이트되어 대기, 답변완료, 확정 상태를 한눈에 파악할 수 있습니다.",
    gradient: "from-emerald-500 to-teal-500",
    color: "#10B981",
    highlights: [
      "스레드별 대화 관리",
      "자동 상태 업데이트",
      "인바운드 웹훅 연동",
      "캠페인별 필터링",
    ],
    mockup: <InboxMockup />,
    reverse: false,
  },
  {
    icon: BarChart3,
    title: "성과 추적 대시보드",
    badge: "Analytics & ROI",
    desc: "콘텐츠 업로드 여부, 조회수, 좋아요, 공유수를 자동 수집합니다. 캠페인별 ROI를 실시간 대시보드에서 한눈에 확인하고 리포트를 생성하세요.",
    gradient: "from-orange-500 to-red-500",
    color: "#F59E0B",
    highlights: [
      "KPI 자동 수집 (조회수, 참여율)",
      "캠페인별 ROI 분석",
      "인플루언서별 성과 비교",
      "주간/월간 트렌드 차트",
    ],
    mockup: <MetricsMockup />,
    reverse: true,
  },
];

/* ── Main Section ── */
export function FeatureAutomationSection() {
  return (
    <section className="relative py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-fuchsia-600/[0.03] rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 left-0 w-[500px] h-[500px] bg-blue-600/[0.03] rounded-full blur-[120px]" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-sm text-fuchsia-300 mb-6">
            Campaign Automation
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
            추출부터 성과까지,{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 to-purple-400 bg-clip-text text-transparent">
              원스톱 자동화
            </span>
          </h2>
          <p className="text-lg text-white/35 max-w-2xl mx-auto">
            제안서 링크 생성부터 DM/이메일 발송, 회신 관리, 성과
            추적까지 — 모든 과정이 하나의 플랫폼에서 자동으로 연결됩니다
          </p>
        </motion.div>

        {/* Feature Cards - Full Width Alternating */}
        <div className="space-y-16">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1 }}
            >
              {/* Connecting line between features */}
              {i > 0 && (
                <div className="flex justify-center mb-10">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-px h-8 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                    <ChevronRight className="w-4 h-4 text-white/10 rotate-90" />
                  </div>
                </div>
              )}

              <div
                className={`flex flex-col ${
                  feature.reverse ? "lg:flex-row-reverse" : "lg:flex-row"
                } gap-8 lg:gap-12 items-center`}
              >
                {/* Text Side */}
                <div className="flex-1 min-w-0 lg:max-w-[420px]">
                  {/* Badge */}
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4"
                    style={{ backgroundColor: `${feature.color}15` }}
                  >
                    <feature.icon
                      className="w-4 h-4"
                      style={{ color: feature.color }}
                    />
                    <span
                      className="text-xs font-bold"
                      style={{ color: `${feature.color}CC` }}
                    >
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="text-2xl lg:text-3xl font-extrabold text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-white/40 leading-relaxed mb-6">
                    {feature.desc}
                  </p>

                  {/* Highlights */}
                  <div className="space-y-2.5">
                    {feature.highlights.map((h) => (
                      <div key={h} className="flex items-center gap-2.5">
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${feature.color}20` }}
                        >
                          <Check
                            className="w-3 h-3"
                            style={{ color: feature.color }}
                          />
                        </div>
                        <span className="text-sm text-white/50">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mockup Side */}
                <div className="flex-1 min-w-0 w-full lg:max-w-[560px]">
                  {feature.mockup}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
