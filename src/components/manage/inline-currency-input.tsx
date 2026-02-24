"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface InlineCurrencyInputProps {
  value: number | null;
  currency: string;
  onSave: (value: number | null) => void;
}

export function InlineCurrencyInput({ value, currency, onSave }: InlineCurrencyInputProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value != null ? String(value) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleBlur() {
    setEditing(false);
    const num = parseFloat(text);
    const newVal = isNaN(num) ? null : num;
    if (newVal !== value) onSave(newVal);
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setEditing(true); setText(value != null ? String(value) : ""); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="flex items-center gap-1 text-xs hover:bg-accent rounded px-1.5 py-0.5 min-w-[60px]"
      >
        {value != null ? (
          <>
            <span>{value.toLocaleString()}</span>
            <Badge variant="outline" className="text-[10px] px-1 py-0">{currency}</Badge>
          </>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        type="number"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === "Enter") handleBlur(); if (e.key === "Escape") setEditing(false); }}
        className="h-7 w-24 text-xs"
      />
      <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{currency}</Badge>
    </div>
  );
}
