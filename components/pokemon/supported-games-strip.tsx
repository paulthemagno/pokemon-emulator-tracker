"use client";

import Image from "next/image";

const GAME_GROUPS = [
  {
    generation: "Gen 1",
    games: [
      { name: "Red", cover: "/game-covers/red.png" },
      { name: "Blue", cover: "/game-covers/blue.png" },
      { name: "Yellow", cover: "/game-covers/yellow.png" },
    ],
  },
  {
    generation: "Gen 2",
    games: [
      { name: "Gold", cover: "/game-covers/gold.png" },
      { name: "Silver", cover: "/game-covers/silver.png" },
      { name: "Crystal", cover: "/game-covers/crystal.png" },
    ],
  },
  {
    generation: "Gen 3",
    games: [
      { name: "Ruby", cover: "/game-covers/ruby.png" },
      { name: "Sapphire", cover: "/game-covers/sapphire.png" },
      { name: "Emerald", cover: "/game-covers/emerald.jpg" },
      { name: "FireRed", cover: "/game-covers/firered.png" },
      { name: "LeafGreen", cover: "/game-covers/leafgreen.png" },
    ],
  },
];

export function SupportedGamesStrip() {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/55 p-4 shadow-sm backdrop-blur">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Supported games</p>
          <h3 className="text-lg font-bold text-foreground">Gen 1-3 save parsing, with local mGBA live adapters</h3>
        </div>
        <p className="text-sm text-muted-foreground">FireRed and LeafGreen are Generation 3 games.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {GAME_GROUPS.map((group) => (
          <div key={group.generation} className="rounded-xl border border-border/60 bg-background/45 p-3">
            <p className="mb-3 text-sm font-bold text-foreground">{group.generation}</p>
            <div className="flex flex-wrap gap-2">
              {group.games.map((game) => (
                <div key={game.name} className="w-[58px]">
                  <div className="relative mx-auto h-14 w-14 overflow-hidden rounded-lg border border-border/70 bg-muted shadow-sm">
                    <Image
                      alt={`${game.name} cover`}
                      className="h-full w-full object-cover"
                      height={112}
                      src={game.cover}
                      width={112}
                    />
                  </div>
                  <p className="mt-1 truncate text-center text-[10px] font-semibold text-muted-foreground">
                    {game.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
