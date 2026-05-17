import type { PCBox, SaveData } from "./types";

export function hasStoredPokemon(data: SaveData | null): boolean {
  return Boolean(
    data?.pcBoxes.some((box) => box.pokemon.some((pokemon) => pokemon !== null))
  );
}

function emptyBox(index: number, isCurrent = false): PCBox {
  return {
    name: `Box ${index + 1}`,
    pokemon: [],
    capacity: 20,
    isCurrent,
  };
}

function shouldUseLiveCurrentBox(liveBox: PCBox | undefined): liveBox is PCBox {
  return Boolean(
    liveBox?.isCurrent && liveBox.pokemon.some((pokemon) => pokemon !== null)
  );
}

function areCompatiblePcBoxSources(liveData: SaveData, saveData: SaveData): boolean {
  if (saveData.generation !== liveData.generation) return false;
  if (saveData.game === liveData.game) return true;

  const redBlue = new Set(["red", "blue"]);
  return liveData.generation === 1 && redBlue.has(liveData.game) && redBlue.has(saveData.game);
}

export function mergeLiveWithSavePcBoxes(
  liveData: SaveData,
  saveData: SaveData | null
): SaveData {
  if (!hasStoredPokemon(saveData)) return liveData;
  if (!saveData) return liveData;
  if (!areCompatiblePcBoxSources(liveData, saveData)) return liveData;

  if (!liveData.pcBoxes.length) {
    return {
      ...liveData,
      pcBoxes: saveData.pcBoxes,
    };
  }

  const maxBoxes = Math.max(liveData.pcBoxes.length, saveData.pcBoxes.length);
  const mergedBoxes = Array.from({ length: maxBoxes }, (_, index) => {
    const liveBox = liveData.pcBoxes[index];
    const saveBox = saveData.pcBoxes[index];
    const isCurrent = Boolean(liveBox?.isCurrent);

    if (shouldUseLiveCurrentBox(liveBox)) return liveBox;

    if (saveBox) {
      return {
        ...saveBox,
        name: saveBox.name,
        isCurrent,
      };
    }

    return liveBox ?? emptyBox(index, isCurrent);
  });

  return {
    ...liveData,
    pcBoxes: mergedBoxes,
  };
}
