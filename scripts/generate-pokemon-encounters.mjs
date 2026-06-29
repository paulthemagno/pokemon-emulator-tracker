import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputPath = path.join(root, "lib/pokemon/data/pokemon-encounters.json");
const maxSpeciesId = 386;
const concurrency = 6;

const versionProfiles = new Map([
  ["red", "red-blue"],
  ["blue", "red-blue"],
  ["yellow", "yellow"],
  ["gold", "gold-silver"],
  ["silver", "gold-silver"],
  ["crystal", "crystal"],
  ["ruby", "ruby-sapphire"],
  ["sapphire", "ruby-sapphire"],
  ["emerald", "emerald"],
  ["firered", "firered-leafgreen"],
  ["leafgreen", "firered-leafgreen"],
]);

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "pokemon-emulator-tracker knowledge generator",
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
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

function getLocationAreaId(url) {
  const match = String(url ?? "").match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : 0;
}

function normalizeConditions(values) {
  return values
    .map((entry) => entry?.name)
    .filter(Boolean)
    .sort()
    .join(",");
}

const speciesIds = Array.from({ length: maxSpeciesId }, (_, index) => index + 1);
const rowByKey = new Map();

await mapLimit(speciesIds, concurrency, async (speciesId, index) => {
  if ((index + 1) % 25 === 0) {
    console.log(`Fetched encounters ${index + 1}/${speciesIds.length}`);
  }

  const pokemon = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
  const encounters = await fetchJson(pokemon.location_area_encounters);

  for (const area of encounters ?? []) {
    const locationArea = area.location_area?.name;
    const locationAreaId = getLocationAreaId(area.location_area?.url);
    if (!locationArea) continue;

    for (const versionDetail of area.version_details ?? []) {
      const profile = versionProfiles.get(versionDetail.version?.name);
      if (!profile) continue;

      for (const detail of versionDetail.encounter_details ?? []) {
        const method = detail.method?.name ?? "unknown";
        const minLevel = detail.min_level ?? 0;
        const maxLevel = detail.max_level ?? 0;
        const chance = detail.chance ?? versionDetail.max_chance ?? 0;
        const conditions = normalizeConditions(detail.condition_values ?? []);
        const key = [
          speciesId,
          profile,
          locationAreaId,
          locationArea,
          method,
          minLevel,
          maxLevel,
          conditions,
        ].join("|");
        const existing = rowByKey.get(key);
        if (!existing || existing.chance < chance) {
          rowByKey.set(key, {
            speciesId,
            profile,
            locationAreaId,
            locationArea,
            method,
            minLevel,
            maxLevel,
            chance,
            conditions,
          });
        }
      }
    }
  }
});

const rows = [...rowByKey.values()].sort(
  (left, right) =>
    left.speciesId - right.speciesId ||
    left.profile.localeCompare(right.profile) ||
    left.locationArea.localeCompare(right.locationArea) ||
    left.method.localeCompare(right.method) ||
    left.minLevel - right.minLevel ||
    left.maxLevel - right.maxLevel
);

const body = `${JSON.stringify(
  {
    generatedBy: "scripts/generate-pokemon-encounters.mjs",
    source: "PokeAPI pokemon location_area_encounters for National Dex 1-386.",
    schema: [
      "speciesId",
      "gameProfile",
      "locationAreaId",
      "locationArea",
      "method",
      "minLevel",
      "maxLevel",
      "chance",
      "conditions",
    ],
    rows: rows.map((row) => [
      row.speciesId,
      row.profile,
      row.locationAreaId,
      row.locationArea,
      row.method,
      row.minLevel,
      row.maxLevel,
      row.chance,
      row.conditions,
    ]),
  },
  null,
  0
)}\n`;

await fs.writeFile(outputPath, body);
console.log(`Wrote ${rows.length} encounter rows to ${outputPath}`);
