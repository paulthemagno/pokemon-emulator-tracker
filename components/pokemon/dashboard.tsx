"use client";

import { SaveData } from "@/lib/pokemon/types";
import { TrainerCard, TrainerMapCard } from "@/components/pokemon/trainer-card";
import { PartyDisplay } from "./party-display";
import { PCBoxes } from "./pc-boxes";
import { InventoryDisplay } from "./inventory-display";
import { PokedexPanel } from "./pokedex-panel";
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]">
        <TrainerCard
          trainer={saveData.trainer}
          generation={saveData.generation}
          game={saveData.game}
          compact
        />
        <TrainerMapCard location={saveData.location} />
      </div>

      <PartyDisplay party={saveData.party} generation={saveData.generation} />

      <PokedexPanel saveData={saveData} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <InventoryDisplay items={saveData.inventory} generation={saveData.generation} />
        <PCBoxes boxes={saveData.pcBoxes} />
      </div>
    </div>
  );
}
