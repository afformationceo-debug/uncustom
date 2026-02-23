"use client";

import { motion } from "framer-motion";
import { Check, X, Minus, Zap } from "lucide-react";

const rows = [
  {
    feature: "인플루언서 발굴",
    manual: "수동 검색 (15분/1명)",
    competitor: "단일 플랫폼",
    uncustom: "AI 5개 플랫폼 동시 스캔",
    manualScore: 1,
    competitorScore: 2,
    uncustomScore: 5,
  },
  {
    feature: "이메일 수집",
    manual: "프로필 직접 확인",
    competitor: "일부 자동",
    uncustom: "바이오 + 링크 자동 추출",
    manualScore: 1,
    competitorScore: 3,
    uncustomScore: 5,
  },
  {
    feature: "섭외 제안서",
    manual: "수동 작성 + 발송",
    competitor: "이메일만",
    uncustom: "맞춤 랜딩페이지 자동 생성",
    manualScore: 1,
    competitorScore: 2,
    uncustomScore: 5,
  },
  {
    feature: "발송 & 추적",
    manual: "이메일 수동 발송",
    competitor: "이메일만",
    uncustom: "DM + 이메일 + 열람 추적",
    manualScore: 1,
    competitorScore: 3,
    uncustomScore: 5,
  },
  {
    feature: "성과 분석",
    manual: "엑셀 수동 집계",
    competitor: "기본 통계",
    uncustom: "자동 수집 + ROI 대시보드",
    manualScore: 1,
    competitorScore: 2,
    uncustomScore: 5,
  },
  {
    feature: "멀티 플랫폼",
    manual: false,
    competitor: "제한적 (1~2개)",
    uncustom: "IG / TT / YT / TW 통합",
    manualScore: 0,
    competitorScore: 2,
    uncustomScore: 5,
  },
  {
    feature: "제안서 링크",
    manual: false,
    competitor: false,
    uncustom: "공개 URL + 참여 신청 폼",
    manualScore: 0,
    competitorScore: 0,
    uncustomScore: 5,
  },
  {
    feature: "인박스 통합",
    manual: false,
    competitor: "별도 앱 필요",
    uncustom: "스레드별 회신 관리",
    manualScore: 0,
    competitorScore: 1,
    uncustomScore: 5,
  },
];

function ScoreDots({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex gap-0.5 justify-center">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < score ? color : "bg-white/5"
          }`}
        />
      ))}
    </div>
  );
}

export function ComparisonSection() {
  return (
    <section id="comparison" className="relative py-28 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/[0.03] rounded-full blur-[120px]" />

      <div className="relative max-w-5xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-sm text-purple-300 mb-6">
            Comparison
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
            왜{" "}
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Uncustom
            </span>
            인가요?
          </h2>
          <p className="text-lg text-white/35 max-w-xl mx-auto">
            수동 작업, 기존 솔루션과 Uncustom을 비교해보세요
          </p>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl border border-white/[0.06] bg-white/[0.01] overflow-hidden"
        >
          {/* Header Row */}
          <div className="grid grid-cols-4 text-sm font-semibold border-b border-white/[0.06]">
            <div className="p-5 text-white/40">기능</div>
            <div className="p-5 text-white/25 text-center">
              <div>수동 작업</div>
              <div className="text-[10px] text-white/15 font-normal mt-0.5">
                엑셀 + 이메일
              </div>
            </div>
            <div className="p-5 text-white/25 text-center">
              <div>기존 솔루션</div>
              <div className="text-[10px] text-white/15 font-normal mt-0.5">
                단일 기능 도구
              </div>
            </div>
            <div className="p-5 text-center relative">
              <div className="absolute inset-0 bg-gradient-to-b from-purple-500/[0.08] to-purple-500/[0.03]" />
              <div className="relative">
                <div className="flex items-center justify-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent font-bold">
                    Uncustom
                  </span>
                </div>
                <div className="text-[10px] text-purple-300/40 font-normal mt-0.5">
                  올인원 자동화
                </div>
              </div>
            </div>
          </div>

          {/* Data Rows */}
          {rows.map((row, i) => (
            <motion.div
              key={row.feature}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="grid grid-cols-4 text-sm border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.015] transition-colors group"
            >
              <div className="p-5 text-white/60 font-medium">{row.feature}</div>
              <div className="p-5 text-center">
                {row.manual === false ? (
                  <X className="w-4 h-4 text-red-400/50 mx-auto" />
                ) : (
                  <div>
                    <div className="text-xs text-white/20 mb-1">
                      {row.manual}
                    </div>
                    <ScoreDots
                      score={row.manualScore}
                      color="bg-red-400/40"
                    />
                  </div>
                )}
              </div>
              <div className="p-5 text-center">
                {row.competitor === false ? (
                  <X className="w-4 h-4 text-red-400/50 mx-auto" />
                ) : (
                  <div>
                    <div className="text-xs text-white/20 mb-1">
                      {row.competitor}
                    </div>
                    <ScoreDots
                      score={row.competitorScore}
                      color="bg-yellow-400/40"
                    />
                  </div>
                )}
              </div>
              <div className="p-5 text-center relative">
                <div className="absolute inset-0 bg-purple-500/[0.03] group-hover:bg-purple-500/[0.06] transition-colors" />
                <div className="relative">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-xs text-purple-300/80 font-medium">
                      {row.uncustom as string}
                    </span>
                  </div>
                  <ScoreDots
                    score={row.uncustomScore}
                    color="bg-purple-400"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-purple-500/[0.06] border border-purple-500/15">
            <Zap className="w-5 h-5 text-purple-400" />
            <span className="text-sm text-white/50">
              Uncustom은 수동 작업 대비{" "}
              <span className="text-purple-300 font-bold">평균 10배</span> 빠르고,
              기존 솔루션 대비{" "}
              <span className="text-purple-300 font-bold">3배 더 많은 기능</span>을
              제공합니다.
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
