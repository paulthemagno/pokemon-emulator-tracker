# Phase 1 Chatbot Implementation

## Overview
Implemented MVP of an in-app LLM chatbot integrated with Pokemon game context from live emulator or save files.

## Architecture

### Core Components

#### Provider Interface (`lib/chatbot/types.ts`)
- `ChatProvider` interface for pluggable LLM providers
- `ChatMessage` and `ConversationState` types for conversation management
- `GameContextSnapshot` for packing game state into prompts

#### Ollama Provider (`lib/chatbot/providers/ollama.ts`)
- Connects to local Ollama instance (default: `http://127.0.0.1:11434`)
- Validates model availability on initialization
- Injects game context (trainer, location, party, badges, Pokédex, money) into system prompt
- Configurable model name, temperature, max tokens

#### Context Packer (`lib/chatbot/context-packer.ts`)
- `packGameContext()`: Converts SaveData or live snapshots to GameContextSnapshot
- `areContextsEqual()`: Deduplicates consecutive identical states
- `snapshotContextForStorage()`: Removes sensitive data before persistence

#### Conversation Hook (`hooks/use-conversation.ts`)
- `useConversation()`: Manages conversation state with IndexedDB persistence
- Auto-saves conversation history per session
- Loads previous conversations from IndexedDB
- Configurable max history size (default: 100 messages)
- Database-agnostic with graceful fallback if IndexedDB unavailable

#### API Route (`app/api/chat/route.ts`)
- POST `/api/chat` endpoint
- Accepts message, history, game context, optional system prompt
- Initializes Ollama provider on first request
- Returns error 503 if provider not ready
- Delegates to provider.sendMessage()

#### UI Component (`components/pokemon/chatbot-panel.tsx`)
- Modal chat interface with message thread
- Shows game state context when available (location, money)
- Sends Enter to submit, Shift+Enter for newline
- Displays loading spinner during LLM response
- Error handling with user-friendly messages
- Scrolls to bottom on new messages
- Disables input if Ollama not connected

#### Page Integration (`app/page.tsx`)
- Chatbot button in header (message icon)
- Opens/closes chatbot modal
- Passes `activeSaveData` to chatbot for context injection
- No conflicts with existing UI

## Testing Phase 1

### Prerequisites
1. **Ollama installed and running:**
   ```bash
   ollama serve
   ```
   (Default: http://127.0.0.1:11434)

2. **Model available:**
   ```bash
   ollama pull mistral
   ```
   (Or configure `OLLAMA_MODEL` env var for different model)

3. **Dev server running:**
   ```bash
   npm run dev
   ```

### Test Flow
1. Open http://localhost:3000
2. Upload a save file or start live emulator connection
3. Click the chat icon (💬) in header
4. Verify "Ollama connected" status (or error if not running)
5. Ask a question: "What Pokemon are in my party?"
6. Verify response includes game context
7. Check browser DevTools > Application > IndexedDB for saved conversations

### Expected Behavior
- **Without Ollama:** Yellow warning banner in chat panel
- **With Ollama:** Chat works immediately, context injected automatically
- **Context example in prompt:**
  ```
  Trainer: Ash
  Location: Cerulean City
  Money: ₽2500
  Playtime: 5h 23m 12s
  Badges: 3
  Pokédex: 45/151
  
  Party:
    Pikachu (Lv. 25) - 78/85 HP
    Bulbasaur (Lv. 20) - 62/62 HP
  ```

## Configuration

### Environment Variables (Optional)
```bash
OLLAMA_ENDPOINT=http://127.0.0.1:11434  # Default
OLLAMA_MODEL=mistral                     # Default
OLLAMA_MAX_TOKENS=2048                   # Default
OLLAMA_TEMPERATURE=0.7                   # Default
```

### Local Development
No additional setup needed beyond Ollama running. IndexedDB auto-initializes on first chat.

## Phase 1 Limitations (By Design)

- ✗ Multi-provider support (Phase 2)
- ✗ Cloud LLM APIs (Phase 2)
- ✗ Vision/screenshot analysis (Phase 2)
- ✗ Long-term memory/summarization (Phase 3)
- ✗ Model selector UI (Phase 2)
- ✗ API key management (Phase 2)
- ✓ Local-only, privacy-first
- ✓ Opt-in conversation history persistence
- ✓ Game context injection
- ✓ Manual screenshot support (base64 in context, UI attachment ready)

## Files Created

```
lib/chatbot/
  ├── types.ts                    # Interfaces and types
  └── providers/
      └── ollama.ts              # Ollama implementation
  └── context-packer.ts          # Context serialization
lib/chatbot/context-packer.ts    # (moved above)
hooks/
  └── use-conversation.ts        # Conversation state hook
app/api/chat/route.ts            # Chat endpoint
components/pokemon/
  └── chatbot-panel.tsx          # Chat UI modal
app/page.tsx                      # (modified - integrated chatbot)
```

## Next Steps (Phase 2)

1. **Multi-provider support:**
   - OpenAI, Anthropic, Google Gemini implementations
   - Provider selector in UI
   - API key management (secure storage in IndexedDB)

2. **Cloud LLM support:**
   - OpenAI compatibility layer for LM Studio, Perplexity, etc.
   - Streaming responses
   - Token budgeting

3. **Vision capabilities:**
   - Screenshot capture button in chat
   - Vision model selection
   - Image analysis context

4. **Long-term memory:**
   - Summarization of old conversations
   - Memory blocks indexed by game state
   - Cross-save memory linking

## Known Issues / Considerations

- Ollama must be running; no graceful degradation UI yet (banner only)
- IndexedDB quota per browser (typically 50MB+); pruning not implemented
- Screenshot capture requires browser permissions (not yet implemented)
- Model switching requires page reload (Phase 2 feature)
