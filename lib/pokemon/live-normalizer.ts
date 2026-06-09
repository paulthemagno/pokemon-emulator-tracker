import type { InventorySection, PCBox, Pokemon, SaveData } from "./types";
import { getGen1ItemName, getGen2ItemName, getGen3ItemName } from "./data/items";
import { getGen2MapLandmark } from "./data/gen2-map-landmarks";
import { getGen1MapLandmark } from "./data/gen1-map-landmarks";
import { getGen3MapLandmark } from "./data/gen3-map-landmarks";
import { getGen3FRLGMapLandmark } from "./data/gen3-frlg-map-landmarks";
import { GEN3_HOENN_DEX_COUNT } from "./data/gen3-hoenn-dex";
import { GEN3_KANTO_DEX_COUNT } from "./data/gen3-kanto-dex";
import { getGen1Location, getGen3FRLGLocation, getGen3RSELocation } from "./data/locations";
import { getMoveById } from "./data/moves";
import { getSpeciesById } from "./data/species";
import { normalizeEventProgress, normalizeLiveEventBytes } from "./events";
import { getExpForLevel } from "./experience";
import { getStatusCondition } from "./utils";

type AnyRecord = Record<string, any>;

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function normalizeBadges(badges: unknown): boolean[] {
  if (!Array.isArray(badges)) return Array.from({ length: 16 }, () => false);
  return badges.map((badge) =>
    typeof badge === "boolean" ? badge : Boolean((badge as AnyRecord)?.earned)
  );
}

function normalizeTrainerGender(value: unknown): "male" | "female" | undefined {
  const gender = String(value ?? "").toLowerCase();
  if (gender === "male" || gender === "female") return gender;
  return undefined;
}

function normalizeMoves(pokemon: AnyRecord) {
  const moveList = asArray(pokemon.moves);
  if (moveList.length > 0) {
    return moveList
      .map((move, index) => {
        const id = Number(move.id ?? move.moveId ?? move.moveID ?? 0);
        const moveData = getMoveById(id);
        return {
          id,
          name: String(move.name ?? move.moveName ?? moveData.name ?? `Move ${index + 1}`),
          pp: Number(move.pp ?? move.currentPP ?? 0),
          maxPP: Number(move.maxPP ?? move.maxPp ?? moveData.pp ?? move.pp ?? 0),
          type: move.type ?? moveData.type,
          power: move.power ?? moveData.power,
          accuracy: move.accuracy ?? moveData.accuracy,
          learnedLevel: move.learnedLevel ?? move.level,
        };
      })
      .filter((move) => move.id > 0);
  }

  return [pokemon.move1, pokemon.move2, pokemon.move3, pokemon.move4]
    .filter(Boolean)
    .map((move, index) => {
      const id = Number(move?.id ?? move?.moveId ?? move);
      const moveData = getMoveById(id);
      return {
        id,
        name: String(move?.name ?? move?.moveName ?? moveData.name ?? `Move ${index + 1}`),
        pp: Number(move?.pp ?? 0),
        maxPP: Number(move?.maxPP ?? move?.pp ?? moveData.pp ?? 0),
        type: move?.type ?? moveData.type,
        power: move?.power ?? moveData.power,
        accuracy: move?.accuracy ?? moveData.accuracy,
      };
    })
    .filter((move) => move.id > 0);
}

function normalizePokemon(pokemon: AnyRecord, generation = 2): Pokemon | null {
  const species = Number(pokemon.species ?? pokemon.speciesId ?? pokemon.speciesID ?? pokemon.id ?? 0);
  const isEgg = Boolean(pokemon.isEgg ?? pokemon.egg);
  if (!species && !isEgg) return null;

  const speciesData = getSpeciesById(species);
  const speciesName = String(pokemon.speciesName ?? pokemon.name ?? speciesData.name ?? (isEgg ? "Egg" : `Pokemon ${species}`));
  const currentHP = Number(pokemon.currentHP ?? pokemon.currentHp ?? pokemon.curHP ?? pokemon.hp ?? 0);
  const maxHP = Number(pokemon.maxHP ?? pokemon.maxHp ?? pokemon.maxhp ?? 0);
  const statusByte =
    typeof pokemon.status === "number" ? pokemon.status : Number(pokemon.statusByte ?? 0);
  const heldItem = Number(pokemon.heldItem ?? 0);
  const experience = Number(pokemon.experience ?? pokemon.exp ?? 0);
  const inferredLevel = inferLevelFromExperience(species, experience);

  return {
    species,
    speciesName,
    types: speciesData.types,
    nickname: String(pokemon.nickname ?? speciesName),
    level: Number(pokemon.level ?? inferredLevel),
    currentHP,
    maxHP,
    experience,
    moves: normalizeMoves(pokemon),
    stats: {
      hp: maxHP,
      attack: Number(pokemon.attack ?? pokemon.stats?.attack ?? 0),
      defense: Number(pokemon.defense ?? pokemon.stats?.defense ?? 0),
      speed: Number(pokemon.speed ?? pokemon.stats?.speed ?? 0),
      specialAttack: Number(pokemon.specialAttack ?? pokemon.special ?? pokemon.stats?.specialAttack ?? 0),
      specialDefense: Number(pokemon.specialDefense ?? pokemon.special ?? pokemon.stats?.specialDefense ?? 0),
    },
    originalTrainer: String(pokemon.originalTrainer ?? pokemon.otName ?? ""),
    originalTrainerID: Number(pokemon.originalTrainerID ?? pokemon.otid ?? pokemon.otId ?? 0),
    heldItem: heldItem > 0 ? heldItem : undefined,
    heldItemName: heldItem > 0 ? String(pokemon.heldItemName ?? getLiveItemName(generation, heldItem)) : undefined,
    happiness: Number(pokemon.happiness ?? 0),
    status: (typeof pokemon.status === "string"
      ? pokemon.status
      : getStatusCondition(statusByte)) as Pokemon["status"],
    isShiny: Boolean(pokemon.isShiny ?? pokemon.shiny),
    isEgg,
    form: typeof pokemon.form === "number" ? pokemon.form : undefined,
    formName: pokemon.formName !== undefined ? String(pokemon.formName) : undefined,
    gender: pokemon.gender,
  };
}

function inferLevelFromExperience(species: number, experience: number): number {
  const growthRate = getSpeciesById(species).growthRate ?? "medium-fast";
  for (let level = 100; level >= 1; level--) {
    if (experience >= getExpForLevel(level, growthRate)) return level;
  }
  return 1;
}

function getLiveItemName(generation: number, id: number): string {
  if (generation === 1) return getGen1ItemName(id);
  if (generation === 3) return getGen3ItemName(id);
  return getGen2ItemName(id);
}

function normalizeInventory(bag: AnyRecord | null, generation: number): InventorySection[] {
  if (!bag) return [];
  const sections: InventorySection[] = [];
  const sectionMap: Array<[string, unknown]> = [
    ["Items", bag.items],
    ["Key Items", bag.keyItems],
    ["Poke Balls", bag.pokeballs ?? bag.balls],
    ["TMs/HMs", bag.tmhms],
    ["Berries", bag.berries],
    ["PC Storage", bag.pcStorage ?? bag.pcItems ?? bag.itemStorage],
  ];

  for (const [name, items] of sectionMap) {
    const flatItems = Array.isArray(items)
      ? items
      : [...asArray((items as AnyRecord)?.tms), ...asArray((items as AnyRecord)?.hms)];
    const normalizedItems = flatItems.map((item, index) => {
      const id = Number(item.id ?? index + 1);
      return {
        id,
        name: String(item.name ?? getLiveItemName(generation, id)),
        quantity: Number(item.quantity ?? item.count ?? 1),
        pocket: name,
      };
    });

    if (normalizedItems.length > 0) {
      sections.push({
        name,
        items: normalizedItems,
      });
    }
  }

  return sections;
}

function normalizePCBoxes(pcBoxes: unknown, generation = 2): PCBox[] {
  return asArray(pcBoxes)
    .map((box, index) => {
      const record = (box ?? {}) as AnyRecord;
      const capacity = Number(record.capacity ?? 20);
      const rawPokemon = asArray(record.pokemon);
      const hasExplicitSlots = rawPokemon.some((mon) => {
        const candidate = (mon ?? {}) as AnyRecord;
        return candidate.slotIndex !== undefined || candidate.slot !== undefined;
      });
      const pokemon: (Pokemon | null)[] = hasExplicitSlots ? Array.from({ length: capacity }, () => null) : [];
      for (const [fallbackIndex, mon] of rawPokemon.entries()) {
        const normalized = normalizePokemon(mon, generation);
        if (!normalized) continue;
        if (hasExplicitSlots) {
          const rawSlotIndex = Number((mon as AnyRecord).slotIndex);
          const rawOneBasedSlot = Number((mon as AnyRecord).slot);
          const slotIndex = Number.isFinite(rawSlotIndex)
            ? rawSlotIndex
            : Number.isFinite(rawOneBasedSlot)
              ? rawOneBasedSlot - 1
              : fallbackIndex;
          if (slotIndex >= 0 && slotIndex < capacity) {
            pokemon[slotIndex] = normalized;
          }
        } else {
          pokemon.push(normalized);
        }
      }
      const rawName = String(record.name ?? `Box ${index + 1}`);
      const legacyCurrentMatch = rawName.match(/^current box(?:\s+(\d+))?/i);
      const name = legacyCurrentMatch ? `Box ${legacyCurrentMatch[1] ?? index + 1}` : rawName;

      return {
        name,
        pokemon,
        capacity,
        isCurrent: Boolean(record.isCurrent) || Boolean(legacyCurrentMatch),
      };
    });
}

export function normalizeLiveSnapshot(snapshot: AnyRecord): SaveData {
  const generation = Number(snapshot.generation ?? snapshot.status?.generation ?? 2) as SaveData["generation"];
  const player = snapshot.player ?? snapshot.trainer ?? {};
  const partySource = snapshot.party?.party ?? snapshot.party?.pokemon ?? snapshot.party;
  const party = asArray(partySource).map((mon) => normalizePokemon(mon, generation)).filter(Boolean) as Pokemon[];
  const pcBoxes = normalizePCBoxes(snapshot.pcBoxes, generation);
  const badges = normalizeBadges(player.badges);
  const game = String(snapshot.game ?? snapshot.status?.game ?? snapshot.status?.version ?? "crystal").toLowerCase() as SaveData["game"];
  const liveMapId = Number(snapshot.location?.mapId ?? player.location?.mapId ?? 0);
  const liveMapGroup = Number(snapshot.location?.mapGroup ?? player.location?.mapGroup ?? 0);
  const rawLocationName = String(snapshot.location?.name ?? player.location?.name ?? "");
  const landmark = generation === 2 ? getGen2MapLandmark(liveMapGroup, liveMapId, rawLocationName) : undefined;
  const gen1Landmark = generation === 1 ? getGen1MapLandmark(liveMapId) : undefined;
  const isFRLG = game === "firered" || game === "leafgreen";
  const gen3Landmark = generation === 3
    ? isFRLG
      ? getGen3FRLGMapLandmark(liveMapGroup, liveMapId)
      : getGen3MapLandmark(liveMapGroup, liveMapId)
    : undefined;
  const locationName =
    landmark?.name ??
    gen1Landmark?.name ??
    gen3Landmark?.name ??
    (generation === 1 && Number.isFinite(liveMapId) ? getGen1Location(liveMapId) : undefined) ??
    (generation === 3 && Number.isFinite(liveMapId) ? (isFRLG ? getGen3FRLGLocation(liveMapId) : getGen3RSELocation(liveMapId)) : undefined) ??
    (rawLocationName && rawLocationName !== "Live" ? rawLocationName : "Location syncing");
  const livePokedex = snapshot.pokedex as AnyRecord | undefined;
  const livePokedexMode = livePokedex?.mode === "national" ? "national" : "regional";
  const liveRegionalDex =
    generation === 3 && livePokedexMode === "regional"
      ? isFRLG
        ? "kanto"
        : game === "ruby" || game === "sapphire" || game === "emerald"
          ? "hoenn"
          : undefined
      : undefined;
  const liveDexMax =
    liveRegionalDex === "kanto"
      ? GEN3_KANTO_DEX_COUNT
      : liveRegionalDex === "hoenn"
        ? GEN3_HOENN_DEX_COUNT
        : livePokedex?.dexMax;

  return {
    generation,
    game,
    trainer: {
      name: String(player.name ?? "Live Trainer"),
      gender: normalizeTrainerGender(player.gender),
      id: Number(player.id ?? player.trainerId ?? 0),
      money: Number(player.money ?? 0),
      badges,
      badgeCount: badges.filter(Boolean).length,
      playTime: {
        hours: Number(player.playTime?.hours ?? 0),
        minutes: Number(player.playTime?.minutes ?? 0),
        seconds: Number(player.playTime?.seconds ?? 0),
      },
    },
    pokedex: livePokedex
      ? {
          seenSpecies: asArray(livePokedex.seenSpecies).map((v) => Number(v)).filter((v) => v > 0),
          caughtSpecies: asArray(livePokedex.caughtSpecies).map((v) => Number(v)).filter((v) => v > 0),
          seenCount: Number(livePokedex.seenCount ?? asArray(livePokedex.seenSpecies).length),
          caughtCount: Number(livePokedex.caughtCount ?? asArray(livePokedex.caughtSpecies).length),
          source: "live",
          mode: livePokedexMode,
          regionalDex: liveRegionalDex,
          dexMax: typeof liveDexMax === "number" ? liveDexMax : undefined,
        }
      : undefined,
    party,
    pcBoxes,
    inventory: normalizeInventory(snapshot.bag ?? snapshot.inventory, generation),
    events: normalizeEventProgress(snapshot.events) ?? normalizeLiveEventBytes(snapshot.eventsRaw, generation, game),
    location: {
      mapId: liveMapId,
      mapGroup: Number.isFinite(liveMapGroup) ? liveMapGroup : undefined,
      name: locationName,
      x: Number(snapshot.location?.x ?? player.location?.x ?? 0),
      y: Number(snapshot.location?.y ?? player.location?.y ?? 0),
      areaType: "unknown",
    },
    valid: true,
    rawSize: 0,
  };
}
