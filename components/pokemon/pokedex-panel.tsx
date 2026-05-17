"use client";

import { useMemo, useState } from "react";
import { SaveData } from "@/lib/pokemon/types";
import { SPECIES } from "@/lib/pokemon/data/species";
import {
  GEN3_HOENN_DEX_COUNT,
  GEN3_HOENN_DEX_NATIONAL_ORDER,
  getGen3HoennDexNumber,
} from "@/lib/pokemon/data/gen3-hoenn-dex";
import { TYPE_COLORS } from "@/lib/pokemon/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

type DexFilter = "all" | "seen" | "caught" | "missing";
type DexViewMode = "hoenn" | "national";

interface PokedexPanelProps {
  saveData: SaveData;
}

function getDexMax(generation: 1 | 2 | 3): number {
  if (generation === 1) return 151;
  if (generation === 2) return 251;
  return 386;
}

function isRseGame(saveData: SaveData): boolean {
  return saveData.game === "ruby" || saveData.game === "sapphire" || saveData.game === "emerald";
}

function getSaveDexViewMode(saveData: SaveData): DexViewMode {
  if (saveData.pokedex?.regionalDex === "hoenn") return "hoenn";
  if (isRseGame(saveData) && saveData.pokedex?.mode !== "national") return "hoenn";
  return "national";
}

function getResolvedDexViewMode(saveData: SaveData, viewModeOverride: DexViewMode | null): DexViewMode {
  if (saveData.generation !== 3) return getSaveDexViewMode(saveData);
  return viewModeOverride ?? getSaveDexViewMode(saveData);
}

function getDexSpeciesIds(saveData: SaveData, viewMode: DexViewMode): number[] {
  const resolvedViewMode = getResolvedDexViewMode(saveData, viewMode);
  if (
    saveData.generation === 3 &&
    resolvedViewMode === "hoenn"
  ) {
    return [...GEN3_HOENN_DEX_NATIONAL_ORDER];
  }

  const max =
    saveData.generation === 3 && resolvedViewMode === "national"
      ? 386
      : saveData.pokedex?.dexMax ?? getDexMax(saveData.generation);
  return Array.from({ length: max }, (_, index) => index + 1);
}

function getDisplayDexNumber(saveData: SaveData, viewMode: DexViewMode, nationalDex: number): number {
  const resolvedViewMode = getResolvedDexViewMode(saveData, viewMode);
  if (
    saveData.generation === 3 &&
    resolvedViewMode === "hoenn"
  ) {
    return getGen3HoennDexNumber(nationalDex) ?? nationalDex;
  }
  return nationalDex;
}

function getSpriteUrl(species: number): string {
  if (species <= 0 || species > 386) {
    return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png";
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${species}.png`;
}

export function PokedexPanel({ saveData }: PokedexPanelProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DexFilter>("all");
  const [viewModeOverride, setViewModeOverride] = useState<DexViewMode | null>(null);
  const resolvedViewMode = getResolvedDexViewMode(saveData, viewModeOverride);
  const canChooseGen3DexView =
    saveData.generation === 3 && isRseGame(saveData);

  const dexSpeciesIds = useMemo(() => getDexSpeciesIds(saveData, resolvedViewMode), [saveData, resolvedViewMode]);
  const dexSpeciesSet = useMemo(() => new Set(dexSpeciesIds), [dexSpeciesIds]);
  const dexMax = dexSpeciesIds.length;

  const inferredOwnedSet = useMemo(() => {
    const owned = new Set<number>();

    for (const pokemon of saveData.party) {
      if (pokemon?.species > 0 && dexSpeciesSet.has(pokemon.species)) {
        owned.add(pokemon.species);
      }
    }

    for (const box of saveData.pcBoxes) {
      for (const pokemon of box.pokemon) {
        if (pokemon && pokemon.species > 0 && dexSpeciesSet.has(pokemon.species)) {
          owned.add(pokemon.species);
        }
      }
    }

    return owned;
  }, [saveData.party, saveData.pcBoxes, dexSpeciesSet]);

  const seenSetFromGame = useMemo(() => {
    return new Set(
      (saveData.pokedex?.seenSpecies ?? []).filter((species) => dexSpeciesSet.has(species))
    );
  }, [saveData.pokedex?.seenSpecies, dexSpeciesSet]);

  const caughtSetFromGame = useMemo(() => {
    return new Set(
      (saveData.pokedex?.caughtSpecies ?? []).filter((species) => dexSpeciesSet.has(species))
    );
  }, [saveData.pokedex?.caughtSpecies, dexSpeciesSet]);

  const hasGamePokedex = Boolean(saveData.pokedex);
  const caughtSet = hasGamePokedex ? caughtSetFromGame : inferredOwnedSet;
  const seenSet = hasGamePokedex ? seenSetFromGame : caughtSet;

  const speciesInDex = useMemo(
    () => dexSpeciesIds
      .map((id) => SPECIES.find((entry) => entry.id === id))
      .filter((entry): entry is (typeof SPECIES)[number] => Boolean(entry)),
    [dexSpeciesIds]
  );

  const filteredSpecies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return speciesInDex.filter((entry) => {
      const isSeen = seenSet.has(entry.id);
      const isCaught = caughtSet.has(entry.id);
      if (filter === "seen" && !isSeen) return false;
      if (filter === "caught" && !isCaught) return false;
      if (filter === "missing" && isCaught) return false;

      if (!normalizedQuery) return true;

      const displayDexNumber = getDisplayDexNumber(saveData, resolvedViewMode, entry.id);
      const idMatch =
        entry.id.toString().includes(normalizedQuery) ||
        displayDexNumber.toString().includes(normalizedQuery);
      const nameMatch = entry.name.toLowerCase().includes(normalizedQuery);
      const typeMatch = entry.types.some((type) => type.toLowerCase().includes(normalizedQuery));
      return idMatch || nameMatch || typeMatch;
    });
  }, [speciesInDex, caughtSet, seenSet, filter, query, saveData, resolvedViewMode]);

  const caughtCount = caughtSet.size;
  const seenCount = seenSet.size;
  const completion = Math.round((caughtCount / dexMax) * 100);

  return (
    <Card className="overflow-hidden border-border/80 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              Pokedex
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Search by name, number, or type, then filter owned and missing entries.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Completion</p>
            <p className="text-xl font-black text-foreground">
              {caughtCount}/{dexMax}
            </p>
            <p className="text-xs text-muted-foreground">{completion}%</p>
            <p className="text-xs text-muted-foreground">Seen {seenCount}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {canChooseGen3DexView && (
          <div className="flex flex-wrap gap-2">
            {[
              ["hoenn", `Hoenn (${GEN3_HOENN_DEX_COUNT})`],
              ["national", "National (386)"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewModeOverride(mode as DexViewMode)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold transition",
                  resolvedViewMode === mode
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
            <span className="self-center text-xs text-muted-foreground">
              Showing {resolvedViewMode === "national" ? "National Dex" : "Hoenn Dex"} with the save's seen/caught flags.
            </span>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search: Pikachu, #25, electric..."
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              filter === "all"
                ? "border-primary/60 bg-primary/15 text-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            All ({dexMax})
          </button>
          <button
            type="button"
            onClick={() => setFilter("seen")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              filter === "seen"
                ? "border-sky-500/60 bg-sky-500/15 text-sky-200"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            Seen ({seenCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("caught")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              filter === "caught"
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            Caught ({caughtCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("missing")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              filter === "missing"
                ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            Missing ({Math.max(0, dexMax - caughtCount)})
          </button>
        </div>

        <div className="max-h-[460px] overflow-y-auto rounded-lg border border-border/70">
          <div className="grid gap-1 p-1">
            {filteredSpecies.map((entry) => {
              const caught = caughtSet.has(entry.id);
              const seen = seenSet.has(entry.id);
              const primaryType = entry.types[0] ?? "???";
              const accent = TYPE_COLORS[primaryType] ?? TYPE_COLORS["???"];

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-2.5 py-2",
                    caught
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-border/60 bg-background/60"
                  )}
                  style={{ boxShadow: `inset 3px 0 0 ${accent}` }}
                >
                  <div className="relative h-10 w-10 shrink-0 rounded bg-background/70">
                    <Image
                      src={getSpriteUrl(entry.id)}
                      alt={entry.name}
                      fill
                      className={cn(
                        "pixelated object-contain",
                        caught ? "" : seen ? "opacity-80 grayscale" : "opacity-45 grayscale"
                      )}
                      draggable={false}
                      unoptimized
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{getDisplayDexNumber(saveData, resolvedViewMode, entry.id).toString().padStart(3, "0")}
                      </span>
                      <span className="truncate text-sm font-bold text-foreground">
                        {entry.name}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.types.map((type) => (
                        <Badge
                          key={`${entry.id}-${type}`}
                          variant="outline"
                          className="rounded-md border px-1.5 py-0 text-[10px] capitalize"
                          style={{
                            borderColor: `${TYPE_COLORS[type] ?? TYPE_COLORS["???"]}66`,
                            color: TYPE_COLORS[type] ?? TYPE_COLORS["???"],
                            backgroundColor: `${TYPE_COLORS[type] ?? TYPE_COLORS["???"]}15`,
                          }}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {caught ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-label="Caught" />
                    ) : seen ? (
                      <Eye className="h-4 w-4 text-sky-400" aria-label="Seen" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" aria-label="Not seen" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Source: {hasGamePokedex ? "in-game Pokedex flags (seen/caught)" : "fallback inferred from current party and PC boxes because no Pokedex flags were provided"}.
        </p>
      </CardContent>
    </Card>
  );
}
