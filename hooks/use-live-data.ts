"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveData } from "@/lib/pokemon/types";

interface LiveState {
  data: SaveData | null;
  error: string | null;
  isConnected: boolean;
  isPolling: boolean;
  lastUpdated: number | null;
  source: string | null;
}

export function useLiveData(intervalMs = 1000) {
  const [state, setState] = useState<LiveState>({
    data: null,
    error: null,
    isConnected: false,
    isPolling: false,
    lastUpdated: null,
    source: null,
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef(false);
  const isPollingRef = useRef(false);
  const failuresRef = useRef(0);

  const clearPollTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const getNextDelay = useCallback(() => {
    const failures = failuresRef.current;
    if (!state.data && failures > 0) return 250;
    if (failures <= 0) return intervalMs;
    return Math.min(1500, intervalMs * 2 ** Math.min(failures, 2));
  }, [intervalMs, state.data]);

  const poll = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const response = await fetch("/api/live", {
        cache: "no-store",
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Live source unavailable");

      failuresRef.current = 0;
      setState({
        data: result.data,
        error: null,
        isConnected: true,
        isPolling: true,
        lastUpdated: result.updatedAt ?? Date.now(),
        source: result.source ?? "http://127.0.0.1:8080",
      });
    } catch (error) {
      failuresRef.current += 1;
      setState((current) => ({
        ...current,
        error: current.data
          ? null
          : error instanceof Error
            ? error.message
            : "Live source unavailable",
        isConnected: Boolean(current.data),
        isPolling: true,
      }));
    } finally {
      inFlightRef.current = false;
      clearPollTimer();
      if (isPollingRef.current) {
        timeoutRef.current = setTimeout(poll, getNextDelay());
      }
    }
  }, [clearPollTimer, getNextDelay]);

  const start = useCallback(() => {
    isPollingRef.current = true;
    failuresRef.current = 0;
    setState((current) => ({ ...current, isPolling: true }));
    clearPollTimer();
    void poll();
  }, [clearPollTimer, poll]);

  const stop = useCallback(() => {
    isPollingRef.current = false;
    failuresRef.current = 0;
    clearPollTimer();
    setState((current) => ({ ...current, isPolling: false }));
  }, [clearPollTimer]);

  const clear = useCallback(() => {
    isPollingRef.current = false;
    failuresRef.current = 0;
    clearPollTimer();
    setState({
      data: null,
      error: null,
      isConnected: false,
      isPolling: false,
      lastUpdated: null,
      source: null,
    });
  }, [clearPollTimer]);

  useEffect(() => stop, [stop]);

  return {
    ...state,
    start,
    stop,
    clear,
  };
}
