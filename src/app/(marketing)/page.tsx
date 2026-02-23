"use client";

import { LandingNav } from "@/components/landing/nav";
import { HeroSection } from "@/components/landing/hero";
import { SocialProofSection } from "@/components/landing/social-proof";
import { PainPointsSection } from "@/components/landing/pain-points";
import { FlowArchitectureSection } from "@/components/landing/flow-architecture";
import { ProcessStepsSection } from "@/components/landing/process-steps";
import { FeatureExtractionSection } from "@/components/landing/feature-extraction";
import { FeatureAutomationSection } from "@/components/landing/feature-automation";
import { ComparisonSection } from "@/components/landing/comparison";
import { FAQSection } from "@/components/landing/faq";
import { CTASection, Footer } from "@/components/landing/cta-footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#06060a] text-white selection:bg-purple-500/30 overflow-x-hidden">
      <style jsx global>{`
        @keyframes landing-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes landing-particle {
          0% { opacity: 0; transform: translateY(0) scale(0); }
          10% { opacity: 1; transform: translateY(0) scale(1); }
          90% { opacity: 0.5; }
          100% { opacity: 0; transform: translateY(-100vh) scale(0.5); }
        }
        html { scroll-behavior: smooth; }
      `}</style>

      <LandingNav />
      <HeroSection />
      <SocialProofSection />
      <PainPointsSection />
      <FlowArchitectureSection />
      <ProcessStepsSection />
      <FeatureExtractionSection />
      <FeatureAutomationSection />
      <ComparisonSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
}
