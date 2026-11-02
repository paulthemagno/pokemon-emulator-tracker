# Game recognition

## Save uploads

`parseSaveFile` identifies international Gen 1/2 layouts from party lists and
checksums. Gen 1 starter state can distinguish Yellow from Red/Blue; Gen 2 uses
separate Gold/Silver and Crystal checksum ranges. Gen 3 requires a complete valid
slot and identifies RS, Emerald or FR/LG from the trainer-sector marker and
SaveBlock2 extent.

Paired titles can remain indistinguishable. Compatible EN/IT/DE/FR/ES filename
hints resolve the title within the detected family. Otherwise `/api/parse`
returns `candidates`; the UI resubmits the file with a compatible `game` choice.
An incompatible hint or override cannot select another layout. Low-level Gen 1/2
parsers are decoding primitives; use `parseSaveFile` for validation and detection.

The Gen 3 family rule is a heuristic: edited saves, exceptional marker/key values
and nonstandard hacks may remain unrecognized. Japanese/Korean GB save layouts
are unsupported. Traded Pokemon metadata does not establish the current game.

## mGBA live

All adapters share `live-adapters/rom-identity.lua` and the generated
`live-adapters/generated/rom-identities.lua` catalog. Edit
`lib/pokemon/knowledge/sources/rom-identities.json` and run
`corepack pnpm generate:pokemon-knowledge` to regenerate it.

- GBA game codes identify the five titles and EN/IT/DE/FR/ES language; revision is
  read separately. GB/GBC product codes identify Yellow/Gold/Silver/Crystal;
  legacy Red/Blue and English Yellow use known header global checksums.
- Header checksums are validated. Unsupported identities and wrong-generation
  adapters return errors. ROM CRC32 is reported when available, but is not yet
  matched against a complete release catalog; headers alone do not certify hacks.
- Identity selects the existing profile plus European overrides for Gen 1 core
  WRAM, RS active party and FR/LG runtime pointers. Gen 2 and Emerald retain their
  Western profiles. Japanese/Korean live profiles are unsupported.
- ROM/load/reset changes clear caches. `status.identity` becomes
  `SaveData.romIdentity` and prevents merging different ROM identities.

Gen 1 European fields are derived from the contiguous shared WRAM layout and
cross-checked against localized player/rival/badge/map anchors. No global SRAM or
map-coordinate adjustment is applied. Source pins and scope are recorded in
[source-lockfile.md](source-lockfile.md) and the catalog. Header references:
[GBATEK](https://mgba-emu.github.io/gbatek/#gbacartridgeheader),
[Pan Docs](https://github.com/gbdev/pandocs/blob/master/src/The_Cartridge_Header.md),
[mGBA API](https://mgba.io/docs/dev/scripting.html).

## Verification limits

`corepack pnpm test` uses synthetic save fixtures and Fengari to execute the
production Lua against a simulated memory bus. Coverage includes localized and
unlabeled filenames, compatible title choices, checksums, Western ROM headers,
profile overrides and identity/lifecycle changes.

Recognition coverage does not certify every gameplay field in every release.
Real-save and mGBA checks remain necessary for trainer, party, boxes, inventory,
Pokedex, locations and events. Accented names and language-specific text tables
need further coverage; game recognition does not translate the tracker's labels.
