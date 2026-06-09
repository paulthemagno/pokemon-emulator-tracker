import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const sourceDir = path.join(root, "lib/pokemon/knowledge/sources");

const PINNED_SOURCES = {
  pokered: {
    sourceKey: "pretPokered",
    repo: "pret/pokered",
    commit: "3c814341c81307b3193a9ea890ff3a197b09b4e3",
    eventPath: "constants/event_constants.asm",
    wramPath: "ram/wram.asm",
  },
  pokeyellow: {
    sourceKey: "pretPokeyellow",
    repo: "pret/pokeyellow",
    commit: "bfa7170107eea23b89febb60bfb2ce39173bf2e1",
    eventPath: "constants/event_constants.asm",
    wramPath: "ram/wram.asm",
  },
  pokegold: {
    sourceKey: "pretPokegold",
    repo: "pret/pokegold",
    commit: "09d2148d6d26b20840fb4997916321666ca1e953",
    eventPath: "constants/event_flags.asm",
    wramPath: "ram/wram.asm",
    initEventsPath: "engine/events/std_scripts.asm",
  },
  pokecrystal: {
    sourceKey: "pokecrystal",
    repo: "pret/pokecrystal",
    commit: "8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217",
    eventPath: "constants/event_flags.asm",
    wramPath: "ram/wram.asm",
    initEventsPath: "engine/events/std_scripts.asm",
  },
  pokeruby: {
    sourceKey: "pretPokeruby",
    repo: "pret/pokeruby",
    commit: "63a8cbf0016b351a4e68f7036fa0b77e23d2f2c1",
    eventPath: "include/constants/flags.h",
    initEventsPath: "data/scripts/new_game.inc",
  },
  pokeemerald: {
    sourceKey: "pretPokeemerald",
    repo: "pret/pokeemerald",
    commit: "0d3100185e0b13faabfc589fc402dd46f83c1d6a",
    eventPath: "include/constants/flags.h",
    initEventsPath: "data/scripts/new_game.inc",
  },
  pokefirered: {
    sourceKey: "pretPokefirered",
    repo: "pret/pokefirered",
    commit: "e060ab955b5dc9ac1c4904c2cd141683615cf477",
    eventPath: "include/constants/flags.h",
  },
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--") continue;
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    if (key === "from-github") {
      args.fromGithub = true;
    } else {
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function readJson(name) {
  return JSON.parse(await fs.readFile(path.join(sourceDir, name), "utf8"));
}

async function writeJson(name, data) {
  await fs.writeFile(path.join(sourceDir, name), `${JSON.stringify(data, null, 2)}\n`);
}

async function getCommit(repoPath) {
  const { stdout } = await execFileAsync("git", ["-C", repoPath, "rev-parse", "HEAD"]);
  return stdout.trim();
}

async function readSource(args, key, filePath) {
  const repoPath = args[key];
  if (repoPath) return fs.readFile(path.join(repoPath, filePath), "utf8");
  if (!args.fromGithub) throw new Error(`Pass --${key} /path/to/${key} or --from-github.`);
  const source = PINNED_SOURCES[key];
  const url = `https://raw.githubusercontent.com/${source.repo}/${source.commit}/${filePath}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

function stripComment(line) {
  const [body, comment = ""] = line.split(/;|\/\//);
  return { body: body.trim(), comment: comment.trim() };
}

function evalAsmExpression(expression, constants) {
  const js = expression
    .replace(/\$([0-9a-f]+)/gi, "0x$1")
    .replace(/\b([A-Z_][A-Z0-9_]*)\b/gi, (name) => {
      if (Object.hasOwn(constants, name)) return String(constants[name]);
      throw new Error(`Unknown constant ${name}`);
    });
  if (!/^[\d\s()+\-*/%<>&|.^xobA-Fa-f]+$/i.test(js)) throw new Error(`Unsafe expression ${expression}`);
  return Function(`"use strict"; return (${js});`)();
}

function directiveSize(line, constants) {
  const clean = stripComment(line).body.replace(/^[A-Za-z0-9_{}]+::\s*/, "").trim();
  if (!clean) return 0;
  if (clean.startsWith("db")) return clean.slice(2).split(",").filter(Boolean).length || 1;
  if (clean.startsWith("dw")) return 2 * (clean.slice(2).split(",").filter(Boolean).length || 1);
  const ds = clean.match(/^ds\s+(.+)$/);
  if (ds) return evalAsmExpression(ds[1], constants);
  const flagArray = clean.match(/^flag_array\s+(.+)$/);
  if (flagArray) return Math.ceil(evalAsmExpression(flagArray[1], constants) / 8);
  if (clean.startsWith("map_connection_struct")) return 11;
  if (clean.startsWith("spritestatedata")) return 16;
  if (clean.startsWith("party_struct")) return 44;
  if (clean.startsWith("box_struct")) return 33;
  return 0;
}

function collectAsmConstants(source, seed = {}) {
  const constants = { ...seed };
  for (const line of source.split(/\r?\n/)) {
    const clean = stripComment(line).body;
    const match = clean.match(/^DEF\s+([A-Z0-9_]+)\s+EQU\s+(.+)$/i);
    if (!match) continue;
    try {
      constants[match[1]] = evalAsmExpression(match[2], constants);
    } catch {
      // Some source constants depend on macros not needed for event offsets.
    }
  }
  return constants;
}

function humanizeFlagName(name) {
  return name
    .replace(/^(EVENT|FLAG)_/, "")
    .replace(/^SYS_/, "")
    .replace(/^HIDE_/, "Hide ")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bTm\b/g, "TM")
    .replace(/\bHm\b/g, "HM")
    .replace(/\bSs\b/g, "S.S.")
    .replace(/\bPc\b/g, "PC");
}

function categorize(name, section = "", comment = "") {
  const text = `${name} ${section} ${comment}`.toLowerCase();
  if (text.includes("unused") || text.includes("never set") || text.includes("unknown")) return "Unused/unknown";
  if (/^(?:FLAG|EVENT)_HIDE_/.test(name)) return "Map objects";
  if (/^FLAG_DECORATION_\d+$/.test(name)) return "Map objects";
  if (/^FLAG_SYS_/.test(name)) return "System state";
  if (/EVENT_BEAT_ELITE_4_|EVENT_BEAT_CHAMPION_LANCE|_ROOM_ENTRANCE_CLOSED|_ROOM_EXIT_OPEN/.test(name)) return "League challenge state";
  if (/LANCES_ROOM_LOCK_DOOR|HALL_OF_FAME_DEX_RATING/.test(name)) return "Map objects";
  if (/STARTER_DOLL|BIRCH_AIDE_MET|MATCH_CALL/.test(name)) return "Optional rewards";
  if (/BEAT_MEWTWO|CAUGHT_(?:LUGIA|HO_OH)|DEFEATED_(?:KYOGRE|GROUDON|RAYQUAZA|HO_OH|LUGIA)|SET_WHEN_FOUGHT_HO_OH|SOLVED_HO_OH_PUZZLE|WALL_OPENED_IN_.*_CHAMBER/.test(name)) return "Optional rewards";
  if (/FOLLOWED_OAK_INTO_LAB|OAK_ASKED_TO_CHOOSE_MON|GOT_STARTER|OAK_GOT_PARCEL|GOT_OAKS_PARCEL|RESCUED_BIRCH|KYOGRE_ESCAPED_SEAFLOOR_CAVERN|WALLACE_GOES_TO_SKY_PILLAR/.test(name)) return "Story: Main";
  if (/FOUGHT_SUICUNE|SAW_SUICUNE|TIN_TOWER_1F_SUICUNE/.test(name)) return "Story: Main";
  if (/BEAT_LANCE|DEFEATED_LANCE|DEFEATED_LEADER_GIOVANNI/.test(name)) return "Story: Gyms and League";
  if (/\bbeat_|_trainer|trainer_/.test(text) && !/(elite|champion|giovanni|rival|wally|archie|maxie|aqua|magma|rocket)/.test(text)) return "Trainers";
  if (/\bHM\d|_HM\d|HM[0-9]|_BIKE$|BICYCLE|TICKET|POKEDEX|POKENAV|MACHINE_PART|CARD_KEY|BASEMENT_KEY|LIFT_KEY/.test(name)) return "Key items and unlocks";
  if (text.includes("hidden") || text.includes("_item_") || text.includes("itemball") || text.includes("picked_up")) return "Items";
  if (text.includes("hide") || text.includes("sprite") || text.includes("people")) return "Map objects";
  if (text.includes("fossil") || text.includes("hitmon")) return "Optional rewards";
  if (text.includes("badge") || text.includes("gym") || text.includes("elite") || text.includes("champion")) return "Story: Gyms and League";
  if (text.includes("story") || text.includes("rocket") || text.includes("evil") || text.includes("aqua") || text.includes("magma") || text.includes("devon") || text.includes("silph") || text.includes("legend") || text.includes("orb") || text.includes("radio tower") || text.includes("slowpoke") || text.includes("victory road")) return "Story: Main";
  if (text.includes("rival") || text.includes("wally")) return "Story: Rival";
  if (text.includes("tm") || text.includes("rod")) return "Optional rewards";
  if (text.includes("daily")) return "Daily";
  if (text.includes("visited") || text.includes("landmark")) return "Map progress";
  return "Other";
}

function stateKindFor(name) {
  if (/^(?:FLAG|EVENT)_HIDE_|^FLAG_DECORATION_\d+$/.test(name)) return "visibility";
  if (/^FLAG_SYS_/.test(name)) return "system";
  return undefined;
}

function importanceFor(name, category) {
  if (category === "League challenge state" || category === "System state") return "routine";
  if (category === "Story: Main" || category === "Story: Gyms and League" || category === "Story: Rival") return "story";
  if (category === "Key items and unlocks") return "unlock";
  if (category === "Items" || category === "Optional rewards" || category === "Daily") return "optional";
  if (category === "Trainers" || category === "Map objects" || category === "Map progress") return "routine";
  if (/HALL_OF_FAME|GAME_CLEAR|OPENED_MT_SILVER|POWER_TO_KANTO|LEGENDARIES_IN_SOOTOPOLIS/.test(name)) return "story";
  return "routine";
}

function isImportant(name, category) {
  if (category === "Unused/unknown" || category === "Daily" || category === "Items" || category === "Trainers" || category === "Map objects" || category === "System state" || category === "Optional rewards" || category === "League challenge state") return false;
  if (/FOLLOWED_OAK_INTO_LAB|OAK_ASKED_TO_CHOOSE_MON|GOT_STARTER|OAK_GOT_PARCEL|GOT_OAKS_PARCEL|GOT_A_POKEMON_FROM_ELM|GOT_(?:CYNDAQUIL|TOTODILE|CHIKORITA)_FROM_ELM|GOT_MYSTERY_EGG_FROM_MR_POKEMON|GAVE_MYSTERY_EGG_TO_ELM|RESCUED_BIRCH/.test(name)) return true;
  return /BADGE|GYM|ELITE|CHAMPION|POKEDEX|POKENAV|HM[0-9]|_HM\d|TICKET|RIVAL|WALLY|ROCKET|AQUA|MAGMA|DEVON|SILPH|GIOVANNI|LANCE|WALLACE|KYOGRE_ESCAPED|WALLACE_GOES_TO_SKY_PILLAR|SUICUNE|GAME_CLEAR|HALL_OF_FAME|SS_TICKET|MACHINE_PART|POWER_TO_KANTO|OPENED_MT_SILVER|RED_IN_MT_SILVER/.test(name);
}

function parseAsmEvents(source) {
  const entries = [];
  let value = 0;
  let section = "Other";
  const constants = {};

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith(";")) {
      section = trimmed.replace(/^;\s*/, "") || section;
      continue;
    }

    const { body, comment } = stripComment(line);
    let match = body.match(/^const_def(?:\s+(.+))?$/);
    if (match) {
      value = match[1] ? evalAsmExpression(match[1], constants) : 0;
      continue;
    }
    match = body.match(/^const_next\s+(.+)$/);
    if (match) {
      value = evalAsmExpression(match[1], constants);
      continue;
    }
    match = body.match(/^const_skip(?:\s+(.+))?$/);
    if (match) {
      value += match[1] ? evalAsmExpression(match[1], constants) : 1;
      continue;
    }
    match = body.match(/^const\s+(EVENT_[A-Z0-9_]+)$/);
    if (match) {
      const key = match[1];
      constants[key] = value;
      const category = categorize(key, section, comment);
      entries.push({
        id: value,
        key,
        label: humanizeFlagName(key),
        category,
        importance: importanceFor(key, category),
        important: isImportant(key, category),
        stateKind: stateKindFor(key),
        note: comment || undefined,
      });
      value += 1;
      continue;
    }
    match = body.match(/^DEF\s+NUM_EVENTS\s+EQU\s+(.+)$/i);
    if (match) constants.NUM_EVENTS = evalAsmExpression(match[1], { ...constants, const_value: value });
  }

  return {
    flagCount: constants.NUM_EVENTS ?? Math.max(...entries.map((entry) => entry.id)) + 1,
    entries: entries.filter((entry) => entry.category !== "Unused/unknown"),
  };
}

function parseCExpression(expression, constants) {
  const js = expression
    .replace(/\/\*.*?\*\//g, "")
    .replace(/\b([A-Z_][A-Z0-9_]*)\b/g, (name) => {
      if (Object.hasOwn(constants, name)) return String(constants[name]);
      throw new Error(`Unknown constant ${name}`);
    });
  if (!/^[\d\s()+\-*/%<>&|.^xXa-fA-F]+$/.test(js)) throw new Error(`Unsafe expression ${expression}`);
  return Function(`"use strict"; return (${js});`)();
}

function parseCFlags(source, seed = {}) {
  const entries = [];
  const constants = { ...seed };
  let section = "Other";

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) {
      section = trimmed.replace(/^\/\/\s*/, "") || section;
      continue;
    }

    const match = line.match(/^#define\s+([A-Z0-9_]+)\s+(.+?)(?:\s*\/\/\s*(.*))?$/);
    if (!match) continue;
    const [, key, rawExpression, comment = ""] = match;
    if (!key.startsWith("FLAG_") || key.startsWith("FLAG_TEMP") || key.startsWith("FLAG_SPECIAL")) {
      try {
        constants[key] = parseCExpression(rawExpression.trim(), constants);
      } catch {
        // Constants with includes are not relevant unless referenced by FLAG_* values.
      }
      continue;
    }

    let id;
    try {
      id = parseCExpression(rawExpression.trim(), constants);
    } catch {
      continue;
    }
    constants[key] = id;
    if (id >= 0x4000) continue;
    const category = categorize(key, section, comment);
    if (category === "Unused/unknown") continue;
    entries.push({
      id,
      key,
      label: humanizeFlagName(key),
      category,
      importance: importanceFor(key, category),
      important: isImportant(key, category),
      stateKind: stateKindFor(key),
      note: comment || undefined,
    });
  }

  return {
    flagCount: Math.max(...entries.map((entry) => entry.id)) + 1,
    entries,
  };
}

function parseInitiallySetEvents(source) {
  const start = source.indexOf("InitializeEventsScript:");
  const body = start === -1
    ? source
    : source.slice(start).split(/\bendcallback\b/, 1)[0];
  return new Set(
    Array.from(body.matchAll(/^\s*set(?:event|flag)\s+((?:EVENT|FLAG)_[A-Z0-9_]+)/gm), (match) => match[1])
  );
}

function extractWramLabelOffset(source, label, constants, startLabel) {
  const lines = source.split(/\r?\n/);
  let active = false;
  let offset = 0;
  for (const line of lines) {
    if (line.includes(`${startLabel}::`)) {
      active = true;
      continue;
    }
    if (!active) continue;
    const labelMatch = stripComment(line).body.match(/^([A-Za-z0-9_{}]+)::/);
    if (labelMatch?.[1] === label) return offset;
    offset += directiveSize(line, constants);
  }
  throw new Error(`Missing ${label}`);
}

async function buildGame(args, key, profile, generation, parser) {
  const source = PINNED_SOURCES[key];
  const eventSource = await readSource(args, key, source.eventPath);
  const cSeed = key === "pokeruby"
    ? { SYSTEM_FLAGS: 0x800 }
    : key === "pokeemerald"
      ? { SYSTEM_FLAGS: 0x860 }
      : key === "pokefirered"
        ? { SYS_FLAGS: 0x800 }
        : {};
  const parsed = parser(eventSource, cSeed);
  const initiallySetEvents = source.initEventsPath
    ? parseInitiallySetEvents(await readSource(args, key, source.initEventsPath))
    : new Set();
  const layout = {
    generation,
    gameProfile: profile,
    sourceKey: source.sourceKey,
    flagCount: parsed.flagCount,
    entries: parsed.entries.map((entry) => {
      if (!initiallySetEvents.has(entry.key)) return entry;
      return {
        ...entry,
        initiallySet: true,
        important: false,
        importance: "routine",
        category: "Initial game state",
        note: "Set by the new-save initialization script; the raw bit alone is not proof that the named action was completed.",
      };
    }),
  };

  if (generation <= 2) {
    if (generation === 2) {
      const flagBytes = Math.ceil(parsed.flagCount / 8);
      const currentBoxOffset = profile === "crystal-en" ? 0x2700 : 0x2724;
      const saveBase = 0x2009;
      const liveBase = profile === "crystal-en" ? 0xd47b : 0xd1a1;
      const bytesBetweenEventFlagsAndCurrentBox = profile === "crystal-en" ? 0 : 5;
      const flagStart = currentBoxOffset - flagBytes - bytesBetweenEventFlagsAndCurrentBox;
      layout.flagStartOffset = `0x${flagStart.toString(16)}`;
      layout.liveFlagStartOffset = `0x${(liveBase + flagStart - saveBase).toString(16)}`;
      return layout;
    }

    const wram = await readSource(args, key, source.wramPath);
    const constants = collectAsmConstants(eventSource, {
      NUM_POKEMON: generation === 1 ? 151 : 251,
      NUM_BADGES: generation === 1 ? 8 : 16,
      NUM_EVENTS: parsed.flagCount,
      PARTY_LENGTH: 6,
      NAME_LENGTH: 11,
      BAG_ITEM_CAPACITY: 20,
      PC_ITEM_CAPACITY: 50,
      NUM_BOXES: generation === 1 ? 12 : 14,
      MONS_PER_BOX: 20,
      MAX_HIDDEN_ITEMS: 64,
      MAX_HIDDEN_COINS: 16,
      NUM_CITY_MAPS: generation === 1 ? 11 : 32,
      MAX_WARP_EVENTS: 32,
      MAX_BG_EVENTS: 16,
      MAX_OBJECT_EVENTS: 16,
      SPRITE_SET_LENGTH: 11,
    });
    const base = generation === 1 ? 0x25a3 : 0x2009;
    const startLabel = generation === 1 ? "wMainDataStart" : "wGameData";
    const liveBase = generation === 1 ? 0xd2f7 : profile === "crystal-en" ? 0xd473 : 0xd1a1;
    const labelOffset = extractWramLabelOffset(wram, "wEventFlags", constants, startLabel);
    // Gen 1's saved event array starts at $29f3 for both profiles. Yellow's
    // live WRAM layout is one byte earlier than Red/Blue, matching the other
    // Yellow player-data symbols (for example wPokedexOwned).
    const saveCorrection = profile === "red-blue-en" ? 6 : profile === "yellow-en" ? -12 : 0;
    const liveCorrection = profile === "red-blue-en" ? 6 : profile === "yellow-en" ? -13 : 0;
    layout.flagStartOffset = `0x${(base + labelOffset + saveCorrection).toString(16)}`;
    layout.liveFlagStartOffset = `0x${(liveBase + labelOffset + liveCorrection).toString(16)}`;
  }

  return layout;
}

const args = parseArgs(process.argv.slice(2));
const provenance = await readJson("provenance.json");
for (const [key, source] of Object.entries(PINNED_SOURCES)) {
  if (args[key]) {
    provenance[source.sourceKey].commit = await getCommit(args[key]);
    provenance[source.sourceKey].path = [source.eventPath, source.wramPath, source.initEventsPath].filter(Boolean).join(", ");
  }
}

const eventFlags = {
  gen1: {
    redBlue: await buildGame(args, "pokered", "red-blue-en", 1, parseAsmEvents),
    yellow: await buildGame(args, "pokeyellow", "yellow-en", 1, parseAsmEvents),
  },
  gen2: {
    goldSilver: await buildGame(args, "pokegold", "gold-silver-en", 2, parseAsmEvents),
    crystal: await buildGame(args, "pokecrystal", "crystal-en", 2, parseAsmEvents),
  },
  gen3: {
    rubySapphire: await buildGame(args, "pokeruby", "ruby-sapphire-en", 3, parseCFlags),
    emerald: await buildGame(args, "pokeemerald", "emerald-en", 3, parseCFlags),
    fireRedLeafGreen: await buildGame(args, "pokefirered", "firered-leafgreen-en", 3, parseCFlags),
  },
};

await writeJson("event-flags.json", eventFlags);
await writeJson("provenance.json", provenance);
console.log("Extracted Pokemon event flags.");
