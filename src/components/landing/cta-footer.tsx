"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Shield, Zap, Users, Clock } from "lucide-react";

const trustBadges = [
  { icon: Shield, label: "팀 단위 데이터 격리" },
  { icon: Zap, label: "실시간 Supabase 동기화" },
  { icon: Users, label: "RLS 기반 접근 제어" },
  { icon: Clock, label: "가입 후 30초 만에 시작" },
];

export function CTASection() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-purple-600/[0.08] rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] bg-blue-600/[0.05] rounded-full blur-[120px]" />
        <div className="absolute top-1/2 right-1/3 w-[400px] h-[400px] bg-fuchsia-600/[0.05] rounded-full blur-[120px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight mb-6 leading-[1.1]">
            인플루언서 마케팅,
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
              지금 자동화를 시작하세요
            </span>
          </h2>

          <p className="text-lg text-white/40 mb-12 max-w-xl mx-auto leading-relaxed">
            AI가 찾고, 자동으로 섭외하고, 성과까지 추적합니다.
            <br />
            지금 무료로 시작해보세요.
          </p>

          {/* CTA Button */}
          <Link
            href="/login"
            className="group relative inline-flex items-center justify-center gap-3 px-12 py-5 text-lg font-bold text-white rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.03]"
          >
            {/* Gradient base */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-blue-600" />

            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-blue-600 blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-500" />

            {/* Inner border */}
            <div className="absolute inset-[1px] rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-blue-600" />

            {/* Shimmer */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/15 to-transparent" />

            {/* Radial hover glow */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.12),transparent_60%)]" />

            <span className="relative">무료 체험하기</span>
            <svg
              className="relative w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>

          <p className="text-sm text-white/20 mt-6">
            카드 등록 없이 바로 시작 가능
          </p>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-4"
          >
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05]"
              >
                <badge.icon className="w-3.5 h-3.5 text-white/25" />
                <span className="text-[11px] text-white/30">{badge.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-sm font-black text-white">U</span>
            </div>
            <span className="text-lg font-bold text-white/80">Uncustom</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-8 text-sm text-white/30">
            <a
              href="#features"
              className="hover:text-white/60 transition-colors"
            >
              기능
            </a>
            <a
              href="#process"
              className="hover:text-white/60 transition-colors"
            >
              프로세스
            </a>
            <a href="#faq" className="hover:text-white/60 transition-colors">
              FAQ
            </a>
            <Link
              href="/login"
              className="hover:text-white/60 transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="hover:text-white/60 transition-colors"
            >
              회원가입
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-xs text-white/15">
            &copy; {new Date().getFullYear()} Uncustom. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
