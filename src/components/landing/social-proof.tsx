"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Star } from "lucide-react";

function CountUp({
  end,
  suffix = "",
  prefix = "",
}: {
  end: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 2000;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }, [inView, end]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

const stats = [
  { value: 50000, suffix: "+", label: "추출된 인플루언서", icon: "🎯" },
  { value: 5, suffix: "개", label: "플랫폼 동시 지원", icon: "🌐" },
  { value: 10, suffix: "배", label: "시간 절약", icon: "⚡" },
  { value: 30, suffix: "분", label: "캠페인 셋업", icon: "🚀" },
];

const testimonials = [
  {
    quote: "인플루언서 100명 찾는데 3일 걸리던 작업이 30분으로 줄었어요.",
    author: "김민준",
    role: "뷰티 브랜드 마케터",
    rating: 5,
  },
  {
    quote: "제안서 링크 기능이 대박이에요. 인플루언서 전환율이 3배 올랐습니다.",
    author: "이서연",
    role: "패션 D2C 대표",
    rating: 5,
  },
  {
    quote: "이메일 열람 추적 덕분에 후속 연락 타이밍을 딱 맞출 수 있었어요.",
    author: "박준혁",
    role: "F&B 스타트업 CMO",
    rating: 5,
  },
];

export function SocialProofSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Divider glow line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="text-center group"
            >
              <div className="relative inline-block">
                <div className="text-4xl sm:text-5xl font-black bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                  <CountUp end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="absolute inset-0 blur-2xl bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 -z-10" />
              </div>
              <div className="text-sm text-white/40 mt-2 font-medium">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-purple-500/15 transition-all duration-500"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, si) => (
                  <Star
                    key={si}
                    className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="text-sm text-white/50 leading-relaxed mb-5 font-medium italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center text-xs font-bold text-white/60">
                  {t.author[0]}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/70">
                    {t.author}
                  </div>
                  <div className="text-[10px] text-white/30">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom divider */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </section>
  );
}
