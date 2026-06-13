# LLM Pokemon Agent

This document defines the game-knowledge layer for the in-app chatbot and for future agent work.

## Goal

The LLM should act as a grounded gameplay co-pilot. It should combine the current save/live state with local Pokemon reference tools, then answer with a concrete action or a precise factual lookup.

The model should not rely on memory for game-specific facts when a local tool can answer the question.

Local knowledge modules under `lib/pokemon/knowledge/` are the ground-truth entry point for offsets, item ranges, inventory layouts, and source provenance. Chatbot tools should query those modules before using prompt memory.

## Grounding Rules

1. Use the current `GameContextSnapshot` for trainer state, party, inventory, location, badges, Pokedex, and money.
2. Use local tools for moves, items, species, type matchups, learnsets, encounters, and save-field explanations.
3. If a needed dataset is missing, say what is missing and ask one specific follow-up.
4. Never invent encounter rates, map coordinates, item effects, or move learnsets.
5. Prefer one actionable recommendation with a short reason for tactical questions.

## Tool Surface

Current Ollama tools:

- `get_move_reference`
- `search_game_guidance`
- `get_trainer_status`
- `get_story_context`
- `get_party_overview`
- `get_pokemon_details`
- `get_inventory_overview`

Recommended next tools:

| Tool | Inputs | Output |
| --- | --- | --- |
| `get_move` | `moveName`, optional `game` | Type, power, accuracy, PP, generation-specific effect, source. |
| `get_item` | `itemName`, optional `game` | Pocket, effect/flavor, availability if known, source. |
| `get_species` | `speciesName`, optional `game` | Types, base stats, growth rate, abilities for Gen 3, evolution notes. |
| `get_type_matchup` | attacking type or move, defender species/types, generation | Multiplier and relevant generation mechanics. |
| `get_learnset` | species, game, optional method | Level-up/TM/HM/tutor/egg moves by game. |
| `get_encounters` | location, game, optional method/time | Encounter species, levels, rates, method, source. |
| `get_game_support` | game | Known parser/live/data support and limitations. |
| `get_save_field` | field, game | Save/live field meaning, offset/provenance when documented. |

`get_move_reference` reads the generated local Gen 1-3 move table and
PokeAPI-derived descriptions. It does not call PokeAPI during chat requests and
does not claim that a species learns the move.

`search_game_guidance` searches `GENERATED_EVENT_GUIDES` within the loaded game
profile. It returns compact event meaning, locations, available steps, PRET links,
and reviewed walkthrough sources. Text matches are retrieval hints, not proof
that an event is currently available.

## Provider And Multimodal Policy

- Display the effective provider and model to the user.
- Blank UI overrides use the server-side `OLLAMA_*` environment values.
- Request API keys may override `OLLAMA_API_KEY`, but must not be persisted or
  returned in provider metadata.
- Images require a vision-capable model and use bounded JPEG, PNG, or WebP input.
- Image attachments remain part of client-side conversation history so follow-up
  turns can reference the same visual input.
- Ollama `message.thinking` is separate from final answer content. Store it
  separately, render it collapsed, and honor `think: false` when the user disables
  model thinking.
- Audio requires an explicit speech-to-text stage. Do not pass arbitrary audio to
  a text/vision model and claim it was understood.
- Future hosted provider adapters must reuse the same local tools and provenance
  rules instead of replacing retrieval with prompt memory.

## Context Packing Improvements

`GameContextSnapshot` includes compact source-backed `progressFacts` for reviewed permanent choices, current story phases, and the main-story milestone summary. `get_story_context` returns those values and known next steps without exposing the full raw variable array. A missing milestone is not treated as proof that it is immediately available when the game allows multiple valid orders.

It should eventually also include:

- `generation` and exact `game`.
- `source`: `save` or `live`.
- Active PC box name/index when known.
- Current map IDs in addition to display location.
- Badge names, not only badge count.
- Known current battle state if a live adapter can expose it.

Keep the packed context compact. Large reference data belongs in tools, not the prompt.

## Fine-Tuning Position

Do not fine-tune a model to memorize Pokemon datasets. Fine-tuning is appropriate only for style and behavior:

- concise tactical answers
- source-aware uncertainty
- tool-first lookup behavior
- no generic encouragement
- asking for missing data instead of guessing

For factual game knowledge, use retrieval/tool calls over local generated datasets.

## Example Behavior

User: "Can my Kadabra learn ThunderPunch in Crystal?"

Good flow:

1. Call `get_learnset({ species: "Kadabra", game: "crystal", method: "all" })`.
2. Answer only from the returned data.
3. If the dataset is not available, say that Crystal learnsets are not loaded yet.

Bad answer:

> I think Kadabra probably can because it learns many elemental punches.

The model should not guess.

## Data Docs For Training Or RAG

Create compact, game-scoped markdown from generated data:

```text
docs/llm-data/
  gen1-red-blue.md
  gen1-yellow.md
  gen2-gold-silver.md
  gen2-crystal.md
  gen3-ruby-sapphire.md
  gen3-emerald.md
  gen3-firered-leafgreen.md
```

Each file should include only durable summaries and tool schemas. Detailed rows should stay in machine-readable generated data.
