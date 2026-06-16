import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(rootDir, "lib/pokemon/knowledge/walkthrough-index.json");
const manifestPath = path.join(
  rootDir,
  "lib/pokemon/knowledge/walkthrough-embeddings.manifest.json"
);
const vectorsPath = path.join(
  rootDir,
  "lib/pokemon/knowledge/walkthrough-embeddings.f32"
);

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

await loadLocalEnv();

const endpoint = (process.env.OLLAMA_ENDPOINT || "http://127.0.0.1:11434").replace(
  /\/+$/,
  ""
);
const model = process.env.OLLAMA_EMBEDDING_MODEL?.trim();
if (!model) {
  throw new Error(
    "OLLAMA_EMBEDDING_MODEL is required. Example: OLLAMA_EMBEDDING_MODEL=embeddinggemma:latest corepack pnpm generate:pokemon-guide-embeddings"
  );
}
const apiKey = process.env.OLLAMA_API_KEY;
const args = new Map(
  process.argv
    .slice(2)
    .filter((argument) => argument.startsWith("--"))
    .map((argument) => {
      const [key, ...rest] = argument.slice(2).split("=");
      return [key, rest.length > 0 ? rest.join("=") : "true"];
    })
);
const requestedProfiles = new Set(
  String(args.get("profiles") ?? "")
    .split(",")
    .map((profile) => profile.trim())
    .filter(Boolean)
);
const batchSize = clampInteger(Number(args.get("batch-size") ?? 16), 1, 64);
const targetDimensions = clampInteger(Number(args.get("dimensions") ?? 256), 1, 4096);
const dryRun = args.get("dry-run") === "true";

function clampInteger(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.floor(value), min), max);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function l2Normalize(vector) {
  const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  return norm > 0 ? vector.map((value) => value / norm) : vector;
}

function embeddingText(chunk) {
  const title = [
    chunk.rootTitle,
    chunk.part ? `Part ${chunk.part}` : "",
    chunk.parentSection,
    chunk.section,
  ]
    .filter(Boolean)
    .join(" / ");
  return `title: ${title || "none"} | text: ${chunk.text}`;
}

async function embedBatch(inputs) {
  const response = await fetch(`${endpoint}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      input: inputs,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Ollama embedding request failed for ${model}: ${response.status} ${response.statusText} ${body}`
    );
  }
  const payload = await response.json();
  if (!Array.isArray(payload.embeddings)) {
    throw new Error("Ollama /api/embed response did not include embeddings.");
  }
  return payload.embeddings;
}

const indexRaw = await fs.readFile(indexPath, "utf8");
const index = JSON.parse(indexRaw);
const chunks = index.chunks.filter((chunk) =>
  requestedProfiles.size === 0
    ? true
    : chunk.profiles.some((profile) => requestedProfiles.has(profile))
);
const indexHash = sha256(
  JSON.stringify({
    version: index.version,
    generator: index.generator,
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      revision: chunk.revision,
      url: chunk.url,
      textHash: sha256(chunk.text),
    })),
  })
);

console.log(`Embedding ${chunks.length} walkthrough chunks`);
console.log(`Provider: ollama`);
console.log(`Endpoint: ${endpoint}`);
console.log(`Model: ${model}`);
console.log(`Target dimensions: ${targetDimensions}`);
console.log(`Batch size: ${batchSize}`);

if (dryRun) {
  console.log("Dry run only; no embeddings written.");
  process.exit(0);
}

const allVectors = [];
let rawDimensions;

for (let offset = 0; offset < chunks.length; offset += batchSize) {
  const batch = chunks.slice(offset, offset + batchSize);
  const embeddings = await embedBatch(batch.map(embeddingText));
  if (embeddings.length !== batch.length) {
    throw new Error(
      `Expected ${batch.length} embeddings, received ${embeddings.length}.`
    );
  }

  for (const embedding of embeddings) {
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Received an empty embedding vector.");
    }
    rawDimensions ??= embedding.length;
    if (embedding.length !== rawDimensions) {
      throw new Error(
        `Inconsistent embedding dimensions: expected ${rawDimensions}, received ${embedding.length}.`
      );
    }
    if (targetDimensions > embedding.length) {
      throw new Error(
        `Requested ${targetDimensions} dimensions but model returned ${embedding.length}.`
      );
    }
    allVectors.push(l2Normalize(embedding.slice(0, targetDimensions)));
  }

  console.log(
    `Embedded ${Math.min(offset + batch.length, chunks.length)}/${chunks.length}`
  );
}

const vectorBuffer = Buffer.alloc(allVectors.length * targetDimensions * 4);
for (const [rowIndex, vector] of allVectors.entries()) {
  for (const [columnIndex, value] of vector.entries()) {
    vectorBuffer.writeFloatLE(value, (rowIndex * targetDimensions + columnIndex) * 4);
  }
}
await fs.writeFile(vectorsPath, vectorBuffer);

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  generator: "scripts/generate-pokemon-guide-embeddings.mjs",
  provider: "ollama",
  endpointHint: endpoint,
  model,
  rawDimensions,
  dimensions: targetDimensions,
  normalization: "l2",
  dtype: "float32-le",
  vectorFile: path.basename(vectorsPath),
  sourceIndex: "walkthrough-index.json",
  sourceIndexHash: indexHash,
  documentPrompt: "title: {rootTitle / part / parentSection / section} | text: {text}",
  queryPrompt: "task: search result | query: {query}",
  records: chunks.map((chunk, index) => ({
    index,
    id: chunk.id,
    profiles: chunk.profiles,
    games: chunk.games,
    source: chunk.source,
    rootTitle: chunk.rootTitle,
    part: chunk.part,
    section: chunk.section,
    parentSection: chunk.parentSection,
    url: chunk.url,
    revision: chunk.revision,
  })),
};

await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${manifestPath}`);
console.log(`Wrote ${vectorsPath}`);
