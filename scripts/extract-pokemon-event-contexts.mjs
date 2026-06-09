import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const sourceDir = path.join(root, "lib/pokemon/knowledge/sources");
const cacheDir = path.join(root, ".cache/pokemon-source");

const PINNED_SOURCES = {
  pretPokered: {
    arg: "pokered",
    repo: "pret/pokered",
    commit: "3c814341c81307b3193a9ea890ff3a197b09b4e3",
  },
  pretPokeyellow: {
    arg: "pokeyellow",
    repo: "pret/pokeyellow",
    commit: "bfa7170107eea23b89febb60bfb2ce39173bf2e1",
  },
  pretPokegold: {
    arg: "pokegold",
    repo: "pret/pokegold",
    commit: "09d2148d6d26b20840fb4997916321666ca1e953",
  },
  pokecrystal: {
    arg: "pokecrystal",
    repo: "pret/pokecrystal",
    commit: "8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217",
  },
  pretPokeruby: {
    arg: "pokeruby",
    repo: "pret/pokeruby",
    commit: "63a8cbf0016b351a4e68f7036fa0b77e23d2f2c1",
  },
  pretPokeemerald: {
    arg: "pokeemerald",
    repo: "pret/pokeemerald",
    commit: "0d3100185e0b13faabfc589fc402dd46f83c1d6a",
  },
  pretPokefirered: {
    arg: "pokefirered",
    repo: "pret/pokefirered",
    commit: "e060ab955b5dc9ac1c4904c2cd141683615cf477",
  },
};

const SOURCE_EXTENSIONS = new Set([
  ".asm",
  ".c",
  ".h",
  ".inc",
  ".json",
  ".s",
  ".txt",
]);

const SKIP_PATH_PARTS = [
  "/build/",
  "/tools/",
  "/sound/",
  "/gfx/",
  "/graphics/",
  "/data/pokemon/",
];

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

function profileLayouts(eventFlags) {
  return [
    ...Object.values(eventFlags.gen1 ?? {}),
    ...Object.values(eventFlags.gen2 ?? {}),
    ...Object.values(eventFlags.gen3 ?? {}),
  ];
}

function selectedProfiles(args, layouts) {
  const selected = new Set(
    String(args.profiles ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  if (selected.size === 0) return layouts;
  return layouts.filter((layout) => selected.has(layout.gameProfile));
}

function sourceForLayout(layout) {
  const source = PINNED_SOURCES[layout.sourceKey];
  if (!source) throw new Error(`No pinned source config for ${layout.sourceKey}.`);
  return source;
}

async function ensureRepo(args, sourceKey) {
  const source = PINNED_SOURCES[sourceKey];
  const explicitPath = args[source.arg];
  if (explicitPath) return explicitPath;
  if (!args.fromGithub) {
    throw new Error(`Pass --${source.arg} /path/to/${source.arg} or --from-github.`);
  }

  await fs.mkdir(cacheDir, { recursive: true });
  const target = path.join(cacheDir, `${source.arg}-${source.commit}`);
  try {
    await fs.access(path.join(target, ".git"));
    return target;
  } catch {
    // Continue and clone below.
  }

  const url = `https://github.com/${source.repo}.git`;
  await execFileAsync("git", ["clone", "--filter=blob:none", "--no-checkout", url, target], {
    maxBuffer: 1024 * 1024 * 20,
  });
  await execFileAsync("git", ["-C", target, "checkout", source.commit], {
    maxBuffer: 1024 * 1024 * 20,
  });
  return target;
}

async function listSourceFiles(repoPath) {
  const { stdout } = await execFileAsync("git", ["-C", repoPath, "ls-files"], {
    maxBuffer: 1024 * 1024 * 20,
  });
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((filePath) => SOURCE_EXTENSIONS.has(path.extname(filePath)))
    .filter((filePath) => !SKIP_PATH_PARTS.some((part) => `/${filePath}`.includes(part)));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineOperation(line, filePath) {
  if (/\b(setevent|setflag|FlagSet|SetFlag|FLAG_SET)\b/.test(line)) return "set";
  if (/\b(clearevent|clearflag|FlagClear|ClearFlag|FLAG_CLEAR)\b/.test(line)) return "clear";
  if (/\b(checkevent|checkflag|FlagGet|CheckFlag|FLAG_GET)\b/.test(line)) return "check";
  if (/^\s*(const|#define|DEF)\s+/.test(line)) return "definition";
  if (filePath.endsWith(".json") && /"flag"\s*:/.test(line)) return "map-object";
  if (/\btrainer\b/i.test(line)) return "trainer";
  if (/\bitemball\b/i.test(line) || /\bhiddenitem\b/i.test(line)) return "item-object";
  return "reference";
}

function nearbyLines(lines, lineIndex, radius) {
  const start = Math.max(0, lineIndex - radius);
  const end = Math.min(lines.length, lineIndex + radius + 1);
  return lines.slice(start, end).map((text, index) => ({
    line: start + index + 1,
    text,
  }));
}

function shouldPreferOccurrence(context) {
  return context.operation !== "definition";
}

function occurrenceScore(context) {
  const operationScores = {
    set: 100,
    clear: 95,
    trainer: 85,
    "item-object": 85,
    "map-object": 80,
    check: 60,
    reference: 40,
    definition: 0,
  };
  let score = operationScores[context.operation] ?? 20;
  if (context.path.startsWith("maps/") || context.path.includes("/maps/") || context.path.startsWith("scripts/")) {
    score += 20;
  }
  return score;
}

function compactContexts(contextsByKey, maxPerFlag) {
  return Object.fromEntries(
    Object.entries(contextsByKey)
      .map(([key, contexts]) => {
        const nonDefinitions = contexts.filter((context) => context.operation !== "definition");
        const candidates = nonDefinitions.length > 0 ? nonDefinitions : contexts;
        return [
          key,
          [...candidates]
            .sort((a, b) => occurrenceScore(b) - occurrenceScore(a) || a.path.localeCompare(b.path) || a.line - b.line)
            .slice(0, maxPerFlag),
        ];
      })
      .filter(([, contexts]) => contexts.length > 0)
  );
}

async function collectRepoContexts(repoPath, keys, options) {
  const regex = new RegExp(`\\b(${keys.map(escapeRegex).join("|")})\\b`, "g");
  const contextsByKey = Object.fromEntries(keys.map((key) => [key, []]));
  const files = await listSourceFiles(repoPath);
  const maxPerFlag = options.maxPerFlag;
  const contextRadius = options.contextRadius;

  for (const filePath of files) {
    const fullPath = path.join(repoPath, filePath);
    let text;
    try {
      text = await fs.readFile(fullPath, "utf8");
    } catch {
      continue;
    }
    if (!regex.test(text)) {
      regex.lastIndex = 0;
      continue;
    }
    regex.lastIndex = 0;

    const lines = text.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      regex.lastIndex = 0;
      for (const match of line.matchAll(regex)) {
        const key = match[1];
        const current = contextsByKey[key];
        if (!current) continue;
        const context = {
          path: filePath,
          line: lineIndex + 1,
          operation: lineOperation(line, filePath),
          text: line.trim(),
          context: nearbyLines(lines, lineIndex, contextRadius),
        };
        if (shouldPreferOccurrence(context) || current.length === 0) {
          current.push(context);
        }
      }
    }
  }

  return compactContexts(contextsByKey, maxPerFlag);
}

function summarizeProfile(layout, contexts) {
  const keys = new Set(layout.entries.map((entry) => entry.key));
  const withContext = Object.keys(contexts).filter((key) => keys.has(key)).length;
  const withNonDefinitionContext = Object.entries(contexts)
    .filter(([key]) => keys.has(key))
    .filter(([, entries]) => entries.some((entry) => entry.operation !== "definition")).length;
  return {
    eventCount: keys.size,
    withContext,
    withNonDefinitionContext,
    coverage: Number((withContext / Math.max(keys.size, 1)).toFixed(4)),
    nonDefinitionCoverage: Number((withNonDefinitionContext / Math.max(keys.size, 1)).toFixed(4)),
  };
}

const args = parseArgs(process.argv.slice(2));
const eventFlags = await readJson("event-flags.json");
const layouts = selectedProfiles(args, profileLayouts(eventFlags));
const groupedBySource = new Map();
for (const layout of layouts) {
  const source = sourceForLayout(layout);
  const group = groupedBySource.get(layout.sourceKey) ?? { source, layouts: [] };
  group.layouts.push(layout);
  groupedBySource.set(layout.sourceKey, group);
}

const output = {
  version: 1,
  description:
    "Source-code usage contexts for generated Pokemon event flags. Contexts are evidence for event descriptions; they are not player-facing text by themselves.",
  profiles: {},
};

for (const [sourceKey, group] of groupedBySource.entries()) {
  const repoPath = await ensureRepo(args, sourceKey);
  const keys = Array.from(new Set(group.layouts.flatMap((layout) => layout.entries.map((entry) => entry.key))));
  console.log(`Collecting ${keys.length} flag contexts from ${group.source.repo} (${sourceKey})...`);
  const contexts = await collectRepoContexts(repoPath, keys, {
    maxPerFlag: Number(args["max-per-flag"] ?? 6),
    contextRadius: Number(args["context-radius"] ?? 2),
  });

  for (const layout of group.layouts) {
    const layoutKeys = new Set(layout.entries.map((entry) => entry.key));
    const profileContexts = Object.fromEntries(
      Object.entries(contexts).filter(([key]) => layoutKeys.has(key))
    );
    output.profiles[layout.gameProfile] = {
      generation: layout.generation,
      sourceKey,
      source: {
        repo: group.source.repo,
        commit: group.source.commit,
      },
      summary: summarizeProfile(layout, profileContexts),
      contexts: profileContexts,
    };
  }
}

await writeJson("event-contexts.json", output);
console.log("Wrote lib/pokemon/knowledge/sources/event-contexts.json");
