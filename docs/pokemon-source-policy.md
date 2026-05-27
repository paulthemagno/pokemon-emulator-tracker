# Pokemon Data Source Policy

This project should keep gameplay data local at runtime, but every local dataset needs a clear source trail.

## Source Tiers

Use the strongest source available for each data type.

| Tier | Use for | Sources | Notes |
| --- | --- | --- | --- |
| Official public source | Public game identity, regions, feature descriptions, supported platforms, user-facing copy | Pokemon.com, Nintendo support, official manuals/guides when legally accessible | Official pages rarely include save offsets, internal IDs, or RAM maps. |
| Reproducible technical source | Internal IDs, ROM data, maps, save offsets, RAM symbols, learnsets, encounters | `pret/pokered`, `pret/pokeyellow`, `pret/pokecrystal`, `pret/pokeruby`, `pret/pokeemerald`, `pret/pokefirered` | These are reverse-engineered, not official, but they are auditable and script-friendly. Pin commits when extracting. |
| Structured API source | Descriptions, localized names, convenient cross-game metadata | PokeAPI | PokeAPI is not official. Treat it as a generated data source and keep runtime calls out of gameplay UI. |
| Secondary reference | Cross-checking unclear structures, save layouts, emulator-facing RAM maps, or edge cases | Bulbapedia, Data Crystal, community docs, emulator docs | Prefer pret extraction when it directly matches the runtime layout. Use secondary references when they document the emulator/save-facing structure more directly, and record why in `docs/source-lockfile.md`. |

## Required Provenance

Generated Pokemon data should carry or be accompanied by:

- `sourceKind`: `official`, `pret`, `pokeapi`, `secondary`, or `local-fallback`.
- `sourceName`: human-readable source name.
- `sourceUrl`: canonical source URL.
- `sourceCommit`: required for pret extractions.
- `game`: exact game/profile the row applies to.
- `extractedAt`: ISO date for generated artifacts.
- `generator`: script path that produced the artifact.

For TypeScript files that cannot carry provenance per row yet, add a file-level generated header and track gaps in `docs/game-support-matrix.md`.

Current source records and pin status are tracked in `docs/source-lockfile.md`.

## Runtime Rule

The app should not call remote Pokemon knowledge APIs during normal gameplay rendering. Remote APIs are allowed only for explicit regeneration scripts or developer audits.

Current generated local dumps:

- `lib/pokemon/data/item-descriptions.ts`: generated from PokeAPI plus local fallbacks.
- `lib/pokemon/data/move-descriptions.ts`: generated from PokeAPI plus local fallbacks.
- `lib/pokemon/data/gen1-map-landmarks.ts`: generated/derived from Gen 1 town-map entries and map constants.
- `lib/pokemon/data/gen2-map-landmarks.ts`: generated from `pret/pokecrystal`.
- `public/maps/kanto-town-map-rby.png`: generated from Gen 1 map graphics.
- `public/maps/*town-map-gsc.png`: generated from `pret/pokecrystal`.
- `lib/pokemon/knowledge/event-flags.ts`: generated from pinned `pret` event flag definitions for Gen 1/2/3.

## When Adding A Game

1. Add a game row to `docs/game-support-matrix.md`.
2. Pick the technical source repo and pin a commit.
3. Generate local data into a stable dataset or document why manual extraction is temporary.
4. Add parser fixtures and tests before marking a feature as supported.
5. Update LLM tool coverage if users can ask about the new data.
