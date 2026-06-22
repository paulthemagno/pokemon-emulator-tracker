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
  <a href="#dashboard-overview">Overview</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#save-file-workflow">Save Files</a> •
  <a href="#live-emulator-workflow">Live mGBA</a> •
  <a href="#local-llm-assistant">LLM Assistant</a>
</p>

<p align="center">
  <img src="public/demo/fight.gif" width="720" alt="Pokemon Emulator Tracker battle demo" />
</p>

Pokemon Emulator Tracker is a local-first dashboard for Pokemon emulator runs. It turns save files and live mGBA memory into a readable trainer dashboard: party, HP, boxes, inventory, badges, Pokedex, map location, story flags, and current progress.

It supports two main workflows:

- **Save files:** upload `.sav`, `.srm`, `.sa1`, `.sa2`, `.sn1`, or `.sn2` files and inspect the run.
- **Live emulator tracking:** connect mGBA through a local Lua adapter and watch the dashboard update while the game is running.

An optional local Ollama assistant can answer questions about the currently loaded save or live session.

## Contents

- [Dashboard Overview](#dashboard-overview)
- [Quick Start](#quick-start)
- [Supported Games](#supported-games)
- [Save File Workflow](#save-file-workflow)
- [Live Emulator Workflow](#live-emulator-workflow)
- [Local LLM Assistant](#local-llm-assistant)
- [Test and Audit](#test-and-audit)
- [Data Sources](#data-sources)
- [Project Docs](#project-docs)

## Dashboard Overview

<p align="center">
  <img src="public/demo/overview.gif" width="720" alt="Pokemon Emulator Tracker dashboard overview" />
</p>

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

You can also try the hosted UI: [pokemon-emulator-tracker.vercel.app](https://pokemon-emulator-tracker.vercel.app/).

The hosted demo supports save upload and UI browsing. Live mGBA mode and Ollama stay local-only because Vercel cannot reach services running on your machine.

<details>
<summary>Install and LAN notes</summary>

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

</details>

## Supported Games

| Generation | Games | Save upload | mGBA live |
| --- | --- | --- | --- |
| Gen 1 | Red, Blue, Yellow | Supported | Supported |
| Gen 2 | Gold, Silver, Crystal | Supported | Supported |
| Gen 3 | Ruby, Sapphire, Emerald | Partial but usable | Partial but usable |
| Gen 3 | FireRed, LeafGreen | Partial but usable | Partial but usable |

See [docs/game-support-matrix.md](docs/game-support-matrix.md) for the detailed support matrix and current caveats.

## Save File Workflow

1. Start the app locally or open the hosted demo.
2. Drag a `.sav`, `.srm`, `.sa1`, `.sa2`, `.sn1`, or `.sn2` file into the upload area.
3. Inspect trainer data, party, Pokédex, PC boxes, inventory, badges, and map.
4. Re-upload the save after saving in-game to refresh the dashboard.

Filename hints matter when a raw save layout does not uniquely identify the game:

- Gen 1: include `red`, `blue`, or `yellow` in generic filenames.
- Gen 3: include `ruby`, `sapphire`, `emerald`, `firered`, or `leafgreen` in generic filenames.

The parser normalizes uploaded saves into the same model used by live mode, so the UI behaves the same after upload or live polling.

## Live Emulator Workflow

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

## Local LLM Assistant

The chat assistant is optional. It uses local Ollama and receives a compact context from the current save/live session: trainer, party, inventory, badges, location, Pokédex progress, and related local knowledge.

<p align="center">
  <img src="public/demo/llm-chat.gif" width="640" alt="Pokemon Emulator Tracker local LLM assistant demo" />
</p>

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

If the selected Ollama model does not support tool calls, the app falls back to prompt/context mode.

<details>
<summary>LLM configuration</summary>

Optional environment variables:

```bash
OLLAMA_ENDPOINT=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:latest
OLLAMA_EMBEDDING_MODEL=embeddinggemma:latest
OLLAMA_API_KEY=
OLLAMA_ALLOW_RUNTIME_ENDPOINT=false
OLLAMA_MAX_TOKENS=2048
OLLAMA_TEMPERATURE=0.7
OLLAMA_ENABLE_TOOLS=true
OLLAMA_THINKING=true
```

The chat header shows the effective model. Its settings panel can override the
model, a local endpoint, and an optional Bearer API key for the current page
session. Blank fields use the server environment values, and request API keys are
not stored in conversation history. Remote endpoint overrides require
`OLLAMA_ALLOW_RUNTIME_ENDPOINT=true`.

`OLLAMA_EMBEDDING_MODEL` selects the Ollama embedding model used by guide RAG
generation and runtime vector retrieval. It has no hidden default; set it before
generating embeddings. If you change it, regenerate the static guide embeddings
so document and query vectors are produced by the same model:

```bash
corepack pnpm generate:pokemon-guide-embeddings
```

JPEG, PNG, and WebP attachments work with vision-capable Ollama models. Audio
notes require a separate speech-to-text step and are not accepted yet.
Attached images are rendered in the chat and stored with the client-side
conversation. Models that support Ollama thinking can stream it into a
collapsible panel. Disable **Model thinking** in chat settings, or set
`OLLAMA_THINKING=false`, to request only the final answer.

</details>

Details: [docs/llm-pokemon-agent.md](docs/llm-pokemon-agent.md).

## Test and Audit

```bash
corepack pnpm test
corepack pnpm audit:pokemon-data
```

Before promoting a new game to fully supported, update the support matrix and add fixtures/tests.

## Data Sources

Pokemon data should stay local at runtime and have traceable sources. Generated files under `lib/pokemon/knowledge/` and `live-adapters/generated/` should not be edited by hand.

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

Source policy and pins:

- [docs/pokemon-source-policy.md](docs/pokemon-source-policy.md)
- [docs/source-lockfile.md](docs/source-lockfile.md)

Event descriptions combine pinned PRET source occurrences with reviewed walkthrough references from `lib/pokemon/knowledge/sources/game-guide-sources.json`.

## Project Docs

- [live-adapters/README.md](live-adapters/README.md): using and debugging the mGBA scripts.
- [docs/architecture.md](docs/architecture.md): stable technical data flow.
- [docs/game-support-matrix.md](docs/game-support-matrix.md): per-game support status.
- [docs/known-issues.md](docs/known-issues.md): open limitations.
- [docs/llm-pokemon-agent.md](docs/llm-pokemon-agent.md): local assistant tools, retrieval, and provider behavior.
- [docs/pokemon-source-policy.md](docs/pokemon-source-policy.md): source standards for Pokemon data.
- [docs/source-lockfile.md](docs/source-lockfile.md): sources, pins, and offset notes.
- [docs/progress-facts-prototype.md](docs/progress-facts-prototype.md): generated audit report for reviewed progress facts.
- [AGENTS.md](AGENTS.md): operational notes for Codex/agents.
