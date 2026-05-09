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

The current live mode is focused on Pokemon Crystal in mGBA.

## Live mGBA

File principale:

```text
live-adapters/mgba-crystal-live.lua
```

The script reads Crystal WRAM and serves JSON on `127.0.0.1:8080`.

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

Do not use a global offset for every map. Some landmarks may require specific `offsetX` / `offsetY` values. Goldenrod was calibrated manually.

Kanto and Johto coordinates must stay consistent with `pokecrystal` `data/maps/landmarks.asm`.

## Badge

Badge sprites are local:

```text
public/badges/
```

Do not hotlink Bulbagarden directly in the UI: some assets break or are unstable in browsers.

## Things not to repeat

- Do not use stretched/cropped map screenshots with coordinates from another map.
- Do not place city labels over the map if they hurt readability.
- Do not calibrate Kanto in a way that breaks Johto, or vice versa.
- Do not assume one offset works for every landmark.

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
