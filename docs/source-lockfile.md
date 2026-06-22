# Pokemon Knowledge Source Lockfile

This file records the sources currently represented in `lib/pokemon/knowledge/`.

## Current Sources

| Key | Kind | Source | Used for | Pin status |
| --- | --- | --- | --- | --- |
| `pokemonOfficial` | official | https://www.pokemon.com/us/pokemon-video-games | Public game identity and user-facing context | URL only |
| `pokeapi` | pokeapi | https://pokeapi.co/docs/v2 | Generated local item/move descriptions, species growth metadata, and National Dex 1-386 evolution chains | API endpoint/version only |
| `gen1SaveReference` | secondary | https://github-wiki-see.page/m/sopoforic/cgrr-pokemon/wiki/Pokemon-Generation-1-Save-Files | Gen 1 inventory offsets and HM/TM ID ranges | URL only |
| `dataCrystalRedBlueRamMap` | secondary | https://datacrystal.tcrf.net/wiki/Pok%C3%A9mon_Red_and_Blue/RAM_map | Red/Blue live WRAM current box and SRAM box bank cross-check | URL only |
| `dataCrystalYellowRamMap` | secondary | https://datacrystal.tcrf.net/wiki/Pok%C3%A9mon_Yellow/RAM_map | Yellow live WRAM offset relationship to Red/Blue | URL only |
| `pretPokered` | pret | https://github.com/pret/pokered | Red/Blue Gen 1 inventory offsets and HM/TM ID ranges | `3c814341c81307b3193a9ea890ff3a197b09b4e3` |
| `pretPokeyellow` | pret | https://github.com/pret/pokeyellow | Yellow source pin and symbolic cross-checks | `bfa7170107eea23b89febb60bfb2ce39173bf2e1` |
| `bulbapediaGen1Save` | secondary | https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_(Generation_I) | Gen 1 SRAM/save cross-check | URL only |
| `bulbapediaGen1PokemonData` | secondary | https://bulbapedia.bulbagarden.net/wiki/Pokemon_data_structure_in_Generation_I | Gen 1 party/current-box WRAM structure starts | URL only |
| `gen3SaveReference` | secondary | https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_in_Generation_III | Gen 3 save section cross-check | URL only |
| `bulbapediaGen3PokemonData` | secondary | https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_data_structure_(Generation_III) | Gen 3 active party RAM starts and 100-byte party Pokemon structure | URL only |
| `dataCrystalFireRedLeafGreenRamMap` | secondary | https://datacrystal.tcrf.net/wiki/Pok%C3%A9mon_FireRed_and_LeafGreen%3ARAM_map | FireRed/LeafGreen US live RAM party records and runtime SaveBlock pointers | URL only |
| `pretPokeruby` | pret | https://github.com/pret/pokeruby | Ruby/Sapphire SaveBlock1/SaveBlock2 offsets, flags, and PC storage layout | `63a8cbf0016b351a4e68f7036fa0b77e23d2f2c1` |
| `pretPokeemerald` | pret | https://github.com/pret/pokeemerald | Emerald SaveBlock1/SaveBlock2 offsets, flags, item quantity encryption, PC storage layout, Gen 3 character map, and Hoenn Dex/map data | `0d3100185e0b13faabfc589fc402dd46f83c1d6a` |
| `pretPokefirered` | pret | https://github.com/pret/pokefirered | FireRed/LeafGreen SaveBlock1/SaveBlock2 offsets, live ASLR move range and runtime pointer model, flags, item quantity encryption, PC storage layout, Kanto Dex order/count, map group count, and Kanto/Sevii region-map data | `e060ab955b5dc9ac1c4904c2cd141683615cf477` |
| `pokecrystal` | pret | https://github.com/pret/pokecrystal | Gen 2 inventory offsets and TM/HM item IDs | `8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217` |
| `pretPokegold` | pret | https://github.com/pret/pokegold | Gold/Silver Gen 2 save and live offset profiles | `09d2148d6d26b20840fb4997916321666ca1e953` |
| `hoennMapImage` | media | https://github.com/pret/pokeemerald/tree/master/graphics/pokenav/region_map | Gen 3 Hoenn overview map asset for save uploads, rendered from `map.png` tileset plus `map.bin` tilemap | `0d3100185e0b13faabfc589fc402dd46f83c1d6a` |
| `hoennBadgeSprites` | media | https://github.com/pret/pokeemerald/blob/master/graphics/trainer_card/badges.png | Gen 3 trainer card badge sprites split into local 16x16 files | `0d3100185e0b13faabfc589fc402dd46f83c1d6a` |
| `pokemonHomeTypeIcons` | media | https://archives.bulbagarden.net/wiki/Category:Type_icons | Local type icons in `public/type-icons/`, using the Pokémon HOME type icon sprite files archived as game sprites | URL only |
| `pokemonGameCovers` | media | https://archives.bulbagarden.net/wiki/Category:Game_covers | Local game cover images in `public/game-covers/` for the current-game UI tile | URL only |

## Pinning Rules

For pret-based generated data, replace `commit pin pending` with an exact commit SHA before marking a dataset as stable. Secondary web references are acceptable for initial scaffolding but should be replaced or cross-checked with pret extraction scripts where practical.

## Knowledge Modules

```text
lib/pokemon/knowledge/provenance.ts
lib/pokemon/knowledge/inventory-layouts.ts
lib/pokemon/knowledge/item-id-ranges.ts
lib/pokemon/knowledge/species-id-maps.ts
lib/pokemon/knowledge/save-layouts.ts
lib/pokemon/knowledge/event-flags.ts
lib/pokemon/data/gen3-hoenn-dex.ts
lib/pokemon/data/gen3-map-landmarks.ts
lib/pokemon/data/pokemon-evolutions.ts
live-adapters/generated/gen1-live-offsets.lua
live-adapters/generated/gen2-live-offsets.lua
live-adapters/generated/gen3-live-offsets.lua
```

These files are generated from:

```text
lib/pokemon/knowledge/sources/provenance.json
lib/pokemon/knowledge/sources/inventory-layouts.json
lib/pokemon/knowledge/sources/item-id-ranges.json
lib/pokemon/knowledge/sources/species-id-maps.json
lib/pokemon/knowledge/sources/save-layouts.json
lib/pokemon/knowledge/sources/event-flags.json
lib/pokemon/knowledge/sources/event-contexts.json
lib/pokemon/knowledge/sources/event-guides.json
lib/pokemon/knowledge/sources/game-guide-sources.json
lib/pokemon/knowledge/sources/progress-fact-candidates.json
```

Regenerate generated TypeScript knowledge modules and the Gen 1/2/3 live Lua offsets with:

```bash
corepack pnpm generate:pokemon-knowledge
```

Regenerate the compact local PokeAPI evolution snapshot with:

```bash
corepack pnpm generate:pokemon-evolutions
```

`pokemon-evolutions.ts` contains only evolution edges and trigger conditions for National Dex
1-386. Runtime chatbot requests query this local file and do not call PokeAPI.

Regenerate the local Bulbapedia walkthrough section index with:

```bash
corepack pnpm generate:pokemon-guides
```

This script reads reviewed walkthrough roots from `game-guide-sources.json`, calls the
Bulbapedia MediaWiki API during generation, and writes compact local sections to
`lib/pokemon/knowledge/walkthrough-index.json`.

Regenerate static walkthrough embeddings with:

```bash
OLLAMA_EMBEDDING_MODEL=embeddinggemma:latest corepack pnpm generate:pokemon-guide-embeddings
```

`walkthrough-embeddings.manifest.json` and `walkthrough-embeddings.f32` must be regenerated
whenever `OLLAMA_EMBEDDING_MODEL` changes or the walkthrough index changes. Runtime guide
retrieval only embeds the user query and compares it against these local vectors.

Refresh extracted pret-backed source values with:

```bash
corepack pnpm extract:pokemon-knowledge -- --pokecrystal /path/to/pokecrystal
corepack pnpm extract:pokemon-events -- --from-github
corepack pnpm extract:pokemon-event-contexts -- --from-github
corepack pnpm generate:pokemon-event-guides
corepack pnpm generate:progress-fact-prototype
corepack pnpm generate:pokemon-knowledge
```

For full Gen 1/2 extraction:

```bash
corepack pnpm extract:pokemon-knowledge -- --pokecrystal /path/to/pokecrystal --pokegold /path/to/pokegold --pokered /path/to/pokered --pokeyellow /path/to/pokeyellow
corepack pnpm extract:pokemon-event-contexts -- --from-github
corepack pnpm generate:pokemon-event-guides
corepack pnpm generate:pokemon-knowledge
```

For Gen 1 extraction:

```bash
corepack pnpm extract:pokemon-knowledge -- --pokered /path/to/pokered --pokeyellow /path/to/pokeyellow
corepack pnpm generate:pokemon-knowledge
```

Parsers should consume the generated modules instead of duplicating offsets/ranges inline.
Generic event descriptions, likely locations, state meanings, source links, and recognizable action shapes are generated from `event-contexts.json` plus `game-guide-sources.json`. Keep fully audited event-specific sequences, prerequisites, alternative branches, and gameplay claims in `lib/pokemon/data/event-guidance.ts` with pinned PRET script URLs. Do not mark an event as currently available unless its prerequisite graph has been audited from source scripts and external guide sources.
`event-contexts.json` records source-code usages for generated event flags: file path, line number, operation kind, and nearby source lines. Treat it as evidence for generated descriptions, not as player-facing text by itself.
For Gen 2, the extractor also reads PRET's `InitializeEventsScript` from `engine/events/std_scripts.asm`. For Ruby/Sapphire and Emerald it reads `data/scripts/new_game.inc`. Flags set by these new-save scripts are tagged as initial game state: their raw bit remains visible, but it is not counted as player completion or as a key milestone.
Visibility flags (`FLAG_HIDE_*`, `EVENT_HIDE_*`, and Gen 3 decoration object flags) and `FLAG_SYS_*` values are exposed as technical state rather than completed progress. Their set/clear value remains available to the UI without contributing to completion totals.
Gen 1 event storage starts at `0x29F3` in both Red/Blue and Yellow save files. Live WRAM starts at `0xD747` in Red/Blue and `0xD746` in Yellow, consistent with Yellow's player-data symbols being one byte earlier. Reading Yellow at `0xD753` or `0xD747` shifts the bit-to-event mapping and can create false flags.
`game-guide-sources.json` is the reviewed online knowledge-base catalog for every supported game profile. It contains multiple complete walkthroughs, progression checklists, and game references.
`event-guides.json` is generated from `event-contexts.json` plus that online source catalog. It provides a readable description, likely source location, set/not-set meaning, suggested steps when the event shape supports them, and links to both PRET code and multiple guides. Only `lib/pokemon/data/event-guidance.ts` should contain fully audited event-specific sequence claims.

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

Gen 3 live party reads must use active `gPlayerParty` RAM, not only the serialized `SaveBlock1.playerParty`
copy. pret sources show menu/heal/battle code mutating `gPlayerParty`; the live address manifests are cross-checked
against Bulbapedia's Gen 3 Pokemon data structure and the Data Crystal FRLG RAM map.

## Extraction Notes

`scripts/extract-pokemon-knowledge-from-pret.mjs` currently extracts:

- Gen 1 Red/Blue inventory offsets and HM/TM ranges from `pret/pokered`.
- Gen 1 Yellow save/inventory offsets from the shared US Red/Blue/Yellow save layout.
- Gen 1/2/3 parser save offset profiles from `lib/pokemon/knowledge/sources/save-layouts.json`, with source pins for `pret/pokered`, `pret/pokeyellow`, `pret/pokegold`, `pret/pokecrystal`, `pret/pokeruby`, `pret/pokeemerald`, and `pret/pokefirered`.
- Gen 1 Red/Blue and Yellow live offset profiles generated into `live-adapters/generated/gen1-live-offsets.lua`.
- Gen 2 Gold/Silver and Crystal live offset profiles generated into `live-adapters/generated/gen2-live-offsets.lua`.
- Gen 3 Ruby/Sapphire/Emerald live profile data generated into `live-adapters/generated/gen3-live-offsets.lua`, including SaveBlock offsets, inventory pocket offsets, PC storage geometry, and internal species ID mapping.
- Gen 1/2/3 event flag definitions generated from `constants/event_constants.asm`, `constants/event_flags.asm`, and Gen 3 `include/constants/flags.h`; save parsers and live adapters read those source-backed bit arrays into the dashboard Events tab.
- Reviewed non-boolean progress offsets are stored in `save-layouts.json`: Gen 1 `wPlayerStarter`, Gen 2 `wElmsLabSceneID` and `wRadioTower5FSceneID`, and Gen 3 `SaveBlock1.vars`. Runtime decoding in `lib/pokemon/progress-facts.ts` uses source-script guards so initialized zero values are not presented as completed choices.
- Event flag source contexts from the pinned pret repositories, generated by `scripts/extract-pokemon-event-contexts.mjs`, for later source-backed event description generation.
- Gen 2 TM/HM item IDs from `pret/pokecrystal` `constants/item_constants.asm`.
- Gen 3 SaveBlock1/SaveBlock2 offsets from `pret` `include/global.h`, badge flag constants from `include/constants/flags.h`, Pokédex flag arrays from `struct Pokedex` plus SaveBlock1 seen mirrors, and PC storage geometry from `include/pokemon_storage_system.h` or the Ruby/Sapphire storage source.
- Gen 3 live play-time fields use `pret/pokeruby` `src/play_time.c`: `playTimeVBlanks` advances first, and `playTimeSeconds` increments after 60 VBlanks.
- Gen 3 internal species IDs from `pret/pokeemerald` `include/constants/species.h`, mapped to the local National Dex species table.
- Gen 3 Hoenn Pokédex order from `pret/pokeemerald` `src/pokemon.c` `sHoennToNationalOrder`. The first 202 entries are the in-game Hoenn Dex; later entries are explicitly marked unseen in Hoenn mode.
- Gen 3 Western text character codes from `pret/pokeemerald` `charmap.txt`, shared by the save parser and mGBA live adapter for trainer names, Pokemon nicknames, OT names, and PC box names.

Important: Gen 3 save sections are chunks, not complete independent structs. Parser offsets from `SaveBlock1` are applied
after assembling section IDs 1 through 4 into one contiguous SaveBlock1 buffer. PC boxes are assembled separately from
section IDs 5 through 13. The parser validates the official section signature/checksum and then chooses one coherent save
slot before assembling those buffers; it must not mix section IDs from different save slots. The footer starts at
`0xFF4`, but game save chunks are `0xF80` bytes (`SECTOR_DATA_SIZE = 3968`) and must be concatenated at that stride.
The effective first boxed Pokémon offset is `0x0004`, derived from `boxNames 0x8344 - (14 boxes * 30 slots * 80 bytes)`,
because `currentBox` is followed by alignment before the boxed Pokémon array.

Important: Gen 3 Pokemon structures store internal species IDs. IDs `277..411`, for example, are not National Dex
numbers. The parser must translate them through `lib/pokemon/knowledge/species-id-maps.ts` before rendering names,
growth curves, gender, or sprites.

Important: Gen 3 live mode cannot use one fixed address strategy for all games. Ruby/Sapphire expose fixed
SaveBlock1 and SaveBlock2 addresses in `pret/pokeruby` `include/global.h`, while Emerald moves SaveBlock1,
SaveBlock2, and PokemonStorage at runtime via `SetSaveBlocksPointers` in `pret/pokeemerald` `src/load_save.c`.
`live-adapters/mgba-gen3-live.lua` therefore resolves the runtime base addresses first, then applies the generated
source-backed struct offsets from `gen3-live-offsets.lua`. Emerald and FireRed/LeafGreen read `gSaveBlock1Ptr`,
`gSaveBlock2Ptr`, and `gPokemonStoragePtr` from the live runtime pointer table on every snapshot before falling back
to scans; do not cache the pointed ASLR SaveBlock addresses because `MoveSaveBlocks_ResetHeap` can move them at
runtime. FireRed/LeafGreen also validates SaveBlock1 against the 43 map groups generated from `data/maps/map_groups.json`,
so Sevii indoor groups are not rejected as invalid memory. The live PokemonStorage scan is
anchored to the official `struct PokemonStorage` layout (`currentBox`, `boxes`, `boxNames`, and wallpaper bytes), not
to guessed boxed-Pokemon content. Ruby/Sapphire use a prioritized storage candidate plus structural validation.
Storage candidates must also contain at least one valid boxed Pokémon record before they are accepted; otherwise
zero-filled or unrelated EWRAM can look plausible enough to produce false empty boxes. Ruby/Sapphire candidate
addresses are derived from observed mGBA runtime storage positions and corrected by the official boxed-Pokemon record
stride (`sizeof(BoxPokemon) = 0x50`; one box is `30 * 0x50 = 0x960`) from `struct PokemonStorage`; the adapter does
not run a full EWRAM PC-storage scan during normal live snapshots. FireRed/LeafGreen use `pret/pokefirered`
`src/load_save.c` for `SAVEBLOCK_MOVE_RANGE = 128` and the moving pointer model, `include/global.h` for SaveBlock
offsets, and `include/pokemon_storage_system.h` for the same `struct PokemonStorage` geometry.

Important: Gen 3 `BoxPokemon` records are encrypted and include both a `hasSpecies` bit and a checksum over the secure
substructures. PC parsing must validate both before rendering a stored Pokémon; otherwise empty or stale PC slots can
decode into plausible-looking garbage. The parser keeps null entries for rejected/empty PC slots so the UI can render
the original 30-slot grid and expose diagnostics instead of compacting valid records into misleading positions.

Important: Gen 3 Pokédex mode is not inferred from the filename or from raw counts. Ruby/Sapphire/Emerald use
`struct Pokedex` `nationalMagic` at `0x001A`, while FireRed/LeafGreen use `0x001B`; all profiles use `mode` at
`0x0019`. The parser treats the save as National Dex only when the profile-specific magic byte and National mode match
the values used by the game. Otherwise, RSE saves are rendered against the 202-entry Hoenn Dex order extracted from
`sHoennToNationalOrder`, while FireRed/LeafGreen saves are rendered against the 151-entry Kanto Dex order backed by
`pret/pokefirered` `KANTO_DEX_COUNT` and `GetKantoPokedexCount`.
Seen entries are cross-checked against the SaveBlock1 mirror arrays when present. Caught entries come from
`SaveBlock2.pokedex.owned` directly, matching the separate owned bitfield in `struct Pokedex`.

Important: FireRed/LeafGreen key item names after the shared TM/HM range use `pret/pokefirered`
`include/constants/items.h` IDs 349-374. Emerald adds `ITEM_MAGMA_EMBLEM` 375 and `ITEM_OLD_SEA_MAP` 376 from
`pret/pokeemerald`. Keep those IDs named locally so bag and PC item storage do not show source-backed key items as
`Unknown`.

Important: Unown form rendering is form-based, not species-based. Gen 2 form calculation follows the documented DV
method using the middle two bits of Attack, Defense, Speed, and Special DVs. Gen 3 follows the personality-value method
using the least significant two bits of each personality byte. PokeAPI exposes the matching front sprites at form paths
such as `sprites/pokemon/201-b.png`, while the default `201.png` is only form A.

Important: `public/maps/hoenn-map-emerald.svg` is the 240x160 PokéNav full-view Hoenn map rendered from
`pret/pokeemerald` `graphics/pokenav/region_map/map.png` (tileset) and `graphics/pokenav/region_map/map.bin`
(64x64 tilemap, cropped to the visible 30x20 tile viewport). Do not use `map.png` by itself as a final map image:
it is source tile graphics, not the composed region map. The UI must not reuse the Gen 1 Kanto or Gen 2 Pokégear
maps for Ruby/Sapphire/Emerald. Gen 3 marker coordinates are derived from `pret/pokeemerald`
`src/data/region_map/region_map_sections.json` and `data/maps/map_groups.json`, then converted with the full-view
Region Map constants from `src/region_map.c` (`MAPCURSOR_X_MIN = 1`, `MAPCURSOR_Y_MIN = 2`). Multi-cell routes and
cities additionally use `SaveBlock1.pos.x` / `pos.y` and `data/layouts/layouts.json` dimensions to mirror
`InitMapBasedOnPlayerLocation` in `src/region_map.c`. Gen 3 badge sprites
come from `pret/pokeemerald` `graphics/trainer_card/badges.png` and are exposed as local 16x16 SVG crops; do not
reuse the Gen 2 badge list for Hoenn games.

Important: `public/maps/kanto-map-frlg.svg`, `public/maps/frlg-islands-1-3-map.svg`,
`public/maps/frlg-islands-4-5-map.svg`, and `public/maps/frlg-islands-6-7-map.svg` are 240x160 FireRed/LeafGreen region maps
generated with `scripts/generate-gen3-frlg-region-map.mjs` from `pret/pokefirered`
`graphics/region_map/region_map.png` plus `kanto.bin`, `sevii_123.bin`, `sevii_45.bin`, and `sevii_67.bin`. The SVGs
embed the source tileset as a data URI and apply the GBA tilemap flags locally, so they do not depend on loading
`public/maps/kanto-map-frlg-tiles.png` from inside an `<img>` render. The empty GBA background tile entry `0x2000` and
white side-mask tile entry `0x200E` are left transparent so the web UI frame supplies the background instead of showing
the game's unused-map/frame bands. The marker lookup in
`lib/pokemon/data/gen3-frlg-map-landmarks.ts` is generated with `scripts/generate-gen3-frlg-map-landmarks.mjs` from
`src/data/region_map/region_map_sections.json`, all `src/data/region_map/region_map_layout_*.h` files,
`data/maps/map_groups.json`, and `data/maps/*/map.json`. FireRed/LeafGreen marker coordinates use the Region Map
formula from `src/region_map.c`: `pixel = 8 * cursor + 36`, and each landmark carries a source-backed `mapView` so the
UI can switch between Kanto and the three Sevii views.

Important: Yellow's Gen 1 save-file inventory offsets do not differ from Red/Blue for the supported US layout. The
generated knowledge still exports a Yellow-specific inventory layout so parsers can keep game selection explicit, but
its Bag and PC Storage offsets mirror Red/Blue.

Important: Gen 1 non-current PC boxes are SRAM-backed. The live adapter reads the active box from WRAM and reads stored
boxes only through mGBA's read-only SRAM memory domain. It must not write MBC1 bank-control addresses during polling,
because changing cartridge banking can corrupt live rendering or runtime state. If the SRAM domain is unavailable or
windowed, live mode exposes the active WRAM box and can merge the remaining boxes from an uploaded save.

Important: Gen 2 TM quantities are stored as a fixed 57-byte TM/HM quantity table, but the TM item IDs are not a contiguous `0xBF + index` range. `pokecrystal` has item ID gaps at `0xC3` and `0xDC`, so the generated `TMs/HMs` pocket stores the exact `itemIds` sequence. Parsers must use that list for fixed-quantity pockets.
