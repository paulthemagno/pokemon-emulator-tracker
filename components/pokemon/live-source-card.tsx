"use client";

import { Activity, Circle, Radio, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LiveSourceCardProps {
  isConnected: boolean;
  isPolling: boolean;
  source: string | null;
  error: string | null;
  lastUpdated: number | null;
  onStart: () => void;
  onStop: () => void;
  embedded?: boolean;
}

function formatTime(timestamp: number | null) {
  return timestamp ? new Date(timestamp).toLocaleTimeString() : "Never";
}

export function LiveSourceCard({
  isConnected,
  isPolling,
  source,
  error,
  lastUpdated,
  onStart,
  onStop,
  embedded = false,
}: LiveSourceCardProps) {
  const content = (
    <>
      {!embedded && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="h-5 w-5 text-primary" />
              Live Source
            </CardTitle>
            <Badge variant="outline" className="gap-1.5">
              <Circle
                className={`h-2.5 w-2.5 fill-current ${
                  isConnected ? "text-emerald-500" : "text-muted-foreground"
                }`}
              />
              {isConnected ? "Connected" : isPolling ? "Searching" : "Idle"}
            </Badge>
          </div>
        </CardHeader>
      )}
      <CardContent className={embedded ? "space-y-4 p-0" : "space-y-4"}>
        {embedded && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Live Source</p>
            <Badge variant="outline" className="gap-1.5">
              <Circle
                className={`h-2.5 w-2.5 fill-current ${
                  isConnected ? "text-emerald-500" : "text-muted-foreground"
                }`}
              />
              {isConnected ? "Connected" : isPolling ? "Searching" : "Idle"}
            </Badge>
          </div>
        )}
        <div className="rounded-lg border border-border/70 bg-muted/35 p-3 text-sm text-muted-foreground">
          <p>
            Live mode needs this app running on the same machine as mGBA. Load the matching script from
            {" "}
            <code className="mx-1 rounded bg-background/70 px-1 py-0.5">Tools -&gt; Scripting...</code>
            {" "}
            then press Start Live.
          </p>
          <div className="mt-2 grid gap-1 text-xs sm:grid-cols-3">
            <p><span className="font-semibold text-foreground">Gen 1:</span> <code>mgba-gen1-live.lua</code></p>
            <p><span className="font-semibold text-foreground">Gen 2:</span> <code>mgba-gen2-live.lua</code></p>
            <p><span className="font-semibold text-foreground">Gen 3:</span> <code>mgba-gen3-live.lua</code></p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Endpoint</p>
            <p className="text-sm font-mono">{source ?? "http://127.0.0.1:8080"}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Last live tick</p>
            <p className="text-sm font-medium">{formatTime(lastUpdated)}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={onStart} disabled={isPolling && isConnected}>
            <Activity className="h-4 w-4" />
            Start Live
          </Button>
          <Button variant="outline" onClick={onStop} disabled={!isPolling}>
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>
      </CardContent>
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <Card>
      {content}
    </Card>
  );
}
