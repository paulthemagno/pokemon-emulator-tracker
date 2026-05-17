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

function getDisplayBoxName(box: PCBox, index: number): string {
  const rawName = box.name?.trim();
  if (!rawName) return `Box ${index + 1}`;
  return rawName;
}

function getSpriteUrl(species: number): string {
  if (species <= 0 || species > 386) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${species}.png`;
}

export function PCBoxes({ boxes, className }: PCBoxesProps) {
  const [currentBoxIndex, setCurrentBoxIndex] = useState(-1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const boxesWithPokemon = boxes.map((box) => ({
    ...box,
    pokemon: box.pokemon.filter((pokemon) => pokemon !== null),
  }));

  const availableBoxes = boxesWithPokemon;
  const liveCurrentBoxIndex = availableBoxes.findIndex((box) => box.isCurrent);

  if (availableBoxes.length === 0) {
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

  const selectedIndexCandidate =
    currentBoxIndex >= 0
      ? currentBoxIndex
      : liveCurrentBoxIndex >= 0
      ? liveCurrentBoxIndex
      : 0;
  const selectedBoxIndex = Math.min(
    Math.max(selectedIndexCandidate, 0),
    availableBoxes.length - 1
  );
  const currentBox = availableBoxes[selectedBoxIndex];
  const currentBoxName = getDisplayBoxName(currentBox, selectedBoxIndex);

  const goToPrevBox = () => {
    const baseIndex = selectedBoxIndex;
    setCurrentBoxIndex(
      baseIndex === 0 ? availableBoxes.length - 1 : baseIndex - 1
    );
  };

  const goToNextBox = () => {
    const baseIndex = selectedBoxIndex;
    setCurrentBoxIndex(
      baseIndex === availableBoxes.length - 1 ? 0 : baseIndex + 1
    );
  };

  // Count total Pokemon in PC
  const totalPokemon = availableBoxes.reduce(
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
            className="h-10 w-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            <span className="font-medium">{currentBoxName}</span>
            <span className="text-xs text-muted-foreground">
              ({currentBox.pokemon.length}/{currentBox.capacity})
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextBox}
            className="h-10 w-10"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {availableBoxes.map((box, index) => {
            const isActive = index === selectedBoxIndex;
            const isLiveCurrent = index === liveCurrentBoxIndex;
            return (
              <button
                key={`${box.name}-${index}`}
                onClick={() => setCurrentBoxIndex(index)}
                className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : isLiveCurrent
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
                    : "border-border bg-background/50 text-muted-foreground hover:bg-muted/70"
                }`}
                title={`${getDisplayBoxName(box, index)} (${box.pokemon.length}/${box.capacity})`}
              >
                {getDisplayBoxName(box, index)}
                {isLiveCurrent && (
                  <span className="ml-1 rounded bg-emerald-500/20 px-1 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                    Current
                  </span>
                )}
              </button>
            );
          })}
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
          <div className="grid grid-cols-[repeat(auto-fit,minmax(70px,1fr))] gap-2.5">
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
                        width={56}
                        height={56}
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
        <div className="flex justify-center gap-2 mt-4">
          {availableBoxes.map((box, index) => (
            <button
              key={index}
              onClick={() => setCurrentBoxIndex(index)}
              className={`h-4 w-4 rounded-full transition-colors ${
                index === selectedBoxIndex
                  ? "bg-primary"
                  : box.isCurrent
                  ? "bg-emerald-500"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              } ${box.isCurrent ? "ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-background" : ""}`}
              title={getDisplayBoxName(availableBoxes[index], index)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
