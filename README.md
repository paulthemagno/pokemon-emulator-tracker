# Pokemon Tracker

Web dashboard for reading Pokemon save files and, in live mode, following Pokemon Crystal while it runs in mGBA.

## What it does

- Imports Gen 1, Gen 2, and partial Gen 3 `.sav` / `.srm` files.
- Shows trainer data, party, PC boxes, inventory, and location.
- Supports live mode for Pokemon Crystal through a Lua script in mGBA.
- In live mode, updates party, HP, EXP, moves, badges, trainer info, and Pokégear landmarks.

## Setup

Requires a recent Node.js version and Corepack.

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

If `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS` (for example, `sharp`), approve build scripts and rerun install:

```bash
corepack pnpm approve-builds --all
corepack pnpm install
```

Open:

```text
http://localhost:3000
```

To expose the UI to other devices on the same network:

```bash
corepack pnpm dev --hostname 0.0.0.0
```

Then open the host computer's IP address, for example:

```text
http://192.168.1.83:3000
```

## Live with mGBA

1. Open Pokemon Crystal in mGBA.
2. Open `Tools -> Scripting...`.
3. Load `live-adapters/mgba-crystal-live.lua`.
4. In the web app, press **Start Live**.

The mGBA script exposes a small local server at:

```text
http://127.0.0.1:8080/snapshot
```

The web app calls `/api/live`, which proxies to the live script.

## Sharing the project

When sharing the code, share the whole repository but not `node_modules`.

Important files/folders:

- `app/`
- `components/`
- `hooks/`
- `lib/`
- `live-adapters/`
- `public/`
- `package.json`
- `pnpm-lock.yaml`
- `next.config.mjs`
- `tsconfig.json`

Whoever receives the project should run:

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

## Known status

- `.sav` mode remains the most universal path for emulators without a live adapter.
- True live mode depends on the emulator. The maintained adapter right now is `mGBA + Pokemon Crystal`.
- The live map uses the original 160x144 Pokemon Crystal Pokégear town-map layout with landmark coordinates from `pokecrystal`.
- Some Gen 3 areas still have legacy TypeScript errors and should be cleaned up before considering the project stable.

## Generated data

Item descriptions in tooltips are stored locally in `lib/pokemon/data/item-descriptions.ts`.
The file is generated from PokeAPI for the Gen 1-3 items the app can parse.

Move descriptions in tooltips are stored locally in `lib/pokemon/data/move-descriptions.ts`.
The file is generated from PokeAPI for Gen 1-3 move IDs used by the app.

To regenerate it after item table changes:

```bash
node scripts/generate-item-descriptions.mjs
node scripts/generate-move-descriptions.mjs
```

The Gen 2 Pokégear map PNGs in `public/maps/` are generated from a local `pokecrystal` checkout:

```bash
git clone --depth 1 https://github.com/pret/pokecrystal.git /tmp/pokecrystal
node scripts/generate-gen2-town-maps.mjs /tmp/pokecrystal
node scripts/generate-gen2-map-landmarks.mjs /tmp/pokecrystal
```

## Documents

- [Live adapters](live-adapters/README.md)
- [Agent notes](AGENTS.md)
- [Architecture notes](docs/architecture.md)
- [Known issues](docs/known-issues.md)
