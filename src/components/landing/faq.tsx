"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Uncustom은 어떤 서비스인가요?",
    a: "Uncustom은 AI 기반 인플루언서 마케팅 자동화 플랫폼입니다. 키워드 입력만으로 Instagram, TikTok, YouTube, Twitter 등 5개 플랫폼에서 인플루언서를 자동 발굴하고, 제안서 발송부터 캠페인 성과 추적까지 모든 과정을 한 곳에서 관리할 수 있습니다.",
  },
  {
    q: "어떤 플랫폼의 인플루언서를 찾을 수 있나요?",
    a: "Instagram, TikTok, YouTube, Twitter/X 등 주요 SNS 플랫폼을 모두 지원합니다. 키워드 하나로 모든 플랫폼을 동시에 스캔하거나, 특정 플랫폼만 선택하여 추출할 수 있습니다.",
  },
  {
    q: "인플루언서 이메일은 어떻게 수집하나요?",
    a: "두 가지 방식으로 이메일을 자동 수집합니다. 첫째, 프로필 바이오 텍스트에서 이메일 패턴을 AI가 자동 감지합니다. 둘째, 바이오에 포함된 링크트리, 비콘 등 링크 서비스에서 이메일을 추출합니다.",
  },
  {
    q: "캠페인 제안서는 어떻게 작동하나요?",
    a: "폼에 미션, 리워드, 제품 정보 등을 입력하면 깔끔한 공개 랜딩페이지가 자동 생성됩니다. 이 URL을 DM이나 이메일 템플릿에 삽입하면 인플루언서가 링크를 통해 내용을 확인하고 바로 참여 신청할 수 있습니다.",
  },
  {
    q: "무료 체험이 가능한가요?",
    a: "네, 회원가입 후 바로 무료로 사용해보실 수 있습니다. 인플루언서 추출, 마스터데이터 관리, 캠페인 생성 등 핵심 기능을 직접 체험해보세요.",
  },
  {
    q: "팀 단위로 사용할 수 있나요?",
    a: "네, Uncustom은 팀 기반으로 설계되었습니다. 팀을 생성하고 멤버를 초대하면 같은 데이터를 실시간으로 공유하며 협업할 수 있습니다.",
  },
  {
    q: "데이터 보안은 어떻게 관리되나요?",
    a: "모든 데이터는 Supabase의 Row Level Security(RLS) 정책으로 팀 단위로 완벽하게 격리됩니다. 다른 팀의 데이터에는 절대 접근할 수 없으며, 모든 통신은 암호화됩니다.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="relative py-28 overflow-hidden">
      <div className="relative max-w-3xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/50 mb-6">
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            자주 묻는 질문
          </h2>
        </motion.div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.05 }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 ${
                  openIndex === i
                    ? "bg-white/[0.04] border-purple-500/20"
                    : "bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03] hover:border-white/[0.08]"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {openIndex === i && (
                      <div className="w-1 h-6 rounded-full bg-purple-500 shrink-0" />
                    )}
                    <h3 className={`font-semibold transition-colors ${openIndex === i ? "text-white" : "text-white/70"}`}>
                      {faq.q}
                    </h3>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 transition-all duration-300 ${
                      openIndex === i ? "rotate-180 text-purple-400" : "text-white/20"
                    }`}
                  />
                </div>

                <AnimatePresence>
                  {openIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="text-sm text-white/40 leading-relaxed mt-4 pl-5">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
