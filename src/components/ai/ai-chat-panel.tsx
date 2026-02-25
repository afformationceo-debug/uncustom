"use client";

import { useState, useRef, useEffect } from "react";
import { useAIStore } from "@/stores/ai-store";
import { useAIChat } from "@/hooks/use-ai-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  X,
  Send,
  Loader2,
  Bot,
  User,
  Wrench,
  CheckCircle2,
  Sparkles,
  StopCircle,
  Trash2,
} from "lucide-react";

const QUICK_PROMPTS: Record<string, string[]> = {
  master: [
    "캠페인에 맞는 인플루언서 추천해줘",
    "선택한 인플루언서 분석해줘",
    "팔로워 5만-20만 뷰티 인플루언서 검색",
  ],
  manage: [
    "퍼널 병목 분석해줘",
    "미회신 인플루언서 정리",
    "이번 달 정산 현황",
  ],
  campaigns: [
    "캠페인 진행 현황 요약",
    "타겟 인플루언서 추천",
    "성과 예측",
  ],
  brands: [
    "이 브랜드 분석해줘",
    "경쟁사 비교",
    "인플루언서 협업 패턴",
  ],
  home: [
    "전체 현황 요약",
    "활성 캠페인 진행률",
    "이번 주 인사이트",
  ],
};

export function AIChatPanel() {
  const {
    isOpen,
    setIsOpen,
    pageContext,
    messages,
    clearMessages,
    isStreaming,
    sessionTokens,
  } = useAIStore();
  const { sendMessage, stopStreaming } = useAIChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    sendMessage(trimmed);
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isStreaming) return;
    sendMessage(prompt);
  };

  if (!isOpen) return null;

  const quickPrompts = QUICK_PROMPTS[pageContext] || QUICK_PROMPTS.home;

  return (
    <div className="fixed top-0 right-0 h-full w-[420px] bg-card border-l border-border shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">AI 어시스턴트</h3>
            <p className="text-[10px] text-muted-foreground">
              {pageContext === "master"
                ? "마스터데이터"
                : pageContext === "campaigns"
                  ? "캠페인"
                  : pageContext === "manage"
                    ? "인플루언서 관리"
                    : pageContext === "brands"
                      ? "브랜드 인텔리전스"
                      : "대시보드"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {sessionTokens.cost > 0 && (
            <Badge variant="outline" className="text-[10px] tabular-nums">
              ${sessionTokens.cost.toFixed(3)}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={clearMessages}
          >
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">무엇을 도와드릴까요?</p>
              <p className="text-xs text-muted-foreground mt-1">
                인플루언서 검색, 캠페인 분석, 아웃리치 전략 등을 도와드립니다
              </p>
            </div>
            {/* Quick prompts */}
            <div className="space-y-2 w-full max-w-[300px]">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {/* Tool calls */}
                {msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {msg.tool_calls.map((tc, j) => (
                      <div
                        key={j}
                        className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-background/50 rounded px-2 py-1"
                      >
                        <Wrench className="w-3 h-3" />
                        <span className="font-mono">{tc.name}</span>
                        {msg.tool_results?.[j] ? (
                          <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" />
                        ) : (
                          <Loader2 className="w-3 h-3 animate-spin ml-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Message content */}
                {msg.content ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : isStreaming && i === messages.length - 1 ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs text-muted-foreground">
                      생각하는 중...
                    </span>
                  </div>
                ) : null}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지 입력..."
            className="flex-1 h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3"
              onClick={stopStreaming}
            >
              <StopCircle className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-9 px-3"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
