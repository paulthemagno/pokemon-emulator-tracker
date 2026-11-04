# Local MCP companion

The read-only stdio server in `scripts/pokemon-mcp.ts` exposes the definitions and execution functions already in `lib/chatbot/tools/registry.ts`. It uses the official MCP TypeScript SDK. It does not call a model or change the tracker UI/provider, emulator memory, or save files.

For copy-and-paste Codex, Claude Code, and generic stdio client setup, start with [Connect Your Agent in the README](../README.md#connect-your-agent-mcp).

## Start and connect

Install dependencies and start the tracker as usual. Open the tracker at localhost and load a `.sav`/`.srm` file, or enable live mode with the game's Lua script running in mGBA. MCP follows the same `activeSaveData` selection displayed by the dashboard, including the existing live/save PC-box merge. Knowledge tools with an explicit `game` parameter work without the tracker or emulator.

For Codex, register once from the repository:

```bash
codex mcp add pokemon-tracker -- node --import /absolute/path/to/pokemon-emulator-tracker/node_modules/tsx/dist/loader.mjs /absolute/path/to/pokemon-emulator-tracker/scripts/pokemon-mcp.ts
```

Replace both absolute paths with this checkout's paths. The process changes its working directory to the repository before loading local data. `node` must be available on the client's PATH. Reload the client's MCP connections or start a new chat if tools are not visible in the current chat. Use `codex mcp list` to inspect registration. Remove with `codex mcp remove pokemon-tracker`.

Other MCP clients can launch that same command using stdio. For manual development, `corepack pnpm mcp:pokemon` starts it; it waits for MCP messages rather than printing a normal CLI interface. Logs go to stderr; stdout is reserved for the protocol.

`POKEMON_TRACKER_URL` defaults to `http://127.0.0.1:3000`. Only local HTTP addresses are accepted. Configure it in the MCP process environment if the tracker uses a different port. This does not publish a network MCP endpoint.

## Selected browser context

`useMcpContext` publishes the dashboard's context, including the complete selected `SaveData` under `context.fullState`, to the local-only `POST /api/mcp/context`. `GET /api/mcp/context` returns it to the MCP process. The endpoint validates the full-state containers without stripping optional parser fields, and accepts up to 8 MB. Data is held in server memory, with no save-file writes. Hosted demos and LAN hostnames do not publish to this local bridge; use localhost, 127.0.0.1, or IPv6 loopback. Cross-origin requests are rejected.

With multiple tracker tabs, the most recently focused/visible tab claims the selection. Background updates do not steal it. Per-tab sequence numbers reject out-of-order publications. Clearing the selected dashboard clears its MCP context. Closing the selected tab clears selection rather than silently switching to another tab's file. Updates are published at approximately one-second intervals, with a ten-second heartbeat for unchanged files. After 45 seconds without a browser heartbeat, `state.browserConnected` becomes false; the explicit selection is retained rather than discarded or replaced by another tab. Browser closure clears selection through a small pagehide message when delivered. If the browser crashes without sending it, the last selection remains until another page claims or clears it. Server restart clears all in-memory selections.

For a selected live session, `GET /api/mcp/context` refreshes through the same live service as the UI before returning context. MCP freshness is independent of background browser timer throttling. File selections never trigger emulator reads. Source/tab changes during an in-flight refresh win over the refresh, and older browser publications cannot overwrite a newer server snapshot. A failed live refresh remains explicitly stale with the last successful timestamp; it is never labelled fresh merely because a request was made.

The live adapters and browser polling are unchanged. The existing `/api/live` route only adds `Connection: close` for local requests and lets explicit `fresh=1` reads bypass its 500 ms failure backoff. Its existing timeout and stale-cache fallback remain in place; this does not guarantee uninterrupted reads from the emulator.

The existing interface still gives polling live data priority over an uploaded save. Stop live mode to display and share the uploaded file. MCP refreshes the emulator only when the UI's explicitly selected source is live.

## Existing tools and data freshness

All registry tools are exposed, including `get_evolution`, `get_learnset`, `get_encounters`, `get_item_location`, `search_game_guidance`, `get_trainer_status`, `get_party_overview`, `get_pokemon_details`, and `get_inventory_overview`. Use canonical English names for lookups and explicit game names such as `emerald`.

The existing state tools retain their names. `get_pokemon_details` now also accepts 1-based `boxIndex` plus `slotIndex` (or `pokemonName`), and returns the original Pokemon record, stats, IVs/EVs, and additional parser fields when present. `get_inventory_overview` also reports matching held items in the party and PC. `get_story_context` reports whether raw event flags are available.

`get_game_state` provides on-demand access to all retained sections: `summary`, `trainer`, `party`, `pcBoxes`, `inventory`, `events`, `pokedex`, `progressFacts`, `progressVariables`, and `location`. Array results have `offset`, `limit` (default 20, maximum 100), totals, and `hasMore`. Use `query` to filter items, Pokemon, or flag keys/labels. For PC boxes, omit `boxIndex` for summaries or specify it to inspect occupied slots while preserving their original slot numbers. Event records retain raw bits, interpreted completion, visibility/system semantics, and script provenance. An unset flag is not automatically an unfinished quest.

Emerald event data includes 854 indexed trainer battle records extracted from the pinned PRET `include/constants/opponents.h` and `TRAINER_FLAGS_START` in `include/constants/flags.h`. Each record carries its exact `TRAINER_*` key, `trainerId`, bit state, and source references. These records are classified as routine and do not increase key milestone totals. The event response's `coverage` field reports the number of included trainer records and the limits of interpreting them. See [source provenance](source-lockfile.md) for the source pin and [coverage gaps](known-issues.md) for outstanding work.

An unset team bit can represent an alternative starter/gender team, an unavailable rematch tier, or an unused/technical record. It must not automatically become a missing quest. An absent catalog entry means unknown; event totals count records rather than quests. Non-boolean choices, quest phases, counters, and special-mode progress require separate reviewed readers. Ruby/Sapphire and FireRed/LeafGreen indexed trainer records are not yet catalogued.

After a catalog update, reload an uploaded save or reconnect live mode to rebuild the selected context. Restart an already-running stdio MCP process to load updated tool code. The trainer victory range was already transmitted, but the added daily-state tail and reviewed raw variables require reloading the updated Gen 3 Lua script. An older adapter leaves unread values unavailable, not zero.

The shared packer preserves the full parser state for both the internal chatbot and MCP; it does not put that full state into model prompts or persisted chat history. Tool calls retrieve only requested sections. Offline Pokemon types and missing move metadata are enriched from the existing local species/move tables, with Gen 1 Magnemite/Magneton typing and the Gen 1–3 physical/special type split. The original records remain unchanged under `fullState`.

The browser uses `packGameContext` for either source. MCP results include `state.source` (`file` or `live`), `state.filename`, `state.updatedAt`, `state.ageSeconds`, `state.stale`, session identity, and connection errors. A file is a historical save snapshot and is not rejected because of its age. Live data that is cached, has no timestamp, or is older than five seconds is rejected by default. Set `allowStale: true` explicitly to inspect an older live snapshot; it remains labelled stale. The original snapshot timestamp is preserved rather than replaced with the time the context was packed. Reference lookups may use cached game identity, but do not treat cached player facts as live.

The server shares the existing knowledge limitations: base move power/accuracy is not fully version-specific; enriched move metadata is labelled as cross-game reference data. Hidden Power and moves without known power have an unknown category. Coins are currently absent from `SaveData` in both the parser and live normalizer, and remain unavailable rather than guessed. `get_game_state` summary reports exactly which fields are present. MCP does not add missing Lua fields or make emulator polling continuous. Inspect cited game-specific sources before historical damage calculations.

## Verification

Run `corepack pnpm test`. `tests/mcp.test.ts` checks registry reuse, file age handling, stale-live refusal and explicit override, and offline reference behavior. `tests/active-context.test.ts` checks source transitions, tab selection, out-of-order updates, clearing/expiry, and payload validation. `tests/full-game-context.test.ts` checks full-state preservation, metadata enrichment, party/PC detail, held items, and event provenance. Use an MCP client to verify initialization, `tools/list`, a reference lookup, and selected-file/live calls before claiming the connection is active.

## Reviewed raw quest variables

For Emerald, `get_game_state(section="progressVariables")` returns 18 reviewed 16-bit values with their exact `VAR_*` symbol, extracted ID, value, description, and pinned script references. Use `query`, `offset`, and `limit` as for other sections. `get_story_context` advertises availability and a lookup hint; the raw list is not added to model prompts. Unknown/absent values are unavailable, while an actual zero remains zero with its interpretation warning.

The selection covers roaming-species choice and its house-scene guards, Devon fossil revival, New Mauville generator state, and Trick House level, current phases, and pending rewards. Per-variable descriptions and pinned references are returned by the tool and retained in the [source metadata](../lib/pokemon/knowledge/sources/progress-variables.json); see also [event semantics](emerald-event-context.md). A default zero does not establish a chosen roamer, started quest, or collected prize. Ruby/Sapphire and FireRed/LeafGreen raw quest-variable selections remain unsupported.
