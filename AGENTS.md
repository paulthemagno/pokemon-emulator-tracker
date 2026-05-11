# Agent Notes

These notes are for Codex or other agents picking up the work.

## Main rule

Update these `.md` files as you work. If you change setup, live adapters, maps, coordinates, endpoints, or the user workflow, update at least one of:

- `README.md`
- `live-adapters/README.md`
- `docs/architecture.md`
- `docs/known-issues.md`
- `AGENTS.md`

## Project context

This project is a Next/React app for Pokemon save tracking. It has two data sources:

- `.sav` / `.srm` uploads
- Live emulator memory through `/api/live`

The current live mode is focused on Pokemon Gold/Silver/Crystal in mGBA.

## Live mGBA

File principale:

```text
live-adapters/mgba-gen2-live.lua
```

The script reads Gen 2 WRAM through per-version profiles and serves JSON on `127.0.0.1:8080`.

Endpoint used by the UI:

```text
GET /api/live
```

which is normalized by:

```text
lib/pokemon/live-normalizer.ts
```

## Pokégear Map

The UI uses local maps in:

```text
public/maps/
```

The `mapGroup/mapId -> landmark -> coordinates` conversion lives in:

```text
lib/pokemon/data/gen2-map-landmarks.ts
```

Johto and Kanto town-map PNGs are generated from `pret/pokecrystal` with:

```bash
node scripts/generate-gen2-town-maps.mjs /path/to/pokecrystal
```

The landmark lookup table is generated from `pret/pokecrystal` with:

```bash
node scripts/generate-gen2-map-landmarks.mjs /path/to/pokecrystal
```

Do not use a global offset for every map. The current map images are 160x144 Pokégear screen-space renders, so landmarks should use the visible coordinates from `pokecrystal` `data/maps/landmarks.asm` directly.

Kanto and Johto coordinates must stay consistent with `pokecrystal` `data/maps/landmarks.asm`.

## Badge

Badge sprites are local:

```text
public/badges/
```

Do not hotlink Bulbagarden directly in the UI: some assets break or are unstable in browsers.

- In compact trainer cards, badges should show a short visible label (not only tooltip) so names remain readable at a glance.

## Things not to repeat

- Do not use stretched/cropped map screenshots with coordinates from another map.
- Do not place city labels over the map if they hurt readability.
- Do not calibrate Kanto in a way that breaks Johto, or vice versa.
- Do not assume one offset works for every landmark.

## UI stats notes

- Pokemon stat labels in cards are intentionally short and consistent: `Atk`, `Def`, `SpA`, `SpD`, `Spe` (Gen 1 uses `Spc`).
- Stat bars in cards use 255 as the default reference scale; if any displayed stat exceeds 255, that card scales to the highest displayed stat.

## Inventory notes

- Gen 2 Crystal save inventory offsets differ from TM/HM bytes; keep bag pockets aligned to the correct save addresses (`BAG_ITEMS`, `BAG_KEY_ITEMS`, `BAG_BALLS`, and `BAG_TMS_HMS`).
- Inventory "Show more" should visibly expand/collapse the list and not keep extra items hidden behind a fixed-height scroll area.

## PC boxes UI notes

- Box grid sprites are intentionally larger for readability.
- Box navigation shows visible clickable box names; if parser-provided names are missing, fallback should stay generic (`Box N`) and not use Pokemon names.
- Box navigation dots should remain easy to click on touch devices.
- Live payload can mark the currently active box; UI should default selection to it and keep a distinct visual highlight for it.
- Save-file parsing and live adapter payload are separate pipelines; box names/current-box flags must be handled in both.

## Minimum verification

After frontend changes:

```bash
curl -I http://127.0.0.1:3000
```

If the server is not running:

```bash
./node_modules/.bin/next dev --hostname 0.0.0.0
```

In the sandbox, escalation may be required to bind `0.0.0.0:3000`.
