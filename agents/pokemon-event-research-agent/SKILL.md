---
name: pokemon-event-research-agent
description: Use when auditing Pokemon story/event flags, event sequences, flag prerequisites, mutually exclusive story paths, or user-facing event progress guidance.
---

# Pokemon Event Research Agent

Use this workflow when changing event flag extraction, classifications, story milestones, or UI guidance.

## Rules

- Treat pret repositories as the primary technical source for flag IDs, event scripts, and save/live offsets.
- Do not infer story meaning from a flag name alone when adding guidance. Link to the script that sets, clears, checks, or gates that flag.
- Separate raw flags from player progress:
  - story: required or central story milestones.
  - unlock: traversal, required key items, badges, or systems unlocked.
  - optional: rewards, hidden items, rods, side gifts, rematches, daily content.
  - routine: trainers, visibility flags, visited-map bits, object state, temporary state.
- Mark visibility flags clearly. `FLAG_HIDE_*` and object-event flags can mean an NPC/object is hidden, not that the player completed a quest.
- If two flags are alternatives or version-specific, record that explicitly. Never count both as required unless a source script proves both can be set in one normal route.
- If a source only gives the flag definition and no script context, say that the flag is source-backed but the gameplay meaning is unresolved.

## Research Workflow

1. Confirm the supported game/profile in `docs/game-support-matrix.md`.
2. Read `lib/pokemon/knowledge/sources/event-flags.json` and the pinned source in `docs/source-lockfile.md`.
3. For each gameplay claim, inspect the map/script source where the flag appears:
   - Gen 1: `scripts/*.asm` and map object scripts in `pret/pokered` / `pret/pokeyellow`.
   - Gen 2: `maps/*.asm`, `events/*.asm`, and `engine/events/*.asm` in `pret/pokecrystal` / `pret/pokegold`.
   - Gen 3: `data/maps/**/scripts.inc`, `src/*.c`, and `include/constants/flags.h` in the matching pret repo.
4. Capture exact source URLs pinned to the commit already recorded in provenance.
5. Update generated data only through extraction scripts. Hand-written guidance belongs in `lib/pokemon/data/event-guidance.ts` with source URLs.
6. Add or update tests when changing classification, counts, or user-facing guidance.

## Verification

Run:

```bash
corepack pnpm extract:pokemon-events -- --from-github
corepack pnpm generate:pokemon-knowledge
corepack pnpm test
corepack pnpm audit:pokemon-data
```

After UI changes, verify the dev server:

```bash
curl -I http://127.0.0.1:3000
```
