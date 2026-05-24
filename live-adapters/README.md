# Live Emulator Adapters

The app supports two data modes:

- Save file upload/watch mode: works with most emulators, updates when the `.sav` changes on disk.
- Live memory adapters: expose emulator RAM through a local HTTP API so the UI can update HP, party, level, and other fields while the game is running.

## BizHawk

Run `pokemon-memory-reader` in BizHawk as described in its repository. This app polls:

- `http://127.0.0.1:8080/snapshot` when available
- with `GET /api/live?fallback=legacy`, otherwise `/status`, `/player`, `/party`, and `/bag`

Press **Start Live** in the UI once the Lua server is running.

## mGBA Gen 3 (Ruby/Sapphire/Emerald)

Load `mgba-gen3-live.lua` in mGBA:

1. Open Pokemon Ruby, Sapphire, or Emerald in mGBA.
2. Open `Tools -> Scripting...`.
3. Load `live-adapters/mgba-gen3-live.lua`.
4. Keep the script running and press **Start Live** in the app.

The adapter serves `GET /snapshot` on `127.0.0.1:8080` and exposes trainer info, badges, play time, party, PC boxes, bag pockets, PC item storage, Pokedex flags, current Hoenn `mapGroup` / `mapId`, and SaveBlock1 player `pos.x` / `pos.y` for source-matched region-map marker placement.

The offset profile is loaded from `live-adapters/generated/gen3-live-offsets.lua`, generated from `lib/pokemon/knowledge/sources/save-layouts.json`, `inventory-layouts.json`, and `species-id-maps.json`.

The script polls the local socket on a short wall-clock throttle and builds snapshots lazily when a client request arrives. Runtime SaveBlock and PokemonStorage scans are incremental, so the adapter does not sweep all EWRAM in one frame while the emulator is running. Ruby/Sapphire PC storage uses generated priority candidates plus structural validation, rather than a full runtime EWRAM sweep. The candidates are validated against the official `struct PokemonStorage` layout: `currentBox`, `boxes`, `boxNames`, and wallpaper bytes. Candidates with only empty or invalid records are rejected instead of being forced. GBA live reads prefer mGBA absolute bus reads and only fall back to the WRAM memory domain, because the exposed WRAM domain can vary across mGBA builds.

If you switch between Ruby/Sapphire and Emerald while the Lua script is still loaded, the adapter re-reads the ROM title and clears cached runtime addresses before building the next snapshot.

For Gen 3 PC storage debugging, use:

```text
GET http://127.0.0.1:8080/debug/storage
```

It returns the best runtime `PokemonStorage` candidates, their decoded box names, and sampled boxed Pokemon records.

Ruby/Sapphire use fixed SaveBlock1 and SaveBlock2 addresses documented in `pret/pokeruby` `include/global.h`. Emerald uses the ASLR saveblock model documented in `pret/pokeemerald` `src/load_save.c`: the Lua adapter reads `gSaveBlock1Ptr`, `gSaveBlock2Ptr`, and `gPokemonStoragePtr` from the runtime pointer table for every snapshot, then applies the source-backed struct offsets. Do not replace this with Ruby/Sapphire fixed addresses or cache Emerald pointed SaveBlock addresses across snapshots.

Gen 3 boxed and party Pokemon use the canonical encrypted `BoxPokemon` layout: 80-byte boxed records, 100-byte party records, XOR-decrypted secure substructures, `personality % 24` substructure order, checksum validation, and internal-species-to-National-Dex mapping from the generated species map.

Gen 3 trainer names, Pokemon nicknames, OT names, and box names use the Gen 3 character table shared with the save parser. Keep the Lua table aligned with `lib/pokemon/utils.ts`.

## mGBA Gen 2 (Gold/Silver/Crystal)

Load `mgba-gen2-live.lua` in mGBA:

1. Open Pokemon Gold/Silver/Crystal in mGBA.
2. Open `Tools -> Scripting...`.
3. Load `live-adapters/mgba-gen2-live.lua`.
4. Keep the script running and press **Start Live** in the app.

This adapter reads Gen 2 WRAM plus PC box records from SRAM and serves:

- `GET /snapshot`
- `GET /party`
- `GET /status`

The adapter can write a local debug snapshot file in the system temp directory: `pokemon-emulator-tracker-gen2-live-snapshot.json`.

- Default mode in script: `DEBUG_SNAPSHOT_MODE = "off"` (no auto-write)
- Other modes: `"always"` (overwrite every request) or `"off"` (disable auto-write)
- Per-request override: call `/snapshot?dump=1`, `/snapshot?dump=always`, or `/snapshot?dump=off`

The file includes the full live snapshot plus raw money bytes so you can inspect exact WRAM values offline.

The app polls once per second by default. HP, levels, party composition, held items, bag contents, and PC boxes update when emulator memory changes.

Gold/Silver and Crystal use different WRAM layouts for live memory. The adapter detects the ROM title and selects a matching offset profile for player, party, bag, badges, map, and Pokedex reads; PC box SRAM records stay shared across Gen 2. The Gold/Silver live profile follows the public Data Crystal RAM map for trainer data, bag, map coordinates, party, and Pokedex flags.

The WRAM profiles and Gen 2 TM/HM item ID sequence are loaded from `live-adapters/generated/gen2-live-offsets.lua`. Regenerate that file with `corepack pnpm generate:pokemon-knowledge` after changing `lib/pokemon/knowledge/sources/save-layouts.json` or inventory source manifests.

Crystal money is read as a 3-byte big-endian value from `0xD84E-0xD850` in live mode.

If you change the Lua script, you must reload it in mGBA (it keeps the previous version in memory).

### Current Gen 2 fields

The mGBA adapter currently exposes:

- trainer name, gender, ID, money, play time
- Johto and Kanto badge flags
- party species, nickname, HP, stats, EXP, status, held item, happiness, moves
- PC box species, nicknames, original trainer, EXP, held items, happiness, moves
- PC box names are read from live WRAM when available, with a generic fallback if the scan fails; uploaded Gen 2 save files can also show stored box names.
- bag pockets: Items, Key Items, Poke Balls, TMs/HMs
- PC item storage from SRAM as a separate `PC Storage` inventory section
- live map group / map id / local X/Y

The live TMs/HMs pocket uses the same `pret/pokecrystal`-derived item ID sequence as the save parser. Gen 2 TM item IDs are not contiguous because `0xC3` and `0xDC` are unused item slots, so do not decode live TM quantities with `0xBF + index`.

The web UI uses `mapGroup` and `mapId` for a Pokégear-style landmark view.

The Next `/api/live` route uses `/snapshot` by default. Legacy split endpoints are opt-in with `fallback=legacy` because the mGBA adapter computes a full snapshot for each accepted request.

The live PC reader uses the official Gen 2 box offsets first, then scans SRAM for valid Gen 2 box records. The layout follows `pret/pokecrystal` (`ram/sram.asm`, `layout.link`) and the documented Gen 2 save structure.
PC box data is cached briefly in the Lua adapter so HP, party, trainer, bag, and map updates stay responsive during live polling.

Gen 2 stores key live fields in banked WRAM (`0xD000-0xDFFF`). During battle/menu transitions, one frame can expose
temporary bank-mapped values. The adapter now prefers WRAM memory-domain reads before bus reads to reduce one-tick
trainer/money/play-time/location glitches.

If a future emulator exposes SRAM differently, check the raw `/snapshot` status fields:

- `sram`: whether the adapter can access SRAM
- `sramSize`: reported SRAM memory-domain size, when mGBA exposes it
- `sramHealth`: whether SRAM looks ready, zeroed, erased, or unknown
- `sramReadMode`: whether the adapter is reading mGBA SRAM through the memory domain or bus window
- `lastRequestTarget`: the last HTTP target handled by the adapter
- `profile`: selected live WRAM profile (`crystal` or `gold_silver`)
- `romTitle`: ROM title read from the cartridge header, when mGBA exposes it
- `pcBoxes`: number of non-empty box records found
- `pcBoxPokemon`: total boxed Pokemon found

### Notes for maintainers

Do not assume mGBA sockets behave exactly like LuaSocket. Keep networking simple and defensive.

If you add another emulator adapter, return a `/snapshot` payload close to the current mGBA shape so `lib/pokemon/live-normalizer.ts` can keep the UI source-agnostic.

## mGBA Gen 1 (Red/Blue/Yellow)

Load `mgba-gen1-live.lua` in mGBA:

1. Open Pokemon Red/Blue/Yellow in mGBA.
2. Open `Tools -> Scripting...`.
3. Load `live-adapters/mgba-gen1-live.lua`.
4. Keep the script running and press **Start Live** in the app.

The Gen 1 adapter serves `GET /snapshot` on `127.0.0.1:8080` and exposes trainer info, badges, play time, party, PC boxes, bag items, PC item storage, Pokedex flags, and current map id.
PC boxes are read from the documented Gen 1 SRAM save layout: bank 2 stores boxes 1-6 at `0x4000..0x55EA`, and bank 3 stores boxes 7-12 at `0x6000..0x75EA`. The adapter first tries mGBA's linear SRAM memory domain. If that domain only exposes an erased/windowed view, it briefly selects the matching MBC1 SRAM bank through the `$A000` bus window, reads the box, then restores normal ROM-banking mode.
Current-box state is exposed through `isCurrent`; box names stay plain (`Box 1`, `Box 2`, etc.) because Gen 1 does not store custom box names.
Snapshots are cached and refreshed about every 250 ms from the frame callback, matching the Gen 2 adapter behavior closely enough for the web UI's live polling.

Like Gen 2, the Gen 1 adapter can write a local debug snapshot file in the system temp directory: `pokemon-emulator-tracker-gen1-live-snapshot.json`.

- Default mode in script: `DEBUG_SNAPSHOT_MODE = "off"`
- Per-request override: call `/snapshot?dump=1`, `/snapshot?dump=always`, or `/snapshot?dump=off`
- Extra box diagnostics are available at `/debug/boxes`

The WRAM profiles are loaded from `live-adapters/generated/gen1-live-offsets.lua`, generated from `lib/pokemon/knowledge/sources/save-layouts.json`. Red/Blue's active current-box WRAM offset is cross-checked against Data Crystal's Red/Blue RAM map (`DA80`), while the rest of the profile is tied back to the pinned source manifests. Rerun `corepack pnpm generate:pokemon-knowledge` after changing those manifests.
The Gen 1 Kanto Town Map asset is generated locally from `pret/pokered` `gfx/town_map/town_map.png` plus `gfx/town_map/town_map.rle` with `node scripts/generate-gen1-town-map.mjs`.

When mGBA exposes SRAM as unavailable, Gen 1 live mode can only read the current WRAM box safely. The web UI therefore
merges live data with the uploaded save file when both are present: party/trainer/current box come from live, and
non-current PC boxes come from the save file. Re-upload or refresh the save after changing stored boxes in-game.
During one live session, the UI also keeps previously observed Gen 1 current boxes in memory, so switching PC boxes in
game does not immediately erase boxes already seen through WRAM.
