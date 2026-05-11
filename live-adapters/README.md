# Live Emulator Adapters

The app supports two data modes:

- Save file upload/watch mode: works with most emulators, updates when the `.sav` changes on disk.
- Live memory adapters: expose emulator RAM through a local HTTP API so the UI can update HP, party, level, and other fields while the game is running.

## BizHawk

Run `pokemon-memory-reader` in BizHawk as described in its repository. This app polls:

- `http://127.0.0.1:8080/snapshot` when available
- with `GET /api/live?fallback=legacy`, otherwise `/status`, `/player`, `/party`, and `/bag`

Press **Start Live** in the UI once the Lua server is running.

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
- live map group / map id / local X/Y

The web UI uses `mapGroup` and `mapId` for a Pokégear-style landmark view.

The Next `/api/live` route uses `/snapshot` by default. Legacy split endpoints are opt-in with `fallback=legacy` because the mGBA adapter computes a full snapshot for each accepted request.

The live PC reader uses the official Gen 2 box offsets first, then scans SRAM for valid Gen 2 box records. The layout follows `pret/pokecrystal` (`ram/sram.asm`, `layout.link`) and the documented Gen 2 save structure.
PC box data is cached briefly in the Lua adapter so HP, party, trainer, bag, and map updates stay responsive during live polling.

If a future emulator exposes SRAM differently, check the raw `/snapshot` status fields:

- `sram`: whether the adapter can access SRAM
- `sramHealth`: whether SRAM looks ready, zeroed, erased, or unknown
- `sramReadMode`: whether the adapter is reading mGBA SRAM through the memory domain or bus window
- `profile`: selected live WRAM profile (`crystal` or `gold_silver`)
- `romTitle`: ROM title read from the cartridge header, when mGBA exposes it
- `pcBoxes`: number of non-empty box records found
- `pcBoxPokemon`: total boxed Pokemon found

### Notes for maintainers

Do not assume mGBA sockets behave exactly like LuaSocket. Keep networking simple and defensive.

If you add another emulator adapter, return a `/snapshot` payload close to the current mGBA shape so `lib/pokemon/live-normalizer.ts` can keep the UI source-agnostic.
