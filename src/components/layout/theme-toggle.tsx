"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-[104px] h-8 rounded-lg bg-muted animate-pulse" />;
  }

  const options = [
    { value: "light", icon: Sun, label: "라이트" },
    { value: "dark", icon: Moon, label: "다크" },
    { value: "system", icon: Monitor, label: "시스템" },
  ] as const;

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
            theme === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={opt.label}
        >
          <opt.icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}
