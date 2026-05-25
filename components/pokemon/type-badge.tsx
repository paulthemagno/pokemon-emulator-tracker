"use client";

import { TYPE_COLORS } from "@/lib/pokemon/types";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { HelpCircle } from "lucide-react";

const TYPE_ICON_PATHS: Record<string, string> = {
  normal: "/type-icons/normal.png",
  fire: "/type-icons/fire.png",
  water: "/type-icons/water.png",
  electric: "/type-icons/electric.png",
  grass: "/type-icons/grass.png",
  ice: "/type-icons/ice.png",
  fighting: "/type-icons/fighting.png",
  poison: "/type-icons/poison.png",
  ground: "/type-icons/ground.png",
  flying: "/type-icons/flying.png",
  psychic: "/type-icons/psychic.png",
  bug: "/type-icons/bug.png",
  rock: "/type-icons/rock.png",
  ghost: "/type-icons/ghost.png",
  dragon: "/type-icons/dragon.png",
  dark: "/type-icons/dark.png",
  steel: "/type-icons/steel.png",
  fairy: "/type-icons/fairy.png",
};

interface TypeBadgeProps {
  type?: string | null;
  size?: "xs" | "sm";
  className?: string;
}

export function getTypeColor(type?: string | null): string {
  const normalized = (type ?? "???").toLowerCase();
  return TYPE_COLORS[normalized] ?? TYPE_COLORS["???"];
}

export function TypeBadge({ type, size = "sm", className }: TypeBadgeProps) {
  const normalized = (type ?? "???").toLowerCase();
  const color = getTypeColor(normalized);
  const iconPath = TYPE_ICON_PATHS[normalized];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold capitalize leading-none shadow-sm",
        size === "xs" ? "gap-1 px-1.5 py-0.5 pr-2 text-[10px]" : "gap-1.5 px-2 py-1 pr-2.5 text-sm",
        className
      )}
      style={{
        background:
          `radial-gradient(circle at 28% 18%, rgba(255,255,255,0.55), transparent 22%), ` +
          `linear-gradient(145deg, ${color}36, ${color}16 58%, rgba(0,0,0,0.22))`,
        borderColor: `${color}95`,
        color,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 14px ${color}20`,
      }}
      title={normalized}
    >
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border",
          size === "xs" ? "h-5 w-5" : "h-6 w-6"
        )}
        style={{
          background:
            `radial-gradient(circle at 32% 22%, rgba(255,255,255,0.82), transparent 18%), ` +
            `linear-gradient(145deg, ${color}, ${color}bb 58%, rgba(0,0,0,0.34))`,
          borderColor: "rgba(255,255,255,0.62)",
        }}
      >
        {iconPath ? (
          <Image
            alt=""
            aria-hidden="true"
            className={size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4"}
            height={64}
            src={iconPath}
            width={64}
          />
        ) : (
          <HelpCircle className={size === "xs" ? "h-3 w-3" : "h-4 w-4"} />
        )}
      </span>
      {normalized}
    </span>
  );
}
