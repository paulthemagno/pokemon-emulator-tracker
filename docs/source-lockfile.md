# Pokemon Knowledge Source Lockfile

This file records the sources currently represented in `lib/pokemon/knowledge/`.

## Current Sources

| Key | Kind | Source | Used for | Pin status |
| --- | --- | --- | --- | --- |
| `pokemonOfficial` | official | https://www.pokemon.com/us/pokemon-video-games | Public game identity and user-facing context | URL only |
| `pokeapi` | pokeapi | https://pokeapi.co/docs/v2 | Generated local item/move descriptions and species growth metadata | API endpoint/version only |
| `gen1SaveReference` | secondary | https://github-wiki-see.page/m/sopoforic/cgrr-pokemon/wiki/Pokemon-Generation-1-Save-Files | Gen 1 inventory offsets and HM/TM ID ranges | URL only |
| `dataCrystalRedBlueRamMap` | secondary | https://datacrystal.tcrf.net/wiki/Pok%C3%A9mon_Red_and_Blue/RAM_map | Red/Blue live WRAM current box and SRAM box bank cross-check | URL only |
| `dataCrystalYellowRamMap` | secondary | https://datacrystal.tcrf.net/wiki/Pok%C3%A9mon_Yellow/RAM_map | Yellow live WRAM offset relationship to Red/Blue | URL only |
| `pretPokered` | pret | https://github.com/pret/pokered | Red/Blue Gen 1 inventory offsets and HM/TM ID ranges | `3c814341c81307b3193a9ea890ff3a197b09b4e3` |
| `pretPokeyellow` | pret | https://github.com/pret/pokeyellow | Yellow source pin and symbolic cross-checks | `bfa7170107eea23b89febb60bfb2ce39173bf2e1` |
| `bulbapediaGen1Save` | secondary | https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_(Generation_I) | Gen 1 SRAM/save cross-check | URL only |
| `bulbapediaGen1PokemonData` | secondary | https://bulbapedia.bulbagarden.net/wiki/Pokemon_data_structure_in_Generation_I | Gen 1 party/current-box WRAM structure starts | URL only |
| `gen3SaveReference` | secondary | https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_in_Generation_III | Gen 3 Team/Items section profiles | URL only |
| `pokecrystal` | pret | https://github.com/pret/pokecrystal | Gen 2 inventory offsets and TM/HM item IDs | `8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217` |
| `pretPokegold` | pret | https://github.com/pret/pokegold | Gold/Silver Gen 2 save and live offset profiles | `09d2148d6d26b20840fb4997916321666ca1e953` |

## Pinning Rules

For pret-based generated data, replace `commit pin pending` with an exact commit SHA before marking a dataset as stable. Secondary web references are acceptable for initial scaffolding but should be replaced or cross-checked with pret extraction scripts where practical.

## Knowledge Modules

```text
lib/pokemon/knowledge/provenance.ts
lib/pokemon/knowledge/inventory-layouts.ts
lib/pokemon/knowledge/item-id-ranges.ts
lib/pokemon/knowledge/save-layouts.ts
live-adapters/generated/gen1-live-offsets.lua
live-adapters/generated/gen2-live-offsets.lua
```

These files are generated from:

```text
lib/pokemon/knowledge/sources/provenance.json
lib/pokemon/knowledge/sources/inventory-layouts.json
lib/pokemon/knowledge/sources/item-id-ranges.json
lib/pokemon/knowledge/sources/save-layouts.json
```

Regenerate generated TypeScript knowledge modules and the Gen 1/2 live Lua offsets with:

```bash
corepack pnpm generate:pokemon-knowledge
```

Refresh extracted pret-backed source values with:

```bash
corepack pnpm extract:pokemon-knowledge -- --pokecrystal /path/to/pokecrystal
corepack pnpm generate:pokemon-knowledge
```

For full Gen 1/2 extraction:

```bash
corepack pnpm extract:pokemon-knowledge -- --pokecrystal /path/to/pokecrystal --pokegold /path/to/pokegold --pokered /path/to/pokered --pokeyellow /path/to/pokeyellow
corepack pnpm generate:pokemon-knowledge
```

For Gen 1 extraction:

```bash
corepack pnpm extract:pokemon-knowledge -- --pokered /path/to/pokered --pokeyellow /path/to/pokeyellow
corepack pnpm generate:pokemon-knowledge
```

Parsers should consume the generated modules instead of duplicating offsets/ranges inline.

Gen 1 Town Map coordinates are represented in `lib/pokemon/data/gen1-map-landmarks.ts`. They come from
`pret/pokered` `data/maps/town_map_entries.asm` and `constants/map_constants.asm`, including both
`ExternalMapEntries` and `InternalMapEntries`. This is required because indoor map ids, such as houses and Pokemon
Centers, are grouped by the game and mapped back to their outdoor Town Map landmark. The marker pixel conversion follows
`engine/items/town_map.asm`: `TownMapCoordsToOAMCoords`, `WritePlayerOrBirdSpriteOAM`, and the Game Boy OAM visible
offsets. Do not use the raw OAM value directly as a PNG pixel coordinate.

The generator validates domain boundaries before writing files. Gen 1 live WRAM offsets must stay in
`0xC000..0xDFFF` and cannot reuse save-file offsets. Red/Blue `liveWramOffsets.currentBoxData` is locked to
`0xDA80`, matching Data Crystal's Red/Blue RAM map entry for the active current PC box.

Gen 1 save-file location reads use the saved `Current Map` field for Town Map placement. In the shared US
Red/Blue/Yellow save layout, `0x260A` is `Current Map`; later nearby bytes hold coordinates/block state and map
header data, so they must not be used as the map id.

## Extraction Notes

`scripts/extract-pokemon-knowledge-from-pret.mjs` currently extracts:

- Gen 1 Red/Blue inventory offsets and HM/TM ranges from `pret/pokered`.
- Gen 1 Yellow save/inventory offsets from the shared US Red/Blue/Yellow save layout.
- Gen 1/2 parser save offset profiles from `lib/pokemon/knowledge/sources/save-layouts.json`, with source pins for `pret/pokered`, `pret/pokeyellow`, `pret/pokegold`, and `pret/pokecrystal`.
- Gen 1 Red/Blue and Yellow live offset profiles generated into `live-adapters/generated/gen1-live-offsets.lua`.
- Gen 2 Gold/Silver and Crystal live offset profiles generated into `live-adapters/generated/gen2-live-offsets.lua`.
- Gen 2 TM/HM item IDs from `pret/pokecrystal` `constants/item_constants.asm`.

Important: Yellow's Gen 1 save-file inventory offsets do not differ from Red/Blue for the supported US layout. The
generated knowledge still exports a Yellow-specific inventory layout so parsers can keep game selection explicit, but
its Bag and PC Storage offsets mirror Red/Blue.

Important: Gen 1 non-current PC boxes are SRAM-backed. The live adapter reads the active box from WRAM and prefers
mGBA's linear SRAM memory domain for stored boxes. If that domain exposes only an erased/windowed view, the adapter can
briefly select the matching MBC1 SRAM bank through the `$A000` bus window, read the box, and restore normal mode.

Important: Gen 2 TM quantities are stored as a fixed 57-byte TM/HM quantity table, but the TM item IDs are not a contiguous `0xBF + index` range. `pokecrystal` has item ID gaps at `0xC3` and `0xDC`, so the generated `TMs/HMs` pocket stores the exact `itemIds` sequence. Parsers must use that list for fixed-quantity pockets.
