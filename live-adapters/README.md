# Live Emulator Adapters

The app supports two data modes:

- Save file upload/watch mode: works with most emulators, updates when the `.sav` changes on disk.
- Live memory adapters: expose emulator RAM through a local HTTP API so the UI can update HP, party, level, and other fields while the game is running.

## BizHawk

Run `pokemon-memory-reader` in BizHawk as described in its repository. This app polls:

- `http://127.0.0.1:8080/snapshot` when available
- otherwise `/status`, `/player`, `/party`, and `/bag`

Press **Start Live** in the UI once the Lua server is running.

## mGBA Crystal

Load `mgba-crystal-live.lua` in mGBA:

1. Open Pokemon Crystal in mGBA.
2. Open `Tools -> Scripting...`.
3. Load `live-adapters/mgba-crystal-live.lua`.
4. Keep the script running and press **Start Live** in the app.

This adapter reads Crystal WRAM plus PC box records from SRAM and serves:

- `GET /snapshot`
- `GET /party`
- `GET /status`

The app polls once per second by default. HP, levels, party composition, held items, bag contents, and PC boxes update when emulator memory changes.

### Current Crystal fields

The mGBA adapter currently exposes:

- trainer name, ID, money, play time
- Johto and Kanto badge flags
- party species, nickname, HP, stats, EXP, status, held item, happiness, moves
- PC box species, nicknames, original trainer, EXP, held items, happiness, moves
- bag pockets: Items, Key Items, Poke Balls, TMs/HMs
- live map group / map id / local X/Y

The web UI uses `mapGroup` and `mapId` for a Pokégear-style landmark view.

The live PC reader uses the official Crystal box offsets first, then scans Crystal SRAM for valid Gen 2 box records. The layout follows `pret/pokecrystal` (`ram/sram.asm`, `layout.link`) and the documented Gen 2 save structure.

If a future emulator exposes SRAM differently, check the raw `/snapshot` status fields:

- `sram`: whether the adapter can access SRAM
- `sramHealth`: whether SRAM looks ready, zeroed, erased, or unknown
- `sramReadMode`: whether the adapter is reading mGBA SRAM through the memory domain or bus window
- `pcBoxes`: number of non-empty box records found
- `pcBoxPokemon`: total boxed Pokemon found

### Notes for maintainers

Do not assume mGBA sockets behave exactly like LuaSocket. Keep networking simple and defensive.

If you add another emulator adapter, return a `/snapshot` payload close to the current mGBA shape so `lib/pokemon/live-normalizer.ts` can keep the UI source-agnostic.
