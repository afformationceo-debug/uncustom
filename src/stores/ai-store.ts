import { create } from "zustand";
import type { AIMessage, AIInsight, AIAction, PageContext } from "@/lib/ai/types";

interface AIStore {
  // Chat panel
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;

  // Current context
  pageContext: PageContext;
  setPageContext: (ctx: PageContext) => void;
  campaignId: string | null;
  setCampaignId: (id: string | null) => void;

  // Messages
  messages: AIMessage[];
  addMessage: (msg: AIMessage) => void;
  clearMessages: () => void;

  // Loading state
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;

  // Conversation
  conversationId: string | null;
  setConversationId: (id: string | null) => void;

  // Insights
  insights: AIInsight[];
  setInsights: (insights: AIInsight[]) => void;

  // Actions
  pendingActions: AIAction[];
  setPendingActions: (actions: AIAction[]) => void;

  // Usage
  sessionTokens: { input: number; output: number; cost: number };
  addTokenUsage: (input: number, output: number, cost: number) => void;
}

export const useAIStore = create<AIStore>((set) => ({
  isOpen: false,
  setIsOpen: (open) => set({ isOpen: open }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),

  pageContext: "home",
  setPageContext: (ctx) => set({ pageContext: ctx }),
  campaignId: null,
  setCampaignId: (id) => set({ campaignId: id }),

  messages: [],
  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),
  clearMessages: () => set({ messages: [], conversationId: null }),

  isStreaming: false,
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  conversationId: null,
  setConversationId: (id) => set({ conversationId: id }),

  insights: [],
  setInsights: (insights) => set({ insights }),

  pendingActions: [],
  setPendingActions: (actions) => set({ pendingActions: actions }),

  sessionTokens: { input: 0, output: 0, cost: 0 },
  addTokenUsage: (input, output, cost) =>
    set((state) => ({
      sessionTokens: {
        input: state.sessionTokens.input + input,
        output: state.sessionTokens.output + output,
        cost: state.sessionTokens.cost + cost,
      },
    })),
}));
