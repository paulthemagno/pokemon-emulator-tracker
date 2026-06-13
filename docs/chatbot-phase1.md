# Chatbot Phase 1

The app includes a local Ollama-backed chatbot that receives the current game state from an uploaded save or live emulator snapshot.

## Runtime Setup

Start Ollama and pull a model:

```bash
ollama pull gemma4:latest
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
OLLAMA_MODEL=gemma4:latest
OLLAMA_API_KEY=
OLLAMA_ALLOW_RUNTIME_ENDPOINT=false
OLLAMA_MAX_TOKENS=2048
OLLAMA_TEMPERATURE=0.7
OLLAMA_ENABLE_TOOLS=true
OLLAMA_THINKING=true
```

Set `OLLAMA_ENABLE_TOOLS=false` to force prompt-only context mode.
`OLLAMA_API_KEY` is sent as a Bearer token. A key entered in the chat settings
overrides the environment value for that request, remains only in React page
state, and is not written to IndexedDB or returned by `/api/chat`.

Runtime endpoint overrides are limited to localhost by default to reduce SSRF
risk. Enable remote overrides only with `OLLAMA_ALLOW_RUNTIME_ENDPOINT=true`.

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

- `get_move_reference`
- `search_game_guidance`
- `get_trainer_status`
- `get_story_context`
- `get_party_overview`
- `get_pokemon_details`
- `get_pokedex_overview`
- `get_pokedex_lookup`
- `get_inventory_overview`

If tool calling fails or is unsupported, the provider falls back to a compact text dump of the current game context.

## Current Context

The packed context includes trainer data, game/version, source, location, party, detailed party moves/items/status, badges, Pokedex progress, money, and inventory summaries.

The chatbot should answer from current state or tool results. Factual Pokemon data should move into local tools and generated datasets, not into a large system prompt.

`GET /api/chat` returns non-secret provider status and the effective model name.
Streaming responses begin with the same metadata. Image attachments use Ollama's
base64 `messages[].images` field and are limited to JPEG, PNG, or WebP files up to
5 MB in the UI.

Images are stored in the client-side `ChatMessage.attachments` array so they can
be rendered after sending and included in later multimodal turns. Total image
history accepted by the API is bounded to 24 MB.

When enabled, Ollama's separate `message.thinking` stream is stored on the
assistant message and rendered in a collapsed **Model thinking** section. The
**Enable model thinking** checkbox sends `think: false` when disabled, so Ollama
does not enter thinking mode; it also hides previously stored thinking.
`OLLAMA_THINKING=false` changes the server default.

The behavioral policy for future tools and RAG/fine-tuning work is in [docs/llm-pokemon-agent.md](llm-pokemon-agent.md).

## Limitations

- Ollama API only; authenticated Ollama endpoints work, but no separate OpenAI or
  Anthropic provider adapter exists yet.
- Vision depends on the selected model advertising image support; the UI does not
  detect that capability yet.
- Audio notes need a dedicated speech-to-text provider before chat ingestion.
- No long-term memory beyond IndexedDB conversation history.
- `get_move_reference` does not prove per-game learnsets. Encounters, evolution
  methods, and generation-specific type mechanics still need generated local tools.
