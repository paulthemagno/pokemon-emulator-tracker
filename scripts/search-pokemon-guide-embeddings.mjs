import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(
  rootDir,
  "lib/pokemon/knowledge/walkthrough-embeddings.manifest.json"
);
const vectorsPath = path.join(
  rootDir,
  "lib/pokemon/knowledge/walkthrough-embeddings.f32"
);
const indexPath = path.join(rootDir, "lib/pokemon/knowledge/walkthrough-index.json");

async function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    try {
      const text = await fs.readFile(path.join(rootDir, fileName), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const index = trimmed.indexOf("=");
        const key = trimmed.slice(0, index).trim();
        const rawValue = trimmed.slice(index + 1).trim();
        if (!key || process.env[key] !== undefined) continue;
        process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function parseArgs() {
  const args = new Map();
  for (const argument of process.argv.slice(2)) {
    if (!argument.startsWith("--")) continue;
    const [key, ...rest] = argument.slice(2).split("=");
    args.set(key, rest.length > 0 ? rest.join("=") : "true");
  }
  return args;
}

function l2Normalize(vector) {
  const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  return norm > 0 ? vector.map((value) => value / norm) : vector;
}

function normalizeOllamaModelName(value) {
  return value.endsWith(":latest") ? value.slice(0, -":latest".length) : value;
}

function sameOllamaModelName(left, right) {
  return normalizeOllamaModelName(left) === normalizeOllamaModelName(right);
}

function dotProduct(queryVector, vectors, rowIndex, dimensions) {
  let score = 0;
  const offset = rowIndex * dimensions;
  for (let i = 0; i < dimensions; i += 1) {
    score += queryVector[i] * vectors.readFloatLE((offset + i) * 4);
  }
  return score;
}

async function embedQuery({ endpoint, model, apiKey, query }) {
  const response = await fetch(`${endpoint}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      input: [`task: search result | query: ${query}`],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Ollama embedding request failed for ${model}: ${response.status} ${response.statusText} ${body}`
    );
  }
  const payload = await response.json();
  const embedding = payload.embeddings?.[0];
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Ollama /api/embed response did not include a query embedding.");
  }
  return embedding;
}

await loadLocalEnv();

const args = parseArgs();
const query = String(args.get("query") ?? "").trim();
if (!query) {
  throw new Error('Missing query. Example: corepack pnpm search:pokemon-guide-embeddings -- --query="come trovo Rayquaza in Smeraldo?" --game=emerald');
}

const endpoint = (process.env.OLLAMA_ENDPOINT || "http://127.0.0.1:11434").replace(
  /\/+$/,
  ""
);
const model = process.env.OLLAMA_EMBEDDING_MODEL?.trim();
if (!model) {
  throw new Error("OLLAMA_EMBEDDING_MODEL is required.");
}

const gameFilter = String(args.get("game") ?? args.get("profile") ?? "")
  .trim()
  .toLowerCase();
const top = Math.min(Math.max(Number(args.get("top") ?? 8) || 8, 1), 20);
const apiKey = process.env.OLLAMA_API_KEY;

const [manifestRaw, indexRaw, vectors] = await Promise.all([
  fs.readFile(manifestPath, "utf8"),
  fs.readFile(indexPath, "utf8"),
  fs.readFile(vectorsPath),
]);
const manifest = JSON.parse(manifestRaw);
const index = JSON.parse(indexRaw);

if (!sameOllamaModelName(manifest.model, model)) {
  throw new Error(
    `Embedding model mismatch: manifest was generated with "${manifest.model}", env has "${model}". Regenerate embeddings or change OLLAMA_EMBEDDING_MODEL.`
  );
}

const expectedBytes = manifest.records.length * manifest.dimensions * 4;
if (vectors.length !== expectedBytes) {
  throw new Error(
    `Vector file size mismatch: expected ${expectedBytes} bytes, got ${vectors.length}.`
  );
}

const queryEmbedding = await embedQuery({ endpoint, model, apiKey, query });
if (queryEmbedding.length < manifest.dimensions) {
  throw new Error(
    `Query embedding has ${queryEmbedding.length} dimensions, manifest requires ${manifest.dimensions}.`
  );
}
const queryVector = l2Normalize(queryEmbedding.slice(0, manifest.dimensions));

const chunkById = new Map(index.chunks.map((chunk) => [chunk.id, chunk]));
const ranked = manifest.records
  .map((record) => {
    const chunk = chunkById.get(record.id);
    return {
      score: dotProduct(queryVector, vectors, record.index, manifest.dimensions),
      record,
      chunk,
    };
  })
  .filter((entry) => {
    if (!gameFilter) return true;
    const haystack = [
      ...(entry.record.profiles ?? []),
      ...(entry.record.games ?? []),
      entry.record.rootTitle,
      entry.record.section,
      entry.record.parentSection,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(gameFilter);
  })
  .sort((left, right) => right.score - left.score)
  .slice(0, top);

console.log(`Query: ${query}`);
console.log(`Model: ${model}`);
console.log(`Dimensions: ${manifest.dimensions}`);
console.log(`Filter: ${gameFilter || "none"}`);
console.log("");

for (const [index, entry] of ranked.entries()) {
  const chunk = entry.chunk;
  console.log(`${index + 1}. ${entry.score.toFixed(4)} ${entry.record.games.join(", ")}`);
  console.log(
    `   ${[
      entry.record.rootTitle,
      entry.record.part ? `Part ${entry.record.part}` : "",
      entry.record.parentSection,
      entry.record.section,
    ]
      .filter(Boolean)
      .join(" / ")}`
  );
  console.log(`   ${entry.record.url}`);
  if (chunk?.text) {
    console.log(`   ${chunk.text.replace(/\s+/g, " ").slice(0, 260)}...`);
  }
  console.log("");
}
