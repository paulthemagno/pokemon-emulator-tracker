# Architecture Notes

## Data flow

```text
Save upload
  -> app/api/parse
  -> lib/pokemon/parsers/*
  -> SaveData
  -> UI

mGBA + Pokemon Crystal
  -> live-adapters/mgba-crystal-live.lua
  -> http://127.0.0.1:8080/snapshot
  -> app/api/live
  -> lib/pokemon/live-normalizer.ts
  -> SaveData
  -> UI
```

The UI should consume normalized `SaveData` and avoid caring whether the source is a save file or live memory.

## Important files

- `app/page.tsx`: main upload/live orchestration.
- `app/api/parse/route.ts`: save parser API.
- `app/api/live/route.ts`: live proxy API.
- `hooks/use-live-data.ts`: polling state.
- `components/pokemon/dashboard.tsx`: dashboard layout.
- `components/pokemon/trainer-card.tsx`: trainer, badges, Pokégear map.
- `components/pokemon/pokemon-card.tsx`: party Pokemon card.
- `lib/pokemon/live-normalizer.ts`: converts live JSON to app data model.
- `live-adapters/mgba-crystal-live.lua`: mGBA Crystal RAM reader.

## Live adapter contract

The app expects `/snapshot` to return JSON with some or all of:

```json
{
  "generation": 2,
  "game": "crystal",
  "player": {},
  "party": [],
  "pcBoxes": [
    {
      "name": "Current Box",
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

For Crystal live inventory, the mGBA adapter reads these WRAM pockets:

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

For Crystal live PC data, the mGBA adapter reads the official Gen 2 box offsets from SRAM and then falls back to scanning for valid Gen 2 box records. The offsets match `pret/pokecrystal`'s SRAM layout and Bulbapedia's Gen 2 save structure:

```text
Current box: 0x2D10
Box 1-7:     0x4000, 0x4450, 0x48A0, 0x4CF0, 0x5140, 0x5590, 0x59E0
Box 8-14:    0x6000, 0x6450, 0x68A0, 0x6CF0, 0x7140, 0x7590, 0x79E0
```

`live-normalizer.ts` normalizes those records with the same species, move, item, type, and status lookups used for the live party.

The raw `/snapshot` status includes PC diagnostics:

```text
sram         whether mGBA exposes SRAM
pcBoxes      number of non-empty box records found
pcBoxPokemon total boxed Pokemon found
```

## EXP bars

EXP itself is read from RAM/save data. The UI must not mock or hardcode per-Pokemon EXP corrections.

Some species entries may not include a `growthRate`. To keep the EXP bar dynamic for any Pokemon, `components/pokemon/pokemon-card.tsx` infers the active growth curve from the live pair:

```text
level + total experience
```

It tests all official growth curves and selects the one whose `[level, next level)` EXP window contains the current EXP. This avoids one-off fixes like "Chansey uses fast" while still using real RAM values.

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
