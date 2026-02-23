"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  InstagramLogo,
  TikTokLogo,
  YoutubeLogo,
  TwitterLogo,
  SupabaseLogo,
  ResendLogo,
} from "./platform-logos";
import {
  Search,
  Database,
  FileText,
  Send,
  Inbox,
  BarChart3,
  Mail,
  Users,
  Filter,
  Zap,
  ArrowDown,
  ArrowRight,
} from "lucide-react";

/* ── Dashed connector line ── */
function DashLine({ direction = "down", color = "#8B5CF6" }: { direction?: "down" | "right"; color?: string }) {
  const isDown = direction === "down";
  return (
    <div className={`flex ${isDown ? "flex-col" : "flex-row"} items-center gap-0 ${isDown ? "h-10 w-px" : "w-10 h-px"}`}>
      <div
        className={`${isDown ? "w-px flex-1" : "h-px flex-1"}`}
        style={{
          background: `repeating-linear-gradient(${isDown ? "180deg" : "90deg"}, ${color}60 0px, ${color}60 4px, transparent 4px, transparent 8px)`,
        }}
      />
      {isDown ? (
        <ArrowDown className="w-3 h-3 shrink-0" style={{ color: `${color}90` }} />
      ) : (
        <ArrowRight className="w-3 h-3 shrink-0" style={{ color: `${color}90` }} />
      )}
    </div>
  );
}

/* ── Node card ── */
function NodeCard({
  children,
  color,
  label,
  dashed = false,
  className = "",
}: {
  children: React.ReactNode;
  color: string;
  label?: string;
  dashed?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        className="relative px-4 py-3 rounded-2xl bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.06] transition-all duration-500 hover:scale-[1.03] cursor-default group"
        style={{
          border: `1px ${dashed ? "dashed" : "solid"} ${color}30`,
          boxShadow: `0 0 0 rgba(0,0,0,0)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 0 30px ${color}15`;
          e.currentTarget.style.borderColor = `${color}50`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 rgba(0,0,0,0)`;
          e.currentTarget.style.borderColor = `${color}30`;
        }}
      >
        {children}
      </div>
      {label && (
        <span className="text-[11px] text-white/30 font-medium">{label}</span>
      )}
    </div>
  );
}

/* ── Category group ── */
function CategoryGroup({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div
        className="absolute -inset-3 rounded-2xl border border-dashed opacity-30"
        style={{ borderColor: color }}
      />
      <div className="relative p-4">
        <div
          className="inline-block px-3 py-1 rounded-lg text-xs font-bold mb-4"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Main Flow Architecture Section ── */
export function FlowArchitectureSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="flow" className="relative py-28 overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-purple-600/[0.03] rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-blue-600/[0.03] rounded-full blur-[120px]" />

      <div className="relative max-w-6xl mx-auto px-6" ref={ref}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-sm text-purple-300 mb-6">
            Uncustom Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
            하나의 플랫폼에서
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              모든 것이 연결됩니다
            </span>
          </h2>
          <p className="text-lg text-white/35 max-w-2xl mx-auto">
            AI 추출 엔진부터 이메일 발송, 성과 추적까지 — 모든 노드가 하나로 연결된 자동화 아키텍처
          </p>
        </motion.div>

        {/* ─── Flow Diagram ─── */}
        <div className="flex flex-col items-center gap-0">

          {/* ── ROW 1: Platform Sources ── */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <CategoryGroup title="SNS 플랫폼" color="#E1306C">
              <div className="flex items-center gap-4 flex-wrap justify-center">
                <NodeCard color="#E1306C">
                  <div className="flex items-center gap-2.5">
                    <InstagramLogo className="w-8 h-8" />
                    <div>
                      <div className="text-sm font-bold text-white">Instagram</div>
                      <div className="text-[10px] text-white/30">해시태그 · 태그 · 프로필</div>
                    </div>
                  </div>
                </NodeCard>
                <NodeCard color="#25F4EE">
                  <div className="flex items-center gap-2.5">
                    <TikTokLogo className="w-8 h-8" />
                    <div>
                      <div className="text-sm font-bold text-white">TikTok</div>
                      <div className="text-[10px] text-white/30">키워드 검색</div>
                    </div>
                  </div>
                </NodeCard>
                <NodeCard color="#FF0000">
                  <div className="flex items-center gap-2.5">
                    <YoutubeLogo className="w-8 h-8" />
                    <div>
                      <div className="text-sm font-bold text-white">YouTube</div>
                      <div className="text-[10px] text-white/30">키워드 검색</div>
                    </div>
                  </div>
                </NodeCard>
                <NodeCard color="#ffffff">
                  <div className="flex items-center gap-2.5">
                    <TwitterLogo className="w-8 h-8" />
                    <div>
                      <div className="text-sm font-bold text-white">Twitter/X</div>
                      <div className="text-[10px] text-white/30">키워드 검색</div>
                    </div>
                  </div>
                </NodeCard>
              </div>
            </CategoryGroup>
          </motion.div>

          {/* Connector */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.3 }}
          >
            <DashLine direction="down" color="#8B5CF6" />
          </motion.div>

          {/* ── ROW 2: AI Engine (Central Hub) ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-purple-500/10 blur-3xl" />
              <div className="relative px-10 py-6 rounded-3xl bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <span className="text-xl font-black text-white">U</span>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">Uncustom AI Engine</div>
                    <div className="text-sm text-purple-300/60">Apify + Supabase Realtime + AI 자동화</div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[10px] text-green-400 font-semibold">LIVE</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Connector */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.7 }}
          >
            <DashLine direction="down" color="#8B5CF6" />
          </motion.div>

          {/* ── ROW 3: Feature Groups (3 columns) ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="grid md:grid-cols-3 gap-8 w-full max-w-5xl"
          >
            {/* Data & Analysis */}
            <CategoryGroup title="데이터 & 분석" color="#8B5CF6">
              <div className="space-y-3">
                <NodeCard color="#8B5CF6" dashed>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Database className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">마스터데이터</div>
                      <div className="text-[10px] text-white/25">필터 · 분류 · 검색</div>
                    </div>
                  </div>
                </NodeCard>
                <NodeCard color="#8B5CF6" dashed>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">캠페인 배정</div>
                      <div className="text-[10px] text-white/25">N:M 매핑 · 상태 추적</div>
                    </div>
                  </div>
                </NodeCard>
                <NodeCard color="#8B5CF6" dashed>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">성과 대시보드</div>
                      <div className="text-[10px] text-white/25">조회수 · ROI · 리포트</div>
                    </div>
                  </div>
                </NodeCard>
              </div>
            </CategoryGroup>

            {/* Outreach */}
            <CategoryGroup title="아웃리치" color="#3B82F6">
              <div className="space-y-3">
                <NodeCard color="#3B82F6" dashed>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">제안서 빌더</div>
                      <div className="text-[10px] text-white/25">랜딩페이지 자동 생성</div>
                    </div>
                  </div>
                </NodeCard>
                <NodeCard color="#3B82F6" dashed>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Send className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">DM / 이메일 발송</div>
                      <div className="text-[10px] text-white/25">개인화 태그 · 추적</div>
                    </div>
                  </div>
                </NodeCard>
                <NodeCard color="#3B82F6" dashed>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Inbox className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">인박스 관리</div>
                      <div className="text-[10px] text-white/25">스레드별 회신 관리</div>
                    </div>
                  </div>
                </NodeCard>
              </div>
            </CategoryGroup>

            {/* Integrations */}
            <CategoryGroup title="연동 서비스" color="#10B981">
              <div className="space-y-3">
                <NodeCard color="#10B981" dashed>
                  <div className="flex items-center gap-2.5">
                    <SupabaseLogo className="w-8 h-8" />
                    <div>
                      <div className="text-xs font-bold text-white">Supabase</div>
                      <div className="text-[10px] text-white/25">DB · Auth · Realtime</div>
                    </div>
                  </div>
                </NodeCard>
                <NodeCard color="#10B981" dashed>
                  <div className="flex items-center gap-2.5">
                    <ResendLogo className="w-8 h-8" />
                    <div>
                      <div className="text-xs font-bold text-white">Resend</div>
                      <div className="text-[10px] text-white/25">이메일 · 웹훅 · 인바운드</div>
                    </div>
                  </div>
                </NodeCard>
                <NodeCard color="#10B981" dashed>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Apify</div>
                      <div className="text-[10px] text-white/25">스크래핑 · 프로필 보강</div>
                    </div>
                  </div>
                </NodeCard>
              </div>
            </CategoryGroup>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
