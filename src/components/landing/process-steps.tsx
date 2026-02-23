"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Search, Database, Rocket, ArrowRight } from "lucide-react";
import { InstagramLogo, TikTokLogo, YoutubeLogo, TwitterLogo } from "./platform-logos";

const steps = [
  {
    num: "01",
    icon: Search,
    title: "글로벌 추출",
    subtitle: "AI가 5개 플랫폼을 동시에 스캔",
    desc: "키워드/태그 입력 하나로 모든 플랫폼을 동시에 스캔. 프로필 보강과 이메일 수집까지 자동 완료.",
    gradient: "from-purple-500 to-fuchsia-500",
    color: "#A855F7",
    platforms: true,
  },
  {
    num: "02",
    icon: Database,
    title: "마스터데이터",
    subtitle: "스마트 필터링 & 분류",
    desc: "추출된 인플루언서를 팔로워수, 국가, 카테고리로 정밀하게 필터링. 원하는 인플루언서를 즉시 찾아냅니다.",
    gradient: "from-blue-500 to-cyan-500",
    color: "#3B82F6",
    mockRows: true,
  },
  {
    num: "03",
    icon: Rocket,
    title: "캠페인 자동화",
    subtitle: "배정 → 제안서 → 이메일 → 성과",
    desc: "캠페인에 배정하면 제안서 발송, 이메일 아웃리치, 회신 관리, 성과 추적까지 자동으로 진행.",
    gradient: "from-emerald-500 to-teal-500",
    color: "#10B981",
    statusFlow: true,
  },
];

export function ProcessStepsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="process" className="relative py-28 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-purple-600/[0.02] rounded-full blur-[120px]" />

      <div className="relative max-w-6xl mx-auto px-6" ref={ref}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-sm text-purple-300 mb-6">
            3-Step Process
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            3단계로 끝나는
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
              인플루언서 마케팅
            </span>
          </h2>
        </motion.div>

        {/* Steps - vertical flow */}
        <div className="space-y-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.2 }}
            >
              <div
                className="relative rounded-3xl border bg-white/[0.015] hover:bg-white/[0.03] transition-all duration-700 overflow-hidden group"
                style={{ borderColor: `${step.color}20` }}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: `radial-gradient(ellipse at 30% 50%, ${step.color}06, transparent 70%)` }} />

                <div className="relative p-8 flex flex-col md:flex-row items-start gap-8">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    {/* Step badge */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.gradient} p-[1px]`}>
                        <div className="w-full h-full rounded-xl bg-[#08080d] flex items-center justify-center">
                          <step.icon className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-mono text-white/20">STEP {step.num}</div>
                        <div className="text-xl font-bold text-white">{step.title}</div>
                      </div>
                    </div>

                    <p className={`text-sm font-medium bg-gradient-to-r ${step.gradient} bg-clip-text text-transparent mb-2`}>
                      {step.subtitle}
                    </p>
                    <p className="text-sm text-white/35 leading-relaxed max-w-md">{step.desc}</p>
                  </div>

                  {/* Right: Mini visual */}
                  <div className="w-full md:w-[280px] shrink-0">
                    <div className="rounded-2xl border border-white/[0.06] bg-[#08080d]/80 p-4">
                      {step.platforms && (
                        <div className="flex items-center gap-3 flex-wrap">
                          {[
                            { Logo: InstagramLogo, name: "Instagram", count: "2.8K" },
                            { Logo: TikTokLogo, name: "TikTok", count: "1.5K" },
                            { Logo: YoutubeLogo, name: "YouTube", count: "940" },
                            { Logo: TwitterLogo, name: "Twitter", count: "720" },
                          ].map((p) => (
                            <div key={p.name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                              <p.Logo className="w-5 h-5" />
                              <span className="text-[10px] text-white/50">{p.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {step.mockRows && (
                        <div className="space-y-2">
                          {[
                            { color: "from-pink-500 to-purple-500", name: "beauty_star", followers: "152K" },
                            { color: "from-blue-500 to-cyan-500", name: "travel_kim", followers: "89K" },
                            { color: "from-orange-500 to-red-500", name: "food_master", followers: "1.2M" },
                          ].map((row) => (
                            <div key={row.name} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.02]">
                              <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${row.color}`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] text-white/60 font-medium truncate">@{row.name}</div>
                              </div>
                              <div className="text-[10px] text-white/30 font-mono">{row.followers}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {step.statusFlow && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {["추출", "배정", "발송", "회신", "완료"].map((s, si) => (
                            <div key={s} className="flex items-center gap-1">
                              <div className={`px-2 py-1 rounded-md text-[10px] font-medium ${
                                si < 3 ? "bg-emerald-500/15 text-emerald-400" : si === 3 ? "bg-blue-500/15 text-blue-400" : "bg-white/5 text-white/30"
                              }`}>
                                {s}
                              </div>
                              {si < 4 && <ArrowRight className="w-3 h-3 text-white/10" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Connecting arrow to next step */}
                {i < steps.length - 1 && (
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-[#08080d] border border-white/[0.08] flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-white/20 rotate-90" />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
