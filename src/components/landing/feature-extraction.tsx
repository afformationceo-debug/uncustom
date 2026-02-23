"use client";

import { motion } from "framer-motion";
import { Hash, AtSign, Mail, Globe, Filter, Zap } from "lucide-react";
import { InstagramLogo, TikTokLogo, YoutubeLogo, TwitterLogo } from "./platform-logos";

const pipeline = [
  {
    step: "1",
    title: "키워드 입력",
    desc: "#뷰티, #여행, @competitor 등",
    icon: Hash,
    color: "#A855F7",
  },
  {
    step: "2",
    title: "AI 동시 스캔",
    desc: "4개 플랫폼 해시태그 & 프로필 검색",
    icon: Zap,
    color: "#3B82F6",
  },
  {
    step: "3",
    title: "프로필 자동 보강",
    desc: "팔로워, 바이오, 이메일 수집",
    icon: Filter,
    color: "#10B981",
  },
  {
    step: "4",
    title: "마스터데이터 저장",
    desc: "중복 제거 후 DB 자동 저장",
    icon: Globe,
    color: "#F59E0B",
  },
];

const extractionFeatures = [
  {
    icon: Hash,
    title: "해시태그 검색",
    desc: "키워드 기반으로 관련 게시물과 인플루언서를 자동 탐색",
    logos: [InstagramLogo],
  },
  {
    icon: AtSign,
    title: "태그 계정 발굴",
    desc: "경쟁사/관련 브랜드 계정에 태그된 인플루언서 자동 수집",
    logos: [InstagramLogo],
  },
  {
    icon: Mail,
    title: "이메일 자동 추출",
    desc: "바이오 텍스트 + 링크트리/비콘에서 이메일 패턴 AI 감지",
    logos: [],
  },
  {
    icon: Filter,
    title: "자동 프로필 보강",
    desc: "팔로워수, 바이오, 게시물수, 프로필 사진을 자동 수집",
    logos: [InstagramLogo],
  },
];

export function FeatureExtractionSection() {
  return (
    <section id="features" className="relative py-28 overflow-hidden">
      <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-purple-600/[0.03] rounded-full blur-[120px]" />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300 mb-6">
            AI Extraction Pipeline
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
            키워드 하나 →{" "}
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              자동 추출 파이프라인
            </span>
          </h2>
        </motion.div>

        {/* Pipeline Flow (Horizontal) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <div className="relative p-6 rounded-3xl border border-white/[0.06] bg-white/[0.015]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {pipeline.map((p, i) => (
                <div key={p.step} className="relative">
                  <div className="flex flex-col items-center text-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-dashed hover:bg-white/[0.04] transition-all duration-300" style={{ borderColor: `${p.color}25` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${p.color}15` }}>
                      <p.icon className="w-5 h-5" style={{ color: p.color }} />
                    </div>
                    <div>
                      <div className="text-xs font-mono mb-1" style={{ color: `${p.color}80` }}>STEP {p.step}</div>
                      <div className="text-sm font-bold text-white mb-1">{p.title}</div>
                      <div className="text-[11px] text-white/30">{p.desc}</div>
                    </div>
                  </div>
                  {/* Arrow connector */}
                  {i < pipeline.length - 1 && (
                    <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 4l4 4-4 4" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Supported Platforms row */}
            <div className="mt-5 pt-5 border-t border-white/[0.04] flex items-center justify-center gap-6">
              <span className="text-xs text-white/20">지원 플랫폼</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <InstagramLogo className="w-4 h-4" />
                  <span className="text-[10px] text-white/40">Instagram</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <TikTokLogo className="w-4 h-4" />
                  <span className="text-[10px] text-white/40">TikTok</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <YoutubeLogo className="w-4 h-4" />
                  <span className="text-[10px] text-white/40">YouTube</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <TwitterLogo className="w-4 h-4" />
                  <span className="text-[10px] text-white/40">Twitter/X</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Feature Detail Cards */}
        <div className="grid md:grid-cols-2 gap-5">
          {extractionFeatures.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.1 }}
              className="group flex items-start gap-4 p-5 rounded-2xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] hover:border-purple-500/15 transition-all duration-500"
            >
              <div className="shrink-0 w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <feat.icon className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-white/90">{feat.title}</h4>
                  {feat.logos.map((Logo, li) => (
                    <Logo key={li} className="w-4 h-4 opacity-50" />
                  ))}
                </div>
                <p className="text-sm text-white/35 leading-relaxed">{feat.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
