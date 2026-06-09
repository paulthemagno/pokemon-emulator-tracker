# Pokemon Emulator Tracker

<p align="center">
  <img src="public/logo.png" width="160" alt="Pokemon Emulator Tracker logo" />
</p>

<p align="center">
  <strong>Inspect Pokemon save files, follow mGBA live memory, and query the current run with a local LLM.</strong>
</p>

<p align="center">
  <a href="https://pokemon-emulator-tracker.vercel.app/">
    <img src="https://img.shields.io/badge/Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Hosted demo on Vercel" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Save%20Upload-Gen%201--3-4caf50?style=flat-square" alt="Save upload supports Gen 1 to 3" />
  <img src="https://img.shields.io/badge/mGBA%20Live-Local%20Only-1f6feb?style=flat-square" alt="mGBA live is local only" />
  <img src="https://img.shields.io/badge/Ollama-Optional%20Local%20LLM-f97316?style=flat-square" alt="Ollama is optional and local" />
  <img src="https://img.shields.io/badge/Games-RBY%20GSC%20RSE%20FRLG-a855f7?style=flat-square" alt="Supported games include RBY GSC RSE and FRLG" />
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#use-save-files">Save Upload</a> •
  <a href="#use-mgba-live-mode">mGBA Live</a> •
  <a href="#use-the-local-llm-assistant">LLM Assistant</a> •
  <a href="#supported-games">Supported Games</a>
</p>

Pokemon Emulator Tracker is a local-first dashboard for two workflows:

- static save analysis: upload `.sav` / `.srm` files and inspect trainer data, party, Pokédex, PC boxes, inventory, badges, key events/all save states with readable captions and step lists, and map location
- live emulator tracking: connect mGBA through a Lua adapter and watch party, HP, PC boxes, inventory, key events/all save states with readable captions and step lists, and map updates while the game is running

It also includes an optional local Ollama assistant that can answer questions about the currently loaded save or live session.

## Hosted Demo

Demo URL: [pokemon-emulator-tracker.vercel.app](https://pokemon-emulator-tracker.vercel.app/)

What works on Vercel:

- save upload and parsing
- dashboard browsing
- UI exploration

What still requires local setup:

- mGBA live mode via `127.0.0.1:8080`
- Ollama via `127.0.0.1:11434`

The hosted Vercel version cannot reach services on your own machine, so live mode and the local LLM are local-only by design.

## Contents

- [Supported Games](#supported-games)
- [Quick Start](#quick-start)
- [Use Save Files](#use-save-files)
- [Use mGBA Live Mode](#use-mgba-live-mode)
- [Use the Local LLM Assistant](#use-the-local-llm-assistant)
- [Test and Audit](#test-and-audit)
- [Data Sources](#data-sources)
- [Project Docs](#project-docs)

## Supported Games

| Generation | Games | Save upload | mGBA live |
| --- | --- | --- | --- |
| Gen 1 | Red, Blue, Yellow | Supported | Supported |
| Gen 2 | Gold, Silver, Crystal | Supported | Supported |
| Gen 3 | Ruby, Sapphire, Emerald | Partial but usable | Partial but usable |
| Gen 3 | FireRed, LeafGreen | Partial but usable | Partial but usable |

See [docs/game-support-matrix.md](docs/game-support-matrix.md) for the detailed support matrix and current caveats.

## Quick Start

Requires Node.js and Corepack.

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

Open:

```text
http://localhost:3000
```

If `pnpm install` fails because build scripts were blocked:

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

## Use Save Files

1. Start the app locally or open the hosted demo.
2. Drag a `.sav`, `.srm`, `.sa1`, `.sa2`, `.sn1`, or `.sn2` file into the upload area.
3. Inspect trainer data, party, Pokédex, PC boxes, inventory, badges, and map.
4. Re-upload the save after saving in-game to refresh the dashboard.

Filename hints matter when a raw save layout does not uniquely identify the game:

- Gen 1: include `red`, `blue`, or `yellow` in generic filenames.
- Gen 3: include `ruby`, `sapphire`, `emerald`, `firered`, or `leafgreen` in generic filenames.

The parser normalizes uploaded saves into the same model used by live mode, so the UI behaves the same after upload or live polling.

## Use mGBA Live Mode

Live mode requires the app to run locally.

1. Start the app with `corepack pnpm dev`.
2. Open the game in mGBA.
3. In mGBA, open `Tools -> Scripting...`.
4. Load the Lua adapter for your game.
5. Keep the script running.
6. In the web app, press **Start Live**.

| Games | Lua adapter |
| --- | --- |
| Red, Blue, Yellow | `live-adapters/mgba-gen1-live.lua` |
| Gold, Silver, Crystal | `live-adapters/mgba-gen2-live.lua` |
| Ruby, Sapphire, Emerald, FireRed, LeafGreen | `live-adapters/mgba-gen3-live.lua` |

The Lua adapter serves:

```text
http://127.0.0.1:8080/snapshot
```

The web app calls:

```text
GET /api/live
```

which proxies to the local Lua server.

If you change a Lua script or any file under `live-adapters/generated/`, reload the script in mGBA. If live polling is stopped, the dashboard falls back to the uploaded save file.

More details and debug endpoints: [live-adapters/README.md](live-adapters/README.md).

## Use the Local LLM Assistant

The chat assistant is optional. It uses local Ollama and receives a compact context from the current save/live session: trainer, party, inventory, badges, location, Pokédex progress, and related local knowledge.

1. Install Ollama.
2. Pull the default model:

```bash
ollama pull gemma4:latest
```

3. Start Ollama:

```bash
ollama serve
```

4. Start the app:

```bash
corepack pnpm dev
```

5. Load a save or start live mode, then open **Chat AI**.

Optional environment variables:

```bash
OLLAMA_ENDPOINT=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:latest
OLLAMA_MAX_TOKENS=2048
OLLAMA_TEMPERATURE=0.7
OLLAMA_ENABLE_TOOLS=true
```

If the selected Ollama model does not support tool calls, the app falls back to prompt/context mode.

Details: [docs/chatbot-phase1.md](docs/chatbot-phase1.md) and [docs/llm-pokemon-agent.md](docs/llm-pokemon-agent.md).

## Test and Audit

```bash
corepack pnpm test
corepack pnpm audit:pokemon-data
```

Before promoting a new game to fully supported, update the support matrix and add fixtures/tests.

## Data Sources

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
corepack pnpm extract:pokemon-events -- --from-github
corepack pnpm extract:pokemon-event-contexts -- --from-github
corepack pnpm generate:pokemon-event-guides
corepack pnpm generate:pokemon-knowledge
```

Source policy and pins:

- [docs/pokemon-source-policy.md](docs/pokemon-source-policy.md)
- [docs/source-lockfile.md](docs/source-lockfile.md)

Event descriptions combine pinned PRET source occurrences with the reviewed multi-guide catalog in
`lib/pokemon/knowledge/sources/game-guide-sources.json`. The UI exposes the likely location, the meaning of
the current boolean state, expandable completion steps, and separate game-source/walkthrough links.

Do not patch generated knowledge files by hand. Update the source JSON/manifests and regenerate.

## Project Docs

- [live-adapters/README.md](live-adapters/README.md): using and debugging the mGBA scripts.
- [docs/architecture.md](docs/architecture.md): stable technical data flow.
- [docs/game-support-matrix.md](docs/game-support-matrix.md): per-game support status.
- [docs/known-issues.md](docs/known-issues.md): open limitations.
- [docs/source-lockfile.md](docs/source-lockfile.md): sources, pins, and offset notes.
- [AGENTS.md](AGENTS.md): operational notes for Codex/agents.
