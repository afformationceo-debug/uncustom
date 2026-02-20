"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Mail, MailOpen } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import type { Tables } from "@/types/database";

type EmailThread = Tables<"email_threads"> & {
  influencer?: Tables<"influencers">;
};
type EmailMessage = Tables<"email_messages">;

function SanitizedHtml({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "a", "ul", "ol", "li", "h1", "h2", "h3", "span", "div", "b", "i", "u"],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
  });
  return (
    <div
      className="text-sm prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export default function InboxPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createClient();

  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchThreads();
  }, [campaignId]);

  useRealtime(
    "email_messages",
    undefined,
    () => {
      if (selectedThread) fetchMessages(selectedThread);
      fetchThreads();
    }
  );

  async function fetchThreads() {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_threads")
      .select(`
        *,
        influencer:influencers(username, display_name, email, platform, profile_image_url)
      `)
      .eq("campaign_id", campaignId)
      .order("last_message_at", { ascending: false });

    if (!error) {
      setThreads((data as unknown as EmailThread[]) ?? []);
    }
    setLoading(false);
  }

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
  }

  async function selectThread(threadId: string) {
    setSelectedThread(threadId);
    await fetchMessages(threadId);
  }

  async function handleReply() {
    if (!replyText.trim() || !selectedThread) return;
    setSending(true);

    const thread = threads.find((t) => t.id === selectedThread);
    if (!thread) return;

    const influencer = thread.influencer as unknown as Tables<"influencers">;

    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          reply_to_thread: selectedThread,
          to_email: influencer?.email,
          subject: `Re: ${thread.subject ?? ""}`,
          html: replyText.replace(/\n/g, "<br>"),
        }),
      });

      if (response.ok) {
        toast.success("답장이 발송되었습니다.");
        setReplyText("");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">인박스</h2>
        {unreadCount > 0 && (
          <Badge variant="destructive">{unreadCount} 읽지 않음</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-250px)]">
        {/* Thread list */}
        <Card className="overflow-hidden">
          <CardContent className="p-0 h-full overflow-y-auto">
            {loading ? (
              <p className="text-center py-8 text-gray-500">로딩 중...</p>
            ) : threads.length === 0 ? (
              <p className="text-center py-8 text-gray-500">메시지가 없습니다.</p>
            ) : (
              threads.map((thread) => {
                const influencer = thread.influencer as unknown as Tables<"influencers">;
                return (
                  <button
                    key={thread.id}
                    onClick={() => selectThread(thread.id)}
                    className={cn(
                      "w-full p-4 text-left border-b hover:bg-gray-50 transition-colors",
                      selectedThread === thread.id && "bg-blue-50",
                      thread.unread && "bg-blue-25"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {thread.unread ? (
                        <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                      ) : (
                        <MailOpen className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className={cn("text-sm truncate", thread.unread && "font-semibold")}>
                          {influencer?.display_name ?? influencer?.username ?? "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {thread.subject}
                        </div>
                        {thread.last_message_at && (
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(thread.last_message_at).toLocaleString("ko-KR")}
                          </div>
                        )}
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
          <CardContent className="flex-1 p-4 overflow-y-auto space-y-4">
            {!selectedThread ? (
              <p className="text-center py-20 text-gray-400">스레드를 선택하세요</p>
            ) : messages.length === 0 ? (
              <p className="text-center py-20 text-gray-400">메시지가 없습니다</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[80%] p-3 rounded-lg",
                    msg.direction === "outbound"
                      ? "ml-auto bg-blue-50 text-blue-900"
                      : "bg-gray-100"
                  )}
                >
                  <div className="text-xs text-gray-500 mb-1">
                    {msg.from_email} - {new Date(msg.received_at).toLocaleString("ko-KR")}
                  </div>
                  {msg.body_html ? (
                    <SanitizedHtml html={msg.body_html} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.body_text}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>

          {selectedThread && (
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="답장 작성..."
                  rows={3}
                  className="flex-1"
                />
                <Button
                  onClick={handleReply}
                  disabled={sending || !replyText.trim()}
                  className="self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
