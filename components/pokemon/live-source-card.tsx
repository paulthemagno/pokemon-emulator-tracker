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
}: LiveSourceCardProps) {
  return (
    <Card>
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
      <CardContent className="space-y-4">
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
    </Card>
  );
}
