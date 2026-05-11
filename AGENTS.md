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

## Chatbot (Phase 1 - MVP) — COMPLETED WITH ENRICHMENT

In-app LLM chatbot integrated with game context. See `docs/chatbot-phase1.md` for full details.

### Phase 1.5 Enhancement (COMPLETED)

**Context Enrichment:**
- `GameContextSnapshot` now includes `partyPokemonDetailed` with full Pokemon details: moves (name, type, power, PP), ability, held item, status, nature, species
- `context-packer.ts` extracts all fields from SaveData
- `formatGameContext()` in ollama.ts displays tactical summary (types, HP%, status, moves with PP)

**System Prompt Improvement:**
- Changed from generic "helpful expert" to concrete co-pilot focused on battle/team advice
- Rules: Use only provided state, no generic encouragement, recommend one concrete action with reasoning, consider type effectiveness/HP/status/PP/levels/items
- Disables hallucination by explicit "ask for missing data instead of guessing"

**Result:** LLM responses now tactical and grounded in actual game state instead of generic.

### Phase 1.6 Enhancement (COMPLETED)

**Optional Tool/Function Calling (Ollama):**
- `lib/chatbot/providers/ollama.ts` now attempts tool-calling first when game context is available
- Built-in tools exposed to the model: `get_trainer_status`, `get_party_overview`, `get_pokemon_details`, `get_inventory_overview`
- Automatic fallback: if model/tool support is missing, provider falls back to standard prompt+context flow without breaking chat
- Config flag: set `OLLAMA_ENABLE_TOOLS=false` to disable tool-calling completely

### Components

```text
lib/chatbot/
  ├── types.ts                  # ChatProvider interface, GameContextSnapshot
  └── providers/
      └── ollama.ts            # Local Ollama implementation
  └── context-packer.ts        # Convert SaveData → GameContextSnapshot
hooks/
  └── use-conversation.ts      # Conversation state + IndexedDB persistence
app/api/chat/route.ts          # POST /api/chat endpoint
components/pokemon/
  └── chatbot-panel.tsx        # Modal chat UI with message thread
```

### How It Works

1. User clicks chat icon (💬) in header → `showChatbot` state toggles
2. `ChatbotPanel` mounts with `gameData={activeSaveData}`
3. Context packer converts game state → `GameContextSnapshot`
4. User types message → API POST `/api/chat` with message + history + context
5. `OllamaProvider.sendMessage()` calls Ollama at `127.0.0.1:11434`
6. Context injected into system prompt (trainer, location, party, badges, Pokédex, money)
7. Response displayed in message thread
8. `useConversation` auto-saves to IndexedDB (opt-in, per session)

### Phase 1 Scope (MVP)

- **Provider:** Ollama only (local, privacy-first)
- **Model:** Mistral or configurable via `OLLAMA_MODEL`
- **Context:** Trainer name, location, party, badges, Pokédex, money, inventory
- **Storage:** IndexedDB conversation history (client-side, opt-in save)
- **Attachments:** Screenshot support prepared (base64 field, UI button ready)

### Phase 1 Limitations

- ✗ No multi-provider (Phase 2: OpenAI, Anthropic, Gemini)
- ✗ No cloud LLM support (Phase 2)
- ✗ No vision/image analysis (Phase 2)
- ✗ No long-term memory (Phase 3: summarization, memory blocks)
- ✗ No model selector UI (Phase 2)

### Testing Phase 1

1. Start Ollama: `ollama serve`
2. Pull model: `ollama pull mistral`
3. Start dev server: `npm run dev`
4. Open http://localhost:3000 → upload save or start live mode
5. Click chat icon → test "What Pokemon are in my party?"

**Expected:** Response includes game context automatically.

**If "Ollama not connected" banner appears:** Check Ollama is running at `http://127.0.0.1:11434`.

### Configuration

- `OLLAMA_ENDPOINT`: Default `http://127.0.0.1:11434`
- `OLLAMA_MODEL`: Default `mistral`
- `OLLAMA_MAX_TOKENS`: Default `2048`
- `OLLAMA_TEMPERATURE`: Default `0.7`

### Notes for Future Agents

- Provider abstraction is extensible: new providers implement `ChatProvider` interface only
- IndexedDB schema can be migrated in `openDatabase()` `onupgradeneeded` handler
- Game context is stripped of sensitive data before persistence (`snapshotContextForStorage()`)
- Hook supports max history size limit (default 100 messages) to avoid quota issues
- No streaming yet; Phase 2 will add streaming responses from multi-provider support
