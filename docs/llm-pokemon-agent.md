# LLM Pokemon Agent

This document is the single reference for chatbot runtime setup and for improving answer
quality with source-backed Pokemon knowledge. It covers local provider configuration, tool
calling, PokeAPI extraction, walkthrough ingestion, retrieval, provenance, and the order in
which future work should be implemented.

The central rule is:

> The model interprets the question and explains the answer. Local tools provide factual
> Pokemon data, game progression facts, and the current save/live state.

Do not solve factual quality by adding large prompts or by fine-tuning facts into a model.

## Current State

The chatbot already has:

- local or remote Ollama-compatible endpoint support, with optional Bearer API key;
- optional image input and provider-specific thinking controls;
- current save/live state packed into the conversation;
- tool calling for selected Pokemon and game-state questions;
- generated event descriptions and game-guide source catalogs;
- indexed retrieval for catalogued Bulbapedia walkthrough sections;
- provider and model information exposed in the UI.

Current implementation entry points:

```text
app/api/chat/route.ts
lib/chatbot/providers/ollama.ts
lib/chatbot/tools/registry.ts
lib/chatbot/context-packer.ts
components/pokemon/chatbot-panel.tsx
lib/pokemon/data/pokemon-evolutions.ts
lib/pokemon/knowledge/
lib/pokemon/knowledge/sources/game-guide-sources.json
```

Tool definitions and handlers now live in `lib/chatbot/tools/registry.ts`. Ollama delegates to
that registry instead of owning provider-specific implementations. Reference tools can run
without a loaded save; state, inventory, Pokédex, and guide-progress tools require game context.

Implemented reference tools:

- `get_move` and compatibility alias `get_move_reference`;
- `get_species`;
- `get_type_matchup`, with explicit Generation 1 and Generation 2/3 charts;
- `get_evolution`, backed by a generated local PokeAPI snapshot.
- `get_learnset`, backed by a generated local PokeAPI snapshot.
- `get_encounters`, backed by a generated local PokeAPI snapshot.
- `get_item`, backed by local Gen 1-3 item tables plus generated PokeAPI descriptions.
- `get_item_location`, backed by reviewed walkthrough retrieval and optional active inventory checks.

Still pending:

- PRET-backed exact game-specific learnset extraction, encounter slots, and item placement;
- richer audited prerequisite planning inside `get_story_context`;
- support for non-Ollama provider APIs.

## Runtime Setup

Start Ollama and pull the chat and embedding models you want to use:

```bash
ollama pull gemma4:latest
ollama pull embeddinggemma:latest
ollama serve
```

Start the app:

```bash
corepack pnpm dev
```

Open `http://localhost:3000`, upload a save or start live mode, then open the chat panel.
Conversation history is stored client-side in IndexedDB.

Optional environment variables:

```text
OLLAMA_ENDPOINT=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:latest
OLLAMA_EMBEDDING_MODEL=embeddinggemma:latest
OLLAMA_API_KEY=
OLLAMA_ALLOW_RUNTIME_ENDPOINT=false
OLLAMA_MAX_TOKENS=-1
OLLAMA_TEMPERATURE=0
OLLAMA_ENABLE_TOOLS=true
OLLAMA_THINKING=true
```

`OLLAMA_MAX_TOKENS=-1` is passed to Ollama as `num_predict: -1`, which means no
explicit response cap. Positive numeric values are still accepted when you want a
hard response cap.

`OLLAMA_ENABLE_TOOLS=false` forces prompt-only context mode. If the selected Ollama model
does not support tool calls, the provider also falls back to compact context mode.

`OLLAMA_API_KEY` is sent as a Bearer token. A key entered in chat settings overrides the
environment value for that request, remains only in React page state, and is not written to
IndexedDB or returned by `/api/chat`.

Runtime endpoint overrides are limited to localhost by default. Enable remote overrides only
with `OLLAMA_ALLOW_RUNTIME_ENDPOINT=true`.

`OLLAMA_EMBEDDING_MODEL` has no hidden default. Static guide embeddings and runtime query
embeddings must use the same embedding model, dimension count, and normalization. Regenerate
the guide vectors after changing it:

```bash
corepack pnpm generate:pokemon-guide-embeddings
```

`GET /api/chat` returns non-secret provider status and the effective model name. Streaming
responses begin with the same metadata.

JPEG, PNG, and WebP image attachments use Ollama's base64 `messages[].images` field and are
limited to 5 MB in the UI. They are stored in `ChatMessage.attachments`, rendered in chat after
sending, and included in later multimodal turns. Total image history accepted by the API is
bounded to 24 MB. Vision depends on the selected model advertising image support; the UI does
not detect that capability yet.

When enabled, Ollama's separate `message.thinking` stream is stored on the assistant message and
rendered in a collapsed **Model thinking** section. The **Enable model thinking** checkbox sends
`think: false` when disabled, so Ollama does not enter thinking mode. `OLLAMA_THINKING=false`
changes the server default.

Audio notes need a dedicated speech-to-text provider before chat ingestion.

## Target Architecture

```text
chat provider
    -> shared tool registry
        -> current game-state tools
        -> Pokemon reference tools
        -> progression and guide retrieval tools
            -> generated local datasets and indexes
                -> PRET repositories
                -> PokeAPI build-time snapshots
                -> reviewed walkthrough pages
```

Rules:

- tools are provider-independent;
- remote sources are accessed during generation or research, not during a normal chat request;
- the model never receives entire remote API responses or entire walkthrough pages;
- every factual tool result includes source provenance and limitations;
- current progress is derived server-side from the uploaded save or live state;
- the model must not invent completed flags, inventory, party state, or story progress.

## Canonical Game Profiles

Tool arguments use the application slug. Generated event, guide, and save-layout records use the
language-specific knowledge profile. These identifiers are related but not interchangeable.
Never accept an ambiguous generation number when the answer depends on a specific game.

```ts
type GameProfile =
  | "red-blue"
  | "yellow"
  | "gold-silver"
  | "crystal"
  | "ruby-sapphire"
  | "emerald"
  | "firered-leafgreen";
```

| Application slug | Knowledge profile | Generation | PokeAPI version group | Primary PRET source |
| --- | --- | ---: | --- | --- |
| `red-blue` | `red-blue-en` | 1 | `red-blue` | `pret/pokered` |
| `yellow` | `yellow-en` | 1 | `yellow` | `pret/pokeyellow` |
| `gold-silver` | `gold-silver-en` | 2 | `gold-silver` | `pret/pokegold` |
| `crystal` | `crystal-en` | 2 | `crystal` | `pret/pokecrystal` |
| `ruby-sapphire` | `ruby-sapphire-en` | 3 | `ruby-sapphire` | `pret/pokeruby` |
| `emerald` | `emerald-en` | 3 | `emerald` | `pret/pokeemerald` |
| `firered-leafgreen` | `firered-leafgreen-en` | 3 | `firered-leafgreen` | `pret/pokefirered` |

The route should infer the profile from the current save/live state when possible. If the user
asks about another game explicitly, the explicit game wins only for reference questions; it
must not replace the active game's progress context. `GameContextSnapshot` currently exposes
`gameTitle` but not a canonical profile, so a later context change should add explicit
`gameProfile` and `knowledgeProfile` fields rather than repeatedly parsing a display title.

## Source Responsibilities

| Source | Use it for | Do not use it for |
| --- | --- | --- |
| Current save/live state | party, inventory, badges, position, event completion, immediate context | generic game facts |
| PRET disassemblies | exact Gen 1-3 mechanics, learnsets, encounters, item locations, event scripts and flags | prose walkthrough explanations |
| PokeAPI | normalized species, moves, types, evolution metadata, version-group cross-checks | current player state or authoritative story order |
| Reviewed walkthroughs | route intent, puzzle explanation, player-facing next steps, version-specific warnings | exact internal flags without PRET confirmation |

For game-specific Gen 1-3 facts, PRET remains authoritative. PokeAPI is a useful normalized
source and cross-check, but it must not silently replace version-specific source data.

## Shared Tool Result Contract

Every knowledge tool should return the same envelope:

```ts
type KnowledgeToolResult<T> = {
  ok: boolean;
  tool: string;
  gameProfile?: string;
  data?: T;
  sources: Array<{
    kind: "save-state" | "pret" | "pokeapi" | "walkthrough";
    name: string;
    url?: string;
    commit?: string;
    sourceRevision?: string;
    retrievedAt?: string;
    scope?: string;
  }>;
  limitations: string[];
  confidence: "source-backed" | "cross-checked" | "unresolved";
  error?: {
    code: "INVALID_ARGUMENT" | "NOT_FOUND" | "AMBIGUOUS_GAME" | "UNSUPPORTED_GAME";
    message: string;
  };
};
```

`data` is the only canonical payload for successful tool-specific fields. Consumers should not
expect tool-specific fields at the top level.

Runtime enforcement:

- tool call arguments are described to Ollama through each tool's JSON Schema `parameters`;
- tool results are produced by the app, not by the model, so they are validated locally with Zod
  before being sent back to Ollama;
- Ollama's `format` JSON Schema support is reserved for assistant-generated structured
  responses. The normal chat path does not force final answers into JSON because the UI expects
  natural-language Markdown.

Tool output must be compact and bounded. Return the rows needed for the answer, not a complete
database dump. Names should be normalized internally while preserving display names.

### Tool Response Data Shapes

These are the canonical `data` payloads returned inside `KnowledgeToolResult<T>`.

| Tool | Canonical `data` shape |
| --- | --- |
| `get_move`, `get_move_reference` | `{ id, name, type, power, accuracy, pp, effect?, flavorText?, appliesTo }` |
| `get_species` | `{ id, name, introducedGeneration, types, growthRate, baseStats }` |
| `get_type_matchup` | `{ generation, attackingType, move?, defenderSpecies?, defenderTypes, factors, multiplier, effectiveness }` |
| `get_evolution` | `{ species: { id, name }, direction, evolvesFrom, evolvesTo }` |
| `get_learnset` | `{ species: { id, name }, game, methods, requestedMove?, learnsMove?, levelMax?, totalMatches, returnedMatches, entries }` |
| `get_encounters` | `{ summary, game, requestedSpecies, requestedLocation, requestedMethod, requestedTimeOfDay, totalMatches, returnedMatches, locationSummaries, entries, answerPolicy }` |
| `get_item` | `{ query, game, totalMatches, returnedMatches, entries }` |
| `get_item_location` | `{ item, aliases, game, inventoryMatches, matches, answerPolicy }` |
| `search_game_guidance` | `{ query, canonicalQuery, keywords, requestedGame, game, matchedProfiles, matches, generalGuideSources, retrievalMode, embeddingModel, answerPolicy }` |
| `get_trainer_status` | `{ trainerName, location, money, badges, pokedexSeen, pokedexOwned, gameTitle, playtime }` |
| `get_party_overview` | `{ count, party }` |
| `get_story_context` | `{ facts }` |
| `get_pokedex_overview` | `{ gameTitle, seen, owned, completionVsSeenPercent }` |
| `get_pokemon_details` | `{ name, species, level, hp, maxHp, status, types, ability?, nature?, heldItem?, moves }` |
| `get_inventory_overview` | `{ query, totalUniqueItems, totalItemCount, returnedItems, items }` |
| `get_pokedex_lookup` | `{ name, nationalDexId, seen, caught }` |

Common nested rows:

```ts
type LearnsetEntry = {
  moveId: number;
  move: string;
  method: "level-up" | "machine" | "tutor" | "egg" | string;
  level?: number;
};

type EncounterLocationSummary = {
  location: string;
  locationArea: string;
  methods: string[];
  levelRanges: string[];
  bestChance: number;
  species?: string[];
};

type EncounterEntry = {
  speciesId: number;
  species: string;
  locationAreaId: number;
  location: string;
  locationArea: string;
  method: string;
  minLevel: number;
  maxLevel: number;
  chance: number;
  conditions: string[];
};

type GuidanceMatch = {
  retrieval?: {
    matchedTerms?: string[];
    matchedPhrases?: string[];
    coverage?: number;
    embeddingScore?: number;
    embeddingModel?: string;
  };
  knowledgeProfile: string;
  game: string;
  event: string;
  description?: string;
  actionHint?: string;
  location?: string;
  steps?: string[];
  prerequisites?: string[];
  normalMissingReason?: string;
  sourceRefs: string[];
  audited: boolean;
  walkthrough?: {
    source: string;
    part: number;
    section: string;
    parentSection?: string;
    revision?: string | number;
  };
};
```

## Tool Catalog

This catalog includes both currently exposed runtime tools and planned tools. The source of
truth for implemented runtime definitions is `lib/chatbot/tools/registry.ts`.

| Tool | Status | Requires loaded save/live state | Purpose | Primary source |
| --- | --- | --- | --- | --- |
| `get_move` | Implemented | No | Look up Gen 1-3 move type, power, accuracy, PP, effect, and version-group flavor text. | Local move table plus generated PokeAPI move descriptions |
| `get_move_reference` | Implemented compatibility alias | No | Backward-compatible alias for `get_move` using `moveName`. | Same as `get_move` |
| `get_species` | Implemented | No | Look up species National Dex ID, types, growth rate, and reference stats. | Local species table |
| `get_type_matchup` | Implemented | No, if `game` or `generation` is supplied | Calculate Gen 1, 2, or 3 type effectiveness, including Gen 1 differences. | Local type charts |
| `get_evolution` | Implemented | No | Look up Gen 1-3 evolution relationships and trigger conditions. | Generated local PokeAPI evolution snapshot |
| `get_learnset` | Implemented | No | Query per-game level-up, TM/HM, tutor, and egg move learnsets. | Generated local PokeAPI learnset snapshot |
| `search_game_guidance` | Implemented | No | Retrieve source-backed walkthrough/event guidance with lexical or hybrid vector search. | Audited event guidance, generated event guides, Bulbapedia walkthrough index, optional guide embeddings |
| `get_trainer_status` | Implemented | Yes | Return current trainer, location, money, badges, playtime, and basic progress state. | Current save/live context |
| `get_party_overview` | Implemented | Yes | Return current party summary with HP, level, status, and types. | Current save/live context |
| `get_story_context` | Implemented | Yes | Return source-backed permanent choices, current phases, and known next-step facts. Future prerequisite planning should extend this tool instead of adding a separate overlapping story-step tool. | Current save/live context plus generated progress facts |
| `get_pokedex_overview` | Implemented | Yes | Return seen/caught totals and completion summary. | Current save/live context |
| `get_pokemon_details` | Implemented | Yes | Return detailed party Pokémon data by name or party index. | Current save/live context |
| `get_pokedex_lookup` | Implemented | Yes | Check whether a specific species has been seen or caught. | Current save/live context |
| `get_inventory_overview` | Implemented | Yes | Return inventory summary and optionally filtered item list. | Current save/live context |
| `get_encounters` | Implemented | No | Query per-game wild encounter availability by location/species/method/time. | Generated local PokeAPI encounter snapshot |
| `get_item` | Implemented | No | Look up item metadata by name or ID. | Local item tables plus generated PokeAPI item descriptions |
| `get_item_location` | Implemented | Optional | Find where an item/TM/HM is obtained and optionally compare with current inventory. | Reviewed walkthrough retrieval |

### Pokemon reference

```ts
get_species({
  species: string | number,
  game?: GameProfile
})

get_move({
  move: string | number,
  game?: GameProfile
})

get_type_matchup({
  attackingType?: string,
  move?: string,
  defenderSpecies?: string,
  defenderTypes?: string[],
  game?: GameProfile,
  generation?: 1 | 2 | 3
})

get_evolution({
  species: string | number,
  game?: GameProfile,
  direction?: "from" | "to" | "both" // default: both
})
```

Generation is mandatory for type calculations if no game is supplied because type charts and
move behavior vary by generation.

### Learnsets and encounters

```ts
get_learnset({
  species: string | number,
  game: GameProfile,
  methods?: Array<"level-up" | "machine" | "tutor" | "egg">,
  move?: string | number,
  levelMax?: number,
  limit?: number // default: 50, maximum: 100
})

get_encounters({
  game: GameProfile,
  location?: string,
  species?: string | number,
  method?: string,
  timeOfDay?: "morning" | "day" | "night",
  limit?: number // default: 30, maximum: 100
})
```

`get_learnset` and `get_encounters` currently use generated local PokeAPI snapshots. PRET-backed
extraction remains the target for stricter source parity, especially exact encounter slot tables,
map-specific encounter rates, and edge cases that PokeAPI normalizes.

### Items

```ts
get_item({
  item: string | number,
  game?: GameProfile
})

get_item_location({
  item: string | number,
  game: GameProfile,
  canonicalQuery?: string,
  obtainedOnly?: boolean, // default: false
  limit?: number // default: 5, maximum: 8
})
```

`get_item` uses local Gen 1-3 item IDs and generated PokeAPI descriptions. `get_item_location`
retrieves reviewed walkthrough sections and, when save/live context is present, can report active
inventory matches. It does not yet use exact PRET item placement or hidden-item flag extraction.

### Progression and walkthrough retrieval

```ts
search_game_guidance({
  query: string,
  canonicalQuery?: string,
  keywords?: string[],
  game?: GameProfile,
  limit?: number // default: 5, maximum: 8
})
```

General walkthrough questions should use `search_game_guidance`. Current-save story questions
should use `get_story_context`. If we later add prerequisite planning, it should enrich
`get_story_context` with source-backed candidate steps rather than introduce a second overlapping
story-progress tool.

`search_game_guidance` is the runtime RAG entry point for general walkthrough
questions. It first scopes the search by `game` when the model or loaded save
provides one, then searches the local source-backed guide corpus. `query` is the
user's original question. `canonicalQuery` should contain official English
source terms for the entities and objectives that the user actually mentioned,
such as location, character, item, Pokemon, route, or objective names.
`canonicalQuery` must not include solution details that should be discovered
from retrieval. For example, "How do I clear Mirage Tower in Pokemon Emerald?"
should be rewritten as "Mirage Tower Pokemon Emerald walkthrough", not as a
query that already includes "Mach Bike", "Rock Smash", or fossils. `keywords`
can add official aliases and named entities present in the question. For example,
"Pokemon Crystal League teams" can use "Pokemon Crystal Elite Four teams" with
keywords such as "Pokemon League" and "Elite Four", but should not include the
Elite Four member names or their Pokemon unless the user mentioned them. The
retriever uses a
hybrid score when `OLLAMA_EMBEDDING_MODEL` is configured and generated
walkthrough vectors are present: the Ollama provider embeds the query at runtime,
then `search_game_guidance` combines vector similarity with field-weighted
lexical scoring over titles, parent headings, part topics, section body text,
and exact source URLs. Lexical term weights are derived from corpus frequency, so
common words naturally contribute less without maintaining language-specific
intent-word lists. If query embeddings are unavailable, the tool falls back to
lexical retrieval. Each returned match includes retrieval metadata showing
matched terms, matched phrases, coverage, and, when used, `embeddingScore` and
`embeddingModel`, so logs can explain why a section was selected.

## PokeAPI Extraction Contract

Official API documentation: [PokeAPI v2](https://pokeapi.co/docs/v2).

PokeAPI is GET-only and does not require an API key. Its fair-use guidance asks clients to cache
resources locally. Therefore this project should consume it in a generator, commit or package the
generated output, and never depend on PokeAPI availability for a chat response.

Relevant endpoints:

```text
/api/v2/pokemon/{id-or-name}/
/api/v2/pokemon-species/{id-or-name}/
/api/v2/evolution-chain/{id}/
/api/v2/move/{id-or-name}/
/api/v2/item/{id-or-name}/
/api/v2/type/{id-or-name}/
/api/v2/location/{id-or-name}/
/api/v2/location-area/{id-or-name}/
/api/v2/version-group/{id-or-name}/
/api/v2/machine/{id}/
```

List endpoints use:

```text
limit=<positive integer>
offset=<zero-based integer>
```

Extraction rules:

1. Resolve resources by canonical name or numeric ID.
2. Filter nested version data by the exact PokeAPI version-group name from the profile table.
3. For learnsets, filter `version_group_details` by both version group and learn method.
4. For localized text, prefer English and store the selected language explicitly.
5. Traverse evolution chains recursively and retain trigger conditions, not only species names.
6. Store the endpoint, extraction date, generator version, and a content hash with generated data.
7. Reject unversioned current-generation facts when the question targets an older game.
8. Cache raw responses outside runtime data so generators can be rerun without unnecessary calls.

Recommended generator parameters:

```text
--profiles red-blue,yellow,gold-silver,crystal,ruby-sapphire,emerald,firered-leafgreen
--resource species|moves|types|evolutions|items|locations|all
--concurrency 4
--delay-ms 250
--timeout-ms 15000
--retries 2
--from-cache
--refresh
--dry-run
```

These are generator controls, not chatbot request parameters. Conservative defaults should be
used even though PokeAPI currently has no authentication or published per-key quota.

## Walkthrough Source Catalog

The reviewed catalog remains:

```text
lib/pokemon/knowledge/sources/game-guide-sources.json
```

Do not create a separate file for every guide. Extend the catalog format when ingestion is
implemented. A source record should eventually support:

```ts
type GuideSource = {
  id: string;
  title: string;
  rootUrl: string;
  kind: "mediawiki" | "query-paged" | "path-paged" | "manual";
  games: GameProfile[];
  allowedUrlPrefixes: string[];
  pageTitlePrefixes?: string[];
  queryParameters?: Record<string, {
    allowedValues?: string[];
    discoverFromRoot?: boolean;
  }>;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxDepth: number;
  versionNotes?: string;
  usageNote?: string;
  lastReviewedAt: string;
};
```

URLs and child pages must be discovered from the reviewed root page. Do not generate arbitrary
URLs from guessed page numbers or slugs.

### Bulbapedia

Example root:
[Pokemon Crystal walkthrough](https://bulbapedia.bulbagarden.net/wiki/Walkthrough%3APok%C3%A9mon_Crystal).

The root links to `/Part_N` pages, and each part contains location and event sections. Prefer the
MediaWiki Action API where the site endpoint permits it:

```text
api.php
  ?action=parse
  &page=<page title>
  &prop=text|links|tocdata|revid|displaytitle
  &redirects=1
  &format=json
  &formatversion=2
```

Use `section=<section id>` when extracting one selected section. `tocdata` should be used instead
of the deprecated `sections` property. Follow only discovered walkthrough-part links with the
reviewed title prefix.

### StrategyWiki

Example root:
[Pokemon Crystal](https://strategywiki.org/wiki/Pok%C3%A9mon_Crystal).

The table of contents links to granular route and location pages. Some Crystal entries legitimately
point to shared Gold/Silver pages, such as the Radio Tower guide. Therefore:

- follow the table-of-contents link target instead of constructing a Crystal URL;
- record `games` and `versionNotes` independently from the URL path;
- tag version-specific statements inside shared pages;
- use the same MediaWiki API parameters as above when available.

### Psypoke

Example root:
[Gold/Silver/Crystal walkthrough](https://www.psypokes.com/gsc/walkthrough.php).

This walkthrough uses a query parameter:

```text
walkthrough.php?part=<part number>
```

The reviewed GSC root currently exposes parts `1` through `12`. Allowed values must be discovered
from actual root links and saved in the catalog; they must not be inferred by incrementing until a
request fails. Canonicalization must retain the `part` parameter, discard unrelated tracking
parameters, and sort any retained query parameters.

### Thonky

Example root:
[Ruby/Sapphire/Emerald walkthrough](https://www.thonky.com/pokemon-ruby-sapphire-emerald/).

The root links to same-prefix location slugs such as `sootopolis-city`, `seafloor-cavern`, and
`weather-institute`. Follow only links under the catalogued path prefix. Use page headings as
semantic sections; previous/next links can validate ordering but should not expand the crawl
beyond the root allowlist. Preserve Ruby, Sapphire, and Emerald applicability when a paragraph is
version-specific.

### Game8 and other manual sources

Dynamic checklist or heavily templated sites should start as `manual` sources with explicit
allowlisted pages. Do not add a broad crawler merely because the domain contains useful guides.
Promote a source to an automatic adapter only after its navigation, canonical URLs, version scope,
and extraction stability have been reviewed.

MediaWiki parsing parameters are documented by
[MediaWiki: Parsing wikitext](https://www.mediawiki.org/wiki/API:Parsing_wikitext).

## Guide Ingestion Parameters

Recommended command shape:

```text
generate:pokemon-guides
  --profiles crystal,emerald
  --source bulbapedia-crystal
  --max-pages 40
  --max-depth 2
  --concurrency 2
  --delay-ms 750
  --timeout-ms 15000
  --retries 2
  --chunk-target-chars 2500
  --chunk-max-chars 5000
  --from-cache
  --refresh
  --dry-run
```

Required behavior:

- `--profiles` and `--source` limit scope; omitted values use catalogued sources only;
- `--max-pages` is a hard stop per source;
- `--max-depth` is measured from the reviewed root;
- `--concurrency` defaults to `2`;
- `--delay-ms` defaults to `750` per domain;
- `--timeout-ms` defaults to `15000`;
- `--retries` defaults to `2` with backoff;
- cache entries are keyed by canonical URL and relevant request parameters;
- `--refresh` revalidates cached pages;
- `--dry-run` reports discovered and rejected URLs without writing generated data.

Each adapter must set a descriptive User-Agent, respect site access rules, and produce an audit
report listing accepted pages, rejected pages, redirects, errors, and content changes.

## Guide Chunk Schema

Generated retrieval records should be compact, section-based, and traceable:

```ts
type GuideChunk = {
  id: string;
  gameProfiles: GameProfile[];
  sourceId: string;
  canonicalUrl: string;
  pageTitle: string;
  sectionPath: string[];
  ordinal: number;
  summary: string;
  entities: {
    locations: string[];
    characters: string[];
    items: string[];
    badges: string[];
    events: string[];
  };
  storyPhase?: string;
  appliesTo: string[];
  sourceRevision?: string;
  contentHash: string;
  extractedAt: string;
};
```

Store concise factual summaries and small necessary excerpts, not mirrored walkthrough pages.
Section boundaries are preferable to blind fixed-size splitting. If a section is too long, target
about `2500` characters and never exceed `5000`, with only enough overlap to preserve a sentence
or list context.

## Retrieval Strategy

Retrieval should be deterministic before it becomes semantic:

1. Filter by exact game profile.
2. Filter or boost the current location, story phase, badges, and unresolved event symbols.
3. Rank exact entity and heading matches.
4. Apply lexical ranking such as BM25 or trigram matching.
5. Return at most `3-5` guide chunks to the model.
6. Add embeddings only after the lexical baseline has measurable gaps.

Event symbols extracted from PRET are strong join keys. A guide chunk about the Radio Tower can be
linked to reviewed event descriptions for the same location and then compared with the player's
completed flags.

For a major progression recommendation:

- the completion state must come from save/live data;
- the required event relationship must come from PRET-derived event knowledge;
- the player-facing explanation should cite at least one reviewed guide;
- conflicting or version-ambiguous guides must be surfaced as a limitation, not silently merged.

## Prompt And Tool Policy

The system prompt should remain short:

- use tools for factual Pokemon or progression claims;
- use the active game profile unless the user explicitly asks about another game;
- distinguish known current state from general advice;
- cite the compact source labels returned by tools;
- state when the available data cannot resolve a question;
- never claim that an action is completed unless the current state confirms it.

The tool loop should have hard limits:

```text
maximum tool rounds per response: 6
maximum results from one retrieval tool: 8
maximum guide chunks passed to the model: 5
maximum repeated identical tool call: 1
```

Invalid arguments should produce structured errors that the model can correct once. Repeating the
same failing call should end tool execution and produce an honest user-facing limitation.

## Multimodal Inputs

Images and audio are conversation inputs, not authoritative game-state sources.

- screenshots may help identify a location, menu, Pokemon, or visible error;
- visual claims should be confirmed with current state or reference tools when possible;
- audio notes should be transcribed before they enter the normal chat/tool pipeline;
- provider capability checks must reject unsupported image or audio input clearly;
- attachments should have size, count, MIME type, and timeout limits.

Do not persist attachments or transcripts unless a user-facing history feature explicitly requires
it and its privacy behavior is documented.

## Provenance And Copyright

Generated records must retain:

- source name and canonical URL;
- source commit or page revision when available;
- extraction date;
- generator version or content hash;
- game/version scope;
- known limitations.

Walkthrough ingestion is retrieval support, not guide republication. Store structured facts,
short summaries, headings, entities, and minimal excerpts. Do not copy complete articles or expose
large source passages through a tool response.

## Implementation Order

### Phase 1: shared reference tools

- consolidate provider tool handling behind one registry; **implemented for Ollama**
- add canonical `gameProfile` and `knowledgeProfile` values to the packed game context;
- implement species, move, type, and evolution tools; **implemented**
- add the common result envelope; **implemented**
- display tool source details in the chat UI; **implemented for guidance responses**
- test argument validation, generation differences, and bounded output; **initial coverage implemented**

### Phase 2: PokeAPI generator

- add cached build-time extraction;
- map all supported profiles to exact version groups;
- generate normalized species, move, type, and evolution records;
- record endpoint provenance and audit generated output.

### Phase 3: walkthrough index

- extend `game-guide-sources.json` rather than creating per-guide config files;
- implement MediaWiki, query-paged, path-paged, and manual adapters; **Bulbapedia MediaWiki adapter implemented**
- generate chunks, entity metadata, and a source audit; **implemented for Bulbapedia**
- implement `search_game_guidance`; **implemented**

Run `corepack pnpm generate:pokemon-guides` to discover the real `Part N` links from each
catalogued Bulbapedia root and regenerate `lib/pokemon/knowledge/walkthrough-index.json`.
Each compact record keeps the part number, part topic list, section and parent titles, factual
section text, page revision, and a source URL anchored to the exact heading. The chat searches
titles, parent headings, part topics, exact URLs, and body text with weighted lexical scoring.
Model-supplied canonical English terms and keywords are used as stronger retrieval hints for
questions in any language. Guide-style questions should prefer these walkthrough sections over raw
event flags; event flags remain useful supporting evidence for save-state meaning and
version-specific script claims. Runtime chat requests do not fetch Bulbapedia.

Successful walkthrough results expose source metadata separately from the model text. The chat API
returns those source links as `sources`, and the UI renders them under the assistant message in a
collapsible "Sources used" block. This keeps citations deterministic even when a local model omits
or mistranslates source labels.

Reading a live online guide page during chat should be an explicit future mode, not the default.
The recommended flow is: search the local index first; if no adequate section is available or the
user wants the current remote page, ask for permission to fetch the exact URL, clean and cache the
page, then pass only the relevant sections or a bounded full-page excerpt with the source URL and
revision. Avoid passing raw HTML or unbounded article text to a local model.

Successful guide results are also stored on the assistant message as hidden `knowledgeContext`.
Follow-up questions first use this retained, source-backed context without another tool call. If
the retained context is unrelated or insufficient, the model returns `NEED_TOOL` internally and
the normal tool-selection flow resumes. This context is evidence supplied to the model, not hidden
chain-of-thought, and it is not rendered in the chat UI.

### Phase 4: exact game data

- expand PRET extraction for encounters, item locations, and stricter learnset parity;
- implement the corresponding tools;
- use PokeAPI only for normalization and cross-checking.

### Phase 5: progression planner

- connect current normalized events to guide chunks;
- compute unmet prerequisites outside the model;
- enrich `get_story_context` with source-backed candidate next steps when prerequisites can be
  audited;
- add regression cases for badges, optional routes, version differences, and postgame boundaries.

### Phase 6: answer trace UI

- show which tools ran without exposing hidden chain-of-thought;
- show compact source links and the responding provider/model;
- distinguish source-backed answers from unresolved or generic model advice.

## Definition Of Done

A tool or source adapter is complete only when:

- its arguments, defaults, limits, and errors are documented;
- output uses the shared result contract;
- game-version filtering is tested;
- provenance is visible in tool output;
- generated data has a deterministic audit;
- runtime chat works without network access to the source;
- unsupported or ambiguous cases fail explicitly;
- relevant README or architecture links are updated if the user workflow changes.

Verification should include:

```bash
corepack pnpm test
corepack pnpm audit:pokemon-data
corepack pnpm generate:pokemon-knowledge
```

New generators must also support a deterministic `--dry-run` or audit mode suitable for CI.

## Non-Goals

- no live unrestricted web browsing by the model;
- no remote PokeAPI request in the chat request path;
- no unbounded domain crawling;
- no assumption that a walkthrough URL alone defines game applicability;
- no fine-tuning to memorize factual Pokemon data;
- no exposure of hidden model chain-of-thought;
- no replacement of exact game-version facts with generic franchise knowledge.

Fine-tuning may later improve tone, tool-selection habits, and concise source-aware explanations.
It should be considered only after the local tools, retrieval index, evaluation cases, and
provenance rules are stable.
