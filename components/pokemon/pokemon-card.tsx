"use client";

import { Pokemon } from "@/lib/pokemon/types";
import { getSpeciesById } from "@/lib/pokemon/data/species";
import { getMoveById } from "@/lib/pokemon/data/moves";
import { getExpWindow } from "@/lib/pokemon/experience";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Sparkles, Heart, Skull } from "lucide-react";
import Image from "next/image";
import { ItemIcon } from "./item-icon";
import { ItemInfoTooltip } from "./item-info-tooltip";
import { MoveInfoTooltip } from "./move-info-tooltip";
import { getEggSpriteUrl, getPokemonSpriteUrl } from "@/lib/pokemon/forms";
import { getTypeColor, TypeBadge } from "./type-badge";

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

function getCardBackground(primaryType: string, secondaryType?: string): React.CSSProperties {
  const primary = getTypeColor(primaryType);
  const secondary = getTypeColor(secondaryType ?? primaryType);

  return {
    borderColor: `${primary}55`,
    background:
      `radial-gradient(circle at 18% 8%, ${primary}30 0, transparent 30%), ` +
      `radial-gradient(circle at 84% 2%, ${secondary}26 0, transparent 28%), ` +
      `linear-gradient(135deg, ${primary}12 0%, transparent 34%, ${secondary}10 100%), ` +
      "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--card)) 100%)",
    boxShadow: `inset 0 1px 0 ${primary}18`,
  };
}

function getTypeAuraStyle(primaryType: string, secondaryType?: string): React.CSSProperties {
  const primary = getTypeColor(primaryType);
  const secondary = getTypeColor(secondaryType ?? primaryType);

  return {
    background:
      `radial-gradient(circle at 24% 35%, ${primary}38 0, transparent 24%), ` +
      `radial-gradient(circle at 78% 18%, ${secondary}28 0, transparent 28%), ` +
      `linear-gradient(115deg, transparent 0%, ${primary}12 36%, transparent 64%, ${secondary}10 100%)`,
    opacity: 0.9,
  };
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
  const isFainted = !pokemon.isEgg && maxHP > 0 && currentHP <= 0;
  const heldItemName = pokemon.heldItemName ?? (pokemon as any).heldItem?.name;
  const speciesData = getSpeciesById(pokemon.species);
  const pokemonTypes = pokemon.types?.length ? pokemon.types : speciesData.types;
  const primaryType = pokemonTypes[0] ?? "???";
  const secondaryType = pokemonTypes[1];
  const displayName = pokemon.isEgg
    ? pokemon.species > 0
      ? `Egg (${pokemon.speciesName})`
      : "Egg"
    : pokemon.nickname;
  const subtitle = pokemon.isEgg && pokemon.species > 0
    ? `Will hatch into ${pokemon.speciesName}`
    : pokemon.nickname !== pokemon.speciesName
      ? pokemon.speciesName
      : null;
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
          "relative flex items-center gap-3 rounded-lg bg-muted/50 p-2 transition-colors hover:bg-muted/80",
          isFainted && "border border-red-500/60 bg-red-950/20 shadow-[inset_3px_0_0_rgba(239,68,68,0.75)]",
          className
        )}
      >
        <div className="relative h-10 w-10 flex-shrink-0">
          {pokemon.species > 0 && (
            <Image
              src={getPokemonSpriteUrl(pokemon)}
              alt={pokemon.speciesName}
              fill
              className={cn(
                "pixelated object-contain",
                pokemon.isEgg && "translate-x-1 translate-y-1 scale-90 opacity-55",
                isFainted && "grayscale"
              )}
              unoptimized
            />
          )}
          {pokemon.isEgg && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Image
                src={getEggSpriteUrl()}
                alt="Egg"
                width={34}
                height={34}
                className="pixelated -translate-x-1 -translate-y-1 drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]"
                unoptimized
              />
            </div>
          )}
          {isFainted && (
            <div className="absolute -inset-1 rounded-lg border border-red-400/70 shadow-[0_0_18px_rgba(239,68,68,0.35)]" />
          )}
          {isFainted && (
            <div className="absolute -right-1 -top-1 rounded-full border border-background bg-red-500 p-0.5 text-white shadow">
              <Skull className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium truncate">{displayName}</span>
            {pokemon.isShiny && <Sparkles className="h-3 w-3 text-amber-400" />}
            {isFainted && (
              <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-red-300">
                FNT
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="truncate text-xs text-muted-foreground">
              {pokemon.isEgg ? subtitle ?? "Egg" : `Lv.${pokemon.level}`}
            </span>
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
        isFainted && "border-red-500/75 shadow-[0_0_0_1px_rgba(239,68,68,0.28),0_20px_60px_rgba(127,29,29,0.18)]",
        className
      )}
      style={getCardBackground(primaryType, secondaryType)}
    >
      <CardContent className="p-0">
        {/* Header with sprite and basic info */}
        <div className="relative flex items-start gap-3 overflow-hidden border-b border-border/50 p-3">
          <div className="pointer-events-none absolute inset-0" style={getTypeAuraStyle(primaryType, secondaryType)} />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                `linear-gradient(90deg, ${primaryTypeColor} 1px, transparent 1px), ` +
                `linear-gradient(0deg, ${primaryTypeColor} 1px, transparent 1px)`,
              backgroundSize: "18px 18px",
            }}
          />
          <div
            className="absolute inset-x-0 top-0 z-10 h-1"
            style={{
              background: secondaryType
                ? `linear-gradient(90deg, ${primaryTypeColor}, ${getTypeColor(secondaryType)})`
                : primaryTypeColor,
            }}
          />
          {isFainted && (
            <div className="absolute inset-x-0 top-1 z-10 h-1 bg-red-500/80" />
          )}
          {/* Sprite */}
          <div className="relative z-10 flex-shrink-0">
            <div
              className="relative h-16 w-16 overflow-hidden rounded-lg border p-1 shadow-inner backdrop-blur-[1px]"
              style={{
                background:
                  `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.22), transparent 26%), ` +
                  `linear-gradient(145deg, ${primaryTypeColor}24, rgba(0,0,0,0.12))`,
                borderColor: `${primaryTypeColor}66`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 24px ${primaryTypeColor}18`,
              }}
            >
              {pokemon.species > 0 && (
                <Image
                  src={getPokemonSpriteUrl(pokemon)}
                  alt={pokemon.speciesName}
                  fill
                  className={cn(
                    "pixelated object-contain p-0.5 drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-110",
                    pokemon.isEgg && "translate-x-2 translate-y-2 scale-90 opacity-55",
                    isFainted && "grayscale"
                  )}
                  unoptimized
                />
              )}
              {pokemon.isEgg && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image
                    src={getEggSpriteUrl()}
                    alt="Egg"
                    width={48}
                    height={48}
                    className="pixelated -translate-x-1 -translate-y-1 drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]"
                    unoptimized
                  />
                </div>
              )}
              {isFainted && (
                <div className="absolute -inset-1 rounded-xl border border-red-400/80 shadow-[0_0_20px_rgba(239,68,68,0.35)]" />
              )}
              {isFainted && (
                <div className="absolute -right-1.5 -top-1.5 rounded-full border-2 border-background bg-red-500 p-1 text-white shadow-lg">
                  <Skull className="h-4 w-4" />
                </div>
              )}
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
          <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-xl font-black tracking-normal text-foreground">
                  {displayName}
                </h3>
                {pokemon.isShiny && (
                  <Sparkles className="h-4 w-4 flex-shrink-0 text-amber-400" />
                )}
                {isFainted && (
                  <Badge className="rounded-md border border-red-400/50 bg-red-500/15 px-2 py-0.5 text-[11px] font-black uppercase text-red-300">
                    Fainted
                  </Badge>
                )}
              </div>
              {subtitle && (
                <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
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
                <TypeBadge key={type} type={type} />
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
          {pokemon.moves?.some((move) => (move?.id ?? 0) > 0) && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Moves</p>
              <div className="grid grid-cols-2 gap-2">
                {pokemon.moves
                  .map((move, i) => ({ move, i }))
                  .filter(({ move }) => (move?.id ?? 0) > 0)
                  .slice(0, 4)
                  .map(({ move, i }) => {
                    const moveData = getMoveById(move?.id ?? 0);
                    const moveName =
                      (move?.name && !move.name.startsWith("Move ") ? move.name : moveData.name) || `Move ${i + 1}`;
                    const moveType = move?.type ?? moveData.type;
                    const movePower = move?.power ?? moveData.power;
                    const moveAccuracy = move?.accuracy ?? moveData.accuracy;
                    const maxPP = move?.maxPP || moveData.pp;
                    const currentPP = move?.pp ?? 0;
                    const moveColor = getTypeColor(moveType ?? "???");

                    return (
                      <MoveInfoTooltip
                        key={`${move?.id ?? 0}-${i}`}
                        moveId={move?.id}
                        moveName={moveName}
                        generation={generation}
                      >
                        <div
                          className="cursor-help rounded-md border border-border/60 bg-background/45 p-2 text-xs"
                          style={{ boxShadow: `inset 3px 0 0 ${moveColor}` }}
                          title={`${moveName} ${currentPP}/${maxPP} PP`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-foreground">{moveName}</div>
                              <TypeBadge className="mt-1" size="xs" type={moveType ?? "???"} />
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
          )}

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
