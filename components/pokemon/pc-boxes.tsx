"use client";

import { useState } from "react";
import { PCBox } from "@/lib/pokemon/types";
import { PokemonCard } from "./pokemon-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Box, Grid3X3 } from "lucide-react";
import Image from "next/image";

interface PCBoxesProps {
  boxes: PCBox[];
  className?: string;
}

function getSpriteUrl(species: number): string {
  if (species <= 0 || species > 386) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${species}.png`;
}

export function PCBoxes({ boxes, className }: PCBoxesProps) {
  const [currentBoxIndex, setCurrentBoxIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const boxesWithPokemon = boxes.map((box) => ({
    ...box,
    pokemon: box.pokemon.filter((pokemon) => pokemon !== null),
  }));

  // Filter to boxes that have Pokemon
  const nonEmptyBoxes = boxesWithPokemon.filter((box) => box.pokemon.length > 0);

  if (nonEmptyBoxes.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Box className="h-5 w-5 text-primary" />
            PC Boxes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No Pokemon stored in PC
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentBox = nonEmptyBoxes[currentBoxIndex];

  const goToPrevBox = () => {
    setCurrentBoxIndex((prev) =>
      prev === 0 ? nonEmptyBoxes.length - 1 : prev - 1
    );
  };

  const goToNextBox = () => {
    setCurrentBoxIndex((prev) =>
      prev === nonEmptyBoxes.length - 1 ? 0 : prev + 1
    );
  };

  // Count total Pokemon in PC
  const totalPokemon = nonEmptyBoxes.reduce(
    (sum, box) => sum + box.pokemon.length,
    0
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Box className="h-5 w-5 text-primary" />
            PC Boxes
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {totalPokemon} Pokemon stored
          </span>
        </div>

        {/* Box Navigation */}
        <div className="flex items-center justify-between mt-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevBox}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2">
            <span className="font-medium">{currentBox.name}</span>
            <span className="text-xs text-muted-foreground">
              ({currentBox.pokemon.length}/{currentBox.capacity})
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextBox}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex justify-end mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            className="text-xs"
          >
            <Grid3X3 className="h-3 w-3 mr-1" />
            {viewMode === "grid" ? "List View" : "Grid View"}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {viewMode === "grid" ? (
          // Grid view - shows sprites in a 6x5 grid like the game
          <div className="grid grid-cols-[repeat(auto-fit,minmax(52px,1fr))] gap-2">
            {Array.from({ length: currentBox.capacity }).map((_, index) => {
              const pokemon = currentBox.pokemon[index];
              return (
                <div
                  key={index}
                  className="aspect-square rounded-lg bg-muted/50 flex items-center justify-center relative group transition-colors hover:bg-muted/80"
                  title={pokemon ? `${pokemon.nickname} Lv.${pokemon.level}` : "Empty"}
                >
                  {pokemon ? (
                    <>
                      <Image
                        src={getSpriteUrl(pokemon.species)}
                        alt={pokemon.speciesName}
                        width={40}
                        height={40}
                        className="pixelated"
                        unoptimized
                      />
                      {/* Hover tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        {pokemon.nickname} Lv.{pokemon.level}
                      </div>
                    </>
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // List view - shows detailed cards
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {currentBox.pokemon.map((pokemon, index) => (
              <PokemonCard key={index} pokemon={pokemon} compact />
            ))}
          </div>
        )}

        {/* Box selector dots */}
        <div className="flex justify-center gap-1 mt-4">
          {nonEmptyBoxes.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBoxIndex(index)}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentBoxIndex
                  ? "bg-primary"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
