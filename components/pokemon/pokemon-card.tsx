"use client";

import { Pokemon, TYPE_COLORS } from "@/lib/pokemon/types";
import { getSpeciesById } from "@/lib/pokemon/data/species";
import { getMoveById } from "@/lib/pokemon/data/moves";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Sparkles, Egg, Heart } from "lucide-react";
import Image from "next/image";
import { ItemIcon } from "./item-icon";
import { ItemInfoTooltip } from "./item-info-tooltip";
import { MoveInfoTooltip } from "./move-info-tooltip";

interface PokemonCardProps {
  pokemon: Pokemon;
  index?: number;
  generation?: number;
  compact?: boolean;
  className?: string;
}

const BASE_STAT_REFERENCE = 255;

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
  const color = getTypeColor(type);
  return {
    backgroundColor: `${color}22`,
    borderColor: `${color}66`,
    color,
  };
}

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? TYPE_COLORS["???"];
}

function getCardBackground(primaryType: string, secondaryType?: string): React.CSSProperties {
  const primary = getTypeColor(primaryType);
  const secondary = getTypeColor(secondaryType ?? primaryType);

  return {
    borderColor: `${primary}55`,
    background:
      `radial-gradient(circle at 16% 8%, ${primary}33 0, transparent 34%), ` +
      `radial-gradient(circle at 86% 0%, ${secondary}22 0, transparent 30%), ` +
      "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--card)) 100%)",
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
  const primaryType = pokemonTypes[0] ?? "???";
  const secondaryType = pokemonTypes[1];
  const primaryTypeColor = getTypeColor(primaryType);
  const expWindow = getExpWindow(pokemon.level, pokemon.experience, speciesData.growthRate);
  const currentLevelExp = expWindow.current;
  const nextLevelExp = expWindow.next;
  const gained = Math.max(0, pokemon.experience - currentLevelExp);
  const span = Math.max(1, nextLevelExp - currentLevelExp);
  const expProgress = Math.min(100, Math.max(0, (gained / span) * 100));
  const statRows =
    generation === 1
      ? [
          { label: "Atk", value: pokemon.stats.attack },
          { label: "Def", value: pokemon.stats.defense },
          { label: "Spc", value: pokemon.stats.special ?? pokemon.stats.specialAttack ?? 0 },
          { label: "Spe", value: pokemon.stats.speed },
        ]
      : [
          { label: "Atk", value: pokemon.stats.attack },
          { label: "Def", value: pokemon.stats.defense },
          { label: "SpA", value: pokemon.stats.specialAttack ?? pokemon.stats.special ?? 0 },
          { label: "SpD", value: pokemon.stats.specialDefense ?? pokemon.stats.special ?? 0 },
          { label: "Spe", value: pokemon.stats.speed },
        ];
  const statBarReference = Math.max(BASE_STAT_REFERENCE, ...statRows.map((stat) => stat.value));

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
    <Card
      className={cn(
        "group overflow-hidden border-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl",
        className
      )}
      style={getCardBackground(primaryType, secondaryType)}
    >
      <CardContent className="p-0">
        {/* Header with sprite and basic info */}
        <div className="relative flex items-start gap-3 overflow-hidden border-b border-border/50 p-3">
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{
              background: secondaryType
                ? `linear-gradient(90deg, ${primaryTypeColor}, ${getTypeColor(secondaryType)})`
                : primaryTypeColor,
            }}
          />
          {/* Sprite */}
          <div className="relative flex-shrink-0">
            <div
              className="relative h-16 w-16 overflow-hidden rounded-lg border p-1 shadow-inner"
              style={{
                backgroundColor: `${primaryTypeColor}18`,
                borderColor: `${primaryTypeColor}44`,
              }}
            >
              <Image
                src={getSpriteUrl(pokemon.species)}
                alt={pokemon.speciesName}
                fill
                className="pixelated object-contain p-0.5 drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-110"
                unoptimized
              />
            </div>
            {index !== undefined && (
              <div
                className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-xs font-black text-background shadow-lg"
                style={{ backgroundColor: primaryTypeColor }}
              >
                {index + 1}
              </div>
            )}
          </div>

          {/* Name and Level */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-xl font-black tracking-normal text-foreground">
                  {pokemon.nickname}
                </h3>
                {pokemon.isShiny && (
                  <Sparkles className="h-4 w-4 flex-shrink-0 text-amber-400" />
                )}
                {(pokemon as any).isEgg && (
                  <Egg className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
              </div>
              {pokemon.nickname !== pokemon.speciesName && (
                <p className="truncate text-sm text-muted-foreground">{pokemon.speciesName}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="rounded-md px-2.5 py-0.5 text-sm font-bold"
              >
                Lv. {pokemon.level}
              </Badge>
              {pokemonTypes.map((type) => (
                <Badge
                  key={type}
                  variant="outline"
                  className="rounded-md border px-2.5 py-0.5 text-sm font-semibold capitalize"
                  style={getTypeStyle(type)}
                >
                  {type}
                </Badge>
              ))}
              {statusText && (
                <Badge className={cn("rounded-md px-2.5 py-1 text-xs", getStatusColor(statusText))}>
                  {statusText}
                </Badge>
              )}
            </div>
            {maxHP > 0 && (
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="font-medium text-muted-foreground">HP</span>
                  <span className="font-mono text-foreground">
                    {currentHP}/{maxHP}
                  </span>
                </div>
                <Progress
                  value={hpPercentage}
                  className="h-2 bg-background/60"
                  indicatorClassName={getHpColor(currentHP, maxHP)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 p-3">
          {/* EXP Bar */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">EXP to next level</span>
              <span className="font-mono text-xs">
                {pokemon.level >= 100
                  ? "MAX"
                  : `${Math.max(0, nextLevelExp - pokemon.experience).toLocaleString()} left`}
              </span>
            </div>
            <Progress
              value={expProgress}
              className="h-1.5 bg-background/60"
              indicatorClassName="bg-blue-500"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{pokemon.experience.toLocaleString()} EXP</span>
              <span>{pokemon.level >= 100 ? "Lv. MAX" : `Lv. ${pokemon.level + 1}`}</span>
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(86px,1fr))] gap-2">
            {statRows.map((stat) => (
              <div
                key={stat.label}
                className="rounded-md border border-border/60 bg-background/45 px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold text-muted-foreground">{stat.label}</p>
                  <p className="font-mono text-xs font-bold text-foreground">{stat.value}</p>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(8, Math.min(100, (stat.value / statBarReference) * 100))}%`,
                      backgroundColor: primaryTypeColor,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Moves */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Moves</p>
            <div className="grid grid-cols-2 gap-2">
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
                const moveColor = getTypeColor(moveType ?? "???");

                return (
                  <MoveInfoTooltip
                    key={`${move?.id ?? 0}-${i}`}
                    moveId={hasMove ? move?.id : 0}
                    moveName={hasMove ? moveName : undefined}
                    generation={generation}
                  >
                    <div
                      className="cursor-help rounded-md border border-border/60 bg-background/45 p-2 text-xs"
                      style={{ boxShadow: `inset 3px 0 0 ${moveColor}` }}
                      title={hasMove ? `${moveName} ${currentPP}/${maxPP} PP` : `Empty slot ${i + 1}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-foreground">
                            {hasMove ? moveName : `Empty Slot ${i + 1}`}
                          </div>
                          <span
                            className="mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium capitalize"
                            style={getTypeStyle(moveType ?? "???")}
                          >
                            {moveType ?? "move"}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {currentPP}/{maxPP}
                        </span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                        <span>{movePower !== undefined && movePower !== null ? `${movePower} pow` : "status"}</span>
                        <span className="text-right">{moveAccuracy ? `${moveAccuracy}% acc` : "--"}</span>
                      </div>
                    </div>
                  </MoveInfoTooltip>
                );
              })}
            </div>
          </div>

          {/* Held Item */}
          <div className="rounded-md border border-border/60 bg-background/45 px-3 py-2 text-xs">
            <ItemInfoTooltip itemName={heldItemName} generation={generation}>
              <div className="flex cursor-help items-center gap-3">
                <ItemIcon itemName={heldItemName} generation={generation} />
                <span className="text-muted-foreground">Holding:</span>
                <span className="font-semibold text-amber-400">{heldItemName ?? "None"}</span>
              </div>
            </ItemInfoTooltip>
            {pokemon.happiness !== undefined && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3 text-rose-400" />
                    Happiness
                  </span>
                  <span className="font-mono">{pokemon.happiness}/255</span>
                </div>
                <Progress
                  value={Math.min(100, Math.max(0, (pokemon.happiness / 255) * 100))}
                  className="h-1.5 bg-background/60"
                  indicatorClassName={getHappinessColor(pokemon.happiness)}
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
