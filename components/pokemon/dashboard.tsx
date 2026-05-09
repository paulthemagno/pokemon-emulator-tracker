"use client";

import { SaveData } from "@/lib/pokemon/types";
import { TrainerCard } from "./trainer-card";
import { PartyDisplay } from "./party-display";
import { PCBoxes } from "./pc-boxes";
import { InventoryDisplay } from "./inventory-display";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface DashboardProps {
  saveData: SaveData;
  filename?: string | null;
  lastUpdated?: number | null;
  isLive?: boolean;
}

function formatLastUpdated(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

export function Dashboard({ saveData, filename, lastUpdated, isLive = false }: DashboardProps) {
  return (
    <div className="space-y-6">
      {/* Header with file info */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-normal text-foreground">
            {isLive ? "Live Data" : "Save Data"}
          </h2>
          {filename && (
            <p className="mt-1 text-sm text-muted-foreground font-mono">{filename}</p>
          )}
        </div>
        {lastUpdated && (
          <Badge variant="outline" className="flex items-center gap-1 rounded-full px-3 py-1">
            <Clock className="h-3 w-3" />
            Updated {formatLastUpdated(lastUpdated)}
          </Badge>
        )}
      </div>

      <PartyDisplay party={saveData.party} generation={saveData.generation} />

      <div className="grid gap-6 xl:grid-cols-[minmax(520px,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <TrainerCard
            trainer={saveData.trainer}
            generation={saveData.generation}
            game={saveData.game}
            location={saveData.location}
          />
        </div>

        <div className="space-y-6">
          <InventoryDisplay items={saveData.inventory} generation={saveData.generation} />
          <PCBoxes boxes={saveData.pcBoxes} />
        </div>
      </div>
    </div>
  );
}
