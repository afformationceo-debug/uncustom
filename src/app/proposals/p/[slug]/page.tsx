import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import type { Tables } from "@/types/database";
import type { Metadata } from "next";
import { ProposalLandingClient } from "./client";

interface Product {
  name: string;
  image_url: string;
  description: string;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("proposals")
    .select("title, hero_image_url")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  return {
    title: data?.title ?? "Proposal",
    description: data?.title
      ? `${data.title} - Campaign Proposal`
      : "Campaign proposal from Uncustom",
    openGraph: data?.hero_image_url
      ? { images: [{ url: data.hero_image_url }] }
      : undefined,
  };
}

function isUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function getCsChannelLabel(channel: string): string {
  const lower = channel.toLowerCase();
  if (lower.includes("kakao")) return "카카오톡으로 문의하기";
  if (lower.includes("instagram") || lower.includes("insta")) return "인스타그램 DM 문의하기";
  if (lower.includes("line")) return "LINE으로 문의하기";
  if (lower.includes("telegram")) return "텔레그램으로 문의하기";
  if (lower.includes("twitter") || lower.includes("x.com")) return "X(Twitter) DM 문의하기";
  if (lower.includes("discord")) return "디스코드로 문의하기";
  return "문의하기";
}

function getCsChannelIcon(channel: string): string {
  const lower = channel.toLowerCase();
  if (lower.includes("kakao")) return "chat";
  if (lower.includes("instagram") || lower.includes("insta")) return "instagram";
  if (lower.includes("email") || lower.includes("mail")) return "email";
  return "link";
}

export default async function ProposalPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !proposal) {
    notFound();
  }

  const typedProposal = proposal as Tables<"proposals">;
  const products = Array.isArray(typedProposal.products)
    ? (typedProposal.products as unknown as Product[])
    : [];
  const missionImages = (typedProposal.mission_images ?? []).filter(Boolean);
  const requiredTags = typedProposal.required_tags ?? [];
  const csChannel = typedProposal.cs_channel?.trim() ?? "";
  const csAccount = typedProposal.cs_account?.trim() ?? "";

  // The HTML content (mission_html, rewards_html, notice_html) is authored by
  // authenticated admin users via the Tiptap rich text editor, not from public
  // user input. This follows the same rendering pattern used in the email
  // template system throughout this codebase.

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ================================================================= */}
      {/* 1. HERO SECTION                                                    */}
      {/* ================================================================= */}
      {typedProposal.hero_image_url ? (
        <section className="relative w-full h-[56vh] sm:h-[60vh] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={typedProposal.hero_image_url}
            alt={typedProposal.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          {/* Title over hero */}
          <div className="absolute inset-x-0 bottom-0 px-4 pb-8 sm:pb-12">
            <div className="max-w-2xl mx-auto">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight drop-shadow-lg">
                {typedProposal.title}
              </h1>
            </div>
          </div>
        </section>
      ) : (
        /* Hero without image - gradient background */
        <section className="relative w-full bg-gradient-to-br from-primary/10 via-background to-secondary/20 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight">
              {typedProposal.title}
            </h1>
          </div>
        </section>
      )}

      {/* Main content container */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ================================================================= */}
        {/* 2. MISSION SECTION                                                */}
        {/* ================================================================= */}
        {(typedProposal.mission_html || missionImages.length > 0) && (
          <section className="py-10 sm:py-12 proposal-section">
            <SectionHeader icon="mission" title="미션" />
            {typedProposal.mission_html && (
              <div
                className="prose prose-lg max-w-none text-foreground/90 prose-headings:text-foreground prose-p:leading-relaxed prose-a:text-primary prose-a:underline prose-strong:text-foreground [&_ul]:list-disc [&_ol]:list-decimal"
                // Admin-authored Tiptap content
                dangerouslySetInnerHTML={{ __html: typedProposal.mission_html }}
              />
            )}

            {/* Mission images gallery */}
            {missionImages.length > 0 && (
              <div className={`mt-6 grid gap-3 ${
                missionImages.length === 1
                  ? "grid-cols-1"
                  : missionImages.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-2 sm:grid-cols-3"
              }`}>
                {missionImages.map((url, i) => (
                  <div
                    key={i}
                    className={`relative rounded-2xl overflow-hidden bg-muted shadow-sm ${
                      missionImages.length === 3 && i === 0 ? "col-span-2 sm:col-span-1" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`미션 이미지 ${i + 1}`}
                      className="w-full h-auto object-cover aspect-square sm:aspect-[4/3]"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <SectionDivider />

        {/* ================================================================= */}
        {/* 3. PRODUCTS SECTION                                               */}
        {/* ================================================================= */}
        {products.length > 0 && (
          <>
            <section className="py-10 sm:py-12 proposal-section">
              <SectionHeader icon="product" title="제품 소개" />

              {/* Horizontal scroll on mobile, stacked on desktop */}
              <div className="flex gap-4 overflow-x-auto pb-2 sm:overflow-visible sm:flex-col snap-x snap-mandatory scrollbar-hide">
                {products.map((product, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-[280px] sm:w-full snap-start rounded-2xl border border-border bg-card shadow-sm overflow-hidden sm:flex sm:flex-row"
                  >
                    {product.image_url && (
                      <div className="w-full h-48 sm:w-40 sm:h-auto sm:min-h-[140px] flex-shrink-0 bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-center">
                      <h3 className="font-semibold text-foreground text-lg leading-snug">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <SectionDivider />
          </>
        )}

        {/* ================================================================= */}
        {/* 4. REWARDS SECTION (BEFORE apply form)                            */}
        {/* ================================================================= */}
        {typedProposal.rewards_html && (
          <>
            <section className="py-10 sm:py-12 proposal-section">
              <SectionHeader icon="reward" title="리워드" />
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
                <div
                  className="prose prose-lg max-w-none text-foreground/90 prose-headings:text-foreground prose-p:leading-relaxed prose-a:text-primary prose-a:underline prose-strong:text-foreground [&_ul]:list-disc [&_ol]:list-decimal"
                  // Admin-authored Tiptap content
                  dangerouslySetInnerHTML={{ __html: typedProposal.rewards_html }}
                />
              </div>
            </section>

            <SectionDivider />
          </>
        )}

        {/* ================================================================= */}
        {/* 5. REQUIRED TAGS SECTION                                          */}
        {/* ================================================================= */}
        {requiredTags.length > 0 && (
          <>
            <section className="py-10 sm:py-12 proposal-section">
              <SectionHeader icon="tag" title="필수 태그" />
              <div className="flex flex-wrap gap-2.5">
                {requiredTags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-primary/10 text-primary border border-primary/20 transition-colors"
                  >
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            </section>

            <SectionDivider />
          </>
        )}

        {/* ================================================================= */}
        {/* 6. NOTICE SECTION                                                 */}
        {/* ================================================================= */}
        {typedProposal.notice_html && (
          <>
            <section className="py-10 sm:py-12 proposal-section">
              <SectionHeader icon="notice" title="유의사항" />
              <div className="rounded-2xl bg-muted/60 border border-border p-5 sm:p-6">
                <div
                  className="prose prose-sm max-w-none text-muted-foreground prose-headings:text-foreground prose-p:leading-relaxed prose-a:text-primary prose-a:underline prose-strong:text-foreground [&_ul]:list-disc [&_ol]:list-decimal"
                  // Admin-authored Tiptap content
                  dangerouslySetInnerHTML={{ __html: typedProposal.notice_html }}
                />
              </div>
            </section>

            <SectionDivider />
          </>
        )}

        {/* ================================================================= */}
        {/* 7. CS CHANNEL CTA                                                 */}
        {/* ================================================================= */}
        {csChannel && csAccount && (
          <>
            <section className="py-10 sm:py-12 proposal-section">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  궁금한 점이 있으신가요?
                </p>
                {isUrl(csAccount) ? (
                  <a
                    href={csAccount}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    <CsChannelIconSvg type={getCsChannelIcon(csChannel)} />
                    <span>{getCsChannelLabel(csChannel)}</span>
                    <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : isUrl(csChannel) ? (
                  <a
                    href={csChannel}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    <CsChannelIconSvg type="link" />
                    <span>{csAccount} 문의하기</span>
                    <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-card border border-border shadow-sm">
                    <CsChannelIconSvg type={getCsChannelIcon(csChannel)} />
                    <div className="text-left">
                      <p className="text-xs text-muted-foreground">{csChannel}</p>
                      <p className="font-semibold text-foreground">{csAccount}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <SectionDivider />
          </>
        )}

        {/* ================================================================= */}
        {/* 8. APPLICATION FORM                                               */}
        {/* ================================================================= */}
        <section className="py-10 sm:py-12 proposal-section" id="apply">
          <SectionHeader icon="apply" title="캠페인 신청" />
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-8 shadow-sm">
            <ProposalLandingClient
              slug={slug}
              collectBasicInfo={typedProposal.collect_basic_info}
              collectInstagram={typedProposal.collect_instagram}
              collectPaypal={typedProposal.collect_paypal}
              collectShipping={typedProposal.collect_shipping}
            />
          </div>
        </section>

        {/* ================================================================= */}
        {/* 9. FOOTER                                                         */}
        {/* ================================================================= */}
        <footer className="text-center py-10 sm:py-12 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <svg className="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            <span className="text-xs font-medium tracking-wider uppercase">
              Powered by Uncustom
            </span>
          </div>
        </footer>
      </div>

      {/* Global CSS for animations */}
      <style>{`
        .proposal-section {
          animation: fadeSlideIn 0.6s ease-out both;
        }
        .proposal-section:nth-child(1) { animation-delay: 0.05s; }
        .proposal-section:nth-child(2) { animation-delay: 0.1s; }
        .proposal-section:nth-child(3) { animation-delay: 0.15s; }
        .proposal-section:nth-child(4) { animation-delay: 0.2s; }
        .proposal-section:nth-child(5) { animation-delay: 0.25s; }
        .proposal-section:nth-child(6) { animation-delay: 0.3s; }
        .proposal-section:nth-child(7) { animation-delay: 0.35s; }
        .proposal-section:nth-child(8) { animation-delay: 0.4s; }
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        /* Hide scrollbar for horizontal scroll */
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function SectionDivider() {
  return (
    <div className="flex items-center gap-3 px-4">
      <div className="flex-1 h-px bg-border" />
      <div className="w-1.5 h-1.5 rounded-full bg-border" />
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary flex-shrink-0">
        <SectionIconSvg type={icon} />
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
        {title}
      </h2>
    </div>
  );
}

function SectionIconSvg({ type }: { type: string }) {
  const cls = "w-5 h-5";
  switch (type) {
    case "mission":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        </svg>
      );
    case "product":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    case "reward":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      );
    case "tag":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
        </svg>
      );
    case "notice":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      );
    case "apply":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
        </svg>
      );
  }
}

function CsChannelIconSvg({ type }: { type: string }) {
  const cls = "w-5 h-5";
  switch (type) {
    case "chat":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    case "email":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      );
  }
}
