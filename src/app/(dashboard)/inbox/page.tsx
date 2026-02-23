"use client";

import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { CampaignSelector } from "@/components/campaign-selector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Send,
  Mail,
  MailOpen,
  Search,
  Users,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import TiptapEditor from "@/components/email/template-editor";
import type { Tables } from "@/types/database";

type EmailThread = Tables<"email_threads"> & {
  influencer?: Tables<"influencers">;
};
type EmailMessage = Tables<"email_messages">;

function SanitizedHtml({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "span", "div", "b", "i", "u",
      "blockquote", "img", "table", "tr", "td", "th", "thead", "tbody",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "style", "src", "alt", "width", "height"],
  });
  return (
    <div
      className="text-sm prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">로딩 중...</div>}>
      <InboxPageContent />
    </Suspense>
  );
}

function InboxPageContent() {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const supabase = createClient();

  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [campaigns, setCampaigns] = useState<Tables<"campaigns">[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyHtml, setReplyHtml] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompose, setShowCompose] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch campaigns list for name mapping
  useEffect(() => {
    async function fetchCampaigns() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberData } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (!memberData) return;
      const { data } = await supabase
        .from("campaigns")
        .select("*")
        .eq("team_id", memberData.team_id)
        .order("created_at", { ascending: false });
      if (data) setCampaigns(data as Tables<"campaigns">[]);
    }
    fetchCampaigns();
  }, []);

  const campaignMap = useMemo(
    () => new Map(campaigns.map((c) => [c.id, c.name])),
    [campaigns]
  );

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("email_threads")
      .select(`
        *,
        influencer:influencers(username, display_name, email, platform, profile_image_url)
      `)
      .order("last_message_at", { ascending: false });

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    const { data, error } = await query;

    if (!error) {
      setThreads((data as unknown as EmailThread[]) ?? []);
    }
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    setSelectedThread(null);
    setMessages([]);
    setShowCompose(false);
    fetchThreads();
  }, [fetchThreads]);

  useRealtime(
    "email_messages",
    undefined,
    () => {
      if (selectedThread) fetchMessages(selectedThread);
      fetchThreads();
    }
  );

  useRealtime(
    "email_threads",
    campaignId ? `campaign_id=eq.${campaignId}` : undefined,
    () => fetchThreads()
  );

  async function fetchMessages(threadId: string) {
    const { data } = await supabase
      .from("email_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("received_at", { ascending: true });

    setMessages((data as EmailMessage[]) ?? []);

    await supabase
      .from("email_threads")
      .update({ unread: false })
      .eq("id", threadId);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function selectThread(threadId: string) {
    setSelectedThread(threadId);
    setShowCompose(false);
    await fetchMessages(threadId);
    const thread = threads.find((t) => t.id === threadId);
    if (thread) {
      setReplySubject(`Re: ${thread.subject ?? ""}`);
    }
  }

  async function handleReply() {
    if (!replyHtml.trim() || !selectedThread) return;
    setSending(true);

    const thread = threads.find((t) => t.id === selectedThread);
    if (!thread) return;

    const influencer = thread.influencer as unknown as Tables<"influencers">;

    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: thread.campaign_id,
          reply_to_thread: selectedThread,
          to_email: influencer?.email,
          subject: replySubject || `Re: ${thread.subject ?? ""}`,
          html: replyHtml,
        }),
      });

      if (response.ok) {
        toast.success("답장이 발송되었습니다.");
        setReplyHtml("");
        setShowCompose(false);
        fetchMessages(selectedThread);
      } else {
        toast.error("답장 발송 실패");
      }
    } catch {
      toast.error("오류가 발생했습니다.");
    }
    setSending(false);
  }

  const unreadCount = threads.filter((t) => t.unread).length;

  const filteredThreads = searchQuery
    ? threads.filter((t) => {
        const inf = t.influencer as unknown as Tables<"influencers">;
        const name = (inf?.display_name ?? inf?.username ?? "").toLowerCase();
        const subject = (t.subject ?? "").toLowerCase();
        const query = searchQuery.toLowerCase();
        return name.includes(query) || subject.includes(query);
      })
    : threads;

  const currentThread = threads.find((t) => t.id === selectedThread);
  const currentInfluencer = currentThread?.influencer as unknown as Tables<"influencers"> | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">인박스</h2>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} 읽지 않음</Badge>
          )}
          <Badge variant="secondary">{threads.length}개 스레드</Badge>
          <CampaignSelector mode="filter" value={campaignId} onChange={setCampaignId} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
        {/* Thread list */}
        <Card className="overflow-hidden flex flex-col">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="이름, 제목 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredThreads.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">메시지가 없습니다.</p>
            ) : (
              filteredThreads.map((thread) => {
                const influencer = thread.influencer as unknown as Tables<"influencers">;
                const threadCampaignName = campaignMap.get(thread.campaign_id);
                return (
                  <button
                    key={thread.id}
                    onClick={() => selectThread(thread.id)}
                    className={cn(
                      "w-full p-3 text-left border-b hover:bg-accent transition-colors",
                      selectedThread === thread.id && "bg-primary/10 border-l-2 border-l-primary",
                      thread.unread && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {influencer?.profile_image_url ? (
                        <img
                          src={influencer.profile_image_url}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover shrink-0 mt-0.5"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <Users className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-sm truncate", thread.unread && "font-semibold")}>
                            {influencer?.display_name ?? influencer?.username ?? "Unknown"}
                          </span>
                          {thread.unread && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ml-1" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {thread.subject ?? "(제목 없음)"}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {!campaignId && threadCampaignName && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                              {threadCampaignName}
                            </Badge>
                          )}
                          {influencer?.platform && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                              {influencer.platform}
                            </Badge>
                          )}
                          {thread.last_message_at && (
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(thread.last_message_at).toLocaleDateString("ko-KR")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          {currentThread && currentInfluencer && (
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentInfluencer.profile_image_url ? (
                  <img
                    src={currentInfluencer.profile_image_url}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium">
                    {currentInfluencer.display_name ?? currentInfluencer.username}
                  </div>
                  <div className="text-xs text-muted-foreground">{currentInfluencer.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!campaignId && (
                  <Badge variant="outline" className="text-xs">
                    {campaignMap.get(currentThread.campaign_id) ?? ""}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {currentInfluencer.platform}
                </Badge>
                {currentInfluencer.profile_url && (
                  <a href={currentInfluencer.profile_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </a>
                )}
              </div>
            </div>
          )}

          <CardContent className="flex-1 p-4 overflow-y-auto space-y-3">
            {!selectedThread ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Mail className="w-12 h-12 mb-3" />
                <p>스레드를 선택하세요</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MailOpen className="w-12 h-12 mb-3" />
                <p>메시지가 없습니다</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "max-w-[85%] rounded-lg shadow-sm",
                      msg.direction === "outbound"
                        ? "ml-auto bg-primary/10 border border-primary/20"
                        : "bg-card border border-border"
                    )}
                  >
                    <div className="px-3 py-2 border-b border-border/50">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium">
                          {msg.direction === "outbound" ? "나" : msg.from_email}
                        </span>
                        <span>{new Date(msg.received_at).toLocaleString("ko-KR")}</span>
                      </div>
                      {msg.subject && (
                        <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                          {msg.subject}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      {msg.body_html ? (
                        <SanitizedHtml html={msg.body_html} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.body_text}</p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </CardContent>

          {selectedThread && (
            <div className="border-t">
              {!showCompose ? (
                <button
                  onClick={() => setShowCompose(true)}
                  className="w-full p-3 text-left text-sm text-muted-foreground hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  답장 작성하기...
                </button>
              ) : (
                <div className="p-3 space-y-3">
                  <div>
                    <Input
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      placeholder="제목"
                      className="h-8 text-sm"
                    />
                  </div>
                  <TiptapEditor
                    content={replyHtml}
                    onChange={setReplyHtml}
                    placeholder="답장을 작성하세요... (HTML 서식 지원)"
                  />
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowCompose(false);
                        setReplyHtml("");
                      }}
                    >
                      취소
                    </Button>
                    <Button
                      onClick={handleReply}
                      disabled={sending || !replyHtml.trim()}
                      size="sm"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-1" />
                      )}
                      발송
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
