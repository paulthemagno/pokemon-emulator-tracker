# Chatbot Phase 1

The app includes a local Ollama-backed chatbot that receives the current game state from an uploaded save or live emulator snapshot.

## Runtime Setup

Start Ollama and pull a model:

```bash
ollama pull mistral
ollama serve
```

Start the app:

```bash
corepack pnpm dev
```

Open `http://localhost:3000`, upload a save or start live mode, then open the chat panel.

## Configuration

Optional environment variables:

```text
OLLAMA_ENDPOINT=http://127.0.0.1:11434
OLLAMA_MODEL=mistral
OLLAMA_MAX_TOKENS=2048
OLLAMA_TEMPERATURE=0.7
OLLAMA_ENABLE_TOOLS=true
```

Set `OLLAMA_ENABLE_TOOLS=false` to force prompt-only context mode.

## Components

```text
app/api/chat/route.ts
components/pokemon/chatbot-panel.tsx
hooks/use-conversation.ts
lib/chatbot/context-packer.ts
lib/chatbot/providers/ollama.ts
lib/chatbot/types.ts
```

Flow:

```text
SaveData/live snapshot
  -> packGameContext()
  -> ChatbotPanel
  -> POST /api/chat
  -> OllamaProvider
  -> Ollama /api/chat
```

Conversation history is stored client-side in IndexedDB through `hooks/use-conversation.ts`.

## Current Tool Calls

When a model supports Ollama tool calls and game context exists, the provider exposes:

- `get_trainer_status`
- `get_party_overview`
- `get_pokemon_details`
- `get_inventory_overview`

If tool calling fails or is unsupported, the provider falls back to a compact text dump of the current game context.

## Current Context

The packed context includes trainer data, game/version, source, location, party, detailed party moves/items/status, badges, Pokedex progress, money, and inventory summaries.

The chatbot should answer from current state or tool results. Factual Pokemon data should move into local tools and generated datasets, not into a large system prompt.

The behavioral policy for future tools and RAG/fine-tuning work is in [docs/llm-pokemon-agent.md](llm-pokemon-agent.md).

## Limitations

- Ollama only; no cloud provider selector yet.
- No response streaming in the UI path yet.
- No vision/screenshot analysis yet.
- No long-term memory beyond IndexedDB conversation history.
- Available tool calls cover current game state, not full learnsets/encounters/type matchups yet.
