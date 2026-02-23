"use client";

import { motion } from "framer-motion";
import { Clock, Copy, FileSpreadsheet, Sparkles } from "lucide-react";

const pains = [
  {
    icon: Clock,
    title: "인플루언서 찾느라 하루종일 SNS 서핑",
    desc: "키워드 검색 → 프로필 확인 → 이메일 찾기... 한 명당 15분씩, 하루에 겨우 30명",
    color: "from-red-500/20 to-orange-500/20",
    iconColor: "text-red-400",
    borderColor: "border-red-500/10",
  },
  {
    icon: Copy,
    title: "DM/이메일 일일이 복붙하고 답장 기다리기",
    desc: "100명에게 같은 내용 복붙, 읽었는지 답장했는지 추적도 안 되는 메시지들",
    color: "from-orange-500/20 to-yellow-500/20",
    iconColor: "text-orange-400",
    borderColor: "border-orange-500/10",
  },
  {
    icon: FileSpreadsheet,
    title: "캠페인 성과? 엑셀에 수동 집계",
    desc: "게시물 올렸는지 확인하고, 조회수 하나하나 기록하고... 리포트는 언제 만들지?",
    color: "from-yellow-500/20 to-amber-500/20",
    iconColor: "text-yellow-400",
    borderColor: "border-yellow-500/10",
  },
];

export function PainPointsSection() {
  return (
    <section className="relative py-28 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-red-600/[0.03] rounded-full blur-[100px]" />

      <div className="relative max-w-5xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-sm text-red-300 mb-6">
            이런 고민, 하고 계시죠?
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            수동 인플루언서 마케팅의
            <br />
            <span className="text-white/40">끝없는 반복 작업</span>
          </h2>
        </motion.div>

        {/* Pain Cards */}
        <div className="space-y-5 mb-20">
          {pains.map((pain, i) => (
            <motion.div
              key={pain.title}
              initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className={`group relative p-6 rounded-2xl border ${pain.borderColor} bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-500`}
            >
              <div className="flex items-start gap-5">
                <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${pain.color} flex items-center justify-center`}>
                  <pain.icon className={`w-6 h-6 ${pain.iconColor}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white/90 mb-1.5">{pain.title}</h3>
                  <p className="text-white/40 leading-relaxed">{pain.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Transition to Solution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="relative text-center"
        >
          {/* Connecting line */}
          <div className="w-px h-16 bg-gradient-to-b from-red-500/20 to-purple-500/40 mx-auto mb-8" />

          <div className="relative inline-block">
            <div className="absolute inset-0 blur-3xl bg-purple-500/10 -z-10" />
            <div className="flex items-center gap-3 mb-4 justify-center">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <span className="text-sm font-semibold text-purple-300 uppercase tracking-widest">Solution</span>
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
              Uncustom이 이 모든 과정을
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                AI로 자동화합니다
              </span>
            </h2>
            <p className="text-lg text-white/40 max-w-xl mx-auto">
              키워드 입력 한 번이면 끝.
              <br />
              AI가 인플루언서를 찾고, 제안서를 보내고, 성과를 추적합니다.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
