import type { Pokemon } from "./types";

const UNOWN_FORM_LABELS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N",
  "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "!", "?",
] as const;

const UNOWN_SPRITE_SUFFIXES = [
  "", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n",
  "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "exclamation", "question",
] as const;

export function getGen2UnownFormFromDVs(attack: number, defense: number, speed: number, special: number): number {
  const composite =
    (((attack >> 1) & 0x03) << 6) |
    (((defense >> 1) & 0x03) << 4) |
    (((speed >> 1) & 0x03) << 2) |
    ((special >> 1) & 0x03);
  return Math.min(25, Math.floor(composite / 10));
}

export function getGen3UnownFormFromPersonality(personality: number): number {
  const composite =
    ((personality & 0x03000000) >>> 18) |
    ((personality & 0x00030000) >>> 12) |
    ((personality & 0x00000300) >>> 6) |
    (personality & 0x00000003);
  return composite % 28;
}

export function getUnownFormLabel(form: number | undefined): string | undefined {
  if (form === undefined || form < 0 || form >= UNOWN_FORM_LABELS.length) return undefined;
  return UNOWN_FORM_LABELS[form];
}

export function getPokemonSpriteUrl(pokemonOrSpecies: Pokemon | number): string {
  const species = typeof pokemonOrSpecies === "number" ? pokemonOrSpecies : pokemonOrSpecies.species;
  const isShiny = typeof pokemonOrSpecies === "number" ? false : Boolean(pokemonOrSpecies.isShiny);
  const form = typeof pokemonOrSpecies === "number" ? undefined : pokemonOrSpecies.form;

  if (species === 201 && form !== undefined) {
    const suffix = UNOWN_SPRITE_SUFFIXES[form];
    if (suffix !== undefined) {
      const shinyPath = isShiny ? "shiny/" : "";
      return suffix
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shinyPath}201-${suffix}.png`
        : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shinyPath}201.png`;
    }
  }

  if (species <= 0 || species > 386) {
    return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png";
  }

  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${isShiny ? "shiny/" : ""}${species}.png`;
}

export function getEggSpriteUrl(): string {
  return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/egg.png";
}
