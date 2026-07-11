"use client";

import { Pokemon } from "@/lib/pokemon/types";
import { PokemonCard } from "./pokemon-card";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface PartyDisplayProps {
  party: Pokemon[];
  generation?: number;
  className?: string;
  overview?: boolean;
}

export function PartyDisplay({ party, generation, className, overview = false }: PartyDisplayProps) {
  if (party.length === 0) {
    return (
      <section className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5 text-primary" />
          Party
        </div>
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground">
          No Pokemon in party
        </p>
      </section>
    );
  }

  return (
    <section className={cn(overview ? "space-y-2" : "space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h2 className={cn("flex items-center gap-2 font-bold text-foreground", overview ? "text-lg" : "text-xl")}>
          <Users className="h-5 w-5 text-primary" />
          Party
        </h2>
        <span className="rounded-full border border-border px-2.5 py-1 text-sm text-muted-foreground">
          {party.length}/6
        </span>
      </div>
      <div
        className={cn(
          "grid",
          overview
            ? "gap-2 md:grid-cols-2 2xl:grid-cols-3"
            : "grid-cols-[repeat(auto-fit,minmax(min(100%,330px),1fr))] gap-4"
        )}
      >
        {party.map((pokemon, index) => (
          <PokemonCard
            key={index}
            pokemon={pokemon}
            index={index}
            generation={generation}
            dense={overview}
          />
        ))}
      </div>
    </section>
  );
}
