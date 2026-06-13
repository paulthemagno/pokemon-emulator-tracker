# Game Support Matrix

Status labels:

- `supported`: implemented and covered by tests or existing docs.
- `partial`: implemented but known incomplete or weakly verified.
- `planned`: not implemented yet.
- `blocked`: needs a source decision or emulator API decision.

## Save Upload

| Game | Generation | Save parser | Detection | Party | PC boxes | Inventory | Badges | Pokedex | Location | Main technical source |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red | 1 | supported | filename-based | supported | supported | supported | supported | supported | supported | `pret/pokered`, Gen 1 save references |
| Blue | 1 | supported | filename-based | supported | supported | supported | supported | supported | supported | `pret/pokered`, Gen 1 save references |
| Yellow | 1 | supported | filename-based | supported | supported | supported | supported | supported | supported | Shared US Gen 1 save layout plus Yellow RAM references |
| Gold | 2 | supported | partial | supported | supported | supported | supported | supported | supported | `pret/pokecrystal` plus Gen 2 profile checks |
| Silver | 2 | supported | partial | supported | supported | supported | supported | supported | supported | `pret/pokecrystal` plus Gen 2 profile checks |
| Crystal | 2 | supported | supported | supported | supported | supported | supported | supported | supported | `pret/pokecrystal` |
| Ruby | 3 | partial | filename-based | partial | partial | supported | supported | partial | partial | `pret/pokeruby`, `pret/pokeemerald` Hoenn order |
| Sapphire | 3 | partial | filename-based | partial | partial | supported | supported | partial | partial | `pret/pokeruby`, `pret/pokeemerald` Hoenn order |
| Emerald | 3 | partial | filename-based | partial | partial | supported | supported | partial | partial | `pret/pokeemerald` |
| FireRed | 3 | partial | filename-based | partial | partial | supported | supported | partial | partial | `pret/pokefirered` |
| LeafGreen | 3 | partial | filename-based | partial | partial | supported | supported | partial | partial | `pret/pokefirered` |

## Live Adapter

| Game | mGBA live | Notes |
| --- | --- | --- |
| Red | supported | Covered by `live-adapters/mgba-gen1-live.lua`; full non-current PC boxes require readable mGBA SRAM or save/live merge. |
| Blue | supported | Shares Red/Blue live profile with ROM-title version detection. |
| Yellow | supported | Uses Yellow-specific live profile based on US Yellow RAM references; Pikachu/follower-specific state is not exposed yet. |
| Gold | supported | Covered by `live-adapters/mgba-gen2-live.lua` profile detection. |
| Silver | supported | Covered by `live-adapters/mgba-gen2-live.lua` profile detection. |
| Crystal | supported | Primary maintained live path. |
| Ruby | partial | First mGBA live pass in `live-adapters/mgba-gen3-live.lua`; fixed SaveBlock addresses from `pret/pokeruby`, runtime PC storage scan, encrypted Pokemon record validation. |
| Sapphire | partial | Shares Ruby/Sapphire live profile and ROM-title detection. |
| Emerald | partial | First mGBA live pass with runtime SaveBlock/PokemonStorage resolution for Emerald ASLR, then source-backed `pret/pokeemerald` struct offsets. |
| FireRed | partial | First mGBA live pass using generated `pret/pokefirered` SaveBlock/PokemonStorage offsets, runtime pointer reads, and ROM-title detection. Kanto and Sevii map views are source-backed. |
| LeafGreen | partial | Shares the FireRed/LeafGreen live profile with version-specific labels. |

## Data Coverage

| Dataset | Current state | Next step |
| --- | --- | --- |
| Species names/types/growth | Local TypeScript table; growth source documented as PokeAPI | Add provenance metadata and validate Gen 1-3 completeness. |
| Moves | Local TypeScript table and PokeAPI descriptions | Add per-game learnsets and move mechanics by generation. |
| Items | Local TypeScript tables and PokeAPI descriptions | Replace manual Gen 1/2/3 tables with generated files from pret where practical. |
| Locations | Gen 1 town-map landmarks, generated Gen 2 landmarks, and source-backed Gen 3 Hoenn landmarks | Generate full Gen 3 location/encounter datasets for LLM tools. |
| Maps | Gen 1 Kanto maps, Gen 2 Pokegear maps, Gen 3 Hoenn overview map, and FireRed/LeafGreen Kanto/Sevii overview maps with marker coordinates | Continue validating edge/event maps with real saves before promoting FireRed/LeafGreen. |
| Encounters | Not first-class local data | Generate per-game encounter datasets from pret for LLM tools. |
| Story context | Main-story milestone summary for Gen 1-3; starter choices; Oak Lab; Elm Lab, Mahogany Rocket base, and Radio Tower; Littleroot, Petalburg, Sootopolis crisis, and current Hoenn League run | Expand fine-grained chapter phases only from reviewed variables/scenes or source-proven flag combinations; do not expose all raw vars. |
| Trainers/gyms | Not first-class local data | Add gym leader/rival/E4 datasets after parser foundations are stable. |

## Ground Truth Modules

Current local ground-truth modules:

| Module | Covers |
| --- | --- |
| `lib/pokemon/knowledge/provenance.ts` | Source records and source kinds. |
| `lib/pokemon/knowledge/inventory-layouts.ts` | Gen 1-3 inventory/item-storage offsets and pocket formats. |
| `lib/pokemon/knowledge/item-id-ranges.ts` | Gen 1/2 TM/HM item ID ranges and Gen 1 machine names. |
| `lib/pokemon/knowledge/save-layouts.ts` | Gen 1/2/3 save parser offsets, Pokédex flag offsets, PC box offsets, and generated live offset profile inputs. |
| `lib/pokemon/knowledge/species-id-maps.ts` | Gen 3 internal species ID to National Dex mapping. |
| `lib/pokemon/data/gen3-hoenn-dex.ts` | Gen 3 Hoenn Dex order extracted from `pret/pokeemerald` `sHoennToNationalOrder`. |
| `lib/pokemon/data/gen3-kanto-dex.ts` | FireRed/LeafGreen Kanto Dex count/order from `pret/pokefirered` `KANTO_DEX_COUNT` and `GetKantoPokedexCount`. |
| `live-adapters/generated/gen1-live-offsets.lua` | Generated Gen 1 live WRAM profiles loaded by the mGBA adapter. |
| `live-adapters/generated/gen2-live-offsets.lua` | Generated Gen 2 live WRAM profiles and TM/HM item IDs loaded by the mGBA adapter. |
| `live-adapters/generated/gen3-live-offsets.lua` | Generated Ruby/Sapphire/Emerald/FireRed/LeafGreen live profiles, inventory pockets, and internal species map loaded by the mGBA adapter. |

## Promotion Checklist

A game can move from `partial` to `supported` only when:

- Detection distinguishes that game from nearby versions.
- Parser tests cover trainer, party, PC, inventory, badges, Pokedex, and location.
- Data generation scripts or pinned source notes exist.
- LLM tools can answer at least moves, items, party, inventory, and current location questions for that game.
- README and architecture docs describe any game-specific limits.
