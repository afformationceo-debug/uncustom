"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface CampaignNavProps {
  campaignId: string;
}

const navItems = [
  { label: "키워드", segment: "keywords" },
  { label: "태그됨", segment: "tagged" },
  { label: "추출", segment: "extract" },
  { label: "인플루언서", segment: "influencers" },
  { label: "이메일 템플릿", segment: "email/templates" },
  { label: "이메일 발송", segment: "email/send" },
  { label: "발송 로그", segment: "email/logs" },
  { label: "인박스", segment: "inbox" },
  { label: "관리", segment: "manage" },
  { label: "콘텐츠", segment: "contents" },
  { label: "SNS 계정", segment: "sns-accounts" },
  { label: "성과", segment: "metrics" },
];

export function CampaignNav({ campaignId }: CampaignNavProps) {
  const pathname = usePathname();
  const basePath = `/campaigns/${campaignId}`;

  return (
    <nav className="border-b">
      <div className="flex items-center gap-1 overflow-x-auto px-1 py-1">
        {navItems.map((item) => {
          const href = `${basePath}/${item.segment}`;
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={item.segment}
              href={href}
              className={cn(
                "inline-flex items-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
