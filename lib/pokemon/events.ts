import type { GameEventProgress } from "./types";
import {
  GEN1_EVENT_FLAGS,
  GEN2_EVENT_FLAGS,
  GEN3_EVENT_FLAGS,
  type EventFlagLayout,
} from "./knowledge/event-flags";
import { getGeneratedEventGuide } from "./knowledge/event-guides";
import { getEventGuidance } from "./data/event-guidance";
import { GEN1_ITEMS, GEN2_ITEMS, GEN3_ITEMS } from "./data/items";
import type { GameVersion, Generation } from "./types";
import type { GameEventFlag } from "./types";

const KNOWN_ITEM_NAMES = Array.from(
  new Set([
    ...Object.values(GEN1_ITEMS),
    ...Object.values(GEN2_ITEMS),
    ...GEN3_ITEMS.map((item) => item.name),
  ])
).sort((a, b) => b.length - a.length);

interface AutoEventText {
  description: string;
  steps?: string[];
}

function splitTrailingItemName(text: string): { location: string; item: string } | undefined {
  for (const itemName of KNOWN_ITEM_NAMES) {
    if (itemName === "None" || itemName === "Nothing" || itemName.includes("?")) continue;
    if (text === itemName) return { location: "", item: itemName };
    if (text.endsWith(` ${itemName}`)) {
      return { location: text.slice(0, -itemName.length).trim(), item: itemName };
    }
  }
  return undefined;
}

function autoDescribeSourceFlag(flag: Pick<GameEventFlag, "key" | "label" | "importance">): AutoEventText {
  const hiddenItemPrefix = "Hidden Item ";
  if (flag.label.startsWith(hiddenItemPrefix)) {
    const rest = flag.label.slice(hiddenItemPrefix.length);
    const itemMatch = splitTrailingItemName(rest);
    if (itemMatch) {
      return {
        description: `Hidden item${itemMatch.location ? ` in ${itemMatch.location}` : ""}: ${itemMatch.item}. This flag is completed after that hidden item is picked up.`,
        steps: [
          itemMatch.location ? `Go to ${itemMatch.location}.` : "Go to the hidden item's map.",
          `Find and pick up the hidden ${itemMatch.item}.`,
        ],
      };
    }
    return {
      description: `${flag.label}. This is a hidden-item pickup flag from the decompiled game source.`,
      steps: ["Find and pick up the corresponding hidden item."],
    };
  }

  const visibleItemPrefix = "Item ";
  if (flag.label.startsWith(visibleItemPrefix)) {
    const rest = flag.label.slice(visibleItemPrefix.length);
    const itemMatch = splitTrailingItemName(rest);
    if (itemMatch) {
      return {
        description: `Visible item pickup${itemMatch.location ? ` in ${itemMatch.location}` : ""}: ${itemMatch.item}. This flag is completed after the visible Poke Ball item is picked up.`,
        steps: [
          itemMatch.location ? `Go to ${itemMatch.location}.` : "Go to the item's map.",
          `Pick up the visible ${itemMatch.item} item ball.`,
        ],
      };
    }
  }

  const gen2HiddenItemMatch = flag.label.match(/^(.*) Hidden (.+)$/);
  if (gen2HiddenItemMatch) {
    return {
      description: `Hidden item in ${gen2HiddenItemMatch[1]}: ${gen2HiddenItemMatch[2]}. This flag is completed after that hidden item is picked up.`,
      steps: [`Go to ${gen2HiddenItemMatch[1]}.`, `Find and pick up the hidden ${gen2HiddenItemMatch[2]}.`],
    };
  }

  if (/^(Got|Received|Obtained) /.test(flag.label)) {
    return {
      description: `${flag.label}. This flag is completed after the item, Pokemon, or reward is received.`,
      steps: [`Receive ${flag.label.replace(/^(Got|Received|Obtained) /, "")}.`],
    };
  }

  if (/^(Beat|Defeated) /.test(flag.label)) {
    return {
      description: `${flag.label}. This flag is completed after winning the corresponding battle.`,
      steps: [`Win the battle: ${flag.label.replace(/^(Beat|Defeated) /, "")}.`],
    };
  }

  if (/^(Solved|Opened|Restored|Unlocked) /.test(flag.label)) {
    return {
      description: `${flag.label}. This flag is completed after the corresponding puzzle, door, or access state changes in-game.`,
      steps: [`Complete the in-game action for: ${flag.label}.`],
    };
  }

  if (/^(Visited|Reached|Entered) /.test(flag.label)) {
    return {
      description: `${flag.label}. This flag records that the location or story trigger has been reached.`,
      steps: [`Reach the corresponding location or trigger: ${flag.label}.`],
    };
  }

  const ruinsWallMatch = flag.label.match(/^Wall Opened In (.+) Chamber$/);
  if (ruinsWallMatch) {
    return {
      description: `Hidden wall opened in the Ruins of Alph ${ruinsWallMatch[1]} Chamber.`,
    };
  }

  if (flag.label.startsWith("Hide ") || flag.label.startsWith("Hidden ") || flag.label.startsWith("Show ")) {
    return {
      description: `${flag.label}. This is a technical map-visibility flag for an NPC, item, obstacle, or map object; it is not always a player-facing quest by itself.`,
      steps: [`Use this as map state unless a verified guide explains which story interaction changes it.`],
    };
  }

  const kind = flag.importance === "routine" ? "technical save flag" : "save flag";
  return {
    description: `${flag.label}.`,
  };
}

function buildFlowSteps(flag: GameEventFlag): string[] {
  const hasAuditedSteps = (flag.flowSteps?.length ?? 0) > 0;
  const steps: string[] = [];
  if (flag.prerequisites?.length) {
    steps.push(`Prerequisites: ${flag.prerequisites.join(", ")}.`);
  }
  if (flag.missingPrerequisites?.length) {
    steps.push(`Still blocked by: ${flag.missingPrerequisites.join(", ")}.`);
  }
  steps.push(...(flag.flowSteps ?? []));
  if (flag.alternativeCompleted?.length) {
    steps.push(`Already covered by another completed choice: ${flag.alternativeCompleted.join(", ")}.`);
  } else if (flag.mutuallyExclusiveWith?.length) {
    steps.push(`Alternative choices: ${flag.mutuallyExclusiveWith.join(", ")}.`);
  }
  if (!hasAuditedSteps && flag.actionHint) {
    steps.push(flag.actionHint);
  }
  if (flag.normalMissingReason) {
    steps.push(flag.normalMissingReason);
  }
  return steps;
}

function readBit(data: Uint8Array, offset: number, bitIndex: number): boolean {
  const byte = data[offset + Math.floor(bitIndex / 8)];
  if (byte === undefined) return false;
  return (byte & (1 << (bitIndex % 8))) !== 0;
}

export function parseEventProgress(
  data: Uint8Array,
  layout: EventFlagLayout,
  source: "save" | "live",
  flagStartOffset = layout.flagStartOffset ?? 0
): GameEventProgress {
  const flags = layout.entries.map((entry) => {
    const guidance = getEventGuidance(layout.gameProfile, entry.key);
    const generatedGuide = getGeneratedEventGuide(layout.gameProfile, entry.key);
    const autoDescription = autoDescribeSourceFlag(entry);
    return {
      id: entry.id,
      key: entry.key,
      label: entry.label,
      category: entry.category,
      completed: readBit(data, flagStartOffset, entry.id),
      importance: entry.importance,
      important: entry.important,
      note: entry.note,
      description: guidance?.description ?? autoDescription.description ?? generatedGuide?.description,
      descriptionKind: guidance?.description
        ? "script-guided" as const
        : generatedGuide?.descriptionKind ?? "source-symbol" as const,
      actionHint: guidance?.actionHint,
      flowSteps: guidance?.steps ?? autoDescription.steps ?? generatedGuide?.steps,
      prerequisites: guidance?.prerequisites,
      mutuallyExclusiveWith: guidance?.mutuallyExclusiveWith,
      normalMissingReason: guidance?.normalMissingReason,
      sourceRefs: guidance?.sourceRefs ?? generatedGuide?.sourceRefs,
    };
  });

  const enrichedFlags = enrichEventFlow(flags);
  const importantFlags = enrichedFlags.filter((flag) => flag.important);
  return {
    source,
    completedCount: enrichedFlags.filter((flag) => flag.completed).length,
    totalCount: enrichedFlags.length,
    importantCompletedCount: importantFlags.filter((flag) => flag.completed).length,
    importantTotalCount: importantFlags.length,
    flags: enrichedFlags,
  };
}

function enrichEventFlow(flags: GameEventFlag[]): GameEventFlag[] {
  const completedByKey = new Map(flags.map((flag) => [flag.key, flag.completed]));
  return flags.map((flag) => {
    const missingPrerequisites = (flag.prerequisites ?? []).filter((key) => completedByKey.get(key) !== true);
    const alternativeCompleted = (flag.mutuallyExclusiveWith ?? []).filter((key) => completedByKey.get(key) === true);
    const mutuallyExclusiveDone = alternativeCompleted.length > 0;
    const flowStatus: GameEventFlag["flowStatus"] = flag.completed
      ? "done"
      : mutuallyExclusiveDone || flag.importance === "optional"
        ? "optional"
        : missingPrerequisites.length > 0
          ? "blocked"
          : "not-set";

    return {
      ...flag,
      missingPrerequisites,
      alternativeCompleted,
      description: flag.description ?? autoDescribeSourceFlag(flag).description,
      flowStatus,
      flowSteps: buildFlowSteps({ ...flag, missingPrerequisites, alternativeCompleted, flowStatus }),
    };
  });
}

export function normalizeEventProgress(value: unknown): GameEventProgress | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, any>;
  const flags = Array.isArray(record.flags)
    ? record.flags.map((flag) => ({
      id: Number(flag.id ?? 0),
      key: String(flag.key ?? ""),
      label: String(flag.label ?? flag.key ?? "Event"),
      category: String(flag.category ?? "Other"),
      completed: Boolean(flag.completed),
      importance: ["story", "unlock", "optional", "routine"].includes(String(flag.importance))
        ? flag.importance
        : undefined,
      important: Boolean(flag.important),
      note: flag.note === undefined ? undefined : String(flag.note),
      description: flag.description === undefined ? undefined : String(flag.description),
      descriptionKind: ["source-symbol", "source-context", "script-guided"].includes(String(flag.descriptionKind))
        ? flag.descriptionKind
        : undefined,
      actionHint: flag.actionHint === undefined ? undefined : String(flag.actionHint),
      flowSteps: Array.isArray(flag.flowSteps) ? flag.flowSteps.map(String) : undefined,
      prerequisites: Array.isArray(flag.prerequisites) ? flag.prerequisites.map(String) : undefined,
      missingPrerequisites: Array.isArray(flag.missingPrerequisites) ? flag.missingPrerequisites.map(String) : undefined,
      mutuallyExclusiveWith: Array.isArray(flag.mutuallyExclusiveWith) ? flag.mutuallyExclusiveWith.map(String) : undefined,
      alternativeCompleted: Array.isArray(flag.alternativeCompleted) ? flag.alternativeCompleted.map(String) : undefined,
      normalMissingReason: flag.normalMissingReason === undefined ? undefined : String(flag.normalMissingReason),
      flowStatus: ["done", "available", "blocked", "optional", "not-set"].includes(String(flag.flowStatus))
        ? flag.flowStatus
        : undefined,
      sourceRefs: Array.isArray(flag.sourceRefs) ? flag.sourceRefs.map(String) : undefined,
    }))
    : [];
  const enrichedFlags = enrichEventFlow(flags);
  const importantFlags = enrichedFlags.filter((flag) => flag.important);
  return {
    source: "live",
    completedCount: Number(record.completedCount ?? enrichedFlags.filter((flag) => flag.completed).length),
    totalCount: Number(record.totalCount ?? enrichedFlags.length),
    importantCompletedCount: Number(record.importantCompletedCount ?? importantFlags.filter((flag) => flag.completed).length),
    importantTotalCount: Number(record.importantTotalCount ?? importantFlags.length),
    flags: enrichedFlags,
  };
}

export function getEventFlagLayout(generation: Generation, game: GameVersion): EventFlagLayout {
  if (generation === 1) return game === "yellow" ? GEN1_EVENT_FLAGS.yellow : GEN1_EVENT_FLAGS.redBlue;
  if (generation === 2) return game === "crystal" ? GEN2_EVENT_FLAGS.crystal : GEN2_EVENT_FLAGS.goldSilver;
  if (game === "firered" || game === "leafgreen") return GEN3_EVENT_FLAGS.fireRedLeafGreen;
  if (game === "emerald") return GEN3_EVENT_FLAGS.emerald;
  return GEN3_EVENT_FLAGS.rubySapphire;
}

export function normalizeLiveEventBytes(
  value: unknown,
  generation: Generation,
  game: GameVersion
): GameEventProgress | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, any>;
  if (!Array.isArray(record.bytes)) return undefined;
  return parseEventProgress(Uint8Array.from(record.bytes.map((byte) => Number(byte) & 0xff)), getEventFlagLayout(generation, game), "live", 0);
}
