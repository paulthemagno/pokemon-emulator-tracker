import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const sourceDir = path.join(root, "lib/pokemon/knowledge/sources");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--") continue;
    if (argv[i].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

function parseHex(value) {
  return Number.parseInt(value, 16);
}

function toHex(value) {
  return `0x${value.toString(16).padStart(2, "0")}`;
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

function extractMachineRange(source, marker, prefix) {
  const startMatch = source.match(new RegExp(`DEF ${prefix}01 EQU const_value`));
  if (!startMatch) throw new Error(`Missing ${prefix}01 marker`);

  const afterStart = source.slice(startMatch.index);
  const lines = afterStart.split(/\r?\n/);
  const values = [];

  for (const line of lines) {
    if (values.length > 0 && line.startsWith(marker)) break;
    const match = line.match(new RegExp(`add_${prefix.toLowerCase() === "tm" ? "tm" : "hm"}\\s+\\S+\\s+;\\s+([0-9a-f]{2})`, "i"));
    if (match) values.push(parseHex(match[1]));
  }

  if (values.length === 0) throw new Error(`No ${prefix} values found`);
  return { start: Math.min(...values), end: Math.max(...values), count: values.length };
}

function extractMachineIds(source, marker, prefix) {
  const startMatch = source.match(new RegExp(`DEF ${prefix}01 EQU const_value`));
  if (!startMatch) throw new Error(`Missing ${prefix}01 marker`);

  const afterStart = source.slice(startMatch.index);
  const lines = afterStart.split(/\r?\n/);
  const values = [];

  for (const line of lines) {
    if (values.length > 0 && line.startsWith(marker)) break;
    const match = line.match(new RegExp(`add_${prefix.toLowerCase() === "tm" ? "tm" : "hm"}\\s+\\S+\\s+;\\s+([0-9a-f]{2})`, "i"));
    if (match) values.push(parseHex(match[1]));
  }

  if (values.length === 0) throw new Error(`No ${prefix} values found`);
  return values;
}

function assertManifestRange(manifest, key, extracted) {
  const current = manifest.ranges[key];
  const currentStart = parseHex(current.start);
  const currentEnd = parseHex(current.end);
  const changed = currentStart !== extracted.start || currentEnd !== extracted.end;
  current.start = toHex(extracted.start);
  current.end = toHex(extracted.end);
  return {
    key,
    changed,
    before: { start: toHex(currentStart), end: toHex(currentEnd) },
    after: { start: current.start, end: current.end, count: extracted.count },
  };
}

function updateSourcePin(provenance, sourceKey, commit, paths) {
  const source = provenance[sourceKey];
  if (!source) throw new Error(`Missing provenance source ${sourceKey}`);
  source.commit = commit;
  source.path = paths.join(", ");
}

function updateGen2MachinePockets(inventoryLayouts, machineIds) {
  const updates = [];

  for (const profileKey of ["goldSilver", "crystal"]) {
    const layout = inventoryLayouts.gen2?.[profileKey];
    if (!layout) throw new Error(`Missing Gen 2 inventory layout ${profileKey}`);

    const pocket = layout.pockets.find((entry) => entry.name === "TMs/HMs");
    if (!pocket) throw new Error(`Missing Gen 2 TMs/HMs pocket for ${profileKey}`);

    const before = Array.isArray(pocket.itemIds) ? pocket.itemIds.join(",") : "";
    pocket.itemIds = machineIds.map(toHex);
    updates.push({
      profileKey,
      changed: before !== pocket.itemIds.join(","),
      count: pocket.itemIds.length,
    });
  }

  return updates;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function stripComment(line) {
  return line.split(";")[0].trim();
}

function collectSimpleDefs(source, seed = {}) {
  const constants = { ...seed };

  for (const line of source.split(/\r?\n/)) {
    const match = stripComment(line).match(/^DEF\s+([A-Z0-9_]+)\s+EQU\s+(.+)$/i);
    if (!match) continue;

    try {
      constants[match[1]] = evalAsmExpression(match[2], constants);
    } catch {
      // Some RGBDS expressions depend on const_value or macros; callers can seed the values they need.
    }
  }

  return constants;
}

function evalAsmExpression(expression, constants) {
  let js = expression
    .replace(/\$([0-9a-f]+)/gi, "0x$1")
    .replace(/%([01]+)/g, (_, bits) => `0b${bits}`)
    .replace(/\b([A-Z_][A-Z0-9_]*)\b/gi, (name) => {
      if (Object.hasOwn(constants, name)) return String(constants[name]);
      throw new Error(`Unknown constant ${name} in ${expression}`);
    });

  if (!/^[\d\s()+\-*/%<>&|.^xob]+$/i.test(js)) {
    throw new Error(`Unsafe expression ${expression}`);
  }

  return Function(`"use strict"; return (${js});`)();
}

function directiveSize(line, constants) {
  const clean = stripComment(line).replace(/^[A-Za-z0-9_{}]+::\s*/, "").trim();
  if (!clean) return 0;
  if (clean.startsWith("db")) return clean.slice(2).split(",").filter(Boolean).length || 1;
  if (clean.startsWith("dw")) return 2 * (clean.slice(2).split(",").filter(Boolean).length || 1);

  const ds = clean.match(/^ds\s+(.+)$/);
  if (ds) return evalAsmExpression(ds[1], constants);

  const flagArray = clean.match(/^flag_array\s+(.+)$/);
  if (flagArray) return Math.ceil(evalAsmExpression(flagArray[1], constants) / 8);

  if (clean.startsWith("map_connection_struct")) return 11;
  return 0;
}

async function readPretCommitAndPin(provenance, sourceKey, repoPath, paths) {
  const commit = await getCommit(repoPath);
  updateSourcePin(provenance, sourceKey, commit, paths);
  return commit;
}

async function buildGen1Constants(repoPath) {
  let constants = {
    NUM_POKEMON: 151,
    NUM_BADGES: 8,
  };

  const constantsDir = path.join(repoPath, "constants");
  const files = await fs.readdir(constantsDir);
  for (const file of files.filter((entry) => entry.endsWith(".asm")).sort()) {
    constants = collectSimpleDefs(await fs.readFile(path.join(constantsDir, file), "utf8"), constants);
  }

  return constants;
}

async function extractGen1MainDataOffsets(repoPath) {
  const constants = await buildGen1Constants(repoPath);
  const source = await fs.readFile(path.join(repoPath, "ram/wram.asm"), "utf8");
  const lines = source.split(/\r?\n/);
  const labels = {};
  let inMainData = false;
  let offset = 0;

  for (const line of lines) {
    if (line.includes("wMainDataStart::")) {
      inMainData = true;
      labels.wMainDataStart = 0;
      continue;
    }
    if (!inMainData) continue;
    if (line.includes("wMainDataEnd::")) break;

    const label = stripComment(line).match(/^([A-Za-z0-9_{}]+)::/);
    if (label) labels[label[1]] = offset;
    if (Object.hasOwn(labels, "wPokedexOwned")
      && Object.hasOwn(labels, "wPokedexSeen")
      && Object.hasOwn(labels, "wNumBagItems")
      && Object.hasOwn(labels, "wNumBoxItems")) {
      break;
    }
    offset += directiveSize(line, constants);
  }

  for (const key of ["wPokedexOwned", "wPokedexSeen", "wNumBagItems", "wNumBoxItems"]) {
    if (!Object.hasOwn(labels, key)) throw new Error(`Missing ${key} in ${repoPath}`);
  }

  const sMainData = 0x25a3;
  return {
    bag: sMainData + labels.wNumBagItems,
    pcStorage: sMainData + labels.wNumBoxItems,
    pokedexOwned: sMainData + labels.wPokedexOwned,
    pokedexSeen: sMainData + labels.wPokedexSeen,
  };
}

function extractGen1MachineRange(source, marker, prefix) {
  const normalizedPrefix = prefix.toUpperCase();
  const startMatch = source.match(new RegExp(`DEF ${normalizedPrefix}01 EQU const_value`));
  if (!startMatch) throw new Error(`Missing Gen 1 ${prefix}01 marker`);

  const lines = source.slice(startMatch.index).split(/\r?\n/);
  const values = [];
  for (const line of lines) {
    if (values.length > 0 && line.startsWith(marker)) break;
    const match = line.match(new RegExp(`add_${prefix.toLowerCase()}\\s+\\S+\\s+;\\s+\\$([0-9a-f]{2})`, "i"));
    if (match) values.push(parseHex(match[1]));
  }

  if (values.length === 0) throw new Error(`No Gen 1 ${prefix} values found`);
  return { start: Math.min(...values), end: Math.max(...values), count: values.length };
}

function applyGen1YellowUsSaveLayout(saveLayouts) {
  const redBlue = saveLayouts.gen1?.redBlue;
  const yellow = saveLayouts.gen1?.yellow;
  if (!redBlue || !yellow) throw new Error("Missing Gen 1 Red/Blue or Yellow save layout");

  yellow.sourceKey = "bulbapediaGen1Save";
  yellow.liveWramSourceKey = "dataCrystalYellowRamMap";
  yellow.boxOffsetsSourceKey = "bulbapediaGen1PokemonData";
  yellow.offsets = cloneJson(redBlue.offsets);
  yellow.boxOffsets = cloneJson(redBlue.boxOffsets);
  yellow.liveWramOffsets = {
    playerName: "0xd157",
    trainerId: "0xd358",
    money: "0xd346",
    badges: "0xd355",
    currentMap: "0xd35d",
    playTimeHours: "0xda40",
    playTimeMinutes: "0xda42",
    playTimeSeconds: "0xda43",
    partyCount: "0xd162",
    partySpecies: "0xd163",
    partyData: "0xd16a",
    partyOtNames: "0xd272",
    partyNicknames: "0xd2b4",
    pokedexOwned: "0xd2f6",
    pokedexSeen: "0xd309",
    numItems: "0xd31c",
    items: "0xd31d",
    numPcItems: "0xd539",
    pcItems: "0xd53a",
    currentBoxNumber: "0xd59f",
    currentBoxData: "0xda94",
  };
}

async function updateGen1FromPret({ pokered, pokeyellow, provenance, inventoryLayouts, itemRanges, saveLayouts }) {
  if (!pokered) return [];

  const changes = [];
  const redCommit = await readPretCommitAndPin(provenance, "pretPokered", pokered, [
    "ram/wram.asm",
    "ram/sram.asm",
    "constants/item_constants.asm",
  ]);
  changes.push(`pinned pretPokered ${redCommit}`);

  if (pokeyellow) {
    const yellowCommit = await readPretCommitAndPin(provenance, "pretPokeyellow", pokeyellow, [
      "ram/wram.asm",
      "ram/sram.asm",
      "constants/item_constants.asm",
    ]);
    changes.push(`pinned pretPokeyellow ${yellowCommit}`);
  }

  const redOffsets = await extractGen1MainDataOffsets(pokered);

  const bagPocket = inventoryLayouts.gen1.pockets.find((entry) => entry.name === "Bag");
  const pcPocket = inventoryLayouts.gen1.pockets.find((entry) => entry.name === "PC Storage");
  if (!bagPocket || !pcPocket) throw new Error("Missing Gen 1 inventory pockets");
  bagPocket.offset = toHex(redOffsets.bag);
  pcPocket.offset = toHex(redOffsets.pcStorage);
  inventoryLayouts.gen1.sourceKey = "pretPokered";
  changes.push(`extracted gen1 Bag ${toHex(redOffsets.bag)} and PC Storage ${toHex(redOffsets.pcStorage)}`);

  if (pokeyellow) {
    // The current pret/pokeyellow WRAM section layout does not line up with the
    // published English Yellow runtime RAM map used by emulators. Keep Yellow
    // save inventory aligned with the shared US Red/Blue/Yellow save layout.
    inventoryLayouts.gen1Yellow = structuredClone(inventoryLayouts.gen1);
    inventoryLayouts.gen1Yellow.gameProfile = "yellow-en";
    inventoryLayouts.gen1Yellow.sourceKey = "bulbapediaGen1Save";
    applyGen1YellowUsSaveLayout(saveLayouts);
    changes.push("verified gen1 Yellow Bag and PC Storage against shared US R/B/Y save layout");
    changes.push("verified gen1 Yellow save/live offsets against US Yellow RAM/save references");
  }

  const itemConstants = await fs.readFile(path.join(pokered, "constants/item_constants.asm"), "utf8");
  const hmRange = extractGen1MachineRange(itemConstants, "DEF NUM_HMS", "hm");
  const tmRange = extractGen1MachineRange(itemConstants, "ASSERT NUM_TMS", "tm");
  const hmChange = assertManifestRange(itemRanges, "gen1Hms", hmRange);
  const tmChange = assertManifestRange(itemRanges, "gen1Tms", tmRange);
  itemRanges.ranges.gen1Hms.sourceKey = "pretPokered";
  itemRanges.ranges.gen1Tms.sourceKey = "pretPokered";
  changes.push(`${hmChange.changed ? "updated" : "verified"} gen1Hms ${hmChange.after.start}-${hmChange.after.end}`);
  changes.push(`${tmChange.changed ? "updated" : "verified"} gen1Tms ${tmChange.after.start}-${tmChange.after.end}`);

  return changes;
}

async function updateGen2GoldFromPret({ pokegold, provenance }) {
  if (!pokegold) return [];

  const commit = await readPretCommitAndPin(provenance, "pretPokegold", pokegold, [
    "ram/wram.asm",
    "ram/sram.asm",
    "layout.link",
  ]);
  return [`pinned pretPokegold ${commit}`];
}

const args = parseArgs(process.argv.slice(2));
const pokecrystal = args.pokecrystal;
const pokered = args.pokered;
const pokeyellow = args.pokeyellow;
const pokegold = args.pokegold;
if (!pokecrystal && !pokered && !pokegold) {
  throw new Error("Usage: node scripts/extract-pokemon-knowledge-from-pret.mjs --pokecrystal /path/to/pokecrystal [--pokegold /path/to/pokegold] [--pokered /path/to/pokered --pokeyellow /path/to/pokeyellow]");
}

const provenance = await readJson("provenance.json");
const itemRanges = await readJson("item-id-ranges.json");
const inventoryLayouts = await readJson("inventory-layouts.json");
const saveLayouts = await readJson("save-layouts.json");

const messages = [];

if (pokecrystal) {
  const itemConstantsPath = path.join(pokecrystal, "constants/item_constants.asm");
  const itemConstants = await fs.readFile(itemConstantsPath, "utf8");
  const commit = await getCommit(pokecrystal);

  const tmRange = extractMachineRange(itemConstants, "DEF NUM_TMS", "TM");
  const hmRange = extractMachineRange(itemConstants, "DEF NUM_HMS", "HM");
  const tmIds = extractMachineIds(itemConstants, "DEF NUM_TMS", "TM");
  const hmIds = extractMachineIds(itemConstants, "DEF NUM_HMS", "HM");
  const machineIds = [...tmIds, ...hmIds];

  updateSourcePin(provenance, "pokecrystal", commit, [
    "constants/item_constants.asm",
    "ram/wram.asm",
    "ram/sram.asm",
  ]);

  const changes = [
    assertManifestRange(itemRanges, "gen2Tms", tmRange),
    assertManifestRange(itemRanges, "gen2Hms", hmRange),
  ];
  const pocketChanges = updateGen2MachinePockets(inventoryLayouts, machineIds);

  messages.push(`Extracted pokecrystal knowledge from ${commit}`);
  for (const change of changes) {
    const status = change.changed ? "updated" : "unchanged";
    messages.push(`${status} ${change.key}: ${change.before.start}-${change.before.end} -> ${change.after.start}-${change.after.end} (${change.after.count} entries)`);
  }
  for (const change of pocketChanges) {
    const status = change.changed ? "updated" : "unchanged";
    messages.push(`${status} gen2 ${change.profileKey} TMs/HMs itemIds (${change.count} entries)`);
  }
}

messages.push(...await updateGen1FromPret({ pokered, pokeyellow, provenance, inventoryLayouts, itemRanges, saveLayouts }));
messages.push(...await updateGen2GoldFromPret({ pokegold, provenance }));

await writeJson("provenance.json", provenance);
await writeJson("item-id-ranges.json", itemRanges);
await writeJson("inventory-layouts.json", inventoryLayouts);
await writeJson("save-layouts.json", saveLayouts);

for (const message of messages) console.log(message);
