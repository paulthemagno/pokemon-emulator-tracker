# Agent Notes

These notes are for Codex or other agents picking up work in this repository.

## Main Rule

If you change setup, live adapters, maps, coordinates, endpoints, source data, or user workflow, update the relevant docs in the same change.

Usually update one or more of:

- `README.md`
- `live-adapters/README.md`
- `docs/architecture.md`
- `docs/game-support-matrix.md`
- `docs/known-issues.md`
- `docs/source-lockfile.md`
- `AGENTS.md`

## Current Project Shape

This is a Next/React app for Pokemon save tracking. It has two data sources:

- `.sav` / `.srm` uploads
- live emulator memory through `GET /api/live`

Current first-class support:

- Gen 1 Red/Blue/Yellow save parsing and mGBA live mode
- Gen 2 Gold/Silver/Crystal save parsing and mGBA live mode
- partial Gen 3 save parsing and Ruby/Sapphire/Emerald mGBA live mode

## Run And Verify

Install and start:

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

Tests and data audit:

```bash
corepack pnpm test
corepack pnpm audit:pokemon-data
```

After frontend changes, verify the dev server:

```bash
curl -I http://127.0.0.1:3000
```

If the server is not running:

```bash
./node_modules/.bin/next dev --hostname 0.0.0.0
```

In the sandbox, escalation may be required to bind `0.0.0.0:3000`.

## Live mGBA

Main files:

```text
live-adapters/mgba-gen1-live.lua
live-adapters/mgba-gen2-live.lua
live-adapters/mgba-gen3-live.lua
live-adapters/generated/gen1-live-offsets.lua
live-adapters/generated/gen2-live-offsets.lua
live-adapters/generated/gen3-live-offsets.lua
```

Load the right script from mGBA `Tools -> Scripting...`:

- Red/Blue/Yellow: `live-adapters/mgba-gen1-live.lua`
- Gold/Silver/Crystal: `live-adapters/mgba-gen2-live.lua`
- Ruby/Sapphire/Emerald: `live-adapters/mgba-gen3-live.lua`

The Lua scripts serve JSON on `127.0.0.1:8080`. The UI calls:

```text
GET /api/live
```

which is normalized by:

```text
lib/pokemon/live-normalizer.ts
```

If a Lua script or generated Lua offset file changes, reload the script in mGBA.

## Pokemon Research Workflow

For source audits, new game support, generated Pokemon data, and LLM tool-calling work, follow:

```text
agents/pokemon-research-agent/SKILL.md
```

Core docs:

```text
docs/pokemon-source-policy.md
docs/game-support-matrix.md
docs/llm-pokemon-agent.md
docs/source-lockfile.md
```

Generated knowledge commands:

```bash
corepack pnpm generate:pokemon-knowledge
corepack pnpm extract:pokemon-knowledge -- --pokecrystal /path/to/pokecrystal --pokegold /path/to/pokegold --pokered /path/to/pokered --pokeyellow /path/to/pokeyellow
```

Generated files under `lib/pokemon/knowledge/` and `live-adapters/generated/` must not be edited by hand. Update `lib/pokemon/knowledge/sources/*.json` and rerun the generator.

## Maps

The UI uses local maps in:

```text
public/maps/
```

Gen 1 Kanto town-map landmarks live in:

```text
lib/pokemon/data/gen1-map-landmarks.ts
```

Gen 2 map group/id conversion lives in:

```text
lib/pokemon/data/gen2-map-landmarks.ts
```

Do not use one global marker offset for every map. Gen 1 and Gen 2 maps have different source coordinate systems and conversion rules. Keep coordinates consistent with their source scripts/docs.

## Badge And UI Notes

- Badge sprites are local in `public/badges/`; do not hotlink Bulbagarden directly in the UI.
- Compact trainer cards should show short badge labels, not tooltip-only names.
- Pokemon stat labels should stay short and consistent: `Atk`, `Def`, `SpA`, `SpD`, `Spe`; Gen 1 uses `Spc`.
- Box navigation should show generic `Box N` fallback names. Do not put `Current` in the box name; use `isCurrent`.
- Gen 1 boxes are not player-named.

## Inventory Notes

- Gen 1 Red/Blue/Yellow use the shared supported US save inventory layout; PC item storage is `0x27E6`.
- Gen 2 Crystal save inventory offsets differ from TM/HM bytes; keep bag pockets aligned to `BAG_ITEMS`, `BAG_KEY_ITEMS`, `BAG_BALLS`, and `BAG_TMS_HMS`.
- Gen 2 TM/HM item IDs are not contiguous; use the generated `itemIds` list.
- Inventory "Show more" should visibly expand/collapse and not hide items behind a fixed-height scroll area.

## Chatbot

The chatbot uses local Ollama through:

```text
app/api/chat/route.ts
lib/chatbot/providers/ollama.ts
lib/chatbot/context-packer.ts
components/pokemon/chatbot-panel.tsx
```

Environment variables:

```text
OLLAMA_ENDPOINT
OLLAMA_MODEL
OLLAMA_MAX_TOKENS
OLLAMA_TEMPERATURE
OLLAMA_ENABLE_TOOLS
```

Keep factual Pokemon knowledge in local tools/data, not in prompt bloat or fine-tuned memorization. Details are in `docs/llm-pokemon-agent.md` and `docs/chatbot-phase1.md`.
