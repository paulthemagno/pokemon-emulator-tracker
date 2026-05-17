---
name: pokemon-research-agent
description: Use when adding Pokemon game support, auditing Pokemon data provenance, generating local datasets from official or reproducible sources, or extending LLM tool-calling for Pokemon gameplay questions.
---

# Pokemon Research Agent

Use this workflow for Pokemon Emulator Tracker work involving game support, local datasets, source verification, or chatbot/tool knowledge.

## Core Rules

- Keep runtime gameplay data local.
- Separate official public sources from technical reverse-engineering sources.
- Do not claim offset/map/save data is official unless it comes from an official manual or developer-published technical source.
- Prefer reproducible extraction from pret repositories for internal IDs, maps, save structures, RAM symbols, learnsets, encounters, and item/move tables.
- Add or update project docs whenever setup, data source, live adapter, map, coordinate, endpoint, or user workflow changes.

## Source Selection

Read `docs/pokemon-source-policy.md` first for source tiers.

Use:

- Pokemon.com and Nintendo support for public game identity and feature descriptions.
- `pret/pokered` for Red/Blue technical data.
- Yellow-specific pret/disassembly source for Yellow technical data.
- `pret/pokecrystal` for Gold/Silver/Crystal technical data.
- `pret/pokeruby` for Ruby/Sapphire technical data.
- `pret/pokeemerald` for Emerald technical data.
- `pret/pokefirered` for FireRed/LeafGreen technical data.
- PokeAPI only for generated descriptions or cross-game metadata when a stronger source is unavailable.

## Workflow

1. Check `docs/game-support-matrix.md` and identify the exact game/profile.
2. Check existing parser/data/live files before proposing changes.
3. Pin or record the source repo commit for generated data.
4. Generate local data with scripts where practical.
5. Add tests or audit output before marking support as complete.
6. Update README, architecture docs, known issues, or agent notes.
7. For chatbot work, update `docs/llm-pokemon-agent.md` and prefer tools over prompt bloat.

## Parser Priorities

For a new or partial game, finish in this order:

1. Game detection.
2. Trainer metadata and badges.
3. Party Pokemon.
4. Inventory pockets.
5. PC boxes and active box.
6. Pokedex seen/caught.
7. Location/map IDs.
8. Optional live adapter fields.

## LLM Priorities

Add local tools for factual lookups before considering fine-tuning. Fine-tuning may shape answer style, but factual data should come from tool calls over local generated datasets.

