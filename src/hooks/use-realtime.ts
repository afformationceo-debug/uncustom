"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload, RealtimeChannel } from "@supabase/supabase-js";

type TableName = string;

let channelCounter = 0;

export function useRealtime<T extends Record<string, unknown>>(
  table: TableName,
  filter?: string,
  callback?: (payload: RealtimePostgresChangesPayload<T>) => void
) {
  const supabaseRef = useRef(createClient());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(callback);

  // Always keep callback ref up to date (avoids re-subscription on callback change)
  callbackRef.current = callback;

  useEffect(() => {
    const supabase = supabaseRef.current;

    // Unique channel name to prevent collision
    const channelName = `realtime:${table}:${filter ?? "all"}:${++channelCounter}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter,
        },
        (payload) => {
          callbackRef.current?.(payload as RealtimePostgresChangesPayload<T>);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [table, filter]);
}
