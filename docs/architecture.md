# Architecture Notes

## Data flow

```text
Save upload
  -> app/api/parse
  -> lib/pokemon/parsers/*
  -> SaveData
  -> UI

mGBA + Pokemon Red/Blue/Yellow
  -> live-adapters/mgba-gen1-live.lua
  -> http://127.0.0.1:8080/snapshot
  -> app/api/live
  -> lib/pokemon/live-normalizer.ts
  -> SaveData
  -> UI

mGBA + Pokemon Gold/Silver/Crystal
  -> live-adapters/mgba-gen2-live.lua
  -> http://127.0.0.1:8080/snapshot
  -> app/api/live
  -> lib/pokemon/live-normalizer.ts
  -> SaveData
  -> UI
```

The UI should consume normalized `SaveData` and avoid caring whether the source is a save file or live memory.

## Data provenance

Pokemon gameplay data should be local at runtime and should have a documented source trail. The source policy lives in:

```text
docs/pokemon-source-policy.md
```

The support status for each Gen 1-3 game lives in:

```text
docs/game-support-matrix.md
```

The local Pokemon knowledge modules live in:

```text
lib/pokemon/knowledge/
```

Gen 1, Gen 2, and Gen 3 save parser offsets live in the generated module:

```text
lib/pokemon/knowledge/save-layouts.ts
```

Gen 3 Pokemon structures use internal species IDs, so the parser also consumes:

```text
lib/pokemon/knowledge/species-id-maps.ts
```

Ruby/Sapphire/Emerald regional Pokédex rendering uses:

```text
lib/pokemon/data/gen3-hoenn-dex.ts
```

That file is extracted from `pret/pokeemerald` `src/pokemon.c` `sHoennToNationalOrder`, not from manually sorted local
species data.

FireRed/LeafGreen regional Pokédex rendering uses:

```text
lib/pokemon/data/gen3-kanto-dex.ts
```

That file follows `pret/pokefirered` `KANTO_DEX_COUNT` and `GetKantoPokedexCount`, where Kanto entries are National
Dex numbers `1..151`.

Gen 3 Pokédex and PC storage offsets are also kept in `save-layouts.ts`. The PC storage buffer is reconstructed from
section IDs 5 through 13 at the game chunk stride of `0xF80` bytes per section before reading the aligned boxed Pokémon
array. The footer still lives at `0xFF4`; do not use the footer offset as the concatenation stride.

Gen 3 party and PC Pokémon records are accepted only when the `BoxPokemon` `hasSpecies` flag is set and the encrypted
substructure checksum matches. This prevents stale or empty PC slots from being rendered as stray stored Pokémon. The
PC UI preserves all 30 slot positions per box and shows parser diagnostics for Gen 3 boxes, including rejected checksum
records and the save section IDs crossed by that box.

The source manifest is:

```text
lib/pokemon/knowledge/sources/save-layouts.json
lib/pokemon/knowledge/sources/event-flags.json
```

The Gen 1, Gen 2, and Hoenn Gen 3 mGBA live adapters consume generated Lua projections of the same source data:

```text
live-adapters/generated/gen1-live-offsets.lua
live-adapters/generated/gen2-live-offsets.lua
live-adapters/generated/gen3-live-offsets.lua
```

Their current source pins and source URLs are listed in:

```text
docs/source-lockfile.md
```

Regenerate the knowledge modules and generated live adapter offsets from the source manifests with:

```bash
corepack pnpm generate:pokemon-knowledge
```

If local pret checkouts are available, refresh extracted Gen 1/2 source values first:

```bash
corepack pnpm extract:pokemon-knowledge -- --pokecrystal /path/to/pokecrystal --pokegold /path/to/pokegold --pokered /path/to/pokered --pokeyellow /path/to/pokeyellow
corepack pnpm extract:pokemon-events -- --from-github
corepack pnpm extract:pokemon-event-contexts -- --from-github
corepack pnpm generate:pokemon-event-guides
```

Event flag progress is intentionally split into key events and all save flags. Key events are the story/access subset; all save flags includes technical engine state. Every UI flag gets a readable caption and step list when source evidence supports one. Source-code occurrences are collected in `lib/pokemon/knowledge/sources/event-contexts.json` by `scripts/extract-pokemon-event-contexts.mjs`; `scripts/generate-pokemon-event-guides.mjs` reduces that heavy context plus profile-level online walkthrough sources into compact `event-guides.json`, which the knowledge generator emits as `lib/pokemon/knowledge/event-guides.ts`. Verified-guide descriptions, sequence hints, prerequisite notes, and alternative branches are still hand-curated in `lib/pokemon/data/event-guidance.ts` and must cite the pinned script that sets or checks the flag. The UI does not show "ready now" until a real prerequisite graph is audited from source and guide evidence. Use `agents/pokemon-event-research-agent/SKILL.md` for event-specific audits.

Run the lightweight audit with:

```bash
corepack pnpm audit:pokemon-data
```

## Important files

- `app/page.tsx`: main upload/live orchestration.
- `app/api/parse/route.ts`: save parser API.
- `app/api/live/route.ts`: live proxy API.
- `hooks/use-live-data.ts`: polling state.
- `components/pokemon/dashboard.tsx`: dashboard layout.
- `components/pokemon/trainer-card.tsx`: trainer, badges, Pokégear map.
- `components/pokemon/pokemon-card.tsx`: party Pokemon card.
- `lib/pokemon/live-normalizer.ts`: converts live JSON to app data model.
- `live-adapters/mgba-gen1-live.lua`: mGBA Gen 1 RAM reader.
- `live-adapters/mgba-gen2-live.lua`: mGBA Gen 2 RAM reader.

## Live Adapter Contract

The app expects `/snapshot` to return JSON with some or all of:

```json
{
  "generation": 2,
  "game": "crystal",
  "player": {},
  "party": [],
  "pcBoxes": [
    {
      "name": "Box 1",
      "isCurrent": true,
      "pokemon": [],
      "capacity": 20
    }
  ],
  "bag": {},
  "location": {
    "mapGroup": 11,
    "mapId": 2,
    "x": 0,
    "y": 0,
    "name": "Map 11-2"
  }
}
```

`live-normalizer.ts` fills gaps using local datasets.

For live inventory, the Gen 2 mGBA adapter selects the WRAM profile first, then reads that version's bag pockets. Crystal uses:

```text
wTMsHMs      D859
wNumItems    D892
wItems       D893
wNumKeyItems D8BC
wKeyItems    D8BD
wNumBalls    D8D7
wBalls       D8D8
```

The adapter sends raw item IDs and quantities. `live-normalizer.ts` maps those IDs through the Gen 2 item table before the UI renders names and icons.

For Gen 2 live PC data, the mGBA adapter reads the official box offsets from SRAM and then falls back to scanning for valid Gen 2 box records. The offsets match `pret/pokecrystal`'s SRAM layout and Bulbapedia's Gen 2 save structure:

```text
Current box: 0x2D10
Box 1-7:     0x4000, 0x4450, 0x48A0, 0x4CF0, 0x5140, 0x5590, 0x59E0
Box 8-14:    0x6000, 0x6450, 0x68A0, 0x6CF0, 0x7140, 0x7590, 0x79E0
```

`live-normalizer.ts` normalizes those records with the same species, move, item, type, and status lookups used for the live party.

The raw `/snapshot` status includes PC diagnostics:

```text
sram         whether mGBA exposes SRAM
profile      selected WRAM layout profile (`crystal` or `gold_silver`)
game         detected game version (`gold`, `silver`, or `crystal`)
pcBoxes      number of non-empty box records found
pcBoxPokemon total boxed Pokemon found
```

## EXP bars

EXP itself is read from RAM/save data. The UI must not mock or hardcode per-Pokemon EXP corrections.

Pokemon growth rates are stored centrally in:

```text
lib/pokemon/data/species.ts
```

The EXP math lives in:

```text
lib/pokemon/experience.ts
```

The UI computes "EXP to next level" from total EXP plus the species' official growth curve. This is the same stable data the game uses for the menu value; do not read transient menu text or rely on growth-curve guessing except as a fallback for unknown species.

## Held items

Held item IDs are read from save/RAM and normalized with the generation-specific item table before reaching the UI. Gen 1 has bag items but no held items; Gen 2 and Gen 3 can show held items on Pokemon cards.

`getGen1ItemName`, `getGen2ItemName`, and `getGen3ItemName` are the source of truth for decoded item names. `getItemSpriteUrls` then converts that name into ordered sprite candidates:

```text
PokéSprite category path -> PokeAPI item slug -> neutral fallback icon
```

This is used by both the held-item row and the inventory grid. If a legacy Gen 1/2/3 item does not have a matching modern sprite, the UI falls through cleanly and still shows the real decoded item name.

Item descriptions are shown through `components/pokemon/item-info-tooltip.tsx`. The tooltip reads from `lib/pokemon/data/item-descriptions.ts`, a generated local dump of PokeAPI item flavor/effect data for every Gen 1-3 item slug the app can produce. It prefers generation-appropriate in-game flavor text when available:

```text
Gen 1 -> red-blue, yellow
Gen 2 -> gold-silver, crystal
Gen 3 -> ruby-sapphire, emerald, firered-leafgreen
```

Regenerate the dump with:

```bash
node scripts/generate-item-descriptions.mjs
```

Runtime gameplay should not call PokeAPI for item tooltips.

Gen 1 and Gen 2 both expose PC item storage as a separate inventory section named `PC Storage`. This is not a bag pocket; it mirrors the in-game item storage available from the PC.

In Gen 2 live mode, the mGBA adapter reads PC item storage from SRAM and exposes it in the live `bag.pcStorage` payload. The normalizer maps that to the same `PC Storage` inventory section used by uploaded save files.

Gen 1 Red/Blue and Yellow use separate generated inventory layout exports, but the supported US save layout uses the same PC item storage offset, `0x27E6`, for all three games. Keep the Yellow export so parser selection stays explicit, but do not shift Yellow save inventory offsets unless a separate localized profile is added.

Gen 1 and Gen 2 save parser offsets are centralized in `GEN1_SAVE_LAYOUTS` and `GEN2_SAVE_LAYOUTS`. Parsers should import those generated layouts instead of adding local hardcoded save offsets.

Gen 1 HM/TM item IDs use the late item ID range:

```text
HM01-HM05: 0xC4-0xC8
TM01-TM50: 0xC9-0xFA
```

The local item-name lookup maps these dynamically, so IDs like `216` (`0xD8`) and `222` (`0xDE`) display as `TM16 Pay Day` and `TM22 Solar Beam`.

Gen 2 TM/HM quantities use a fixed 57-byte table, but the item IDs are not fully contiguous. The generated knowledge layout stores the exact `itemIds` sequence extracted from `pret/pokecrystal` so gaps such as `0xC3` and `0xDC` do not shift decoded TMs.

## Gen 1 save support

Gen 1 upload parsing passes filename context into the parser so Red, Blue, and Yellow can be identified when the save filename contains the game name. The save format itself does not currently provide a trusted in-repo version discriminator, so unknown Gen 1 filenames still default to Red.

The Gen 1 parser reads Pokédex owned/seen bitfields from the save offsets documented by community save research and cross-checked against the Red/Blue memory naming used by `pret/pokered`:

```text
owned: 0x25A3
seen:  0x25B6
```

Gen 1 PC boxes use the current box cache at `0x30C0` for the active box and banked SRAM records for boxes 1-12:

```text
box 1-6:  0x4000, 0x4462, 0x48C4, 0x4D26, 0x5188, 0x55EA
box 7-12: 0x6000, 0x6462, 0x68C4, 0x6D26, 0x7188, 0x75EA
```

Each box uses the Gen 1 full box structure: count, species list, 20 compact 33-byte Pokemon records, OT names, and nicknames.

Gen 1 save-file location reads use the shared US save `Current Map` field:

```text
current map: 0x260A
```

That field is distinct from nearby coordinate/block/header bytes. Use `lib/pokemon/data/gen1-map-landmarks.ts` to convert route, city, and indoor map IDs to the Kanto town-map marker.

## Gen 3 save profiles

Gen 3 saves rotate 14 sections inside two save slots. The parser validates the official section signature and checksum,
then chooses one coherent slot before applying a game profile for Team/Items data. Complete slots are ordered by the
save index in the physical last section, matching the documented game-save selection rule; only incomplete/corrupt
fallbacks use the best available section count/index. This matters for PC storage and Pokédex progress because boxes are
spread across section IDs 5 through 13, while Pokédex state is mirrored across SaveBlock2 and SaveBlock1. Mixing sections
or choosing a stale backup can make the data look mostly right while a few entries are missing.

Profiles currently separate:

```text
Ruby/Sapphire: party 0x0234/0x0238, money 0x0490, bag pockets 0x0560/0x05B0/0x0600/0x0640/0x0740
Emerald:       party 0x0234/0x0238, money 0x0490, bag pockets 0x0560/0x05D8/0x0650/0x0690/0x0790
FireRed/LG:    party 0x0034/0x0038, money 0x0290, bag pockets 0x0310/0x03B8/0x0430/0x0464/0x054C
```

Emerald and FireRed/LeafGreen money and bag quantities use the save security key. Ruby/Sapphire quantities are read unmasked. Gen 3 level calculation now uses the same species growth-rate table as the EXP UI instead of a medium-fast approximation. Gen 3 Pokédex progress is read from `SaveBlock2.pokedex` and cross-checked against the SaveBlock1 seen mirrors used by the game.

Gen 3 Pokédex mode is read from `struct Pokedex`, not guessed from observed species. Ruby/Sapphire/Emerald use
`nationalMagic` at `0x001A`; FireRed/LeafGreen use `0x001B`; all profiles use `mode` at `0x0019`. When National Dex is
not enabled, RSE saves are rendered against the 202-entry Hoenn Dex order from `pret/pokeemerald`
`sHoennToNationalOrder`, while FireRed/LeafGreen saves are rendered against the 151-entry Kanto order from
`pret/pokefirered` `KANTO_DEX_COUNT` / `GetKantoPokedexCount`.

The Gen 3 Pokédex panel can switch the display lens between the game's regional Dex and National `386`: Hoenn/National
for Ruby/Sapphire/Emerald and Kanto/National for FireRed/LeafGreen. This changes only which species list is displayed;
seen/caught state still comes from parsed save or live Pokédex flags.

FireRed/LeafGreen Kanto rendering keeps Mew because `pret/pokefirered` defines `KANTO_DEX_COUNT` as
`NATIONAL_DEX_MEW`. Mew may be optional for in-game completion/diploma flows, but it remains part of the source-backed
Kanto Dex list.

The parser first follows the game's `GetSetPokedexFlag` consistency check for seen entries, which requires
`SaveBlock2.pokedex.seen`, `SaveBlock1.seen1`, and `SaveBlock1.seen2` to agree when the mirrors are populated. Caught
entries come directly from `SaveBlock2.pokedex.owned`; they are not dropped just because a seen mirror is incomplete.
If those mirror arrays are empty but `SaveBlock2.pokedex` itself has owned/seen flags, the parser falls back to those raw
`struct Pokedex` seen flags instead of fabricating entries from party or PC boxes. The Pokédex UI must never infer
caught/seen entries from party or PC boxes; missing Pokédex payloads are shown as missing source data.

Gen 3 save uploads and Ruby/Sapphire/Emerald live mode use a Hoenn overview image at:

```text
public/maps/hoenn-map-emerald.svg
```

The UI maps Gen 3 `mapGroup` / `mapId` to `lib/pokemon/data/gen3-map-landmarks.ts`, which was extracted from
`pret/pokeemerald` map-group and region-map source data. It should never reuse Gen 1 Kanto or Gen 2 Pokégear maps for
Gen 3.

FireRed/LeafGreen use source-derived Kanto and Sevii region-map overviews:

```text
public/maps/kanto-map-frlg.svg
public/maps/frlg-islands-1-3-map.svg
public/maps/frlg-islands-4-5-map.svg
public/maps/frlg-islands-6-7-map.svg
lib/pokemon/data/gen3-frlg-map-landmarks.ts
```

The SVGs are generated with `scripts/generate-gen3-frlg-region-map.mjs` from `pret/pokefirered`
`graphics/region_map/region_map.png` plus `kanto.bin`, `sevii_123.bin`, `sevii_45.bin`, and `sevii_67.bin`.
The output embeds the tileset directly so the browser can render it reliably when the SVG is loaded through an `<img>`
tag. The generator leaves the empty GBA background tile and white side-mask frame tile transparent, because the app
frame supplies its own map background. The landmark file is generated with `scripts/generate-gen3-frlg-map-landmarks.mjs` from
`src/data/region_map/region_map_sections.json`, `src/data/region_map/region_map_layout_*.h`,
`data/maps/map_groups.json`, and `data/maps/*/map.json`. Each landmark carries a `mapView`, so the UI switches from
Kanto to the matching Sevii map view using source data instead of forcing all FireRed/LeafGreen locations onto Kanto.

Live Gen 3 locations must preserve `mapGroup = 0`. Hoenn outdoor towns and routes are group zero in the pret
`map_groups.json` source, so normalizers must not coerce that value to `undefined` before region-map lookup.
For multi-cell Hoenn routes and cities, the marker also uses SaveBlock1 player `pos.x` / `pos.y` and pret layout
dimensions to mirror `InitMapBasedOnPlayerLocation` in `pret/pokeemerald` `src/region_map.c`; `mapGroup` / `mapId`
alone is only enough to choose the map section, not the exact cell inside long routes such as Route 104.

Gen 3 PC storage names use `PokemonStorage.boxNames` at `0x8344`. The default game name can decode as plain `BOX`, so
the UI falls back to `Box N` for that generic value while preserving custom names. Gen 3 egg state comes from the
`BoxPokemon.isEgg` flag and the encrypted misc substructure `isEgg` bit; the UI renders it as an egg with the underlying
species shown when the record still exposes one. Gen 2 also supports the special `EGG` species ID from `pret/pokegold`,
but it does not always expose an underlying hatch species in the same way.

Unown forms are not separate species in save data. Gen 2 derives the letter from the middle two bits of the Attack,
Defense, Speed, and Special DVs; Gen 3 derives it from the low two bits of each personality-value byte. Parsed saves and
live snapshots expose `form` / `formName`, and the UI uses PokeAPI's form sprite paths such as `201-b.png` and
`201-question.png` instead of rendering every Unown as form A.

## Pokégear map

The current map view is landmark-based, not per-step.

The Lua adapter reads live `mapGroup` and `mapId`. The UI maps those to a landmark in `gen2-map-landmarks.ts`, then draws the local `public/maps/trainer-marker.png` marker over GSC town map assets.

The local Johto and Kanto PNGs are regenerated from `pokecrystal` `gfx/pokegear/town_map.png`, `johto.bin`, `kanto.bin`, and the Pokégear palette data with:

```bash
node scripts/generate-gen2-town-maps.mjs /path/to/pokecrystal
```

The marker coordinates use the visible 160x144 screen-space values from `pokecrystal` `data/maps/landmarks.asm`. The game stores those with a hardware sprite offset internally, but the UI should not apply that offset.

The `mapGroup/mapId` lookup is generated from `pokecrystal` `data/maps/maps.asm`, so indoor maps, gates, routes, and dungeons inherit the same `LANDMARK_*` values used by the game:

```bash
node scripts/generate-gen2-map-landmarks.mjs /path/to/pokecrystal
```

This is intentionally closer to the in-game Pokégear than to an overworld minimap.

## Networking model

For another device on the LAN:

```text
phone/tablet browser -> Mac Next server :3000
Mac Next server -> mGBA Lua server 127.0.0.1:8080
```

The emulator and Lua adapter must run on the host machine.
