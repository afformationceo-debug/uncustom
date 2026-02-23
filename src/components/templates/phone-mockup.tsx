"use client";

import { cn } from "@/lib/utils";

interface PhoneMockupProps {
  messages: string[];
  className?: string;
}

export function PhoneMockup({ messages, className }: PhoneMockupProps) {
  return (
    <div
      className={cn(
        "w-[280px] h-[500px] rounded-[2rem] border-[3px] border-foreground/20 bg-background shadow-xl flex flex-col overflow-hidden relative",
        className
      )}
    >
      {/* Notch area */}
      <div className="relative flex items-center justify-center pt-2 pb-1 px-6 bg-background">
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-foreground/10 rounded-full" />
        {/* Status bar */}
        <div className="w-full flex items-center justify-between text-[10px] text-muted-foreground mt-4 px-2">
          <span className="font-medium">9:41</span>
          <div className="flex items-center gap-1">
            {/* Wifi icon simplified */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <circle cx="12" cy="20" r="1" />
            </svg>
            {/* Battery icon simplified */}
            <div className="flex items-center gap-0.5">
              <div className="w-5 h-2.5 border border-muted-foreground rounded-sm relative">
                <div className="absolute inset-[1px] bg-muted-foreground rounded-[1px]" />
              </div>
              <div className="w-0.5 h-1.5 bg-muted-foreground rounded-r-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* DM Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-[10px] font-bold text-primary">U</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground leading-tight">Uncustom</p>
          <p className="text-[9px] text-muted-foreground">Instagram</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-muted/20">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground">
              메시지를 입력하면 미리보기가 표시됩니다
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words shadow-sm">
                {msg}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50 bg-background">
        <div className="flex-1 h-7 rounded-full bg-muted/50 border border-border/50 flex items-center px-3">
          <span className="text-[10px] text-muted-foreground">메시지...</span>
        </div>
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary-foreground"
          >
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        </div>
      </div>

      {/* Home indicator */}
      <div className="flex items-center justify-center pb-1.5 pt-1 bg-background">
        <div className="w-24 h-1 bg-foreground/20 rounded-full" />
      </div>
    </div>
  );
}
