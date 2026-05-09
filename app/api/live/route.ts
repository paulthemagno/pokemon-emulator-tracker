import { NextRequest, NextResponse } from "next/server";
import { normalizeLiveSnapshot } from "@/lib/pokemon/live-normalizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let lastSuccess:
  | {
      source: string;
      data: ReturnType<typeof normalizeLiveSnapshot>;
      raw: Record<string, any>;
      updatedAt: number;
    }
  | null = null;
let lastFailureAt = 0;
let inFlight: Promise<Record<string, any>> | null = null;

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 800);
  const response = await fetch(url, {
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function fetchSnapshot(baseUrl: string, useLegacyFallback: boolean) {
  try {
    return await fetchJson(`${baseUrl}/snapshot`);
  } catch {
    if (!useLegacyFallback) {
      throw new Error(`Unable to connect to live source at ${baseUrl}`);
    }

    const [status, player, party, bag] = await Promise.allSettled([
      fetchJson(`${baseUrl}/status`),
      fetchJson(`${baseUrl}/player`),
      fetchJson(`${baseUrl}/party`),
      fetchJson(`${baseUrl}/bag`),
    ]);

    const snapshot = {
      status: status.status === "fulfilled" ? status.value : null,
      player: player.status === "fulfilled" ? player.value : null,
      party: party.status === "fulfilled" ? party.value : null,
      bag: bag.status === "fulfilled" ? bag.value : null,
    };

    if (!snapshot.status && !snapshot.player && !snapshot.party && !snapshot.bag) {
      throw new Error(`Unable to connect to live source at ${baseUrl}`);
    }

    return snapshot;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const port = searchParams.get("port") ?? "8080";
  const host = searchParams.get("host") ?? "127.0.0.1";
  const fallback = searchParams.get("fallback");
  const useLegacyFallback = fallback === "legacy";
  const baseUrl = `http://${host}:${port}`;

  try {
    const now = Date.now();
    if (lastSuccess && now - lastFailureAt < 500) {
      return NextResponse.json({ success: true, ...lastSuccess, stale: true });
    }

    inFlight = inFlight ?? fetchSnapshot(baseUrl, useLegacyFallback).finally(() => {
      inFlight = null;
    });
    const snapshot = await inFlight;
    const data = normalizeLiveSnapshot(snapshot);
    lastSuccess = {
      source: baseUrl,
      data,
      raw: snapshot,
      updatedAt: now,
    };

    return NextResponse.json({
      success: true,
      source: baseUrl,
      data,
      raw: snapshot,
      updatedAt: now,
    });
  } catch (error) {
    lastFailureAt = Date.now();
    if (lastSuccess) {
      return NextResponse.json({ success: true, ...lastSuccess, stale: true });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : `Unable to connect to live source at ${baseUrl}`,
      },
      { status: 503 }
    );
  }
}
