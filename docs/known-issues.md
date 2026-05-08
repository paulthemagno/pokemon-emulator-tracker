# Known Issues

## TypeScript cleanup

There are existing TypeScript errors outside the live Crystal path, especially around:

- Gen 3 parser types
- Inventory section vs inventory item component expectations
- PC box nullable Pokemon entries

These have not blocked the live Crystal UI but should be cleaned before a stable release.

## mGBA Lua sockets

mGBA Lua socket behavior is not identical to standard LuaSocket. Earlier failures included:

- missing `settimeout`
- vararg syntax incompatibility around `...`
- socket `receive` errors

The current adapter avoids a complex HTTP parser and sends a snapshot as soon as a client connects.

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

Some landmarks may still need `offsetX` / `offsetY` calibration. Avoid global offsets unless every landmark in that region is verified.

## Gen 2 item IDs

Gen 2 item IDs are not the same as Gen 1 item IDs. Do not use `getGen1ItemName` for Gold/Silver/Crystal party held items or inventory.

Use:

```ts
getGen2ItemName(id)
```

Example: item id `0x5b` / decimal `91` is `Amulet Coin` in Gen 2, not `Unknown (91)`.

## Emulator support

Only mGBA + Pokemon Crystal has an in-repo live adapter right now.

Future adapters could target:

- BizHawk via Lua / pokemon-memory-reader style API
- RetroArch if a stable memory API is available
- Other emulator-specific scripts

Keep the UI data model source-agnostic.
