"use client";

import { useState, type ReactNode } from "react";
import { SaveData } from "@/lib/pokemon/types";
import { TrainerCard, TrainerMapCard } from "@/components/pokemon/trainer-card";
import { PartyDisplay } from "./party-display";
import { PCBoxes } from "./pc-boxes";
import { InventoryDisplay } from "./inventory-display";
import { PokedexPanel } from "./pokedex-panel";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Boxes, ChevronDown, Clock, Package, Users } from "lucide-react";

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

function DashboardSection({
  title,
  summary,
  defaultOpen = true,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/45 px-4 py-3 text-left transition hover:bg-card/70">
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          {summary && <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function Dashboard({ saveData, filename, lastUpdated, isLive = false }: DashboardProps) {
  const inventoryCount = saveData.inventory.reduce((count, section) => count + section.items.length, 0);
  const pcPokemonCount = saveData.pcBoxes.reduce(
    (count, box) => count + box.pokemon.filter(Boolean).length,
    0
  );
  const dexCount = saveData.pokedex?.caughtCount ?? 0;
  const dexMax = saveData.pokedex?.dexMax ?? (saveData.generation === 1 ? 151 : saveData.generation === 2 ? 251 : 386);

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

      <DashboardSection
        title="Overview"
        summary="Trainer, badges, and current Pokégear map."
      >
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]">
          <TrainerCard
            trainer={saveData.trainer}
            generation={saveData.generation}
            game={saveData.game}
            compact
          />
          <TrainerMapCard location={saveData.location} generation={saveData.generation} />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Game Data"
        summary="Switch between party, Pokédex, PC boxes, and inventory."
      >
        <Tabs defaultValue="party" className="gap-4">
          <TabsList className="h-auto w-full flex-wrap justify-start rounded-xl border border-border/70 bg-card/45 p-1">
            <TabsTrigger value="party" className="h-9 gap-2 px-3">
              <Users className="h-4 w-4" />
              Party
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{saveData.party.length}</span>
            </TabsTrigger>
            <TabsTrigger value="pokedex" className="h-9 gap-2 px-3">
              <BookOpen className="h-4 w-4" />
              Pokédex
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{dexCount}/{dexMax}</span>
            </TabsTrigger>
            <TabsTrigger value="pc" className="h-9 gap-2 px-3">
              <Boxes className="h-4 w-4" />
              PC Boxes
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{pcPokemonCount}</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="h-9 gap-2 px-3">
              <Package className="h-4 w-4" />
              Inventory
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{inventoryCount}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="party" className="mt-0">
            <PartyDisplay party={saveData.party} generation={saveData.generation} />
          </TabsContent>
          <TabsContent value="pokedex" className="mt-0">
            <PokedexPanel saveData={saveData} />
          </TabsContent>
          <TabsContent value="pc" className="mt-0">
            <PCBoxes boxes={saveData.pcBoxes} />
          </TabsContent>
          <TabsContent value="inventory" className="mt-0">
            <InventoryDisplay items={saveData.inventory} generation={saveData.generation} />
          </TabsContent>
        </Tabs>
      </DashboardSection>
    </div>
  );
}
