import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Uncustom - AI 인플루언서 마케팅 자동화 플랫폼",
  description:
    "키워드 하나로 Instagram, TikTok, YouTube, Twitter 인플루언서를 AI가 즉시 발굴하고, 제안서 발송부터 성과 추적까지 한 곳에서 자동화합니다.",
  openGraph: {
    title: "Uncustom - AI 인플루언서 마케팅 자동화 플랫폼",
    description:
      "키워드 하나로 5개 플랫폼 인플루언서를 AI가 즉시 발굴. 제안서 발송, 이메일 아웃리치, 성과 추적까지 올인원 자동화.",
    type: "website",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
