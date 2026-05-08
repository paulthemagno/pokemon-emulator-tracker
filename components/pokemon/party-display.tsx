"use client";

import { Pokemon } from "@/lib/pokemon/types";
import { PokemonCard } from "./pokemon-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

interface PartyDisplayProps {
  party: Pokemon[];
  generation?: number;
  className?: string;
}

export function PartyDisplay({ party, generation, className }: PartyDisplayProps) {
  if (party.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Party
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No Pokemon in party
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Party
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {party.length}/6
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {party.map((pokemon, index) => (
            <PokemonCard key={index} pokemon={pokemon} index={index} generation={generation} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
