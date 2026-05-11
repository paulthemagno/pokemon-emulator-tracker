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

function hasItems<T>(items: T[] | null | undefined) {
  return Array.isArray(items) && items.length > 0;
}

function hasPokemonInBoxes(data: SaveData | null) {
  if (!data) return false;
  return data.pcBoxes.some((box) => box.pokemon.some((pokemon) => pokemon !== null));
}

function isLikelyFallbackTrainerName(name: string | undefined) {
  const normalized = (name ?? "").trim().toLowerCase();
  return normalized.length === 0 || normalized === "live trainer";
}

function isTrainerSnapshotPlausible(previous: SaveData | null, next: SaveData) {
  const nextTrainer = next.trainer;
  if (nextTrainer.money < 0 || nextTrainer.money > 999999) return false;
  if (nextTrainer.playTime.minutes < 0 || nextTrainer.playTime.minutes > 59) return false;
  if ((nextTrainer.playTime.seconds ?? 0) < 0 || (nextTrainer.playTime.seconds ?? 0) > 59) return false;

  if (!previous) return true;

  const prevTrainer = previous.trainer;
  if (isLikelyFallbackTrainerName(nextTrainer.name) && !isLikelyFallbackTrainerName(prevTrainer.name)) {
    return false;
  }

  const moneyDelta = Math.abs(nextTrainer.money - prevTrainer.money);
  if (moneyDelta > 500000) return false;

  const prevSeconds =
    (prevTrainer.playTime.hours * 3600) +
    (prevTrainer.playTime.minutes * 60) +
    (prevTrainer.playTime.seconds ?? 0);
  const nextSeconds =
    (nextTrainer.playTime.hours * 3600) +
    (nextTrainer.playTime.minutes * 60) +
    (nextTrainer.playTime.seconds ?? 0);

  if (nextSeconds + 5 < prevSeconds) return false;
  if (nextSeconds - prevSeconds > 60) return false;

  return true;
}

function hasNonPlaceholderLocation(next: SaveData) {
  const locationName = next.location?.name?.trim() ?? "";
  const mapId = Number(next.location?.mapId ?? 0);
  const mapGroup = Number(next.location?.mapGroup ?? 0);
  if (mapId <= 0 && mapGroup <= 0) return false;
  if (locationName.length === 0 || locationName === "Location syncing") return false;
  if (locationName === "Map 0-0") return false;
  return true;
}

function mergeLiveData(previous: SaveData | null, next: SaveData): SaveData {
  if (!previous) return next;

  const useNextTrainer = isTrainerSnapshotPlausible(previous, next);
  const useNextBoxes = hasItems(next.pcBoxes) && (hasPokemonInBoxes(next) || !hasPokemonInBoxes(previous));

  return {
    ...next,
    trainer: useNextTrainer
      ? {
          ...previous.trainer,
          ...next.trainer,
          badges: hasItems(next.trainer.badges) ? next.trainer.badges : previous.trainer.badges,
          playTime: {
            ...previous.trainer.playTime,
            ...next.trainer.playTime,
          },
        }
      : previous.trainer,
    pokedex: next.pokedex ?? previous.pokedex,
    party: hasItems(next.party) ? next.party : previous.party,
    pcBoxes: useNextBoxes ? next.pcBoxes : previous.pcBoxes,
    inventory: hasItems(next.inventory) ? next.inventory : previous.inventory,
    location: hasNonPlaceholderLocation(next) ? next.location : previous.location,
  };
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
      setState((current) => ({
        data: mergeLiveData(current.data, result.data),
        error: null,
        isConnected: true,
        isPolling: true,
        lastUpdated: result.updatedAt ?? Date.now(),
        source: result.source ?? "http://127.0.0.1:8080",
      }));
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
