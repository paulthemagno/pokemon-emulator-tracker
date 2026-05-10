import type { InventorySection, PCBox, Pokemon, SaveData } from "./types";
import { getGen2ItemName } from "./data/items";
import { getGen2MapLandmark } from "./data/gen2-map-landmarks";
import { getMoveById } from "./data/moves";
import { getSpeciesById } from "./data/species";
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

function normalizePokemon(pokemon: AnyRecord): Pokemon | null {
  const species = Number(pokemon.species ?? pokemon.speciesId ?? pokemon.speciesID ?? pokemon.id ?? 0);
  if (!species) return null;

  const speciesData = getSpeciesById(species);
  const speciesName = String(pokemon.speciesName ?? pokemon.name ?? speciesData.name ?? `Pokemon ${species}`);
  const currentHP = Number(pokemon.currentHP ?? pokemon.currentHp ?? pokemon.curHP ?? pokemon.hp ?? 0);
  const maxHP = Number(pokemon.maxHP ?? pokemon.maxHp ?? pokemon.maxhp ?? 0);
  const statusByte =
    typeof pokemon.status === "number" ? pokemon.status : Number(pokemon.statusByte ?? 0);
  const heldItem = Number(pokemon.heldItem ?? 0);

  return {
    species,
    speciesName,
    types: speciesData.types,
    nickname: String(pokemon.nickname ?? speciesName),
    level: Number(pokemon.level ?? 1),
    currentHP,
    maxHP,
    experience: Number(pokemon.experience ?? pokemon.exp ?? 0),
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
    heldItemName: heldItem > 0 ? String(pokemon.heldItemName ?? getGen2ItemName(heldItem)) : undefined,
    happiness: Number(pokemon.happiness ?? 0),
    status: (typeof pokemon.status === "string"
      ? pokemon.status
      : getStatusCondition(statusByte)) as Pokemon["status"],
    isShiny: Boolean(pokemon.isShiny ?? pokemon.shiny),
    gender: pokemon.gender,
  };
}

function normalizeInventory(bag: AnyRecord | null): InventorySection[] {
  if (!bag) return [];
  const sections: InventorySection[] = [];
  const sectionMap: Array<[string, unknown]> = [
    ["Items", bag.items],
    ["Key Items", bag.keyItems],
    ["Poke Balls", bag.pokeballs ?? bag.balls],
    ["TMs/HMs", bag.tmhms],
  ];

  for (const [name, items] of sectionMap) {
    const flatItems = Array.isArray(items)
      ? items
      : [...asArray((items as AnyRecord)?.tms), ...asArray((items as AnyRecord)?.hms)];
    const normalizedItems = flatItems.map((item, index) => {
      const id = Number(item.id ?? index + 1);
      return {
        id,
        name: String(item.name ?? getGen2ItemName(id)),
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

function normalizePCBoxes(pcBoxes: unknown): PCBox[] {
  return asArray(pcBoxes)
    .map((box, index) => {
      const record = (box ?? {}) as AnyRecord;
      const pokemon = asArray(record.pokemon)
        .map(normalizePokemon)
        .filter(Boolean) as Pokemon[];
      const name = String(record.name ?? `Box ${index + 1}`);

      return {
        name,
        pokemon,
        capacity: Number(record.capacity ?? 20),
        isCurrent: Boolean(record.isCurrent) || name.toLowerCase().startsWith("current box"),
      };
    })
    .filter((box) => box.pokemon.length > 0);
}

export function normalizeLiveSnapshot(snapshot: AnyRecord): SaveData {
  const player = snapshot.player ?? snapshot.trainer ?? {};
  const partySource = snapshot.party?.party ?? snapshot.party?.pokemon ?? snapshot.party;
  const party = asArray(partySource).map(normalizePokemon).filter(Boolean) as Pokemon[];
  const pcBoxes = normalizePCBoxes(snapshot.pcBoxes);
  const badges = normalizeBadges(player.badges);
  const liveMapId = Number(snapshot.location?.mapId ?? player.location?.mapId ?? 0);
  const liveMapGroup = Number(snapshot.location?.mapGroup ?? player.location?.mapGroup ?? 0);
  const rawLocationName = String(snapshot.location?.name ?? player.location?.name ?? "");
  const landmark = getGen2MapLandmark(liveMapGroup, liveMapId, rawLocationName);
  const locationName =
    landmark?.name ??
    (rawLocationName && rawLocationName !== "Live" ? rawLocationName : "Location syncing");
  const livePokedex = snapshot.pokedex as AnyRecord | undefined;

  return {
    generation: Number(snapshot.generation ?? snapshot.status?.generation ?? 2) as SaveData["generation"],
    game: String(snapshot.game ?? snapshot.status?.game ?? snapshot.status?.version ?? "crystal").toLowerCase() as SaveData["game"],
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
        }
      : undefined,
    party,
    pcBoxes: pcBoxes.length ? pcBoxes : [{ name: "Live PC", pokemon: [], capacity: 20 }],
    inventory: normalizeInventory(snapshot.bag ?? snapshot.inventory),
    location: {
      mapId: liveMapId,
      mapGroup: liveMapGroup || undefined,
      name: locationName,
      x: Number(snapshot.location?.x ?? player.location?.x ?? 0),
      y: Number(snapshot.location?.y ?? player.location?.y ?? 0),
      areaType: "unknown",
    },
    valid: true,
    rawSize: 0,
  };
}
