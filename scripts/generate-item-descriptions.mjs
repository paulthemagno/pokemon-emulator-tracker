import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const itemsPath = path.join(root, "lib/pokemon/data/items.ts");
const outputPath = path.join(root, "lib/pokemon/data/item-descriptions.ts");

const ITEM_NAME_ALIASES = {
  "parlyz heal": "paralyze-heal",
  "guard spec": "guard-spec",
  "x defend": "x-defense",
  "x special": "x-sp-atk",
  "max elixer": "max-elixir",
  elixer: "elixir",
  "poke ball": "poke-ball",
  pokeball: "poke-ball",
  "ss ticket": "ss-ticket",
  "oaks parcel": "parcel",
  bicycle: "bike",
  "bike voucher": "bike",
  itemfinder: "dowsing-machine",
  "exp all": "exp-share",
  "exp share": "exp-share",
  brightpowder: "bright-powder",
  secretpotion: "secret-potion",
  "kings rock": "kings-rock",
  psncureberry: "pecha-berry",
  przcureberry: "cheri-berry",
  "burnt berry": "aspear-berry",
  "ice berry": "rawst-berry",
  "bitter berry": "persim-berry",
  "mint berry": "chesto-berry",
  berry: "oran-berry",
  "gold berry": "sitrus-berry",
  mysteryberry: "leppa-berry",
  miracleberry: "lum-berry",
  tinymushroom: "tiny-mushroom",
  silverpowder: "silver-powder",
  twistedspoon: "twisted-spoon",
  blackbelt: "black-belt",
  blackglasses: "black-glasses",
  slowpoketail: "slowpoke-tail",
  nevermeltice: "never-melt-ice",
  ragecandybar: "rage-candy-bar",
  energypowder: "energy-powder",
  berserkgene: "berserk-gene",
  squirtbottle: "squirt-bottle",
  litebluemail: "liteblue-mail",
  portraitmail: "portrait-mail",
  bluesky: "bluesky-mail",
  "pink bow": "silk-scarf",
  "polkadot bow": "silk-scarf",
  "devon goods": "devon-parts",
  "pokeblock case": "pokeblock-kit",
  "rm 1 key": "key-to-room-1",
  "rm 2 key": "key-to-room-2",
  "rm 4 key": "key-to-room-4",
  "rm 6 key": "key-to-room-6",
};

const LOCAL_DESCRIPTIONS = {
  "tm-normal": "Teaches a move to a compatible Pokemon. In Gen 1-3, TMs are single-use.",
  "hm-normal": "Teaches a field move to a compatible Pokemon. HMs can be reused.",
  "exp-share": "Shares experience with another Pokemon or the party, depending on generation.",
  bike: "Lets you move faster while traveling.",
  "dowsing-machine": "Helps locate hidden items.",
  "poke-flute": "Wakes sleeping Pokemon.",
  "coin-case": "Stores coins for the Game Corner.",
  "clear-bell": "A key item connected to Ho-Oh in Crystal.",
  "silver-wing": "A key item connected to Lugia.",
  "rainbow-wing": "A key item connected to Ho-Oh.",
  "red-scale": "A scale from the red Gyarados.",
  "machine-part": "A missing part needed for the Power Plant.",
  "mystery-egg": "An egg entrusted to the player.",
  parcel: "A parcel that must be delivered.",
};

function normalizeText(text) {
  return String(text ?? "")
    .replace(/\f/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\$effect_chance/g, "")
    .trim();
}

function getSlug(itemName) {
  const normalized = itemName
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/['’]/g, "")
    .replace(/é/g, "e")
    .replace(/\s+/g, " ")
    .trim();
  if (/^tm\d+\b/.test(normalized)) return "tm-normal";
  if (/^hm\d+\b/.test(normalized)) return "hm-normal";
  return ITEM_NAME_ALIASES[normalized] ?? normalized.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function extractBlock(source, name) {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) return "";
  const next = source.indexOf("\n};", start);
  return source.slice(start, next);
}

function collectItemNames(source) {
  const names = new Set();

  for (const blockName of ["GEN1_ITEMS", "GEN2_ITEMS"]) {
    const block = extractBlock(source, blockName);
    for (const match of block.matchAll(/:\s*"([^"]+)"/g)) {
      names.add(match[1]);
    }
  }

  const gen3Start = source.indexOf("export const GEN3_ITEMS");
  const gen3End = source.indexOf("];", gen3Start);
  const gen3Block = source.slice(gen3Start, gen3End);
  for (const match of gen3Block.matchAll(/name:\s*"([^"]+)"/g)) {
    names.add(match[1]);
  }

  return [...names].filter((name) => !["None", "Nothing", "?????"].includes(name));
}

async function fetchPokeApiItem(slug) {
  if (slug === "tm-normal" || slug === "hm-normal") return null;
  const response = await fetch(`https://pokeapi.co/api/v2/item/${slug}`);
  if (!response.ok) return null;
  return response.json();
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, run));
  return results;
}

function toEntry(slug, names, data) {
  const flavorTexts = {};
  for (const entry of data?.flavor_text_entries ?? []) {
    if (entry.language?.name !== "en" || !entry.version_group?.name) continue;
    const text = normalizeText(entry.text);
    if (text && !flavorTexts[entry.version_group.name]) {
      flavorTexts[entry.version_group.name] = text;
    }
  }

  const shortEffect = normalizeText(
    data?.effect_entries?.find((entry) => entry.language?.name === "en")?.short_effect
  );
  const firstFlavor = Object.values(flavorTexts)[0];
  const fallback = LOCAL_DESCRIPTIONS[slug];

  return {
    slug,
    names: [...names].sort(),
    flavorText: firstFlavor || fallback || shortEffect || "",
    flavorTexts,
    shortEffect: shortEffect || undefined,
    source: data ? "pokeapi" : "local",
  };
}

const source = await fs.readFile(itemsPath, "utf8");
const itemNames = collectItemNames(source);
const namesBySlug = new Map();
for (const name of itemNames) {
  const slug = getSlug(name);
  if (!namesBySlug.has(slug)) namesBySlug.set(slug, new Set());
  namesBySlug.get(slug).add(name);
}

const slugs = [...namesBySlug.keys()].sort();
const entries = await mapLimit(slugs, 8, async (slug, index) => {
  if ((index + 1) % 25 === 0) {
    console.log(`Fetched ${index + 1}/${slugs.length}`);
  }
  let data = null;
  try {
    data = await fetchPokeApiItem(slug);
  } catch {
    data = null;
  }
  return toEntry(slug, namesBySlug.get(slug), data);
});

const body = `// Generated by scripts/generate-item-descriptions.mjs.
// Source: PokeAPI item flavor/effect data, with local fallbacks for legacy Gen 1-3 names.

export interface ItemDescriptionData {
  slug: string;
  names: string[];
  flavorText: string;
  flavorTexts: Record<string, string>;
  shortEffect?: string;
  source: "pokeapi" | "local";
}

export const ITEM_DESCRIPTIONS: Record<string, ItemDescriptionData> = ${JSON.stringify(
  Object.fromEntries(entries.map((entry) => [entry.slug, entry])),
  null,
  2
)};
`;

await fs.writeFile(outputPath, body);
console.log(`Wrote ${entries.length} item descriptions to ${outputPath}`);
