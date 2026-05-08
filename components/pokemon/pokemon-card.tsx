"use client";

import { Pokemon, TYPE_COLORS } from "@/lib/pokemon/types";
import { getSpeciesById } from "@/lib/pokemon/data/species";
import { getMoveById } from "@/lib/pokemon/data/moves";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Sparkles, Egg } from "lucide-react";
import Image from "next/image";
import { ItemIcon } from "./item-icon";
import { ItemInfoTooltip } from "./item-info-tooltip";

interface PokemonCardProps {
  pokemon: Pokemon;
  index?: number;
  generation?: number;
  compact?: boolean;
  className?: string;
}

function getHpColor(current: number, max: number): string {
  if (max === 0) return "bg-muted";
  const percentage = (current / max) * 100;
  if (percentage > 50) return "bg-green-500";
  if (percentage > 20) return "bg-yellow-500";
  return "bg-red-500";
}

function getSpriteUrl(species: number): string {
  // Use PokeAPI sprites
  if (species <= 0 || species > 386) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${species}.png`;
}

function getStatusText(status: Pokemon["status"] | number): string | null {
  if (!status || status === "none" || status === 0) return null;
  if (typeof status === "string") {
    const labels: Record<string, string> = {
      sleep: "SLP",
      poison: "PSN",
      burn: "BRN",
      freeze: "FRZ",
      paralysis: "PAR",
      "bad-poison": "TOX",
    };
    return labels[status] ?? null;
  }
  if (status & 0x07) return "SLP";
  if (status & 0x08) return "PSN";
  if (status & 0x10) return "BRN";
  if (status & 0x20) return "FRZ";
  if (status & 0x40) return "PAR";
  if (status & 0x80) return "TOX";
  return null;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "PSN":
    case "TOX":
      return "bg-purple-500/20 text-purple-400";
    case "BRN":
      return "bg-orange-500/20 text-orange-400";
    case "FRZ":
      return "bg-cyan-500/20 text-cyan-400";
    case "PAR":
      return "bg-yellow-500/20 text-yellow-400";
    case "SLP":
      return "bg-slate-500/20 text-slate-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getHappinessColor(happiness: number): string {
  if (happiness >= 220) return "bg-green-500";
  if (happiness >= 70) return "bg-yellow-500";
  return "bg-red-500";
}

function getTypeStyle(type: string): React.CSSProperties {
  return {
    backgroundColor: `${TYPE_COLORS[type] ?? TYPE_COLORS["???"]}22`,
    borderColor: `${TYPE_COLORS[type] ?? TYPE_COLORS["???"]}66`,
    color: TYPE_COLORS[type] ?? TYPE_COLORS["???"],
  };
}

const GROWTH_RATES = [
  "fast",
  "medium-fast",
  "medium-slow",
  "slow",
  "erratic",
  "fluctuating",
] as const;

type GrowthRate = (typeof GROWTH_RATES)[number];

function getExpForLevel(level: number, growthRate: string = "medium-slow"): number {
  const l = Math.max(1, Math.min(100, level));
  switch (growthRate) {
    case "fast":
      return Math.floor((4 * Math.pow(l, 3)) / 5);
    case "slow":
      return Math.floor((5 * Math.pow(l, 3)) / 4);
    case "medium-slow":
      return Math.floor((6 / 5) * Math.pow(l, 3) - 15 * Math.pow(l, 2) + 100 * l - 140);
    case "medium-fast":
      return Math.pow(l, 3);
    case "erratic":
      if (l <= 50) return Math.floor((Math.pow(l, 3) * (100 - l)) / 50);
      if (l <= 68) return Math.floor((Math.pow(l, 3) * (150 - l)) / 100);
      if (l <= 98) return Math.floor((Math.pow(l, 3) * Math.floor((1911 - 10 * l) / 3)) / 500);
      return Math.floor((Math.pow(l, 3) * (160 - l)) / 100);
    case "fluctuating":
      if (l <= 15) return Math.floor((Math.pow(l, 3) * (Math.floor((l + 1) / 3) + 24)) / 50);
      if (l <= 36) return Math.floor((Math.pow(l, 3) * (l + 14)) / 50);
      return Math.floor((Math.pow(l, 3) * (Math.floor(l / 2) + 32)) / 50);
    default:
      return Math.pow(l, 3);
  }
}

function getExpWindow(level: number, experience: number, preferredGrowthRate?: string) {
  const candidates = GROWTH_RATES.map((growthRate) => {
    const current = getExpForLevel(level, growthRate);
    const next = level >= 100 ? current : getExpForLevel(level + 1, growthRate);
    const fits = experience >= current && (level >= 100 || experience < next);
    const distance = fits
      ? 0
      : Math.min(Math.abs(experience - current), Math.abs(experience - next));

    return {
      growthRate,
      current,
      next,
      fits,
      distance,
      preferred: growthRate === preferredGrowthRate,
    };
  });

  const exact = candidates
    .filter((candidate) => candidate.fits)
    .sort((a, b) => Number(b.preferred) - Number(a.preferred))[0];

  return exact ?? candidates.sort((a, b) => a.distance - b.distance)[0];
}

export function PokemonCard({
  pokemon,
  index,
  generation,
  compact = false,
  className,
}: PokemonCardProps) {
  const statusText = getStatusText(pokemon.status);
  const currentHP = pokemon.currentHP ?? (pokemon as any).currentHp ?? 0;
  const maxHP = pokemon.maxHP ?? (pokemon as any).maxHp ?? 0;
  const hpPercentage = maxHP > 0 ? (currentHP / maxHP) * 100 : 100;
  const heldItemName = pokemon.heldItemName ?? (pokemon as any).heldItem?.name;
  const speciesData = getSpeciesById(pokemon.species);
  const pokemonTypes = pokemon.types?.length ? pokemon.types : speciesData.types;
  const expWindow = getExpWindow(pokemon.level, pokemon.experience, speciesData.growthRate);
  const currentLevelExp = expWindow.current;
  const nextLevelExp = expWindow.next;
  const gained = Math.max(0, pokemon.experience - currentLevelExp);
  const span = Math.max(1, nextLevelExp - currentLevelExp);
  const expProgress = Math.min(100, Math.max(0, (gained / span) * 100));

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg bg-muted/50 p-2 hover:bg-muted/80 transition-colors",
          className
        )}
      >
        <div className="relative h-10 w-10 flex-shrink-0">
          <Image
            src={getSpriteUrl(pokemon.species)}
            alt={pokemon.speciesName}
            fill
            className="pixelated object-contain"
            unoptimized
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium truncate">{pokemon.nickname}</span>
            {pokemon.isShiny && <Sparkles className="h-3 w-3 text-amber-400" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">Lv.{pokemon.level}</span>
            {maxHP > 0 && (
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-20">
                <div
                  className={cn("h-full transition-all", getHpColor(currentHP, maxHP))}
                  style={{ width: `${hpPercentage}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("overflow-hidden hover:shadow-lg transition-shadow", className)}>
      <CardContent className="p-4">
        {/* Header with sprite and basic info */}
        <div className="flex items-start gap-3">
          {/* Sprite */}
          <div className="relative flex-shrink-0">
            <div className="relative h-16 w-16 rounded-lg bg-muted/50 p-1">
              <Image
                src={getSpriteUrl(pokemon.species)}
                alt={pokemon.speciesName}
                fill
                className="pixelated object-contain"
                unoptimized
              />
            </div>
            {index !== undefined && (
              <div className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {index + 1}
              </div>
            )}
          </div>

          {/* Name and Level */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-foreground truncate">{pokemon.nickname}</h3>
              {pokemon.isShiny && (
                <Sparkles className="h-4 w-4 text-amber-400 flex-shrink-0" />
              )}
              {(pokemon as any).isEgg && (
                <Egg className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
            {pokemon.nickname !== pokemon.speciesName && (
              <p className="text-xs text-muted-foreground">{pokemon.speciesName}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                Lv. {pokemon.level}
              </Badge>
              {pokemonTypes.map((type) => (
                <Badge
                  key={type}
                  variant="outline"
                  className="border text-xs capitalize"
                  style={getTypeStyle(type)}
                >
                  {type}
                </Badge>
              ))}
              {statusText && (
                <Badge className={cn("text-xs", getStatusColor(statusText))}>
                  {statusText}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* HP Bar */}
        {maxHP > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">HP</span>
              <span className="text-xs font-mono">
                {currentHP}/{maxHP}
              </span>
            </div>
            <Progress
              value={hpPercentage}
              className="h-2"
              indicatorClassName={getHpColor(currentHP, maxHP)}
            />
          </div>
        )}

        {/* EXP Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">EXP to next level</span>
            <span className="text-xs font-mono">
              {pokemon.level >= 100
                ? "MAX"
                : `${Math.max(0, nextLevelExp - pokemon.experience).toLocaleString()} left`}
            </span>
          </div>
          <Progress
            value={expProgress}
            className="h-2"
            indicatorClassName="bg-blue-500"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{pokemon.experience.toLocaleString()} EXP</span>
            <span>Lv. {pokemon.level + 1}</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded bg-muted/50 px-2 py-1.5">
            <p className="text-muted-foreground">EXP</p>
            <p className="font-mono font-medium">{pokemon.experience.toLocaleString()}</p>
          </div>
          <div className="rounded bg-muted/50 px-2 py-1.5">
            <p className="text-muted-foreground">ATK/DEF</p>
            <p className="font-mono font-medium">
              {pokemon.stats.attack}/{pokemon.stats.defense}
            </p>
          </div>
          <div className="rounded bg-muted/50 px-2 py-1.5">
            <p className="text-muted-foreground">SPD</p>
            <p className="font-mono font-medium">{pokemon.stats.speed}</p>
          </div>
        </div>

        {/* Moves */}
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-1.5">Moves</p>
          <div className="grid grid-cols-2 gap-1">
            {Array.from({ length: 4 }).map((_, i) => {
              const move = pokemon.moves[i];
              const moveData = getMoveById(move?.id ?? 0);
              const hasMove = Boolean(move && move.id > 0);
              const moveName =
                (hasMove && move.name && !move.name.startsWith("Move ") ? move.name : moveData.name) ||
                `Slot ${i + 1}`;
              const moveType = hasMove ? move?.type ?? moveData.type : moveData.type;
              const movePower = hasMove ? move?.power ?? moveData.power : moveData.power;
              const moveAccuracy = hasMove ? move?.accuracy ?? moveData.accuracy : moveData.accuracy;
              const maxPP = hasMove ? move?.maxPP || moveData.pp : moveData.pp;
              const currentPP = hasMove ? move?.pp ?? 0 : 0;

              return (
                <div
                  key={`${move?.id ?? 0}-${i}`}
                  className="rounded bg-muted/50 px-2 py-1 text-xs"
                  title={hasMove ? `${moveName} ${currentPP}/${maxPP} PP` : `Empty slot ${i + 1}`}
                >
                  <div className="truncate font-medium">
                    {hasMove ? moveName : `Empty Slot ${i + 1}`}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span className="rounded border px-1 capitalize" style={getTypeStyle(moveType ?? "???")}>
                      {moveType ?? "move"}
                    </span>
                    <span className="font-mono">{currentPP}/{maxPP}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>{movePower !== undefined && movePower !== null ? `${movePower} pow` : "status"}</span>
                    <span>{moveAccuracy ? `${moveAccuracy}% acc` : "--"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Held Item */}
        <div className="mt-3 rounded bg-muted/50 px-2 py-1.5 text-xs">
          <ItemInfoTooltip itemName={heldItemName} generation={generation}>
            <div className="flex cursor-help items-center gap-2">
              <ItemIcon itemName={heldItemName} generation={generation} />
              <span className="text-muted-foreground">Holding:</span>
              <span className="font-medium text-amber-400">{heldItemName ?? "None"}</span>
            </div>
          </ItemInfoTooltip>
          {pokemon.happiness !== undefined && (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Happiness</span>
                <span className="font-mono">{pokemon.happiness}/255</span>
              </div>
              <Progress
                value={Math.min(100, Math.max(0, (pokemon.happiness / 255) * 100))}
                className="h-1.5"
                indicatorClassName={getHappinessColor(pokemon.happiness)}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
