# Pokemon Emulator Tracker

<p align="center">
  <img src="public/logo.png" width="160" alt="Pokemon Emulator Tracker logo" />
</p>

Web dashboard for reading Pokemon save files and following live gameplay from mGBA.

## Current Status

Main support:

- Gen 1 Red/Blue/Yellow: `.sav` parsing and mGBA live mode with `live-adapters/mgba-gen1-live.lua`.
- Gen 2 Gold/Silver/Crystal: `.sav` parsing and mGBA live mode with `live-adapters/mgba-gen2-live.lua`.
- Gen 3 Ruby/Sapphire/Emerald/FireRed/LeafGreen: partial `.sav` parser with party, inventory, badges, Pokédex, and PC boxes; all five games have a first mGBA live adapter pass with `live-adapters/mgba-gen3-live.lua`.

Available features:

- trainer data, money, play time, badges, Pokedex
- party Pokemon with moves, HP, stats, EXP, and held items where the game supports them
- PC boxes and PC item storage
- inventory
- local map/landmark display for Gen 1, Gen 2, Ruby/Sapphire/Emerald, and FireRed/LeafGreen Kanto
- local Ollama chatbot with current game context

See [docs/game-support-matrix.md](docs/game-support-matrix.md) for the full support matrix.

## Quick Start

Requires a recent Node.js version and Corepack.

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

Open:

```text
http://localhost:3000
```

If `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS`, approve build scripts and reinstall:

```bash
corepack pnpm approve-builds --all
corepack pnpm install
```

To expose the UI on your LAN:

```bash
corepack pnpm dev --hostname 0.0.0.0
```

Then open the host machine IP, for example:

```text
http://192.168.1.83:3000
```

## Save Files

1. Start the web app.
2. Upload a `.sav` or `.srm` file.
3. For Gen 1 saves with generic filenames, include `red`, `blue`, or `yellow` in the filename.
4. For Gen 3 saves, include `ruby`, `sapphire`, `emerald`, `firered`, or `leafgreen` in the filename. Gen 3 save layout selection is filename-based.

The parser normalizes save files into the same data model used by live mode.

## Live mGBA

1. Open the game in mGBA.
2. Open `Tools -> Scripting...`.
3. Load the correct script:
   - Red/Blue/Yellow: `live-adapters/mgba-gen1-live.lua`
   - Gold/Silver/Crystal: `live-adapters/mgba-gen2-live.lua`
   - Ruby/Sapphire/Emerald/FireRed/LeafGreen: `live-adapters/mgba-gen3-live.lua`
4. In the web app, press **Start Live**.

The Lua script exposes:

```text
http://127.0.0.1:8080/snapshot
```

The UI calls `GET /api/live`, which proxies to mGBA.

If you change a Lua script or a file under `live-adapters/generated/`, reload the script in mGBA.

When live polling is stopped, the dashboard falls back to the uploaded save file. A stale live snapshot must not keep
overriding a `.sav` you are checking offline.

## Local Chatbot With Ollama

The chatbot uses local Ollama. It is optional for tracker/live mode, but enables contextual questions about the current game state.

1. Install and start Ollama.
2. Pull a model:

```bash
ollama pull gemma4:latest
ollama serve
```

3. Start the web app and open the chat panel.

Optional environment variables:

```bash
OLLAMA_ENDPOINT=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:latest
OLLAMA_MAX_TOKENS=2048
OLLAMA_TEMPERATURE=0.7
OLLAMA_ENABLE_TOOLS=true
```

With an active save or live session, the chatbot receives trainer data, party, inventory, badges, location, and Pokedex progress. If the model does not support tool calls, the provider automatically falls back to a text-context prompt.

Details: [docs/chatbot-phase1.md](docs/chatbot-phase1.md) and [docs/llm-pokemon-agent.md](docs/llm-pokemon-agent.md).

## Test And Audit

```bash
corepack pnpm test
corepack pnpm audit:pokemon-data
```

Before promoting a new game to supported, update the support matrix and add fixtures/tests.

## Generated Data

Pokemon data should stay local at runtime and have traceable sources.

Source manifests:

```text
lib/pokemon/knowledge/sources/
```

Generated outputs:

```text
lib/pokemon/knowledge/
live-adapters/generated/gen1-live-offsets.lua
live-adapters/generated/gen2-live-offsets.lua
live-adapters/generated/gen3-live-offsets.lua
```

Regenerate:

```bash
corepack pnpm generate:pokemon-knowledge
```

If local `pret` checkouts are available, refresh extractable manifests first:

```bash
corepack pnpm extract:pokemon-knowledge -- --pokecrystal /path/to/pokecrystal --pokegold /path/to/pokegold --pokered /path/to/pokered --pokeyellow /path/to/pokeyellow
corepack pnpm generate:pokemon-knowledge
```

Policy and source pins: [docs/pokemon-source-policy.md](docs/pokemon-source-policy.md) and [docs/source-lockfile.md](docs/source-lockfile.md). Gen 3 Pokédex mode, Hoenn/Kanto regional Dex order, and PC storage offsets are source-backed; do not patch generated files by hand.

## Documents

- [live-adapters/README.md](live-adapters/README.md): using and debugging the mGBA scripts.
- [docs/architecture.md](docs/architecture.md): stable technical data flow.
- [docs/game-support-matrix.md](docs/game-support-matrix.md): per-game support status.
- [docs/known-issues.md](docs/known-issues.md): open limitations.
- [docs/source-lockfile.md](docs/source-lockfile.md): sources, pins, and offset notes.
- [AGENTS.md](AGENTS.md): operational notes for Codex/agents.
