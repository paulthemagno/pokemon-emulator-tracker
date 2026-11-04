import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Reviewed symbol selection is research input; numeric IDs are always extracted.
const root = process.cwd();
const sourceDir = path.join(root, "lib/pokemon/knowledge/sources");
const candidates = JSON.parse(await fs.readFile(path.join(sourceDir, "progress-fact-candidates.json"), "utf8"));
const provenance = JSON.parse(await fs.readFile(path.join(sourceDir, "provenance.json"), "utf8"));
const source = provenance.pretPokeemerald;
const option = process.argv.indexOf("--pokeemerald");
const repo = option >= 0 ? process.argv[option + 1]
  : path.join(root, ".cache/pokemon-source", `pokeemerald-${source.commit}`);
if (!repo || execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim() !== source.commit) {
  throw new Error("Progress variable extraction requires the pinned pokeemerald checkout");
}
const headerPath = "include/constants/vars.h";
// Read committed blobs so an edited checkout cannot be attributed to the pin.
const readPinned = (file) => execFileSync("git", ["-C", repo, "show", `${source.commit}:${file}`], {
  encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
});
const header = readPinned(headerPath);
const definitions = new Map([...header.matchAll(/^#define\s+(VAR_[A-Z0-9_]+)\s+(0x[0-9a-f]+|\d+)\b/gmi)]
  .map(match => [match[1], Number(match[2])]));
const url = (file, line) => `https://github.com/${source.repo}/blob/${source.commit}/${file}#L${line}`;
const entries = [];
const keys = new Set();
const ids = new Set();
for (const candidate of candidates.candidates.filter(item => item.rawVariables?.length)) {
  if (!candidate.runtimeStatus?.startsWith("raw-values")) throw new Error(`Unreviewed candidate: ${candidate.id}`);
  const refs = [];
  for (const evidence of candidate.evidence.filter(item => item.sourceKey === "pretPokeemerald")) {
    const lines = readPinned(evidence.path).split(/\r?\n/);
    for (const pattern of evidence.patterns) {
      const line = lines.findIndex(text => text.includes(pattern));
      if (line < 0) throw new Error(`${candidate.id}: missing evidence ${evidence.path}: ${pattern}`);
      refs.push(url(evidence.path, line + 1));
    }
  }
  for (const variable of candidate.rawVariables) {
    const id = definitions.get(variable.symbol);
    if (!Number.isInteger(id) || id < 0x4000 || id >= 0x4100 || keys.has(variable.key) || ids.has(id)) {
      throw new Error(`Invalid, missing, or duplicate progress variable: ${variable.symbol}`);
    }
    keys.add(variable.key);
    ids.add(id);
    const line = header.split(/\r?\n/).findIndex(text => new RegExp(`^#define\\s+${variable.symbol}\\s`).test(text)) + 1;
    entries.push({ ...variable, id, candidateId: candidate.id,
      sourceRefs: [...new Set([url(headerPath, line), ...refs])] });
  }
}
await fs.writeFile(path.join(sourceDir, "progress-variables.json"), JSON.stringify({
  version: 1, description: "Reviewed raw progress variables extracted from pinned PRET sources. Values are not automatic quest completion.",
  profiles: { emerald: { sourceKey: "pretPokeemerald", sourceCommit: source.commit, entries } },
}, null, 2) + "\n");
console.log(`Extracted ${entries.length} reviewed Emerald progress variables.`);
