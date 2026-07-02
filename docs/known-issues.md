# Known Issues

## Gen 1 and Gen 3 support gaps

Gen 1 has a first supported pass for Red/Blue/Yellow save parsing and mGBA live mode. Gen 3 save parsing and Ruby/Sapphire/Emerald/FireRed/LeafGreen live mode exist but are not yet at the same confidence level as Gen 1/2.

Known examples:

- Gen 1 Red/Blue/Yellow save detection is filename-based; extensionless or generically named saves default to Red.
- Gen 1 PC box names remain generic because Gen 1 boxes are not player-named.
- Gen 1 live PC boxes depend on mGBA exposing readable SRAM. When SRAM is unavailable, the UI can still merge live current-box data with an uploaded save file.
- Gen 3 game detection is filename-based because raw `.sav` section data does not expose a reliable game title string. Use filenames containing `ruby`, `sapphire`, `emerald`, `firered`, or `leafgreen`.
- Gen 3 SaveBlock1/SaveBlock2, inventory, badge flags, Pokédex flag arrays, and PC storage geometry now come from pinned `pret/pokeruby`, `pret/pokeemerald`, and `pret/pokefirered` sources, but fixture coverage with real saves is still needed before marking Gen 3 stable.
- Gen 3 Ruby/Sapphire/Emerald/FireRed/LeafGreen live mode uses generated source-backed offsets, but the Lua adapter still needs real mGBA validation across all five games before promotion from partial to supported.
- Non-boolean progress facts intentionally cover only reviewed high-value states. Unknown or ambiguous variable values are hidden rather than shown as guessed progress. The main-story summary provides broad milestone coverage, while several mid-game subchapters and postgame routes still rely on the event list instead of a dedicated phase card. Reload the matching Lua script after updating an adapter because mGBA keeps the loaded script in memory.
- Gen 3 Ruby/Sapphire/Emerald Pokédex rendering respects Hoenn regional mode and National mode using `struct Pokedex` bytes and the `pret/pokeemerald` Hoenn order. FireRed/LeafGreen use the `pret/pokefirered` Kanto count/order and can switch between Kanto and National display. Gen 3 still needs broader real-save/live fixture coverage before promotion.
- Gen 3 Pokemon structures now translate internal species IDs to National Dex IDs, but species gender ratios are still incomplete.
- Gen 3 uses a Hoenn map asset and source-backed landmark coordinates for Ruby/Sapphire/Emerald, plus FireRed/LeafGreen Kanto and Sevii overview maps generated from `pret/pokefirered` region-map assets. Edge/event maps still need broader real-save validation.
- Gen 1 and Gen 3 generated location/encounter/learnset datasets are not first-class local data yet.
- Chat image attachments require a vision-capable Ollama, OpenRouter, or AI SDK model;
  capability discovery is not exposed in the UI yet.
- Audio notes are not supported and need a dedicated speech-to-text provider.
- Ollama, OpenRouter, and AI SDK BYOK share the runtime tool loop. AI SDK BYOK
  currently supports `anthropic/`, `openai/`, and `google/` prefixes.
- Gen 1 and Gen 2 PC item storage is parsed, but the UI labels it generically as `PC Storage` rather than with game-specific copy.

Track support status in `docs/game-support-matrix.md` and run `corepack pnpm audit:pokemon-data` before promoting a game to supported.

## mGBA Lua sockets

mGBA Lua socket behavior is not identical to standard LuaSocket. Earlier failures included:

- missing `settimeout`
- vararg syntax incompatibility around `...`
- socket `receive` errors

The current adapter avoids a complex HTTP parser and sends a snapshot as soon as a client connects.

## Live snapshot gaps

During menu transitions or battle frames, the emulator memory snapshot can briefly come back partially empty.
The client now keeps the last good live sections in place instead of flashing empty panels, but the underlying
live read is still best-effort and may lag by one refresh.
Trainer snapshot retention validates both the incoming and retained values. A previously cached trainer with impossible
money or play-time fields is replaced by the next valid snapshot instead of blocking recovery as a backward time jump.

The Gen 1 and Gen 2 mGBA live adapters both expose common status fields such as `sram`, `sramSize`, `sramHealth`,
`sramReadMode`, `profile`, `romTitle`, `pcBoxes`, and `pcBoxPokemon`.

The Gen 1 mGBA live adapter reads PC boxes from the documented SRAM box layout through mGBA's read-only SRAM memory
domain. It does not change MBC1 cartridge banking during polling. If the full SRAM domain is unavailable, it falls back
to the active WRAM box only. When an uploaded save file is
also loaded, the UI merges live current-box data with non-current boxes from the save file so switching the in-game
current PC box does not hide the rest of the stored collection. The live UI also caches Gen 1 boxes already observed as
the current WRAM box during the current session. Box names remain plain in Gen 1; current-box state is represented by
`isCurrent`, not by adding `Current` to the box name.
The Gen 1 live adapter now caches snapshots on the frame callback like the Gen 2 adapter, but full PC boxes still
depend on mGBA exposing a readable SRAM memory domain.

## Next dev origins

When running the app from `127.0.0.1` or a LAN IP, Next dev can block HMR/dev resources unless those hosts are in `allowedDevOrigins`.

Configured in `next.config.mjs`:

```js
allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.83"]
```

If the browser UI loads but clicks feel dead, restart the dev server after checking this setting.

## Pokégear marker calibration

The marker is landmark-based. It uses `mapGroup/mapId`, not exact player tile position, for the town-map view.

Coordinate source:

```text
pokecrystal data/maps/landmarks.asm
```

The local map images are now regenerated from the matching `pokecrystal` Pokégear tilemaps at 160x144, so marker calibration should not use per-landmark `offsetX` / `offsetY` hacks unless a specific upstream mapping bug is proven.

The `mapGroup/mapId` lookup is generated from `pokecrystal` `data/maps/maps.asm`, not maintained by hand.

## Gen 2 item IDs

Gen 2 item IDs are not the same as Gen 1 item IDs. Do not use `getGen1ItemName` for Gold/Silver/Crystal party held items or inventory.

Use:

```ts
getGen2ItemName(id)
```

Example: item id `0x5b` / decimal `91` is `Amulet Coin` in Gen 2, not `Unknown (91)`.

## Emulator support

The in-repo mGBA adapters currently cover:

- Pokemon Red/Blue/Yellow through `live-adapters/mgba-gen1-live.lua`
- Pokemon Gold/Silver/Crystal through `live-adapters/mgba-gen2-live.lua`
- Pokemon Ruby/Sapphire/Emerald/FireRed/LeafGreen through `live-adapters/mgba-gen3-live.lua`

Future adapters could target:

- BizHawk via Lua / pokemon-memory-reader style API
- RetroArch if a stable memory API is available
- Other emulator-specific scripts

Keep the UI data model source-agnostic.
