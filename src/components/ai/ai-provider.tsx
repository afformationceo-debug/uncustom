"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAIStore } from "@/stores/ai-store";
import { AIChatPanel } from "./ai-chat-panel";
import { AIToggleButton } from "./ai-toggle-button";
import type { PageContext } from "@/lib/ai/types";

function getPageContext(pathname: string): PageContext {
  if (pathname.startsWith("/master")) return "master";
  if (pathname.startsWith("/campaigns")) return "campaigns";
  if (pathname.startsWith("/manage")) return "manage";
  if (pathname.startsWith("/brands")) return "brands";
  if (pathname.startsWith("/content-analysis")) return "content-analysis";
  if (pathname.startsWith("/commerce")) return "commerce";
  if (pathname.startsWith("/templates")) return "templates";
  if (pathname.startsWith("/email/send")) return "email-send";
  if (pathname.startsWith("/contents")) return "contents";
  if (pathname.startsWith("/metrics")) return "metrics";
  return "home";
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setPageContext = useAIStore((s) => s.setPageContext);

  useEffect(() => {
    setPageContext(getPageContext(pathname));
  }, [pathname, setPageContext]);

  return (
    <>
      {children}
      <AIChatPanel />
      <AIToggleButton />
    </>
  );
}
