"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhoneMockup } from "@/components/templates/phone-mockup";
import { Braces, ChevronDown } from "lucide-react";

const SAMPLE_DATA: Record<string, string> = {
  name: "김인플",
  username: "kim_influencer",
  campaign_name: "봄 뷰티 캠페인",
  proposal_link: "https://uncustom.co/p/abc123",
  email: "kim@example.com",
  platform: "Instagram",
  follower_count: "12.5K",
  sender_name: "Uncustom",
};

const DM_TAGS = [
  { key: "{{name}}", label: "인플루언서 이름" },
  { key: "{{username}}", label: "인플루언서 유저네임" },
  { key: "{{campaign_name}}", label: "캠페인 이름" },
  { key: "{{proposal_link}}", label: "제안서 링크" },
];

function replaceTags(
  text: string,
  campaignName?: string
): string {
  let result = text;
  for (const [key, value] of Object.entries(SAMPLE_DATA)) {
    const tag = `{{${key}}}`;
    if (key === "campaign_name" && campaignName) {
      result = result.replaceAll(tag, campaignName);
    } else {
      result = result.replaceAll(tag, value);
    }
  }
  return result;
}

interface DmEditorProps {
  value: string;
  onChange: (val: string) => void;
  campaignName?: string;
}

export function DmEditor({ value, onChange, campaignName }: DmEditorProps) {
  const previewMessages = useMemo(() => {
    if (!value.trim()) return [];
    const replaced = replaceTags(value, campaignName);
    // Split by double newlines for separate message bubbles, or keep as one
    return replaced
      .split(/\n{2,}/)
      .map((m) => m.trim())
      .filter(Boolean);
  }, [value, campaignName]);

  function insertTag(tag: string) {
    onChange(value + tag);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left side: Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">DM 메시지</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Braces className="w-3.5 h-3.5 mr-1.5" />
                개인화 태그 넣기
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {DM_TAGS.map((tag) => (
                <DropdownMenuItem
                  key={tag.key}
                  onClick={() => insertTag(tag.key)}
                >
                  <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded mr-2">
                    {tag.key}
                  </code>
                  <span className="text-muted-foreground text-xs">
                    {tag.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`안녕하세요 {{name}}님!\n\n{{campaign_name}} 캠페인에 참여해 주시면 감사하겠습니다.\n\n자세한 내용은 아래 링크를 확인해 주세요:\n{{proposal_link}}`}
          className="min-h-[320px] resize-none text-sm"
        />
        <p className="text-xs text-muted-foreground">
          빈 줄(엔터 2번)로 구분하면 별도의 메시지 버블로 나뉩니다.
        </p>
      </div>

      {/* Right side: Phone Preview */}
      <div className="flex flex-col items-center">
        <Label className="text-sm font-medium mb-3 self-start">
          미리보기
        </Label>
        <PhoneMockup messages={previewMessages} />
      </div>
    </div>
  );
}
