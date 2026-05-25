import type { PCBox, SaveData } from "./types";

function hasItems<T>(items: T[] | null | undefined) {
  return Array.isArray(items) && items.length > 0;
}

function hasPokemonInBox(box: PCBox | undefined) {
  return Boolean(box?.pokemon.some((pokemon) => pokemon !== null));
}

function areCompatibleLiveSnapshots(previous: SaveData, next: SaveData) {
  if (previous.generation !== next.generation) return false;
  if (previous.game === next.game) return true;

  const redBlue = new Set(["red", "blue"]);
  return previous.generation === 1 && redBlue.has(previous.game) && redBlue.has(next.game);
}

function fallbackBox(index: number, isCurrent = false): PCBox {
  return {
    name: `Box ${index + 1}`,
    pokemon: [],
    capacity: 20,
    isCurrent,
  };
}

function mergeLivePcBoxes(previous: SaveData, next: SaveData): PCBox[] {
  if (!hasItems(next.pcBoxes)) return next.generation === 3 ? [] : previous.pcBoxes;
  if (!areCompatibleLiveSnapshots(previous, next)) return next.pcBoxes;

  const maxBoxes = Math.max(previous.pcBoxes.length, next.pcBoxes.length);
  return Array.from({ length: maxBoxes }, (_, index) => {
    const nextBox = next.pcBoxes[index];
    const previousBox = previous.pcBoxes[index];
    const isCurrent = Boolean(nextBox?.isCurrent);

    if (isCurrent || hasPokemonInBox(nextBox)) {
      return {
        ...(nextBox ?? fallbackBox(index, isCurrent)),
        name: nextBox?.name || previousBox?.name || `Box ${index + 1}`,
        isCurrent,
      };
    }

    if (hasPokemonInBox(previousBox)) {
      return {
        ...previousBox,
        isCurrent: false,
      };
    }

    return nextBox ?? previousBox ?? fallbackBox(index, false);
  });
}

function isLikelyFallbackTrainerName(name: string | undefined) {
  const normalized = (name ?? "").trim().toLowerCase();
  return normalized.length === 0 || normalized === "live trainer";
}

function isTrainerSnapshotPlausible(previous: SaveData | null, next: SaveData) {
  const nextTrainer = next.trainer;
  if (nextTrainer.money < 0 || nextTrainer.money > 999999) return false;
  if (nextTrainer.playTime.minutes < 0 || nextTrainer.playTime.minutes > 59) return false;
  if ((nextTrainer.playTime.seconds ?? 0) < 0 || (nextTrainer.playTime.seconds ?? 0) > 59) return false;

  if (!previous) return true;

  const prevTrainer = previous.trainer;
  if (isLikelyFallbackTrainerName(nextTrainer.name) && !isLikelyFallbackTrainerName(prevTrainer.name)) {
    return false;
  }

  const moneyDelta = Math.abs(nextTrainer.money - prevTrainer.money);
  if (moneyDelta > 500000) return false;

  const prevSeconds =
    (prevTrainer.playTime.hours * 3600) +
    (prevTrainer.playTime.minutes * 60) +
    (prevTrainer.playTime.seconds ?? 0);
  const nextSeconds =
    (nextTrainer.playTime.hours * 3600) +
    (nextTrainer.playTime.minutes * 60) +
    (nextTrainer.playTime.seconds ?? 0);

  if (nextSeconds + 5 < prevSeconds) return false;

  return true;
}

function hasNonPlaceholderLocation(next: SaveData) {
  const locationName = next.location?.name?.trim() ?? "";
  if (locationName.length === 0 || locationName === "Location syncing") return false;
  if (locationName === "Map 0-0") return false;
  return true;
}

export function mergeLiveData(previous: SaveData | null, next: SaveData): SaveData {
  if (!previous) return next;
  if (!areCompatibleLiveSnapshots(previous, next)) return next;

  const useNextTrainer = isTrainerSnapshotPlausible(previous, next);

  return {
    ...next,
    trainer: useNextTrainer
      ? {
          ...previous.trainer,
          ...next.trainer,
          badges: hasItems(next.trainer.badges) ? next.trainer.badges : previous.trainer.badges,
          playTime: {
            ...previous.trainer.playTime,
            ...next.trainer.playTime,
          },
        }
      : previous.trainer,
    pokedex: next.pokedex ?? previous.pokedex,
    party: hasItems(next.party) ? next.party : previous.party,
    pcBoxes: mergeLivePcBoxes(previous, next),
    inventory: hasItems(next.inventory) ? next.inventory : previous.inventory,
    location: hasNonPlaceholderLocation(next) ? next.location : previous.location,
  };
}
