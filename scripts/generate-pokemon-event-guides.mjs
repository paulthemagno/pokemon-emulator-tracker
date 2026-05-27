import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "lib/pokemon/knowledge/sources");

const ONLINE_WALKTHROUGH_SOURCES = {
  "red-blue-en": [
    "https://bulbapedia.bulbagarden.net/wiki/Red_and_Blue_walkthrough",
    "https://strategywiki.org/wiki/Pok%C3%A9mon_Red_and_Blue/Walkthrough",
  ],
  "yellow-en": [
    "https://bulbapedia.bulbagarden.net/wiki/Yellow_walkthrough",
    "https://strategywiki.org/wiki/Pok%C3%A9mon_Yellow/Walkthrough",
  ],
  "gold-silver-en": [
    "https://bulbapedia.bulbagarden.net/wiki/Appendix%3AGold_and_Silver_walkthrough",
  ],
  "crystal-en": [
    "https://bulbapedia.bulbagarden.net/wiki/Appendix%3ACrystal_walkthrough",
  ],
  "ruby-sapphire-en": [
    "https://bulbapedia.bulbagarden.net/wiki/Walkthrough%3APok%C3%A9mon_Ruby_and_Sapphire",
    "https://www.thonky.com/pokemon-ruby-sapphire-emerald/",
  ],
  "emerald-en": [
    "https://bulbapedia.bulbagarden.net/wiki/Appendix%3AEmerald_walkthrough",
    "https://www.thonky.com/pokemon-ruby-sapphire-emerald/",
  ],
  "firered-leafgreen-en": [
    "https://bulbapedia.bulbagarden.net/wiki/Appendix%3AFireRed_and_LeafGreen_walkthrough",
    "https://strategywiki.org/wiki/Pok%C3%A9mon_FireRed_and_LeafGreen/Walkthrough",
  ],
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--") continue;
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    args[key] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  return args;
}

async function readJson(name) {
  return JSON.parse(await fs.readFile(path.join(sourceDir, name), "utf8"));
}

async function writeJson(name, data) {
  await fs.writeFile(path.join(sourceDir, name), `${JSON.stringify(data, null, 2)}\n`);
}

function allLayouts(eventFlags) {
  return [
    ...Object.values(eventFlags.gen1 ?? {}),
    ...Object.values(eventFlags.gen2 ?? {}),
    ...Object.values(eventFlags.gen3 ?? {}),
  ];
}

function githubUrl(profile, context) {
  return `https://github.com/${profile.source.repo}/blob/${profile.source.commit}/${context.path}#L${context.line}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function wordsFromIdentifier(value) {
  return value
    .replace(/^EVENT_/, "")
    .replace(/^FLAG_/, "")
    .replace(/^SYS_/, "")
    .replace(/_/g, " ")
    .replace(/\bHm(\d+)/gi, "HM$1")
    .replace(/\bTm(\d+)/gi, "TM$1")
    .replace(/\bSs\b/g, "S.S.")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function hasOperation(contexts, operation) {
  return contexts.some((context) => context.operation === operation);
}

function buildSteps(entry, contexts) {
  const label = entry.label;
  if (/^Hidden Item /.test(label)) {
    return [`Check the matching hidden-item spot for ${label.replace(/^Hidden Item /, "")}.`];
  }
  if (/^Item /.test(label)) {
    return [`Pick up the matching visible item ball for ${label.replace(/^Item /, "")}.`];
  }
  if (/^(Got|Received|Obtained) /.test(label)) {
    return [`Receive ${label.replace(/^(Got|Received|Obtained) /, "")} from the in-game script or NPC that grants it.`];
  }
  if (/^(Beat|Defeated) /.test(label) || hasOperation(contexts, "trainer")) {
    return [`Win the related battle: ${label.replace(/^(Beat|Defeated) /, "")}.`];
  }
  if (/^(Solved|Opened|Restored|Unlocked) /.test(label)) {
    return [`Complete the related puzzle, door, or unlock sequence: ${label}.`];
  }
  return undefined;
}

function buildDescription(entry, contexts) {
  const label = entry.label;
  if (/^Hidden Item /.test(label)) return `Hidden item pickup: ${label.replace(/^Hidden Item /, "")}.`;
  if (/^Item /.test(label)) return `Visible item pickup: ${label.replace(/^Item /, "")}.`;
  if (/^(Got|Received|Obtained) /.test(label)) return `${label}.`;
  if (/^(Beat|Defeated) /.test(label)) return `${label}.`;
  if (/^(Solved|Opened|Restored|Unlocked) /.test(label)) return `${label}.`;
  if (label.startsWith("Hide ") || label.startsWith("Show ") || label.startsWith("Hidden ")) {
    return `${label}; this is map-object visibility state.`;
  }
  if (contexts.length > 0) return `${label}.`;
  return undefined;
}

function buildGuideEntry(profile, entry, contexts) {
  const sourceRefs = unique([
    ...contexts.slice(0, 2).map((context) => githubUrl(profile, context)),
    ...(ONLINE_WALKTHROUGH_SOURCES[profile.gameProfile ?? profile.profileKey] ?? []).slice(0, 1),
  ]);
  const description = buildDescription(entry, contexts);
  const steps = buildSteps(entry, contexts);
  return {
    description,
    descriptionKind: contexts.length > 0 ? "source-context" : "source-symbol",
    steps,
    sourceRefs,
  };
}

const args = parseArgs(process.argv.slice(2));
const maxPerProfile = Number(args["max-per-profile"] ?? 0);
const eventFlags = await readJson("event-flags.json");
const eventContexts = await readJson("event-contexts.json");

const profiles = {};
for (const layout of allLayouts(eventFlags)) {
  const contextProfile = eventContexts.profiles[layout.gameProfile];
  if (!contextProfile) {
    throw new Error(`Missing event contexts for ${layout.gameProfile}. Run extract:pokemon-event-contexts first.`);
  }
  const entries = {};
  for (const entry of layout.entries.slice(0, maxPerProfile > 0 ? maxPerProfile : layout.entries.length)) {
    entries[entry.key] = buildGuideEntry(
      { ...contextProfile, gameProfile: layout.gameProfile, profileKey: layout.gameProfile },
      entry,
      contextProfile.contexts[entry.key] ?? []
    );
  }
  profiles[layout.gameProfile] = {
    generation: layout.generation,
    sourceKey: layout.sourceKey,
    eventCount: layout.entries.length,
    guidedCount: Object.keys(entries).length,
    onlineSources: ONLINE_WALKTHROUGH_SOURCES[layout.gameProfile] ?? [],
    entries,
  };
}

await writeJson("event-guides.json", {
  version: 1,
  description:
    "Generated compact event guide hints. Each entry combines pinned PRET source context with profile-level online walkthrough sources; curated audited guidance may override this at runtime.",
  profiles,
});

console.log(`Generated event-guides.json for ${Object.keys(profiles).length} profiles.`);
