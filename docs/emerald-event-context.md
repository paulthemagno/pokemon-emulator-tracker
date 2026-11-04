# Emerald event context and interpretation

The event catalog retains source-defined bits, including trainer victories, registrations, gifts, optional rewards, and daily state. The separate [reviewed variable reference](emerald-progress-variables.md) documents 18 numeric quest values. Neither collection is an exhaustive list of quests or proof that an unfinished activity is currently available.

All references below use the project's pinned `pret/pokeemerald` commit `0d3100185e0b13faabfc589fc402dd46f83c1d6a`. Per-flag descriptions and links are exposed in `get_game_state(section="events")` and maintained in `lib/pokemon/data/event-guidance.ts`. Variable IDs are extracted from source and documented by the generator.

## Legendary encounters

| Record | Meaning and limits |
| --- | --- |
| `FLAG_DEFEATED_REGIROCK`, `FLAG_DEFEATED_REGICE`, `FLAG_DEFEATED_REGISTEEL` | The scripts set these markers on both defeat and capture completion paths. A set bit alone does not prove a capture. |
| `FLAG_DEFEATED_RAYQUAZA`, `FLAG_DEFEATED_GROUDON`, `FLAG_DEFEATED_KYOGRE` | These also combine defeat/capture outcomes. Keep the encounter result separate from ownership. |
| `FLAG_CAUGHT_MEW`, `FLAG_CAUGHT_HO_OH`, `FLAG_CAUGHT_LUGIA` | Capture-side completion records at their event maps. Their separate `FLAG_DEFEATED_*` bits record defeat-side outcomes. Neither proves current ownership. |
| `FLAG_CAUGHT_LATIAS_OR_LATIOS` | Refers to the stationary Southern Island encounter, not the roaming Pokemon. The similarly named defeated bit is a separate outcome. |
| `FLAG_DEFEATED_DEOXYS` | Set by the Birth Island defeat branch. It is not capture proof. |
| `FLAG_BATTLED_DEOXYS` | The script sets it on the completion path after excluding defeat and fleeing. Its name must not be interpreted as a generic count of all Deoxys encounters. |
| `FLAG_HIDE_*` | Visibility/removal state. This alone cannot establish capture, defeat, or quest completion. |
| Pokédex owned bit | Species acquisition/ownership history can include trades. It does not identify the encounter at which a Pokemon was caught. |

Outcome-script evidence:

- [Regirock](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/DesertRuins/scripts.inc), [Regice](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/IslandCave/scripts.inc), [Registeel](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/AncientTomb/scripts.inc).
- [Rayquaza](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/SkyPillar_Top/scripts.inc), [Groudon](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/TerraCave_End/scripts.inc), [Kyogre](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/MarineCave_End/scripts.inc).
- [Mew](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/FarawayIsland_Interior/scripts.inc), [Ho-Oh](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/NavelRock_Top/scripts.inc), [Lugia](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/NavelRock_Bottom/scripts.inc).
- [Southern Island Latias/Latios](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/SouthernIsland_Interior/scripts.inc), [Deoxys](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/BirthIsland_Exterior/scripts.inc).

Event-map access conditions still apply. The existence of a capture bit is not evidence that an island can be reached in the current game state.

## Optional quests and rewards

| Flag or variable | Recorded fact |
| --- | --- |
| `FLAG_EXCHANGED_SCANNER` | Stern accepted the Scanner in exchange for a Deep Sea Tooth or Deep Sea Scale. Both branches set the same bit; the choice is not recoverable from this bit. |
| `FLAG_WINGULL_SENT_ON_ERRAND` | The Fortree errand started. Delivery and reward collection are separate. |
| `FLAG_WINGULL_DELIVERED_MAIL` | Delivery was recorded by the Mossdeep interaction. This does not prove the return reward was collected. |
| `FLAG_RECEIVED_MENTAL_HERB` | The Fortree return reward was successfully delivered. It does not prove the item is still in the bag. |
| `FLAG_GOT_BASEMENT_KEY_FROM_WATTSON` | The key for the New Mauville errand was received. |
| `VAR_NEW_MAUVILLE_STATE` | State 2 records generator shutdown. |
| `FLAG_GOT_TM_THUNDERBOLT_FROM_WATTSON` | The reward was successfully received after generator shutdown; using the TM does not erase its receipt. |
| `FLAG_RECEIVED_EXP_SHARE` | Mr. Stone's reward after delivery of Steven's letter was received. Delivery and reward pickup are separate events. |
| `FLAG_RECEIVED_BELDUM`, `FLAG_RECEIVED_CASTFORM` | Gift receipts, distinct from the battles/unlocks preceding them and from current ownership. |
| `FLAG_RECEIVED_LAVARIDGE_EGG` | The gift Egg was accepted; this does not record hatching. |
| `FLAG_RECEIVED_REVIVED_FOSSIL_MON` | A revived Pokemon was received. Combine with the current revival phase and fossil selection; another revival can be in progress. |
| Trick House variables | Keep puzzle progression, current puzzle/entrance phases, and pending prize state separate. A bag/storage-full reward path can leave a prize pending. |

Source evidence:

- [Scanner exchange](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/SlateportCity_Harbor/scripts.inc).
- [Fortree Wingull and reward](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/FortreeCity_House4/scripts.inc), [Mossdeep delivery](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/MossdeepCity_House2/scripts.inc).
- [Wattson's errand and reward](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/MauvilleCity/scripts.inc), [generator](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/NewMauville_Inside/scripts.inc).
- [Exp. Share](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/RustboroCity_DevonCorp_3F/scripts.inc), [Beldum](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/MossdeepCity_StevensHouse/scripts.inc), [Castform](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/Route119_WeatherInstitute_2F/scripts.inc).
- [Gift Egg](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/LavaridgeTown/scripts.inc), [fossil revival](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/RustboroCity_DevonCorp_2F/scripts.inc), [Trick House end room](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/Route110_TrickHouseEnd/scripts.inc).

## Technical and repeatable state

- `FLAG_SYS_GAME_CLEAR` permanently records League/Hall of Fame completion. Although represented as a system bit, it is evidence of completed story progress; the main-story summary exposes that milestone.
- `FLAG_LEGENDARIES_IN_SOOTOPOLIS` is a resettable story-phase bit, set by the Seafloor Cavern scene and cleared in Sootopolis after the crisis. It is excluded from key-milestone totals and is not a permanent prerequisite for earlier events. Sources: [Seafloor Cavern](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/SeafloorCavern_Room9/scripts.inc), [Sootopolis](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/SootopolisCity/scripts.inc), [GameClear](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/src/post_battle_event_funcs.c).
- `FLAG_REGISTERED_*`: 78 Match Call registration definitions depend on `include/constants/rematches.h`. Registration is different from a trainer victory and from current rematch readiness. The 854 indexed `TRAINER_*` records cover exact trainer teams instead.
- `FLAG_DAILY_*`: 12 source-defined daily state bits are included for Emerald. `ClearDailyFlags` in [event_data.c](https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/src/event_data.c) clears this range. An unset bit cannot establish that an activity has never been performed.
- `FLAG_MYSTERY_GIFT_*`: retained as internal state with unresolved per-bit gameplay meaning. They must not be converted into invented rewards or quests.
- Explicit unused/never-set definitions, temporary map flags, and special RAM-only flags remain outside the persistent event catalog. Unreviewed raw symbols retained in other profiles are technical state, not completed quests.

These records preserve their `rawSet` state and sources but stay outside permanent key-milestone completion counts. The generator bounds the extracted byte range to the source-backed `SaveBlock1.flags` storage capacity.
