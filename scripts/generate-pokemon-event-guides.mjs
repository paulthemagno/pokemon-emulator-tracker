import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "lib/pokemon/knowledge/sources");

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

const LOCATION_OVERRIDES = {
  OaksLab: "Professor Oak's Laboratory",
  ElmsLab: "Professor Elm's Laboratory",
  BluesHouse: "Blue's House",
  MrPokemonsHouse: "Mr. Pokemon's House",
  HallOfFame: "Hall of Fame",
  IndigoPlateauPokecenter1F: "Indigo Plateau Pokemon Center",
};

function humanizeLocation(value) {
  if (!value) return undefined;
  if (LOCATION_OVERRIDES[value]) return LOCATION_OVERRIDES[value];
  return value
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\bPokecenter\b/gi, "Pokemon Center")
    .replace(/\bPoke Mart\b/gi, "Poke Mart")
    .replace(/\bRoute\s*(\d+)/gi, "Route $1")
    .replace(/\bSs\b/g, "S.S.")
    .replace(/\bMt\b/g, "Mt.")
    .replace(/\s+/g, " ")
    .trim();
}

function locationFromPath(filePath) {
  const parts = filePath.split("/");
  const mapsIndex = parts.lastIndexOf("maps");
  if (mapsIndex >= 0 && parts[mapsIndex + 1]) {
    const candidate = parts[mapsIndex + 1].replace(/\.(asm|inc|c|h|json|s|txt)$/i, "");
    if (!["scripts", "events", "header"].includes(candidate.toLowerCase())) return humanizeLocation(candidate);
  }
  if (parts[0] === "maps" || parts[0] === "scripts") {
    return humanizeLocation(parts.at(-1)?.replace(/\.(asm|inc|c|h|json|s|txt)$/i, ""));
  }
  return undefined;
}

function contextScore(context) {
  let score = 0;
  if (locationFromPath(context.path)) score += 10;
  if (["set", "clear", "trainer", "item-object", "map-object"].includes(context.operation)) score += 4;
  if (context.operation === "check") score += 2;
  if (context.operation === "definition") score -= 10;
  return score;
}

function eventLocation(contexts) {
  const best = [...contexts].sort((a, b) => contextScore(b) - contextScore(a))[0];
  return best ? locationFromPath(best.path) : undefined;
}

function hasOperation(contexts, operation) {
  return contexts.some((context) => context.operation === operation);
}

function locationPrefix(location) {
  return location ? `Go to ${location}.` : undefined;
}

function buildSteps(entry, contexts, location) {
  const label = entry.label;
  if (/^Hidden Item /.test(label)) {
    const item = subjectWithoutLocation(label.replace(/^Hidden Item /, ""), location);
    return unique([
      locationPrefix(location),
      `Search the indicated hidden-item tile and collect ${item}.`,
    ]);
  }
  if (/^Item /.test(label)) {
    const item = subjectWithoutLocation(label.replace(/^Item /, ""), location);
    return unique([
      locationPrefix(location),
      `Pick up the visible item ball containing ${item}.`,
    ]);
  }
  if (/^(Got|Received|Obtained) /.test(label)) {
    return unique([
      locationPrefix(location),
      `Complete the related conversation, gift, pickup, or story scene and receive ${humanizeSubject(label.replace(/^(Got|Received|Obtained) /, ""))}.`,
    ]);
  }
  if (/^(Beat|Defeated) /.test(label) || hasOperation(contexts, "trainer")) {
    if (location === "Hall of Fame") {
      return [`Defeat ${humanizeSubject(label.replace(/^(Beat|Defeated) /, ""))} and enter the Hall of Fame.`];
    }
    return unique([
      locationPrefix(location),
      `Start and win the related battle against ${humanizeSubject(label.replace(/^(Beat|Defeated) /, ""))}.`,
    ]);
  }
  if (/^(Solved|Opened|Restored|Unlocked) /.test(label)) {
    return unique([
      locationPrefix(location),
      `Complete the related puzzle, door, restoration, or access sequence.`,
    ]);
  }
  if (/^(Talked To|Met|Saw) /.test(label)) {
    return unique([
      locationPrefix(location),
      `Speak to or encounter ${label.replace(/^(Talked To|Met|Saw) /, "")} to complete the first-time interaction.`,
    ]);
  }
  if (/^(Caught|Fought) /.test(label)) {
    return unique([
      locationPrefix(location),
      `${label.startsWith("Caught") ? "Catch" : "Fight"} ${label.replace(/^(Caught|Fought) /, "")}.`,
    ]);
  }
  if (/^(Visited|Reached|Entered) /.test(label)) {
    return [locationPrefix(location) ?? `Reach ${label.replace(/^(Visited|Reached|Entered) /, "")}.`];
  }
  if (/^(Rescued|Freed|Returned|Delivered|Gave|Helped) /.test(label)) {
    return unique([
      locationPrefix(location),
      `Complete the related interaction: ${label}.`,
    ]);
  }
  return undefined;
}

function atLocation(location) {
  return location ? ` in ${location}` : "";
}

function humanizeSubject(value) {
  return value
    .replace(/\bHm(\d+)/g, "HM$1")
    .replace(/\bTm(\d+)/g, "TM$1")
    .replace(/\bHo Oh\b/g, "Ho-Oh")
    .replace(/\bSs\b/g, "S.S.")
    .replace(/\b(\d+)(f)\b/gi, (_, floor) => `${floor}F`);
}

function subjectWithoutLocation(value, location) {
  const subject = humanizeSubject(value);
  if (!location) return subject;
  return subject.toLowerCase().startsWith(location.toLowerCase())
    ? subject.slice(location.length).trim()
    : subject;
}

function buildDescription(entry, contexts, location) {
  const label = entry.label;
  if (/^Hidden Item /.test(label)) {
    const item = subjectWithoutLocation(label.replace(/^Hidden Item /, ""), location);
    return `Hidden item${atLocation(location)}: ${item}. Once collected, this flag prevents it from reappearing.`;
  }
  if (/^Item /.test(label)) {
    const item = subjectWithoutLocation(label.replace(/^Item /, ""), location);
    return `Visible item pickup${atLocation(location)}: ${item}. Once collected, the item ball stays removed from the map.`;
  }
  if (/^(Got|Received|Obtained) /.test(label)) {
    return `Records that you received ${humanizeSubject(label.replace(/^(Got|Received|Obtained) /, ""))}${atLocation(location)} from the related gift, pickup, NPC, or story scene.`;
  }
  if (/^(Beat|Defeated) /.test(label)) {
    return `Records the victory over ${humanizeSubject(label.replace(/^(Beat|Defeated) /, ""))}${atLocation(location)} so the game keeps that battle completed.`;
  }
  if (/^(Solved|Opened|Restored|Unlocked|Activated) /.test(label)) {
    return `Records that the related puzzle, passage, restoration, or access change was completed${atLocation(location)}: ${label}.`;
  }
  if (/^(Talked To|Met|Saw) /.test(label)) {
    return `Records the first important conversation or encounter with ${label.replace(/^(Talked To|Met|Saw) /, "")}${atLocation(location)}.`;
  }
  if (/^(Caught|Fought) /.test(label)) {
    return `Records that you ${label.startsWith("Caught") ? "caught" : "fought"} ${label.replace(/^(Caught|Fought) /, "")}${atLocation(location)}.`;
  }
  if (/^(Visited|Reached|Entered) /.test(label)) {
    return `Records that you reached or entered ${label.replace(/^(Visited|Reached|Entered) /, "")}${atLocation(location)}.`;
  }
  if (/^(Rescued|Freed|Returned|Delivered|Gave|Helped) /.test(label)) {
    return `Tracks the completed story interaction “${label}”${atLocation(location)}.`;
  }
  if (label.startsWith("Hide ")) {
    return `Controls whether ${label.replace(/^Hide /, "")} is hidden${atLocation(location)}. This is map-object state and may be changed by another event rather than by a standalone quest.`;
  }
  if (label.startsWith("Show ")) {
    return `Controls whether ${label.replace(/^Show /, "")} is shown${atLocation(location)}. This is map-object state used to rebuild the current world after loading.`;
  }
  if (label.startsWith("Hidden ")) {
    return `Tracks the hidden or removed state of ${label.replace(/^Hidden /, "")}${atLocation(location)}. It usually controls an NPC, obstacle, item, or scene object.`;
  }
  if (/^(Sys|System) /.test(label)) {
    return `Tracks the saved system unlock or capability “${label.replace(/^(Sys|System) /, "")}”.`;
  }
  if (contexts.length > 0) {
    return `Tracks the saved state for “${label}”${atLocation(location)}.`;
  }
  return `Tracks the saved event state “${label}”.`;
}

function buildStateMeaning(entry) {
  const label = entry.label;
  if (/^Hidden Item |^Item /.test(label)) {
    return {
      completionMeaning: "Set: the item has been collected and should no longer appear.",
      notCompletedMeaning: "Not set: the pickup has not been recorded in this save.",
    };
  }
  if (/^(Got|Received|Obtained) /.test(label)) {
    return {
      completionMeaning: "Set: the gift, item, Pokemon, or reward was received.",
      notCompletedMeaning: "Not set: this specific reward event was not recorded.",
    };
  }
  if (/^(Beat|Defeated) /.test(label)) {
    return {
      completionMeaning: "Set: the related battle was won.",
      notCompletedMeaning: "Not set: the save does not currently record that victory.",
    };
  }
  if (label.startsWith("Hide ") || label.startsWith("Hidden ")) {
    return {
      completionMeaning: "Set: the referenced map object is hidden or removed.",
      notCompletedMeaning: "Not set: the object is not being hidden by this flag.",
    };
  }
  if (label.startsWith("Show ")) {
    return {
      completionMeaning: "Set: the referenced map object is shown.",
      notCompletedMeaning: "Not set: this flag is not forcing the object to appear.",
    };
  }
  return {
    completionMeaning: "Set: the game has recorded this event or state.",
    notCompletedMeaning: "Not set: this event or state is not recorded by this flag.",
  };
}

function buildGuideEntry(profile, entry, contexts, onlineSources) {
  const location = eventLocation(contexts);
  const sourceRefs = unique([
    ...contexts.slice(0, 2).map((context) => githubUrl(profile, context)),
    ...onlineSources.slice(0, 2).map((source) => source.url),
  ]);
  const description = buildDescription(entry, contexts, location);
  const steps = buildSteps(entry, contexts, location);
  return {
    description,
    descriptionKind: contexts.length > 0 ? "source-context" : "source-symbol",
    location,
    steps,
    ...buildStateMeaning(entry),
    sourceRefs,
  };
}

const args = parseArgs(process.argv.slice(2));
const maxPerProfile = Number(args["max-per-profile"] ?? 0);
const eventFlags = await readJson("event-flags.json");
const eventContexts = await readJson("event-contexts.json");
const guideSources = await readJson("game-guide-sources.json");

const profiles = {};
for (const layout of allLayouts(eventFlags)) {
  const contextProfile = eventContexts.profiles[layout.gameProfile];
  if (!contextProfile) {
    throw new Error(`Missing event contexts for ${layout.gameProfile}. Run extract:pokemon-event-contexts first.`);
  }
  const onlineSources = guideSources.profiles[layout.gameProfile]?.sources ?? [];
  if (onlineSources.length < 2) {
    throw new Error(`Expected at least two online guide sources for ${layout.gameProfile}.`);
  }
  const entries = {};
  for (const entry of layout.entries.slice(0, maxPerProfile > 0 ? maxPerProfile : layout.entries.length)) {
    entries[entry.key] = buildGuideEntry(
      { ...contextProfile, gameProfile: layout.gameProfile, profileKey: layout.gameProfile },
      entry,
      contextProfile.contexts[entry.key] ?? [],
      onlineSources
    );
  }
  profiles[layout.gameProfile] = {
    generation: layout.generation,
    sourceKey: layout.sourceKey,
    eventCount: layout.entries.length,
    guidedCount: Object.keys(entries).length,
    onlineSources,
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
