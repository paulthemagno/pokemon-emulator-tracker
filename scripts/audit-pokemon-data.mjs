import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

function countMatches(text, regex) {
  return [...text.matchAll(regex)].length;
}

function sourceCounts(text) {
  return {
    pokeapi: countMatches(text, /"source":\s*"pokeapi"/g),
    local: countMatches(text, /"source":\s*"local"/g),
  };
}

function extractObjectBlock(text, exportName) {
  const start = text.indexOf(`export const ${exportName}`);
  if (start < 0) return "";
  const end = text.indexOf("\n};", start);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

function extractArrayBlock(text, exportName) {
  const start = text.indexOf(`export const ${exportName}`);
  if (start < 0) return "";
  const end = text.indexOf("\n];", start);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

async function fileExists(relativePath) {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function printSection(title) {
  console.log(`\n## ${title}`);
}

const requiredDocs = [
  "docs/pokemon-source-policy.md",
  "docs/game-support-matrix.md",
  "docs/llm-pokemon-agent.md",
  "docs/source-lockfile.md",
  "agents/pokemon-research-agent/SKILL.md",
];

const requiredKnowledgeFiles = [
  "lib/pokemon/knowledge/provenance.ts",
  "lib/pokemon/knowledge/inventory-layouts.ts",
  "lib/pokemon/knowledge/item-id-ranges.ts",
  "lib/pokemon/knowledge/species-id-maps.ts",
  "lib/pokemon/knowledge/save-layouts.ts",
  "lib/pokemon/knowledge/event-flags.ts",
  "lib/pokemon/knowledge/event-guides.ts",
  "live-adapters/generated/gen1-live-offsets.lua",
  "live-adapters/generated/gen2-live-offsets.lua",
  "live-adapters/generated/gen3-live-offsets.lua",
  "lib/pokemon/knowledge/index.ts",
  "lib/pokemon/knowledge/sources/provenance.json",
  "lib/pokemon/knowledge/sources/inventory-layouts.json",
  "lib/pokemon/knowledge/sources/item-id-ranges.json",
  "lib/pokemon/knowledge/sources/species-id-maps.json",
  "lib/pokemon/knowledge/sources/save-layouts.json",
  "lib/pokemon/knowledge/sources/event-flags.json",
  "lib/pokemon/knowledge/sources/event-contexts.json",
  "lib/pokemon/knowledge/sources/event-guides.json",
  "lib/pokemon/knowledge/sources/game-guide-sources.json",
  "lib/pokemon/knowledge/sources/progress-fact-candidates.json",
  "docs/progress-facts-prototype.md",
];

printSection("Documentation");
for (const docPath of requiredDocs) {
  console.log(`${await fileExists(docPath) ? "ok" : "missing"} ${docPath}`);
}

printSection("Knowledge Modules");
for (const knowledgePath of requiredKnowledgeFiles) {
  console.log(`${await fileExists(knowledgePath) ? "ok" : "missing"} ${knowledgePath}`);
}

const itemDescriptions = await readText("lib/pokemon/data/item-descriptions.ts");
const moveDescriptions = await readText("lib/pokemon/data/move-descriptions.ts");
const items = await readText("lib/pokemon/data/items.ts");
const moves = await readText("lib/pokemon/data/moves.ts");
const species = await readText("lib/pokemon/data/species.ts");
const inventoryKnowledge = await readText("lib/pokemon/knowledge/inventory-layouts.ts");
const itemRangeKnowledge = await readText("lib/pokemon/knowledge/item-id-ranges.ts");
const speciesIdMapKnowledge = await readText("lib/pokemon/knowledge/species-id-maps.ts");
const saveLayoutKnowledge = await readText("lib/pokemon/knowledge/save-layouts.ts");
const eventFlagKnowledge = await readText("lib/pokemon/knowledge/event-flags.ts");
const eventGuideKnowledge = await readText("lib/pokemon/knowledge/event-guides.ts");
const provenanceKnowledge = await readText("lib/pokemon/knowledge/provenance.ts");
const gen1LiveOffsets = await readText("live-adapters/generated/gen1-live-offsets.lua");
const gen2LiveOffsets = await readText("live-adapters/generated/gen2-live-offsets.lua");
const gen1Parser = await readText("lib/pokemon/parsers/gen1.ts");
const gen3Parser = await readText("lib/pokemon/parsers/gen3.ts");

printSection("Generated Description Sources");
const itemSources = sourceCounts(itemDescriptions);
const moveSources = sourceCounts(moveDescriptions);
console.log(`item descriptions: ${itemSources.pokeapi} pokeapi, ${itemSources.local} local fallback`);
console.log(`move descriptions: ${moveSources.pokeapi} pokeapi, ${moveSources.local} local fallback`);

printSection("Static Table Shape");
console.log(`Gen 1 item IDs: ${countMatches(extractObjectBlock(items, "GEN1_ITEMS"), /0x[0-9a-fA-F]+:\s*"/g)}`);
console.log(`Gen 2 item IDs: ${countMatches(extractObjectBlock(items, "GEN2_ITEMS"), /0x[0-9a-fA-F]+:\s*"/g)}`);
console.log(`Gen 3 item rows: ${countMatches(extractArrayBlock(items, "GEN3_ITEMS"), /\{\s*id:\s*\d+,\s*name:\s*"/g)}`);
console.log(`Move rows: ${countMatches(moves, /\{\s*id:\s*\d+,\s*name:\s*"/g)}`);
console.log(`Species rows: ${countMatches(species, /\{\s*id:\s*\d+,\s*name:\s*"/g)}`);

printSection("Knowledge Coverage");
console.log(`inventory layout pocket rows: ${countMatches(inventoryKnowledge, /\{\s*name:\s*"/g)}`);
console.log(`item id ranges: ${countMatches(itemRangeKnowledge, /start:\s*0x[0-9a-f]+/g)}`);
console.log(`Gen 3 species ID map rows: ${countMatches(speciesIdMapKnowledge, /internal:\s*\d+/g)}`);
console.log(`save layout profiles: ${countMatches(saveLayoutKnowledge, /gameProfile:\s*"/g)}`);
console.log(`event flag rows: ${countMatches(eventFlagKnowledge, /key:\s*"(?:EVENT|FLAG)_/g)}`);
console.log(`event guide rows: ${countMatches(eventGuideKnowledge, /(?:EVENT|FLAG)_[A-Z0-9_]+:\s*\{/g)}`);
if (await fileExists("lib/pokemon/knowledge/sources/event-contexts.json")) {
  const eventContexts = await readText("lib/pokemon/knowledge/sources/event-contexts.json");
  console.log(`event context profiles: ${countMatches(eventContexts, /"gameProfile"|"summary"/g)}`);
  console.log(`event source context rows: ${countMatches(eventContexts, /"operation":\s*"/g)}`);
}
if (await fileExists("lib/pokemon/knowledge/sources/event-guides.json")) {
  const eventGuides = await readText("lib/pokemon/knowledge/sources/event-guides.json");
  console.log(`event guide online refs: ${countMatches(eventGuides, /https?:\/\/(?!github\.com)/g)}`);
}
if (await fileExists("lib/pokemon/knowledge/sources/game-guide-sources.json")) {
  const gameGuideSources = await readText("lib/pokemon/knowledge/sources/game-guide-sources.json");
  console.log(`catalogued online game guides: ${countMatches(gameGuideSources, /"kind":\s*"(?:walkthrough|checklist|reference)"/g)}`);
}
if (await fileExists("lib/pokemon/knowledge/sources/progress-fact-candidates.json")) {
  const progressFacts = await readText("lib/pokemon/knowledge/sources/progress-fact-candidates.json");
  console.log(`source-audited progress fact candidates: ${countMatches(progressFacts, /"id":\s*"gen[123]-/g)}`);
}

printSection("Known Parser Gaps");
const gaps = [
  {
    id: "gen1-yellow-detection",
    ok: !gen1Parser.includes("const isYellow = false"),
    detail: "Yellow detection is still hardcoded false in the Gen 1 parser.",
  },
  {
    id: "gen1-pokedex-flags",
    ok: saveLayoutKnowledge.includes("pokedexOwned: 0x25a3") && saveLayoutKnowledge.includes("pokedexSeen: 0x25b6"),
    detail: "Gen 1 Pokedex owned/seen flags are not centralized in generated save layouts.",
  },
  {
    id: "gen1-pc-boxes",
    ok: saveLayoutKnowledge.includes("currentBoxData: 0x30c0") && gen1Parser.includes("parsePCBoxRecord"),
    detail: "Gen 1 PC boxes still use placeholder boxes instead of generated banked SRAM parsing.",
  },
  {
    id: "knowledge-inventory-layouts",
    ok: inventoryKnowledge.includes("GEN1_INVENTORY_LAYOUT")
      && inventoryKnowledge.includes("GEN2_INVENTORY_LAYOUTS")
      && inventoryKnowledge.includes("GEN3_INVENTORY_LAYOUTS"),
    detail: "Inventory layouts are not centralized in lib/pokemon/knowledge/inventory-layouts.ts.",
  },
  {
    id: "knowledge-generated-modules",
    ok: provenanceKnowledge.includes("Generated by scripts/generate-pokemon-knowledge.mjs")
      && inventoryKnowledge.includes("Generated by scripts/generate-pokemon-knowledge.mjs")
      && itemRangeKnowledge.includes("Generated by scripts/generate-pokemon-knowledge.mjs")
      && speciesIdMapKnowledge.includes("Generated by scripts/generate-pokemon-knowledge.mjs")
      && saveLayoutKnowledge.includes("Generated by scripts/generate-pokemon-knowledge.mjs")
      && eventFlagKnowledge.includes("Generated by scripts/generate-pokemon-knowledge.mjs")
      && eventGuideKnowledge.includes("Generated by scripts/generate-pokemon-knowledge.mjs"),
    detail: "Knowledge modules are not marked as generated by scripts/generate-pokemon-knowledge.mjs.",
  },
  {
    id: "knowledge-event-flags",
    ok: eventFlagKnowledge.includes("GEN1_EVENT_FLAGS")
      && eventFlagKnowledge.includes("GEN2_EVENT_FLAGS")
      && eventFlagKnowledge.includes("GEN3_EVENT_FLAGS"),
    detail: "Event flag definitions are not centralized in lib/pokemon/knowledge/event-flags.ts.",
  },
  {
    id: "knowledge-save-layouts",
    ok: saveLayoutKnowledge.includes("GEN1_SAVE_LAYOUTS") && saveLayoutKnowledge.includes("GEN2_SAVE_LAYOUTS"),
    detail: "Gen 1/2 save offsets are not centralized in generated save-layouts.ts.",
  },
  {
    id: "knowledge-live-layouts",
    ok: gen1LiveOffsets.includes("Generated by scripts/generate-pokemon-knowledge.mjs")
      && gen1LiveOffsets.includes("red_blue")
      && gen1LiveOffsets.includes("yellow")
      && gen2LiveOffsets.includes("Generated by scripts/generate-pokemon-knowledge.mjs")
      && gen2LiveOffsets.includes("gold_silver")
      && gen2LiveOffsets.includes("pcStorage = 0x247e"),
    detail: "Gen 1/2 live offsets are not generated into live-adapters/generated/.",
  },
  {
    id: "knowledge-item-id-ranges",
    ok: itemRangeKnowledge.includes("gen1Tms") && itemRangeKnowledge.includes("gen2Tms"),
    detail: "TM/HM item ID ranges are not centralized in lib/pokemon/knowledge/item-id-ranges.ts.",
  },
  {
    id: "gen3-level-growth",
    ok: !gen3Parser.includes("Simplified level calculation"),
    detail: "Gen 3 level calculation still uses a simplified growth approximation.",
  },
  {
    id: "gen3-gender-ratio",
    ok: !gen3Parser.includes("Simplified - would need species gender ratios"),
    detail: "Gen 3 gender calculation still lacks species gender ratios.",
  },
  {
    id: "gen3-inventory-offsets",
    ok: !gen3Parser.includes("Using Emerald offsets as base"),
    detail: "Gen 3 inventory still uses Emerald offsets as a base for every game.",
  },
  {
    id: "gen3-species-id-map",
    ok: speciesIdMapKnowledge.includes("getGen3NationalSpeciesId")
      && gen3Parser.includes("getGen3NationalSpeciesId"),
    detail: "Gen 3 parser still displays internal species IDs as National Dex IDs.",
  },
];

for (const gap of gaps) {
  console.log(`${gap.ok ? "ok" : "gap"} ${gap.id}: ${gap.ok ? "resolved" : gap.detail}`);
}

const hasPokeApiRuntimeHints = [
  "lib/pokemon/utils.ts",
  "components/pokemon/item-icon.tsx",
  "components/pokemon/item-info-tooltip.tsx",
  "components/pokemon/move-info-tooltip.tsx",
];

printSection("Runtime Remote Data Check");
for (const relativePath of hasPokeApiRuntimeHints) {
  const text = await readText(relativePath);
  const urls = countMatches(text, /https?:\/\/[^"`')\s]+/g);
  console.log(`${relativePath}: ${urls} URL literal(s)`);
}

console.log("\nAudit complete.");
