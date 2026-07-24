// src/hooks/useRealtime.ts
// Custom hook for Supabase Realtime subscriptions
// Usage: useRealtime('income-channel', 'incomes', churchId, (payload) => { ... })
//
// Architecture:
// - Creates a Supabase channel on mount
// - Listens to INSERT, UPDATE, DELETE events on the specified table
// - Filters by church_id (RLS already ensures data isolation)
// - Cleans up channel on unmount (prevents memory leaks)
// - Refuses subscription if client is offline → reconnects on reconnect
//
// Why this matters:
// - Dashboard, Income, Expense, Offering pages need live updates
// - Without realtime: users must manually refresh or navigate away and back
// - With realtime: when pastor approves income, treasurer sees it instantly
// - Reduces polling overhead and unnecessary DB reads

import { useEffect, useRef } from 'react';
import { supabase } from '@/services/supabaseClient';

export interface RealtimeEvent<T = any> {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T | null;
}

/**
 * Subscribe to Supabase Realtime changes for a specific table.
 *
 * @param channelName - unique name for this subscription (e.g. 'income-channel')
 * @param table - the PostgreSQL table name (e.g. 'incomes')
 * @param churchId - the church_id to filter RLS-scoped data
 * @param callback - fired on each INSERT/UPDATE/DELETE matching the filter
 * @returns void (auto-cleans up on unmount)
 */
export function useRealtime<T = any>(
  channelName: string,
  table: string,
  churchId: string,
  callback: (event: RealtimeEvent<T>) => void
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!channelName || !table || !churchId) return;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',  // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table,
        },
        (payload) => {
          // Filter by church_id — RLS already ensures the client only sees
          // rows belonging to this church, but we double-check to avoid
          // unnecessary re-renders for rows from other churches (if any leak)
          const row = payload.new ?? payload.old;
          if (row && (row as any).church_id !== churchId) return;

          callbackRef.current({
            type: payload.eventType as RealtimeEvent<T>['type'],
            new: payload.new as T,
            old: payload.old as T | null,
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // successfully connected
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // Will auto-reconnect when Supabase client reconnects
          console.warn(`Realtime channel "${channelName}" status: ${status}`);
        }
      });

    // Cleanup: unsubscribe when channelName, table, or churchId changes
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, table, churchId]);
}

/**
 * Convenience hook for batching multiple realtime subscriptions.
 * Returns a list of events from all subscribed tables.
 */
export function useRealtimeBatch<T extends Record<string, any>>(
  subscriptions: {
    channelName: string;
    table: string;
    churchId: string;
  }[],
  onEvent: (event: RealtimeEvent<T>) => void
) {
  // Use a single combined callback + ref to avoid duplicate subscriptions
  const combinedRef = useRef(onEvent);
  combinedRef.current = onEvent;

  useEffect(() => {
    const channels: { name: string; channel: any }[] = [];

    for (const sub of subscriptions) {
      if (!sub.channelName || !sub.table || !sub.churchId) continue;

      const channel = supabase
        .channel(sub.channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: sub.table,
          },
          (payload) => {
            const row = payload.new ?? payload.old;
            if (row && (row as any).church_id !== sub.churchId) return;

            combinedRef.current({
              type: payload.eventType as RealtimeEvent<T>['type'],
              new: payload.new as T,
              old: payload.old as T | null,
            });
          }
        )
        .subscribe();

      channels.push({ name: sub.channelName, channel });
    }

    return () => {
      for (const { channel } of channels) {
        supabase.removeChannel(channel);
      }
    };
  }, [subscriptions.map((s) => `${s.channelName}:${s.table}:${s.churchId}`).join(',')]);
}
