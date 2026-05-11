"use client";

import {
  GameVersion,
  Generation,
  LocationInfo,
  TrainerInfo,
} from "@/lib/pokemon/types";
import {
  GEN2_TOWN_MAP_HEIGHT,
  GEN2_TOWN_MAP_WIDTH,
  getGen2MapLandmark,
} from "@/lib/pokemon/data/gen2-map-landmarks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Coins,
  Clock,
  Award,
  MapPin,
  Gamepad2,
} from "lucide-react";

interface TrainerCardProps {
  trainer: TrainerInfo;
  generation: Generation;
  game?: GameVersion;
  location?: LocationInfo | string;
  compact?: boolean;
}

function formatPlayTime(time: { hours: number; minutes: number; seconds?: number }): string {
  const h = time.hours.toString().padStart(2, "0");
  const m = time.minutes.toString().padStart(2, "0");
  const s = (time.seconds ?? 0).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat().format(amount);
}

const POKE_DOLLAR_SYMBOL = "₽";

function getGameDisplayName(generation: Generation, game?: GameVersion): string {
  const gameNames: Record<string, string> = {
    red: "Pokemon Red",
    blue: "Pokemon Blue",
    yellow: "Pokemon Yellow",
    gold: "Pokemon Gold",
    silver: "Pokemon Silver",
    crystal: "Pokemon Crystal",
    ruby: "Pokemon Ruby",
    sapphire: "Pokemon Sapphire",
    emerald: "Pokemon Emerald",
    firered: "Pokemon FireRed",
    leafgreen: "Pokemon LeafGreen",
  };
  return game ? gameNames[game] || `Pokemon ${game}` : `Generation ${generation}`;
}

function getGenBadgeColor(gen: number): string {
  switch (gen) {
    case 1:
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case 2:
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case 3:
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    default:
      return "bg-primary/20 text-primary border-primary/30";
  }
}

type BadgeDescriptor = {
  name: string;
  shortName: string;
  sprite: string;
};

const BADGE_DESCRIPTORS: BadgeDescriptor[] = [
  { name: "Zephyr Badge", shortName: "Zephyr", sprite: "/badges/zephyr.png" },
  { name: "Hive Badge", shortName: "Hive", sprite: "/badges/hive.png" },
  { name: "Plain Badge", shortName: "Plain", sprite: "/badges/plain.png" },
  { name: "Fog Badge", shortName: "Fog", sprite: "/badges/fog.png" },
  { name: "Storm Badge", shortName: "Storm", sprite: "/badges/storm.png" },
  { name: "Mineral Badge", shortName: "Mineral", sprite: "/badges/mineral.png" },
  { name: "Glacier Badge", shortName: "Glacier", sprite: "/badges/glacier.png" },
  { name: "Rising Badge", shortName: "Rising", sprite: "/badges/rising.png" },
  { name: "Boulder Badge", shortName: "Boulder", sprite: "/badges/boulder.png" },
  { name: "Cascade Badge", shortName: "Cascade", sprite: "/badges/cascade.png" },
  { name: "Thunder Badge", shortName: "Thunder", sprite: "/badges/thunder.png" },
  { name: "Rainbow Badge", shortName: "Rainbow", sprite: "/badges/rainbow.png" },
  { name: "Soul Badge", shortName: "Soul", sprite: "/badges/soul.png" },
  { name: "Marsh Badge", shortName: "Marsh", sprite: "/badges/marsh.png" },
  { name: "Volcano Badge", shortName: "Volcano", sprite: "/badges/volcano.png" },
  { name: "Earth Badge", shortName: "Earth", sprite: "/badges/earth.png" },
];

function getBadgeState(index: number): BadgeDescriptor {
  const badge = BADGE_DESCRIPTORS[index] ?? BADGE_DESCRIPTORS[index % BADGE_DESCRIPTORS.length];
  return badge;
}

function getMapLabel(name?: string) {
  const raw = name?.trim();
  if (!raw || raw.toLowerCase() === "live") return "Location syncing";
  return raw;
}

const POKEGEAR_MAPS = {
  johto: "/maps/johto-town-map-gsc.png",
  kanto: "/maps/kanto-town-map-gsc.png",
} as const;

function PlayerMapMarker({ landmark }: { landmark: NonNullable<ReturnType<typeof getGen2MapLandmark>> }) {
  const markerHeight = 14;
  const markerWidth = 12;

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full [image-rendering:pixelated]"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${GEN2_TOWN_MAP_WIDTH} ${GEN2_TOWN_MAP_HEIGHT}`}
    >
      <image
        href="/maps/trainer-marker.png"
        height={markerHeight}
        preserveAspectRatio="xMidYMid meet"
        width={markerWidth}
        x={landmark.x - markerWidth / 2}
        y={landmark.y - markerHeight / 2}
      />
    </svg>
  );
}

function MiniMap({ location, compact = false }: { location?: LocationInfo | string; compact?: boolean }) {
  const locationName = typeof location === "string" ? location : location?.name;
  const mapGroup = typeof location === "string" ? undefined : location?.mapGroup;
  const mapId = typeof location === "string" ? undefined : location?.mapId;
  const landmark = getGen2MapLandmark(mapGroup, mapId, locationName);
  const label = landmark?.name ?? getMapLabel(locationName);
  const mapRegion = landmark?.region === "kanto" ? "kanto" : "johto";

  return (
    <div className={`rounded-lg border border-[#617b38] bg-[#d7e7b6] text-[#182410] ${compact ? "p-2.5" : "p-3"}`}>
      <div className={`flex items-center justify-between ${compact ? "mb-1.5" : "mb-2"}`}>
        <div>
          <p className="text-xs font-semibold uppercase text-[#506033]">Pokégear Map</p>
          <p className="text-sm font-bold text-[#182410]">{label}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-sm border border-[#7d8f46] bg-[#eef8bf] px-2 py-0.5 text-[10px] font-bold uppercase text-[#506033]">
            Debug {mapGroup ? `G${mapGroup}` : "G?"} / {mapId ? `M${mapId}` : "M?"}
          </span>
          <MapPin className="h-4 w-4 text-[#2f6f28]" />
        </div>
      </div>
      <div className={`relative overflow-hidden rounded-md border-[#182410] bg-[#6f9f48] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.35)] ${compact ? "border-2 p-1.5" : "border-4 p-2"}`}>
        <div className={`relative mx-auto aspect-[160/144] w-full overflow-hidden rounded-sm border-2 border-[#f8f0b8] bg-[#93c66d] ${compact ? "max-w-[400px]" : "max-w-[720px]"}`}>
          <img
            src={POKEGEAR_MAPS[mapRegion]}
            alt="Pokégear Kanto and Johto town map"
            className="h-full w-full object-contain [image-rendering:pixelated]"
            draggable={false}
          />
          {landmark && <PlayerMapMarker landmark={landmark} />}
        </div>
      </div>
    </div>
  );
}

export function TrainerMapCard({ location }: { location?: LocationInfo | string }) {
  if (!location) return null;

  return <MiniMap location={location} compact />;
}

export function TrainerCard({ trainer, generation, game, location, compact = false }: TrainerCardProps) {
  const locationName = typeof location === "string" ? location : location?.name;
  const trainerGender = trainer.gender?.trim();
  const totalBadges = Array.isArray(trainer.badges) ? trainer.badges.length : 8;
  const badgeCount = Array.isArray(trainer.badges)
    ? trainer.badges.filter(Boolean).length
    : trainer.badgeCount;

  if (compact) {
    return (
      <Card className="h-fit overflow-hidden border-border/80 bg-card/80">
        <CardContent className="p-3">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-primary" />
                Trainer Info
              </CardTitle>
              <Badge variant="outline" className={getGenBadgeColor(generation)}>
                Gen {generation}
              </Badge>
            </div>

            <div className="grid gap-2 md:grid-cols-[minmax(170px,1fr)_minmax(150px,0.8fr)_minmax(180px,0.9fr)_minmax(135px,0.6fr)]">
              <div className="flex min-h-[54px] items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                <div>
                  <p className="text-xl font-black leading-none text-foreground">{trainer.name}</p>
                  <p className="mt-1 text-xs font-mono text-muted-foreground">
                    ID: {trainer.id.toString().padStart(5, "0")}
                  </p>
                </div>
                {trainerGender && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Gender</p>
                    <p className="text-sm font-medium capitalize">{trainerGender}</p>
                  </div>
                )}
              </div>

              <div className="flex min-h-[54px] items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <Gamepad2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-semibold">{getGameDisplayName(generation, game)}</span>
              </div>

              <div className="grid min-h-[54px] grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Money</p>
                  <p className="font-mono text-sm font-bold">{POKE_DOLLAR_SYMBOL}{formatMoney(trainer.money)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Play Time</p>
                  <p className="font-mono text-sm font-bold">{formatPlayTime(trainer.playTime)}</p>
                </div>
              </div>

              <div className="flex min-h-[54px] items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 md:col-span-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Award className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Badges</span>
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {Array.from({ length: totalBadges }).map((_, i) => {
                      const earned = Array.isArray(trainer.badges) ? Boolean(trainer.badges[i]) : i < trainer.badgeCount;
                      const badge = getBadgeState(i);
                      return (
                        <div
                          key={badge.name}
                          className={`w-11 text-center ${earned ? "" : "opacity-45 grayscale"}`}
                          title={badge.name}
                        >
                          <img
                            src={badge.sprite}
                            alt={badge.name}
                            className="mx-auto h-5 w-5 object-contain [image-rendering:pixelated]"
                            draggable={false}
                          />
                          <span className="mt-0.5 block truncate text-[9px] font-semibold uppercase leading-none text-muted-foreground">
                            {badge.shortName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <span className="shrink-0 text-lg font-black">{badgeCount}/{totalBadges}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/80 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Trainer Info
          </CardTitle>
          <Badge variant="outline" className={getGenBadgeColor(generation)}>
            Gen {generation}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trainer Name & ID */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-foreground">{trainer.name}</p>
            <p className="text-xs text-muted-foreground font-mono">
              ID: {trainer.id.toString().padStart(5, "0")}
            </p>
          </div>
          {trainerGender && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Gender</p>
              <p className="text-sm font-medium capitalize">{trainerGender}</p>
            </div>
          )}
        </div>

        {/* Game Info */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
          <Gamepad2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{getGameDisplayName(generation, game)}</span>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Money */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
            <Coins className="h-4 w-4 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">Money</p>
              <p className="text-sm font-bold font-mono">
                {POKE_DOLLAR_SYMBOL}{formatMoney(trainer.money)}
              </p>
            </div>
          </div>

          {/* Play Time */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
            <Clock className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Play Time</p>
              <p className="text-sm font-bold font-mono">
                {formatPlayTime(trainer.playTime)}
              </p>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Badges</p>
            </div>
            <span className="text-lg font-bold">{badgeCount}/{totalBadges}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(70px,1fr))] gap-2">
            {Array.from({ length: totalBadges }).map((_, i) => {
              const earned = Array.isArray(trainer.badges) ? Boolean(trainer.badges[i]) : i < trainer.badgeCount;
              const badge = getBadgeState(i);
              return (
                <div
                  key={badge.name}
                  className={`relative flex h-[74px] items-center justify-center overflow-hidden rounded-lg border bg-background/60 ${
                    earned ? "border-amber-300/40" : "border-muted-foreground/10 opacity-45 grayscale"
                  }`}
                  title={badge.name}
                >
                  <img
                    src={badge.sprite}
                    alt={badge.name}
                    className="h-9 w-9 object-contain [image-rendering:pixelated]"
                    draggable={false}
                  />
                  <span className="absolute bottom-1 left-1/2 w-full -translate-x-1/2 px-1 text-center text-[10px] font-semibold uppercase leading-none text-white/80">
                    {badge.shortName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Location */}
        {locationName && <MiniMap location={location} />}
      </CardContent>
    </Card>
  );
}
