"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  InstagramLogo,
  TikTokLogo,
  YoutubeLogo,
  TwitterLogo,
} from "./platform-logos";

/* Typing rotator */
const WORDS = ["인플루언서 마케팅", "시딩 캠페인", "브랜드 협업", "글로벌 아웃리치"];

function TypingRotator() {
  const [wi, setWi] = useState(0);
  const [ci, setCi] = useState(0);
  const [del, setDel] = useState(false);

  useEffect(() => {
    const w = WORDS[wi];
    if (!del && ci === w.length) {
      const t = setTimeout(() => setDel(true), 2200);
      return () => clearTimeout(t);
    }
    if (del && ci === 0) {
      setDel(false);
      setWi((p) => (p + 1) % WORDS.length);
      return;
    }
    const t = setTimeout(() => setCi((p) => p + (del ? -1 : 1)), del ? 35 : 70);
    return () => clearTimeout(t);
  }, [ci, del, wi]);

  return (
    <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
      {WORDS[wi].slice(0, ci)}
      <span className="inline-block w-[3px] h-[0.85em] bg-purple-400 ml-0.5 animate-pulse align-middle rounded-full" />
    </span>
  );
}

/* ── Node-based hero architecture diagram ── */
function ArchitectureDiagram() {
  const platformNodes = [
    { Logo: InstagramLogo, label: "Instagram", x: 0, y: 0, color: "#E1306C" },
    { Logo: TikTokLogo, label: "TikTok", x: 1, y: 0, color: "#25F4EE" },
    { Logo: YoutubeLogo, label: "YouTube", x: 2, y: 0, color: "#FF0000" },
    { Logo: TwitterLogo, label: "Twitter/X", x: 3, y: 0, color: "#ffffff" },
  ];

  const featureNodes = [
    { label: "마스터데이터", emoji: "📊", x: 0, y: 2, color: "#8B5CF6" },
    { label: "제안서 빌더", emoji: "📄", x: 1, y: 2, color: "#3B82F6" },
    { label: "이메일 발송", emoji: "✉️", x: 2, y: 2, color: "#10B981" },
    { label: "성과 추적", emoji: "📈", x: 3, y: 2, color: "#F59E0B" },
  ];

  return (
    <div className="relative w-full max-w-[520px] mx-auto">
      {/* SVG Connection Lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 520 340" fill="none" preserveAspectRatio="xMidYMid meet">
        {/* Platform → Center Hub lines */}
        {[65, 195, 325, 455].map((x, i) => (
          <motion.line
            key={`p-${i}`}
            x1={x} y1="52" x2="260" y2="140"
            stroke={platformNodes[i].color}
            strokeWidth="1"
            strokeDasharray="6 4"
            strokeOpacity="0.4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.5 + i * 0.15 }}
          />
        ))}
        {/* Center Hub → Feature lines */}
        {[65, 195, 325, 455].map((x, i) => (
          <motion.line
            key={`f-${i}`}
            x1="260" y1="195" x2={x} y2="280"
            stroke={featureNodes[i].color}
            strokeWidth="1"
            strokeDasharray="6 4"
            strokeOpacity="0.4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 1 + i * 0.15 }}
          />
        ))}
        {/* Animated pulse dots on lines */}
        {[65, 195, 325, 455].map((x, i) => (
          <circle key={`dot-${i}`} r="3" fill={platformNodes[i].color} opacity="0.8">
            <animateMotion
              dur={`${2 + i * 0.3}s`}
              repeatCount="indefinite"
              path={`M${x},52 L260,140`}
            />
          </circle>
        ))}
      </svg>

      {/* Platform Row (Top) */}
      <div className="flex justify-between px-2 mb-8 relative z-10">
        {platformNodes.map((node, i) => (
          <motion.div
            key={node.label}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
            className="flex flex-col items-center gap-1.5"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center border border-white/10 bg-white/[0.04] backdrop-blur-sm hover:bg-white/[0.08] transition-all duration-300 hover:scale-110 hover:border-white/20 cursor-default"
              style={{ boxShadow: `0 0 20px ${node.color}15` }}
            >
              <node.Logo className="w-7 h-7" />
            </div>
            <span className="text-[10px] text-white/40 font-medium">{node.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Center Hub - Uncustom AI Engine */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="flex justify-center my-10 relative z-10"
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-purple-500/20 blur-2xl" />
          <div className="relative px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <span className="text-base font-black text-white">U</span>
              </div>
              <div>
                <div className="text-sm font-bold text-white">Uncustom AI Engine</div>
                <div className="text-xs text-purple-300/70">자동 추출 · 분석 · 발송</div>
              </div>
            </div>
          </div>
          {/* Pulse ring */}
          <div className="absolute -inset-3 rounded-3xl border border-purple-500/10 animate-ping" style={{ animationDuration: "3s" }} />
        </div>
      </motion.div>

      {/* Feature Row (Bottom) */}
      <div className="flex justify-between px-2 relative z-10">
        {featureNodes.map((node, i) => (
          <motion.div
            key={node.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.2 + i * 0.1 }}
            className="flex flex-col items-center gap-1.5"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center border border-dashed bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.06] transition-all duration-300 hover:scale-110 cursor-default"
              style={{ borderColor: `${node.color}40`, boxShadow: `0 0 20px ${node.color}10` }}
            >
              <span className="text-lg">{node.emoji}</span>
            </div>
            <span className="text-[10px] text-white/40 font-medium">{node.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Hero ── */
export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#06060a]" />
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-600/[0.06] rounded-full blur-[120px]" />
      <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-blue-600/[0.04] rounded-full blur-[120px]" />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-purple-400/20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `landing-particle ${10 + Math.random() * 15}s linear infinite ${Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-32 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Text */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8"
            >
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-sm text-purple-300 font-medium">AI 기반 인플루언서 자동화</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.1] tracking-tight text-white mb-6"
            >
              <TypingRotator />
              <br />
              <span className="text-white/90">의 모든 것을</span>
              <br />
              <span className="text-white">자동화하세요</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-lg text-white/45 leading-relaxed mb-10 max-w-lg mx-auto lg:mx-0"
            >
              키워드 하나로 Instagram, TikTok, YouTube, Twitter까지
              <br className="hidden sm:block" />
              5개 플랫폼 인플루언서를 AI가 즉시 발굴하고,
              <br className="hidden sm:block" />
              제안서 발송부터 성과 추적까지 한 곳에서.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Link
                href="/login"
                className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(147,51,234,0.3)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-blue-600" />
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <span className="relative">무료 체험하기</span>
                <svg className="relative w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
              <a
                href="#flow"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-medium text-white/70 hover:text-white rounded-2xl border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300"
              >
                작동 원리 보기
                <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
              </a>
            </motion.div>
          </div>

          {/* Right: Architecture Diagram */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="hidden lg:block"
          >
            <ArchitectureDiagram />
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <ChevronDown className="w-5 h-5 text-white/20" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
