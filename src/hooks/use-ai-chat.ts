"use client";

import { useCallback, useRef } from "react";
import { useAIStore } from "@/stores/ai-store";
import type { AIMessage } from "@/lib/ai/types";

export function useAIChat() {
  const {
    messages,
    addMessage,
    isStreaming,
    setIsStreaming,
    pageContext,
    campaignId,
    conversationId,
    addTokenUsage,
  } = useAIStore();

  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return;

      // Add user message
      const userMsg: AIMessage = {
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      addMessage(userMsg);

      setIsStreaming(true);

      // Create placeholder assistant message
      const assistantMsg: AIMessage = {
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        tool_calls: [],
        tool_results: [],
      };
      addMessage(assistantMsg);

      try {
        abortRef.current = new AbortController();

        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            conversation_id: conversationId,
            page_context: pageContext,
            campaign_id: campaignId,
            history: messages.slice(-20),
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "text") {
                // Update last assistant message
                useAIStore.setState((state) => {
                  const msgs = [...state.messages];
                  const last = msgs[msgs.length - 1];
                  if (last?.role === "assistant") {
                    msgs[msgs.length - 1] = {
                      ...last,
                      content: last.content + data.content,
                    };
                  }
                  return { messages: msgs };
                });
              }

              if (data.type === "tool_start") {
                useAIStore.setState((state) => {
                  const msgs = [...state.messages];
                  const last = msgs[msgs.length - 1];
                  if (last?.role === "assistant") {
                    msgs[msgs.length - 1] = {
                      ...last,
                      tool_calls: [
                        ...(last.tool_calls || []),
                        { id: "", name: data.name, input: {} },
                      ],
                    };
                  }
                  return { messages: msgs };
                });
              }

              if (data.type === "tool_result") {
                useAIStore.setState((state) => {
                  const msgs = [...state.messages];
                  const last = msgs[msgs.length - 1];
                  if (last?.role === "assistant") {
                    msgs[msgs.length - 1] = {
                      ...last,
                      tool_results: [
                        ...(last.tool_results || []),
                        {
                          tool_call_id: "",
                          content: JSON.stringify(data.result),
                        },
                      ],
                    };
                  }
                  return { messages: msgs };
                });
              }

              if (data.type === "done") {
                if (data.usage) {
                  addTokenUsage(
                    data.usage.input_tokens,
                    data.usage.output_tokens,
                    data.usage.cost_usd
                  );
                }
              }

              if (data.type === "error") {
                useAIStore.setState((state) => {
                  const msgs = [...state.messages];
                  const last = msgs[msgs.length - 1];
                  if (last?.role === "assistant") {
                    msgs[msgs.length - 1] = {
                      ...last,
                      content: `오류가 발생했습니다: ${data.error}`,
                    };
                  }
                  return { messages: msgs };
                });
              }
            } catch {
              // Skip malformed SSE data
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          useAIStore.setState((state) => {
            const msgs = [...state.messages];
            const last = msgs[msgs.length - 1];
            if (last?.role === "assistant" && !last.content) {
              msgs[msgs.length - 1] = {
                ...last,
                content: "연결 오류가 발생했습니다. 다시 시도해주세요.",
              };
            }
            return { messages: msgs };
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [
      isStreaming,
      messages,
      pageContext,
      campaignId,
      conversationId,
      addMessage,
      setIsStreaming,
      addTokenUsage,
    ]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, [setIsStreaming]);

  return { messages, sendMessage, stopStreaming, isStreaming };
}
