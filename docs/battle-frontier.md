# Emerald Battle Frontier

Emerald save uploads and the Gen 3 mGBA adapter expose `battleFrontier`:
Battle Points, silver/gold symbols for all seven facilities, and the current or
previous streak plus best record for every supported battle mode and level.
A compact, collapsed-by-default Battle Frontier panel sits after More Data
(Pokédex, PC, inventory and Events). Select an original Frontier Pass symbol
to inspect every battle mode and both levels together, with current/previous
streaks, personal bests and distances to the silver/gold milestones. Both silver and gold symbols are always visible for all seven facilities.
Unowned symbols retain their palette at reduced opacity; ownership is also given
in text.
File data describes the last saved state; live data reads the resolved in-memory SaveBlock2.
Reload `live-adapters/mgba-gen3-live.lua` after updating the adapter and generated
Lua offsets. Older adapters leave this field unavailable.

## Exact technical sources

All references below use PRET pokeemerald commit
`0d3100185e0b13faabfc589fc402dd46f83c1d6a` (reverse-engineered technical source).

- [include/global.h, BattleFrontier and SaveBlock2](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/include/global.h#L378-L542): absolute SaveBlock2 offsets, row-major `[battleMode][levelMode]` arrays, and unencrypted `battlePoints` at `0xEB8`. These annotated offsets already include the Frontier base `0x64C`; do not add it again.
- [include/constants/frontier_util.h](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/include/constants/frontier_util.h): `STREAK_*` masks, including separate multi/link modes. The bit order differs from the array order.
- [src/frontier_util.c](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/src/frontier_util.c#L952-L1475): `IsWinStreakActive`, `*PrintPrevOrCurrentStreak`, and record windows establish current versus previous semantics and units. `GiveFacilitySymbol` uses `FLAG_SYS_TOWER_SILVER + facility * 2` and the adjacent gold bit. `GiveBattlePoints` updates the available balance; `cardBattlePoints` is a separate field and is not the available balance.
- [include/constants/battle_frontier.h](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/include/constants/battle_frontier.h): facility IDs, level modes and `MAX_STREAK=9999`.
- [include/constants/flags.h](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/include/constants/flags.h#L1468-L1481): individual silver/gold symbol flags, decoded through the existing generated event catalog.

| Facility | Streak offset | Record offset | Modes | Unit |
| --- | --- | --- | --- | --- |
| Tower | `0xCE0` | `0xCF0` | Singles, doubles, multi, link multi | wins |
| Dome | `0xD0C` | `0xD14` | Singles, doubles | tournaments |
| Palace | `0xDC8` | `0xDD0` | Singles, doubles | wins |
| Arena | `0xDDA` | `0xDDE` | Singles | wins |
| Factory | `0xDE2` | `0xDEA` | Singles, doubles | wins |
| Pike | `0xE04` | `0xE08` | Singles | rooms |
| Pyramid | `0xE1A` | `0xE1E` | Singles | floors |

Every mode has separate level 50/open values. The shared decoder follows the
in-game display cap of 9999. `streak` with `isCurrent=false` means a previous
series, not zero and not an active challenge. No current opponent, active battle or
exact upcoming Brain encounter is inferred from these records.
Unknown symbol flags are `null`; missing or malformed raw ranges are unavailable.
Ruby/Sapphire Tower records and FireRed/LeafGreen are not decoded by this feature.

## Reproduction

With the pinned PRET checkout in the standard source cache, run:

```sh
node scripts/extract-pokemon-frontier.mjs
node scripts/generate-pokemon-knowledge.mjs
```

The extractor also accepts a checkout path as its first argument and verifies
its HEAD against the pin. It extracts field offsets and active-streak masks into
`lib/pokemon/knowledge/sources/frontier-layout.json` and the Emerald range in
`save-layouts.json`. The knowledge generator emits the TypeScript and Lua layouts.
Both file and live paths decode the same `0xCDC..0xEB9` byte range.

The chatbot receives a compact BP/symbol summary. Use `get_game_state` with
`section=battleFrontier` for the complete records and source references; the same
tool is available through the local MCP. Missing data is reported as unavailable.

## Frontier Pass graphics

`public/frontier/*-{silver,gold}.svg` are local 16×16 pixel-preserving exports
from the same PRET commit: `graphics/frontier_pass/medals.png`, `silver.pal`
and `gold.pal`. Palette index 0 is transparent. The seven-frame facility order
is verified by `src/frontier_pass.c` `sAnims_Medal`; `src/graphics.c` binds the
original sheet to the two palettes. Run `node scripts/generate-frontier-symbols.mjs`
with the pinned source cache (or pass the checkout as the first argument) to
reproduce all 14 assets. No remote images are requested at runtime.

## Symbol milestone distance

The source extractor also reads `sFrontierBrainStreakAppearances` in
`src/frontier_util.c` at the same pinned commit. Targets (silver/gold) are
Tower 35/70 wins, Dome 5/10 tournaments, Palace 21/42 wins, Arena 28/56 wins,
Factory 21/42 wins, Pike 28/140 rooms and Pyramid 21/70 floors. Dome's table
contains 4/9 completed tournaments before entering the 5th/10th tournament;
the displayed target includes winning that tournament. `GetFrontierBrainStatus`
restricts symbol encounters to Singles. Gold requires the silver symbol first.

Distance uses the selected row's active streak, never the personal record or an
ended previous series. Reaching a numerical target does not award a symbol: the
player must defeat the Frontier Brain, and ownership comes from the symbol flags.
These are first milestone targets, not a prediction of the next encounter after
missed or unusual save states. Ineligible modes show a dash.
