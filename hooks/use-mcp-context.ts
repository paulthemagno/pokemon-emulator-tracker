"use client";

import { useEffect, useRef } from 'react';
import { packGameContext } from '@/lib/chatbot/context-packer';
import type { SaveData } from '@/lib/pokemon/types';
import type { ActiveGameSnapshot } from '@/lib/chatbot/active-context';

export function useMcpContext(data: SaveData | null, source: 'file' | 'live', filename: string | null,
  updatedAt: number | null, stale: boolean) {
  const latest = useRef<ActiveGameSnapshot | null>(null);
  const publish = useRef<((claim?: boolean) => void) | null>(null);
  const previousSource = useRef<string | null>(null);

  useEffect(() => {
    const context = packGameContext(data);
    latest.current = data && context ? { source, filename, game: data.game,
      updatedAt: updatedAt ?? Date.now(), stale: source === 'live' && stale, context } : null;
    const selection = data ? `${source}:${filename}` : 'none';
    if (selection !== previousSource.current) {
      previousSource.current = selection;
      publish.current?.();
    }
  }, [data, source, filename, updatedAt, stale]);

  useEffect(() => {
    // The bridge is local-only; hosted demos do not share browser state with a local MCP.
    if (!['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return;
    const sessionId = crypto.randomUUID();
    let sequence = 0;
    let lastSent: ActiveGameSnapshot | null | undefined;
    let lastSentAt = 0;
    const send = (claim = false) => {
      const snapshot = latest.current;
      if (!claim && snapshot === lastSent && Date.now() - lastSentAt < 10_000) return;
      lastSent = snapshot;
      lastSentAt = Date.now();
      void fetch('/api/mcp/context', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sequence: ++sequence, claim, snapshot }),
      }).then(response => { if (!response.ok) lastSent = undefined; }).catch(() => { lastSent = undefined; });
    };
    publish.current = send;
    const focus = () => send(true);
    const visible = () => { if (document.visibilityState === 'visible') focus(); };
    const release = () => {
      navigator.sendBeacon('/api/mcp/context', new Blob([JSON.stringify({ sessionId,
        sequence: ++sequence, release: true, snapshot: null })], { type: 'application/json' }));
    };
    send(document.visibilityState === 'visible');
    const timer = setInterval(() => send(), 1000);
    window.addEventListener('focus', focus);
    window.addEventListener('pageshow', visible);
    window.addEventListener('pagehide', release);
    document.addEventListener('visibilitychange', visible);
    return () => {
      publish.current = null;
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      window.removeEventListener('pageshow', visible);
      window.removeEventListener('pagehide', release);
      document.removeEventListener('visibilitychange', visible);
      release();
    };
  }, []);
}
