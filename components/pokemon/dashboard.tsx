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
}

function formatLastUpdated(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

export function Dashboard({ saveData, filename, lastUpdated }: DashboardProps) {
  return (
    <div className="space-y-6">
      {/* Header with file info */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-foreground">Save Data</h2>
          {filename && (
            <p className="text-sm text-muted-foreground font-mono">{filename}</p>
          )}
        </div>
        {lastUpdated && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Updated {formatLastUpdated(lastUpdated)}
          </Badge>
        )}
      </div>

      {/* Main Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Trainer Info */}
        <div className="lg:col-span-1 space-y-6">
          <TrainerCard
            trainer={saveData.trainer}
            generation={saveData.generation}
            game={saveData.game}
            location={saveData.location}
          />
          <InventoryDisplay items={saveData.inventory} generation={saveData.generation} />
        </div>

        {/* Right Column - Party and PC */}
        <div className="lg:col-span-2 space-y-6">
          <PartyDisplay party={saveData.party} generation={saveData.generation} />
          <PCBoxes boxes={saveData.pcBoxes} />
        </div>
      </div>
    </div>
  );
}
