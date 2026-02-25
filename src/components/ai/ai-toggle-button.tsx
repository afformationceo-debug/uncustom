"use client";

import { useAIStore } from "@/stores/ai-store";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AIToggleButton() {
  const { toggle, isOpen, pendingActions } = useAIStore();

  return (
    <Button
      variant={isOpen ? "default" : "outline"}
      size="sm"
      className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-40"
      onClick={toggle}
    >
      <Sparkles className="w-5 h-5" />
      {pendingActions.length > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
          {pendingActions.length}
        </Badge>
      )}
    </Button>
  );
}
