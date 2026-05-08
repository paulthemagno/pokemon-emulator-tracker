// Utility functions for Pokemon save file parsing

import type { StatusCondition } from "./types";
import { ITEM_DESCRIPTIONS } from "./data/item-descriptions";
import { getGen1ItemName, getGen2ItemName, getGen3ItemName } from "./data/items";
import {
  getGen3FRLGLocation,
  getGen3RSELocation,
} from "./data/locations";
import { getMoveName as getMoveDataName } from "./data/moves";
import { getSpeciesName as getSpeciesDataName } from "./data/species";

// Gen 1/2 Character encoding table
const GEN1_CHAR_TABLE: Record<number, string> = {
  0x50: "", // Terminator
  0x7f: " ",
  0x80: "A",
  0x81: "B",
  0x82: "C",
  0x83: "D",
  0x84: "E",
  0x85: "F",
  0x86: "G",
  0x87: "H",
  0x88: "I",
  0x89: "J",
  0x8a: "K",
  0x8b: "L",
  0x8c: "M",
  0x8d: "N",
  0x8e: "O",
  0x8f: "P",
  0x90: "Q",
  0x91: "R",
  0x92: "S",
  0x93: "T",
  0x94: "U",
  0x95: "V",
  0x96: "W",
  0x97: "X",
  0x98: "Y",
  0x99: "Z",
  0x9a: "(",
  0x9b: ")",
  0x9c: ":",
  0x9d: ";",
  0x9e: "[",
  0x9f: "]",
  0xa0: "a",
  0xa1: "b",
  0xa2: "c",
  0xa3: "d",
  0xa4: "e",
  0xa5: "f",
  0xa6: "g",
  0xa7: "h",
  0xa8: "i",
  0xa9: "j",
  0xaa: "k",
  0xab: "l",
  0xac: "m",
  0xad: "n",
  0xae: "o",
  0xaf: "p",
  0xb0: "q",
  0xb1: "r",
  0xb2: "s",
  0xb3: "t",
  0xb4: "u",
  0xb5: "v",
  0xb6: "w",
  0xb7: "x",
  0xb8: "y",
  0xb9: "z",
  0xe0: "'",
  0xe1: "PK",
  0xe2: "MN",
  0xe3: "-",
  0xe6: "?",
  0xe7: "!",
  0xe8: ".",
  0xef: "♂",
  0xf0: "¥",
  0xf1: "×",
  0xf3: "/",
  0xf4: ",",
  0xf5: "♀",
  0xf6: "0",
  0xf7: "1",
  0xf8: "2",
  0xf9: "3",
  0xfa: "4",
  0xfb: "5",
  0xfc: "6",
  0xfd: "7",
  0xfe: "8",
  0xff: "9",
};

// Gen 3 Character encoding (uses standard with some special chars)
const GEN3_CHAR_TABLE: Record<number, string> = {
  0x00: " ",
  0x01: "À",
  0x02: "Á",
  0x03: "Â",
  0x04: "Ç",
  0x05: "È",
  0x06: "É",
  0x07: "Ê",
  0x08: "Ë",
  0x09: "Ì",
  0x0b: "Î",
  0x0c: "Ï",
  0x0d: "Ò",
  0x0e: "Ó",
  0x0f: "Ô",
  0x10: "Œ",
  0x11: "Ù",
  0x12: "Ú",
  0x13: "Û",
  0x14: "Ñ",
  0x15: "ß",
  0x16: "à",
  0x17: "á",
  0x19: "ç",
  0x1a: "è",
  0x1b: "é",
  0x1c: "ê",
  0x1d: "ë",
  0x1e: "ì",
  0x20: "î",
  0x21: "ï",
  0x22: "ò",
  0x23: "ó",
  0x24: "ô",
  0x25: "œ",
  0x26: "ù",
  0x27: "ú",
  0x28: "û",
  0x29: "ñ",
  0x2a: "º",
  0x2b: "ª",
  0x2d: "&",
  0x2e: "+",
  0x35: "=",
  0x36: ";",
  0x51: "¿",
  0x52: "¡",
  0x53: "PK",
  0x54: "MN",
  0x55: "PO",
  0x56: "Ké",
  0x5a: "Í",
  0x5b: "%",
  0x5c: "(",
  0x5d: ")",
  0x68: "â",
  0x6f: "í",
  0x79: "⬆",
  0x7a: "⬇",
  0x7b: "⬅",
  0x7c: "➡",
  0x85: "<",
  0x86: ">",
  0xa1: "0",
  0xa2: "1",
  0xa3: "2",
  0xa4: "3",
  0xa5: "4",
  0xa6: "5",
  0xa7: "6",
  0xa8: "7",
  0xa9: "8",
  0xaa: "9",
  0xab: "!",
  0xac: "?",
  0xad: ".",
  0xae: "-",
  0xaf: "·",
  0xb0: "…",
  0xb1: "\"",
  0xb2: "\"",
  0xb3: "'",
  0xb4: "'",
  0xb5: "♂",
  0xb6: "♀",
  0xb7: "¥",
  0xb8: ",",
  0xb9: "×",
  0xba: "/",
  0xbb: "A",
  0xbc: "B",
  0xbd: "C",
  0xbe: "D",
  0xbf: "E",
  0xc0: "F",
  0xc1: "G",
  0xc2: "H",
  0xc3: "I",
  0xc4: "J",
  0xc5: "K",
  0xc6: "L",
  0xc7: "M",
  0xc8: "N",
  0xc9: "O",
  0xca: "P",
  0xcb: "Q",
  0xcc: "R",
  0xcd: "S",
  0xce: "T",
  0xcf: "U",
  0xd0: "V",
  0xd1: "W",
  0xd2: "X",
  0xd3: "Y",
  0xd4: "Z",
  0xd5: "a",
  0xd6: "b",
  0xd7: "c",
  0xd8: "d",
  0xd9: "e",
  0xda: "f",
  0xdb: "g",
  0xdc: "h",
  0xdd: "i",
  0xde: "j",
  0xdf: "k",
  0xe0: "l",
  0xe1: "m",
  0xe2: "n",
  0xe3: "o",
  0xe4: "p",
  0xe5: "q",
  0xe6: "r",
  0xe7: "s",
  0xe8: "t",
  0xe9: "u",
  0xea: "v",
  0xeb: "w",
  0xec: "x",
  0xed: "y",
  0xee: "z",
  0xef: "▶",
  0xf0: ":",
  0xf1: "Ä",
  0xf2: "Ö",
  0xf3: "Ü",
  0xf4: "ä",
  0xf5: "ö",
  0xf6: "ü",
  0xff: "", // Terminator
};

/**
 * Decode Gen 1/2 string from bytes
 */
export function decodeGen1String(
  data: Uint8Array,
  offset: number,
  maxLength: number
): string {
  let result = "";
  for (let i = 0; i < maxLength; i++) {
    const byte = data[offset + i];
    if (byte === 0x50 || byte === 0x00) break; // Terminator
    result += GEN1_CHAR_TABLE[byte] || "?";
  }
  return result;
}

/**
 * Decode Gen 3 string from bytes
 */
export function decodeGen3String(
  data: Uint8Array,
  offset: number,
  maxLength: number
): string {
  let result = "";
  for (let i = 0; i < maxLength; i++) {
    const byte = data[offset + i];
    if (byte === 0xff || byte === 0x00) break; // Terminator
    result += GEN3_CHAR_TABLE[byte] || "?";
  }
  return result;
}

export function getGen3CharacterMap(): Record<number, string> {
  return GEN3_CHAR_TABLE;
}

export function decodeString(
  data: Uint8Array,
  characterMap: Record<number, string> = GEN3_CHAR_TABLE
): string {
  let result = "";
  for (const byte of data) {
    if (byte === 0xff || byte === 0x00 || byte === 0x50) break;
    result += characterMap[byte] || "?";
  }
  return result;
}

export function getSpeciesName(id: number, generation?: number): string {
  return getSpeciesDataName(id);
}

export function getMoveName(id: number, generation?: number): string {
  return getMoveDataName(id);
}

export function getItemName(id: number, generation?: number): string {
  if (generation === 1) return getGen1ItemName(id);
  if (generation === 2) return getGen2ItemName(id);
  return getGen3ItemName(id);
}

export function getGen3LocationName(id: number, isFRLG = false): string {
  return isFRLG ? getGen3FRLGLocation(id) : getGen3RSELocation(id);
}

/**
 * Read BCD (Binary Coded Decimal) money value - Gen 1/2
 */
export function readBCD(data: Uint8Array, offset: number, length: number): number {
  let value = 0;
  for (let i = 0; i < length; i++) {
    const byte = data[offset + i];
    const high = (byte >> 4) & 0x0f;
    const low = byte & 0x0f;
    value = value * 100 + high * 10 + low;
  }
  return value;
}

/**
 * Read little-endian 16-bit value
 */
export function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

/**
 * Read little-endian 32-bit value
 */
export function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

/**
 * Read big-endian 16-bit value (Gen 1/2 use big-endian for some values)
 */
export function readUint16BE(data: Uint8Array, offset: number): number {
  return (data[offset] << 8) | data[offset + 1];
}

/**
 * Calculate Gen 1/2 checksum
 */
export function calculateGen1Checksum(
  data: Uint8Array,
  start: number,
  end: number
): number {
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum = (sum + data[i]) & 0xff;
  }
  return (~sum) & 0xff;
}

/**
 * Calculate Gen 3 section checksum
 */
export function calculateGen3Checksum(data: Uint8Array, offset: number): number {
  let checksum = 0;
  for (let i = 0; i < 0xf80; i += 4) {
    checksum = (checksum + readUint32LE(data, offset + i)) >>> 0;
  }
  return ((checksum & 0xffff) + (checksum >>> 16)) & 0xffff;
}

/**
 * Get status condition from status byte
 */
export function getStatusCondition(statusByte: number): StatusCondition {
  if (statusByte === 0) return "none";
  if (statusByte & 0x07) return "sleep"; // Bits 0-2 are sleep counter
  if (statusByte & 0x08) return "poison";
  if (statusByte & 0x10) return "burn";
  if (statusByte & 0x20) return "freeze";
  if (statusByte & 0x40) return "paralysis";
  if (statusByte & 0x80) return "bad-poison";
  return "none";
}

/**
 * Get sprite URL from PokeAPI
 */
export function getSpriteUrl(speciesId: number, shiny = false): string {
  if (speciesId <= 0 || speciesId > 386) {
    return "/placeholder-pokemon.png";
  }
  const path = shiny ? "shiny" : "default";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${path === "shiny" ? "shiny/" : ""}${speciesId}.png`;
}

const ITEM_NAME_ALIASES: Record<string, string> = {
  "parlyz heal": "paralyze-heal",
  "guard spec": "guard-spec",
  "x defend": "x-defense",
  "x special": "x-sp-atk",
  "max elixer": "max-elixir",
  elixer: "elixir",
  "poke ball": "poke-ball",
  pokeball: "poke-ball",
  "ss ticket": "ss-ticket",
  "oaks parcel": "parcel",
  bicycle: "bike",
  "bike voucher": "bike",
  itemfinder: "dowsing-machine",
  "exp all": "exp-share",
  "exp share": "exp-share",
  brightpowder: "bright-powder",
  secretpotion: "secret-potion",
  "kings rock": "kings-rock",
  psncureberry: "pecha-berry",
  przcureberry: "cheri-berry",
  "burnt berry": "aspear-berry",
  "ice berry": "rawst-berry",
  "bitter berry": "persim-berry",
  "mint berry": "chesto-berry",
  berry: "oran-berry",
  "gold berry": "sitrus-berry",
  mysteryberry: "leppa-berry",
  miracleberry: "lum-berry",
  tinymushroom: "tiny-mushroom",
  silverpowder: "silver-powder",
  twistedspoon: "twisted-spoon",
  blackbelt: "black-belt",
  blackglasses: "black-glasses",
  slowpoketail: "slowpoke-tail",
  nevermeltice: "never-melt-ice",
  ragecandybar: "rage-candy-bar",
  energypowder: "energy-powder",
  berserkgene: "berserk-gene",
  squirtbottle: "squirt-bottle",
  litebluemail: "liteblue-mail",
  portraitmail: "portrait-mail",
  bluesky: "bluesky-mail",
  "pink bow": "silk-scarf",
  "polkadot bow": "silk-scarf",
  "devon goods": "devon-parts",
  "pokeblock case": "pokeblock-kit",
  "rm 1 key": "key-to-room-1",
  "rm 2 key": "key-to-room-2",
  "rm 4 key": "key-to-room-4",
  "rm 6 key": "key-to-room-6",
};

const POKESPRITE_ITEM_PATHS: Record<string, string> = {
  "master-ball": "ball/master",
  "ultra-ball": "ball/ultra",
  "great-ball": "ball/great",
  "poke-ball": "ball/poke",
  "safari-ball": "ball/safari",
  "net-ball": "ball/net",
  "dive-ball": "ball/dive",
  "nest-ball": "ball/nest",
  "repeat-ball": "ball/repeat",
  "timer-ball": "ball/timer",
  "luxury-ball": "ball/luxury",
  "premier-ball": "ball/premier",
  "heavy-ball": "ball/heavy",
  "level-ball": "ball/level",
  "lure-ball": "ball/lure",
  "fast-ball": "ball/fast",
  "friend-ball": "ball/friend",
  "moon-ball": "ball/moon",
  "love-ball": "ball/love",
  "park-ball": "ball/park",
  potion: "medicine/potion",
  antidote: "medicine/antidote",
  "burn-heal": "medicine/burn-heal",
  "ice-heal": "medicine/ice-heal",
  awakening: "medicine/awakening",
  "paralyze-heal": "medicine/paralyze-heal",
  "full-restore": "medicine/full-restore",
  "max-potion": "medicine/max-potion",
  "hyper-potion": "medicine/hyper-potion",
  "super-potion": "medicine/super-potion",
  "full-heal": "medicine/full-heal",
  revive: "medicine/revive",
  "max-revive": "medicine/max-revive",
  "fresh-water": "medicine/fresh-water",
  "soda-pop": "medicine/soda-pop",
  lemonade: "medicine/lemonade",
  "moomoo-milk": "medicine/moomoo-milk",
  "energy-powder": "medicine/energy-powder",
  "energy-root": "medicine/energy-root",
  "heal-powder": "medicine/heal-powder",
  "revival-herb": "medicine/revival-herb",
  ether: "medicine/ether",
  "max-ether": "medicine/max-ether",
  elixir: "medicine/elixir",
  "max-elixir": "medicine/max-elixir",
  "lava-cookie": "medicine/lava-cookie",
  "berry-juice": "medicine/berry-juice",
  "sacred-ash": "medicine/sacred-ash",
  "hp-up": "medicine/hp-up",
  protein: "medicine/protein",
  iron: "medicine/iron",
  carbos: "medicine/carbos",
  calcium: "medicine/calcium",
  "rare-candy": "medicine/rare-candy",
  "pp-up": "medicine/pp-up",
  zinc: "medicine/zinc",
  "pp-max": "medicine/pp-max",
  "guard-spec": "battle-item/guard-spec",
  "dire-hit": "battle-item/dire-hit",
  "x-attack": "battle-item/x-attack",
  "x-defense": "battle-item/x-defense",
  "x-speed": "battle-item/x-speed",
  "x-accuracy": "battle-item/x-accuracy",
  "x-sp-atk": "battle-item/x-sp-atk",
  "poke-doll": "other-item/poke-doll",
  "fluffy-tail": "other-item/fluffy-tail",
  "super-repel": "other-item/super-repel",
  "max-repel": "other-item/max-repel",
  "escape-rope": "other-item/escape-rope",
  repel: "other-item/repel",
  "sun-stone": "evo-item/sun-stone",
  "moon-stone": "evo-item/moon-stone",
  "fire-stone": "evo-item/fire-stone",
  "thunder-stone": "evo-item/thunder-stone",
  "water-stone": "evo-item/water-stone",
  "leaf-stone": "evo-item/leaf-stone",
  "tiny-mushroom": "valuable-item/tiny-mushroom",
  "big-mushroom": "valuable-item/big-mushroom",
  pearl: "valuable-item/pearl",
  "big-pearl": "valuable-item/big-pearl",
  stardust: "valuable-item/stardust",
  "star-piece": "valuable-item/star-piece",
  nugget: "valuable-item/nugget",
  "heart-scale": "other-item/heart-scale",
  "old-amber": "fossil/old-amber",
  "helix-fossil": "fossil/helix",
  "dome-fossil": "fossil/dome",
  "root-fossil": "fossil/root",
  "claw-fossil": "fossil/claw",
  "cheri-berry": "berry/cheri",
  "chesto-berry": "berry/chesto",
  "pecha-berry": "berry/pecha",
  "rawst-berry": "berry/rawst",
  "aspear-berry": "berry/aspear",
  "leppa-berry": "berry/leppa",
  "oran-berry": "berry/oran",
  "persim-berry": "berry/persim",
  "lum-berry": "berry/lum",
  "sitrus-berry": "berry/sitrus",
  "figy-berry": "berry/figy",
  "wiki-berry": "berry/wiki",
  "mago-berry": "berry/mago",
  "aguav-berry": "berry/aguav",
  "iapapa-berry": "berry/iapapa",
  "razz-berry": "berry/razz",
  "bluk-berry": "berry/bluk",
  "nanab-berry": "berry/nanab",
  "wepear-berry": "berry/wepear",
  "pinap-berry": "berry/pinap",
  "pomeg-berry": "berry/pomeg",
  "kelpsy-berry": "berry/kelpsy",
  "qualot-berry": "berry/qualot",
  "hondew-berry": "berry/hondew",
  "grepa-berry": "berry/grepa",
  "tamato-berry": "berry/tamato",
  "cornn-berry": "berry/cornn",
  "magost-berry": "berry/magost",
  "rabuta-berry": "berry/rabuta",
  "nomel-berry": "berry/nomel",
  "spelon-berry": "berry/spelon",
  "pamtre-berry": "berry/pamtre",
  "watmel-berry": "berry/watmel",
  "durin-berry": "berry/durin",
  "belue-berry": "berry/belue",
  "liechi-berry": "berry/liechi",
  "ganlon-berry": "berry/ganlon",
  "salac-berry": "berry/salac",
  "petaya-berry": "berry/petaya",
  "apicot-berry": "berry/apicot",
  "lansat-berry": "berry/lansat",
  "starf-berry": "berry/starf",
  "enigma-berry": "berry/enigma",
  "bright-powder": "hold-item/bright-powder",
  "white-herb": "hold-item/white-herb",
  "macho-brace": "ev-item/macho-brace",
  "quick-claw": "hold-item/quick-claw",
  "soothe-bell": "other-item/soothe-bell",
  "mental-herb": "hold-item/mental-herb",
  "choice-band": "hold-item/choice-band",
  "kings-rock": "evo-item/kings-rock",
  "silver-powder": "hold-item/silver-powder",
  "amulet-coin": "hold-item/amulet-coin",
  "cleanse-tag": "hold-item/cleanse-tag",
  "soul-dew": "hold-item/soul-dew",
  "deep-sea-tooth": "evo-item/deep-sea-tooth",
  "deep-sea-scale": "evo-item/deep-sea-scale",
  "smoke-ball": "hold-item/smoke-ball",
  everstone: "hold-item/everstone",
  "focus-band": "hold-item/focus-band",
  "lucky-egg": "hold-item/lucky-egg",
  "scope-lens": "hold-item/scope-lens",
  "metal-coat": "hold-item/metal-coat",
  leftovers: "hold-item/leftovers",
  "dragon-scale": "evo-item/dragon-scale",
  "light-ball": "hold-item/light-ball",
  "soft-sand": "hold-item/soft-sand",
  "hard-stone": "hold-item/hard-stone",
  "miracle-seed": "hold-item/miracle-seed",
  "black-glasses": "hold-item/black-glasses",
  "black-belt": "hold-item/black-belt",
  magnet: "hold-item/magnet",
  "mystic-water": "hold-item/mystic-water",
  "sharp-beak": "hold-item/sharp-beak",
  "poison-barb": "hold-item/poison-barb",
  "never-melt-ice": "hold-item/never-melt-ice",
  "spell-tag": "hold-item/spell-tag",
  "twisted-spoon": "hold-item/twisted-spoon",
  charcoal: "hold-item/charcoal",
  "dragon-fang": "hold-item/dragon-fang",
  "silk-scarf": "hold-item/silk-scarf",
  "up-grade": "evo-item/up-grade",
  "shell-bell": "hold-item/shell-bell",
  "sea-incense": "hold-item/sea-incense",
  "lax-incense": "hold-item/lax-incense",
  "lucky-punch": "hold-item/lucky-punch",
  "metal-powder": "hold-item/metal-powder",
  "thick-club": "hold-item/thick-club",
  stick: "hold-item/stick",
  "town-map": "key-item/town-map",
  "coin-case": "key-item/coin-case",
  "old-rod": "key-item/old-rod",
  "good-rod": "key-item/good-rod",
  "super-rod": "key-item/super-rod",
  "ss-ticket": "key-item/ss-ticket",
  "contest-pass": "key-item/contest-pass",
  "card-key": "key-item/card-key",
  "basement-key": "key-item/basement-key",
  "secret-potion": "key-item/secret-potion",
  "clear-bell": "key-item/clear-bell",
  "blue-card": "key-item/blue-card",
  "squirt-bottle": "key-item/squirt-bottle",
  "red-scale": "key-item/red-scale",
  "lost-item": "key-item/lost-item",
  pass: "key-item/pass",
  "machine-part": "key-item/machine-part",
  "silver-wing": "key-item/silver-wing",
  "rainbow-wing": "key-item/rainbow-wing",
  "mystery-egg": "key-item/mystery-egg",
  "poke-flute": "key-item/poke-flute",
  "silph-scope": "key-item/silph-scope",
  "gold-teeth": "key-item/gold-teeth",
  "lift-key": "key-item/lift-key",
  "mach-bike": "key-item/mach-bike",
  "acro-bike": "key-item/acro-bike",
  "wailmer-pail": "key-item/wailmer-pail",
  "devon-parts": "key-item/devon-parts",
  "soot-sack": "key-item/soot-sack",
  "pokeblock-kit": "key-item/pokeblock-kit",
  letter: "key-item/letter",
  "eon-ticket": "key-item/eon-ticket",
  scanner: "key-item/scanner",
  "go-goggles": "key-item/go-goggles",
  meteorite: "key-item/meteorite",
  "key-to-room-1": "key-item/key-to-room-1",
  "key-to-room-2": "key-item/key-to-room-2",
  "key-to-room-4": "key-item/key-to-room-4",
  "key-to-room-6": "key-item/key-to-room-6",
  "storage-key": "key-item/storage-key",
  "devon-scope": "key-item/devon-scope",
  tea: "key-item/tea",
  "tm-case": "storage/tm-case",
  "magma-emblem": "key-item/magma-stone",
  "old-sea-map": "key-item/town-map",
  bike: "key-item/bike--green",
  "dowsing-machine": "key-item/dowsing-machine",
  parcel: "key-item/parcel",
  "red-orb": "hold-item/red-orb",
  "blue-orb": "hold-item/blue-orb",
  "red-shard": "shard/red",
  "blue-shard": "shard/blue",
  "yellow-shard": "shard/yellow",
  "green-shard": "shard/green",
  "blue-flute": "flute/blue",
  "yellow-flute": "flute/yellow",
  "red-flute": "flute/red",
  "black-flute": "flute/black",
  "white-flute": "flute/white",
};

export function getItemApiSlug(itemName: string, generation?: number): string {
  const normalized = itemName
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/['’]/g, "")
    .replace(/é/g, "e")
    .replace(/\s+/g, " ")
    .trim();
  return ITEM_NAME_ALIASES[normalized] ?? normalized.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function getLocalItemDescription(itemName: string, generation?: number): string {
  const normalized = itemName.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (/^tm\d+\b/.test(normalized)) {
    return "Teaches a move to a compatible Pokemon. In Gen 1-3, TMs are single-use.";
  }
  if (/^hm\d+\b/.test(normalized)) {
    return "Teaches a field move to a compatible Pokemon. HMs can be reused.";
  }

  const slug = getItemApiSlug(itemName, generation);
  const descriptions: Record<string, string> = {
    "exp-all": "Shares battle experience with the whole party in Gen 1.",
    "exp-share": "Shares experience with another Pokemon or the party, depending on generation.",
    "poke-ball": "Used to catch wild Pokemon.",
    "great-ball": "A better ball with a higher catch rate than a Poke Ball.",
    "ultra-ball": "A high-performance ball with a strong catch rate.",
    "master-ball": "Catches a wild Pokemon without fail.",
    "safari-ball": "A special ball used in the Safari Zone.",
    "town-map": "Shows the region map.",
    bike: "Lets you move faster while traveling.",
    "dowsing-machine": "Helps locate hidden items.",
    "poke-flute": "Wakes sleeping Pokemon.",
    "ss-ticket": "A ticket used to board a ship.",
    "coin-case": "Stores coins for the Game Corner.",
    "old-rod": "A basic fishing rod.",
    "good-rod": "A decent fishing rod.",
    "super-rod": "The best fishing rod.",
    "clear-bell": "A key item connected to Ho-Oh in Crystal.",
    "silver-wing": "A key item connected to Lugia.",
    "rainbow-wing": "A key item connected to Ho-Oh.",
    "red-scale": "A scale from the red Gyarados.",
    "machine-part": "A missing part needed for the Power Plant.",
    "mystery-egg": "An egg entrusted to the player.",
    parcel: "A parcel that must be delivered.",
  };

  return descriptions[normalized] ?? descriptions[slug] ?? "No description available yet.";
}

const ITEM_DESCRIPTION_VERSION_GROUPS: Record<number, string[]> = {
  1: ["red-blue", "yellow"],
  2: ["gold-silver", "crystal"],
  3: ["ruby-sapphire", "emerald", "firered-leafgreen"],
};

export function getItemDescription(itemName: string, generation?: number): string {
  const slug = getItemApiSlug(itemName, generation);
  const localDescription = getLocalItemDescription(itemName, generation);
  const itemDescription = ITEM_DESCRIPTIONS[slug];
  if (!itemDescription) return localDescription;

  for (const versionGroup of ITEM_DESCRIPTION_VERSION_GROUPS[generation ?? 0] ?? []) {
    const flavorText = itemDescription.flavorTexts[versionGroup];
    if (flavorText) return flavorText;
  }

  return itemDescription.flavorText || itemDescription.shortEffect || localDescription;
}

/**
 * Get candidate item sprite URLs, best first.
 */
export function getItemSpriteUrls(itemName: string, generation?: number): string[] {
  if (!itemName || /^unknown\b/i.test(itemName) || itemName.toLowerCase() === "none") {
    return [];
  }

  const normalized = itemName.toLowerCase().replace(/\./g, "").trim();
  const candidates = new Set<string>();
  const addPokeApi = (slug: string) => {
    candidates.add(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`);
  };
  const addPokeSprite = (path: string) => {
    candidates.add(`https://raw.githubusercontent.com/msikma/pokesprite/master/items/${path}.png`);
  };

  if (/^tm\d+\b/.test(normalized)) {
    addPokeApi("tm-normal");
    return Array.from(candidates);
  }
  if (/^hm\d+\b/.test(normalized)) {
    addPokeApi("hm-normal");
    return Array.from(candidates);
  }

  const slug = getItemApiSlug(itemName, generation);
  const pokeSpritePath = POKESPRITE_ITEM_PATHS[slug];
  if (pokeSpritePath) addPokeSprite(pokeSpritePath);
  addPokeApi(slug);

  return Array.from(candidates);
}

export function getItemSpriteUrl(itemName: string, generation?: number): string {
  return getItemSpriteUrls(itemName, generation)[0] ?? "";
}

/**
 * Format play time
 */
export function formatPlayTime(hours: number, minutes: number, seconds?: number): string {
  const h = hours.toString().padStart(2, "0");
  const m = minutes.toString().padStart(2, "0");
  if (seconds !== undefined) {
    const s = seconds.toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  }
  return `${h}:${m}`;
}

/**
 * Format money with currency symbol
 */
export function formatMoney(amount: number): string {
  return `₽${amount.toLocaleString()}`;
}

/**
 * Detect game version from save file
 */
export function detectGameVersion(data: Uint8Array): {
  generation: 1 | 2 | 3 | null;
  game: string | null;
} {
  const size = data.length;

  // Gen 3 saves are 128KB or 64KB (some emulators)
  if (size === 131072 || size === 65536) {
    // Check for Gen 3 structure
    const sectionId = readUint16LE(data, 0x0ff4);
    if (sectionId >= 0 && sectionId <= 13) {
      // Try to detect specific game from game code
      const gameCode = readUint32LE(data, 0x00ac);
      switch (gameCode) {
        case 0: return { generation: 3, game: "ruby" }; // Need more checks
        default: return { generation: 3, game: "emerald" }; // Default to Emerald
      }
    }
  }

  // Gen 1/2 saves are 32KB
  if (size === 32768) {
    // Check for Gen 2 by looking for trainer name at Gen 2 offset
    const gen2NameByte = data[0x200b];
    const gen1NameByte = data[0x2598];
    
    // Gen 2 names typically start with valid characters
    if (gen2NameByte >= 0x80 && gen2NameByte <= 0xf9) {
      return { generation: 2, game: "gold" };
    }
    if (gen1NameByte >= 0x80 && gen1NameByte <= 0xf9) {
      return { generation: 1, game: "red" };
    }
  }

  return { generation: null, game: null };
}

/**
 * XOR decrypt/encrypt Gen 3 Pokemon data
 */
export function xorGen3Pokemon(data: Uint8Array, key: number): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const val = readUint32LE(data, i);
    const decrypted = val ^ key;
    result[i] = decrypted & 0xff;
    result[i + 1] = (decrypted >> 8) & 0xff;
    result[i + 2] = (decrypted >> 16) & 0xff;
    result[i + 3] = (decrypted >> 24) & 0xff;
  }
  return result;
}

/**
 * Get Gen 3 substructure order from personality value
 */
export function getGen3SubstructureOrder(personalityValue: number): number[] {
  const orderIndex = personalityValue % 24;
  const orders = [
    [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
    [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
    [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
    [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0],
  ];
  return orders[orderIndex];
}
