"use client";

import { useState } from "react";
import Image from "next/image";
import type { BattleFrontier } from "@/lib/pokemon/types";
import { getFrontierSymbolProgress } from "@/lib/pokemon/frontier";
import { cn } from "@/lib/utils";

const names: Record<string, string> = {
  tower: "Tower", dome: "Dome", palace: "Palace", arena: "Arena",
  factory: "Factory", pike: "Pike", pyramid: "Pyramid",
};
const modes: Record<string, string> = {
  singles: "Singles", doubles: "Doubles", multis: "Multi", link_multis: "Link Multi",
};

function SymbolSprite({ id, tier, dim = false, size = 40 }: { id: string; tier: "silver" | "gold"; dim?: boolean; size?: number }) {
  return <Image src={`/frontier/${id}-${tier}.svg`} alt="" width={size} height={size} unoptimized
    className={cn("shrink-0 [image-rendering:pixelated]", dim && "opacity-50")} />;
}

export function FrontierPanel({ data }: { data: BattleFrontier }) {
  const [selectedId, setSelectedId] = useState(data.facilities[0]?.id);
  const selected = data.facilities.find(facility => facility.id === selectedId) ?? data.facilities[0];
  if (!selected) return null;

  return <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
    <div className="grid grid-cols-4 border-b border-border/70 p-2 sm:grid-cols-7 sm:p-3" aria-label="Battle Frontier facilities">
      {data.facilities.map(facility => {
        const symbolStatus = (tier: "silver" | "gold") => facility[tier] === null ? "unknown" : facility[tier] ? "earned" : "not earned";
        return <button key={facility.id} type="button" aria-pressed={selected.id === facility.id}
          aria-label={`Battle ${names[facility.id]}, silver ${symbolStatus("silver")}, gold ${symbolStatus("gold")}`}
          onClick={() => setSelectedId(facility.id)}
          className={cn("group flex min-w-0 flex-col items-center gap-2 rounded-lg px-1 py-3 text-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            selected.id === facility.id ? "bg-muted/70 text-foreground" : "text-muted-foreground"
          )}>
          <span className="flex gap-2 sm:gap-3">
            {(["silver", "gold"] as const).map(tier => <span key={tier} className="flex flex-col items-center gap-1" title={`${tier === "silver" ? "Silver" : "Gold"}: ${symbolStatus(tier)}`}>
              <SymbolSprite id={facility.id} tier={tier} dim={facility[tier] !== true} size={28} />
              <span className="text-[9px] text-muted-foreground">{tier === "silver" ? "Silver" : "Gold"}{facility[tier] === true ? " ✓" : facility[tier] === null ? " ?" : ""}</span>
            </span>)}
          </span>
          <span className={cn("font-medium", selected.id === facility.id && "text-primary")}>{names[facility.id]}</span>
        </button>;
      })}
    </div>

    <div className="p-4 sm:p-5">
      <h3 className="mb-4 text-sm font-bold">Battle {names[selected.id]}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">All Battle {names[selected.id]} modes, levels, streaks, records and symbol milestones</caption>
          <thead className="text-[10px] text-muted-foreground">
            <tr className="border-b border-border/60">
              <th scope="col" className="pb-3 pr-4 font-medium">Mode</th>
              <th scope="col" className="pb-3 pr-4 font-medium">Level</th>
              <th scope="col" className="pb-3 pr-4 font-medium">Streak</th>
              <th scope="col" className="pb-3 pr-4 text-right font-medium">Best</th>
              {(["silver", "gold"] as const).map(tier => <th key={tier} scope="col" className="pb-3 pl-5 font-medium">
                <span className="flex items-center gap-1.5"><SymbolSprite id={selected.id} tier={tier} size={16} dim={selected[tier] !== true} />{tier === "silver" ? "Silver" : "Gold"}</span>
              </th>)}
            </tr>
          </thead>
          <tbody>
            {selected.records.map((record, index) => <tr key={`${record.mode}-${record.level}`} className={cn("border-border/60", index % 2 === 0 && "border-t")}>
              {index % 2 === 0 && <th scope="rowgroup" rowSpan={2} className="whitespace-nowrap py-3 pr-4 align-top font-medium">{modes[record.mode] ?? record.mode}</th>}
              <td className="whitespace-nowrap py-2.5 pr-4 text-muted-foreground">{record.level === "50" ? "Lv. 50" : "Open"}</td>
              <td className="whitespace-nowrap py-2.5 pr-4"><span className="font-mono text-sm tabular-nums">{record.streak}</span><span className="ml-2 text-[10px] text-muted-foreground">{record.isCurrent ? "current" : "previous"}</span></td>
              <td className="py-2.5 pr-4 text-right font-mono text-sm font-semibold tabular-nums">{record.record}</td>
              {(["silver", "gold"] as const).map(tier => {
                const progress = getFrontierSymbolProgress(selected, record, tier);
                const text = !progress ? "Unknown" : !progress.eligible ? "—" : progress.earned === true ? "Obtained ✓" : progress.earned === null ? "Unknown" : progress.remaining === 0 ? "Target reached" : `${progress.remaining} to go`;
                return <td key={tier} className="whitespace-nowrap py-2.5 pl-5 text-[11px] text-muted-foreground" title={progress?.eligible ? `Target: ${progress.target} consecutive ${record.unit}${progress.requiresSilver ? "; silver required first" : ""}` : "Symbols are awarded in Singles only"}>{text}</td>;
              })}
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Counts in {selected.records[0]?.unit}. Previous series have ended; symbol progress restarts from 0. Symbols are earned in Singles by defeating the Frontier Brain; gold requires silver.</p>
    </div>
  </div>;
}
