"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TiptapEditor from "@/components/email/template-editor";
import { Braces, ChevronDown, LinkIcon, Info } from "lucide-react";

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

const EMAIL_TAGS = [
  { key: "{{name}}", label: "인플루언서 이름" },
  { key: "{{username}}", label: "인플루언서 유저네임" },
  { key: "{{campaign_name}}", label: "캠페인 이름" },
  { key: "{{proposal_link}}", label: "제안서 링크" },
  { key: "{{sender_name}}", label: "보내는 사람 이름" },
  { key: "{{email}}", label: "인플루언서 이메일" },
  { key: "{{platform}}", label: "플랫폼" },
  { key: "{{follower_count}}", label: "팔로워 수" },
];

function replaceTagsInText(
  text: string,
  overrides?: Record<string, string>
): string {
  let result = text;
  const data = { ...SAMPLE_DATA, ...overrides };
  for (const [key, value] of Object.entries(data)) {
    const tag = `{{${key}}}`;
    result = result.replaceAll(tag, value);
  }
  return result;
}

function replaceTagsInHtml(
  html: string,
  overrides?: Record<string, string>
): string {
  let result = html;
  const data = { ...SAMPLE_DATA, ...overrides };
  for (const [key, value] of Object.entries(data)) {
    const tag = `{{${key}}}`;
    if (key === "proposal_link") {
      // Replace proposal_link tag with a styled button
      result = result.replaceAll(
        tag,
        `<a href="${value}" style="display:inline-block;background-color:#7c3aed;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:4px 0;">제안서 보기 &rarr;</a>`
      );
    } else {
      result = result.replaceAll(tag, value);
    }
  }
  return result;
}

interface EmailEditorProps {
  subject: string;
  onSubjectChange: (s: string) => void;
  body: string;
  onBodyChange: (html: string) => void;
  senderName?: string;
  senderEmail?: string;
  campaignName?: string;
}

export function EmailEditor({
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  senderName,
  senderEmail,
  campaignName,
}: EmailEditorProps) {
  const overrides = useMemo(() => {
    const o: Record<string, string> = {};
    if (senderName) o.sender_name = senderName;
    if (campaignName) o.campaign_name = campaignName;
    return o;
  }, [senderName, campaignName]);

  const previewSubject = useMemo(
    () => replaceTagsInText(subject, overrides),
    [subject, overrides]
  );

  const previewBody = useMemo(
    () => replaceTagsInHtml(body, overrides),
    [body, overrides]
  );

  function insertTagIntoBody(tag: string) {
    // Append the tag as a styled span at the end of the body.
    // Note: This HTML is authored by the authenticated user themselves for their
    // own template preview; it is not external untrusted content.
    const tagHtml = `<span class="tiptap-variable">${tag}</span>&nbsp;`;
    onBodyChange(body + tagHtml);
  }

  function insertProposalLink() {
    const linkHtml = `<span class="tiptap-variable">{{proposal_link}}</span>&nbsp;`;
    onBodyChange(body + linkHtml);
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left side: Editor */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">이메일 제목</Label>
          <Input
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="{{name}}님, {{campaign_name}}에 초대합니다!"
            className="mt-1"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">본문</Label>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                  >
                    <Braces className="w-3.5 h-3.5 mr-1.5" />
                    개인화 태그 넣기
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {EMAIL_TAGS.map((tag) => (
                    <DropdownMenuItem
                      key={tag.key}
                      onClick={() => insertTagIntoBody(tag.key)}
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
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={insertProposalLink}
              >
                <LinkIcon className="w-3.5 h-3.5 mr-1.5" />
                제안서 링크 넣기
              </Button>
            </div>
          </div>

          <TiptapEditor
            content={body}
            onChange={onBodyChange}
            placeholder="이메일 본문을 작성하세요..."
          />

          <div className="flex items-start gap-2 p-2.5 bg-muted/50 rounded-md">
            <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              제안서 링크는 발송할 캠페인 제안서 링크로 자동 치환돼요
            </p>
          </div>
        </div>
      </div>

      {/* Right side: Email Preview */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">미리보기</Label>
        <div className="border rounded-lg bg-background overflow-hidden shadow-sm">
          {/* Email Header */}
          <div className="px-5 py-4 border-b bg-muted/30 space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium w-12 shrink-0">
                보낸이
              </span>
              <span className="text-foreground">
                {senderName || "Uncustom"}{" "}
                <span className="text-muted-foreground">
                  &lt;{senderEmail || "hello@uncustom.com"}&gt;
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium w-12 shrink-0">
                받는이
              </span>
              <span className="text-foreground">
                김인플{" "}
                <span className="text-muted-foreground">
                  &lt;kim@example.com&gt;
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium w-12 shrink-0">
                제목
              </span>
              <span className="text-foreground font-medium">
                {previewSubject || "(제목 없음)"}
              </span>
            </div>
          </div>

          {/* Email Body - Content is authored by the authenticated user for preview */}
          <div className="px-5 py-4 min-h-[300px]">
            {previewBody ? (
              <div
                className="prose prose-sm max-w-none text-foreground [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: previewBody }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                본문을 입력하면 미리보기가 표시됩니다
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
