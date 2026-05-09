"use client";

import {
  GameVersion,
  Generation,
  LocationInfo,
  TrainerInfo,
} from "@/lib/pokemon/types";
import { getGen2MapLandmark } from "@/lib/pokemon/data/gen2-map-landmarks";
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

function clampMapPercent(value: number) {
  return Math.max(3, Math.min(97, value));
}

function landmarkToMarkerStyle(landmark: ReturnType<typeof getGen2MapLandmark>) {
  if (!landmark) return {};

  const defaultOffsetX = landmark.region === "kanto" ? -8 : 0;
  const defaultOffsetY = landmark.region === "kanto" ? -15 : 0;
  const markerCenterX = ((landmark.x / 100) * 144 + (landmark.offsetX ?? defaultOffsetX)) / 144 * 100;
  const markerCenterY = ((landmark.y / 100) * 120 + (landmark.offsetY ?? defaultOffsetY)) / 120 * 100;

  return {
    left: `${clampMapPercent(markerCenterX)}%`,
    top: `${clampMapPercent(markerCenterY)}%`,
  };
}

function PlayerMapMarker() {
  return (
    <div className="relative h-4 w-4 -translate-x-1/2 -translate-y-1/2 [image-rendering:pixelated]">
      <div className="absolute left-1/2 top-0 h-1 w-2 -translate-x-1/2 bg-[#f02018]" />
      <div className="absolute left-1/2 bottom-0 h-1 w-2 -translate-x-1/2 bg-[#f02018]" />
      <div className="absolute left-0 top-1/2 h-2 w-1 -translate-y-1/2 bg-[#f02018]" />
      <div className="absolute right-0 top-1/2 h-2 w-1 -translate-y-1/2 bg-[#f02018]" />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-[#f02018]" />
      <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 bg-[#fff8b8]" />
    </div>
  );
}

function MiniMap({ location }: { location?: LocationInfo | string }) {
  const locationName = typeof location === "string" ? location : location?.name;
  const mapGroup = typeof location === "string" ? undefined : location?.mapGroup;
  const mapId = typeof location === "string" ? undefined : location?.mapId;
  const landmark = getGen2MapLandmark(mapGroup, mapId, locationName);
  const label = landmark?.name ?? getMapLabel(locationName);
  const mapRegion = landmark?.region === "kanto" ? "kanto" : "johto";

  return (
    <div className="rounded-lg border border-[#617b38] bg-[#d7e7b6] p-3 text-[#182410]">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[#506033]">Pokégear Map</p>
          <p className="text-sm font-bold text-[#182410]">{label}</p>
        </div>
        <MapPin className="h-4 w-4 text-[#2f6f28]" />
      </div>
      <div className="relative overflow-hidden rounded-md border-4 border-[#182410] bg-[#6f9f48] p-2 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.35)]">
        <div className="relative mx-auto aspect-[144/120] max-h-[520px] w-full max-w-[720px] overflow-hidden rounded-sm border-2 border-[#f8f0b8] bg-[#93c66d]">
          <img
            src={POKEGEAR_MAPS[mapRegion]}
            alt="Pokégear Kanto and Johto town map"
            className="h-full w-full object-cover [image-rendering:pixelated]"
            draggable={false}
          />
          {landmark && (
            <div
              className="absolute transition-[left,top] duration-300"
              style={landmarkToMarkerStyle(landmark)}
              title={landmark.name}
            >
              <PlayerMapMarker />
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between rounded-sm border-2 border-[#182410] bg-[#f8f0b8] px-2 py-1 text-[11px] font-bold uppercase text-[#182410]">
          <span>{label}</span>
          <span>{mapGroup ? `G${mapGroup}` : "G?"} / {mapId ? `M${mapId}` : "M?"}</span>
        </div>
      </div>
    </div>
  );
}

export function TrainerCard({ trainer, generation, game, location }: TrainerCardProps) {
  const locationName = typeof location === "string" ? location : location?.name;
  const totalBadges = Array.isArray(trainer.badges) ? trainer.badges.length : 8;
  const badgeCount = Array.isArray(trainer.badges)
    ? trainer.badges.filter(Boolean).length
    : trainer.badgeCount;

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
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Gender</p>
            <p className="text-sm font-medium capitalize">{trainer.gender}</p>
          </div>
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
                ${formatMoney(trainer.money)}
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
