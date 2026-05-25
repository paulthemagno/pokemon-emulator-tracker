// Source: pret/pokeemerald src/pokemon.c sHoennToNationalOrder at
// 0d3100185e0b13faabfc589fc402dd46f83c1d6a. The first 202 entries are
// the in-game Hoenn Pokédex; later entries are explicitly unseen there.
export const GEN3_HOENN_DEX_NATIONAL_ORDER = [
  252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266,
  267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281,
  282, 283, 284, 285, 286, 287, 288, 289, 63, 64, 65, 290, 291, 292, 293,
  294, 295, 296, 297, 118, 119, 129, 130, 298, 183, 184, 74, 75, 76, 299,
  300, 301, 41, 42, 169, 72, 73, 302, 303, 304, 305, 306, 66, 67, 68, 307,
  308, 309, 310, 311, 312, 81, 82, 100, 101, 313, 314, 43, 44, 45, 182, 84,
  85, 315, 316, 317, 318, 319, 320, 321, 322, 323, 218, 219, 324, 88, 89,
  109, 110, 325, 326, 27, 28, 327, 227, 328, 329, 330, 331, 332, 333, 334,
  335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 174,
  39, 40, 349, 350, 351, 120, 121, 352, 353, 354, 355, 356, 357, 358, 359,
  37, 38, 172, 25, 26, 54, 55, 360, 202, 177, 178, 203, 231, 232, 127, 214,
  111, 112, 361, 362, 363, 364, 365, 366, 367, 368, 369, 222, 170, 171, 370,
  116, 117, 230, 371, 372, 373, 374, 375, 376, 377, 378, 379, 380, 381, 382,
  383, 384, 385, 386,
] as const;

export const GEN3_HOENN_DEX_COUNT = GEN3_HOENN_DEX_NATIONAL_ORDER.length;

const NATIONAL_TO_HOENN = new Map<number, number>(
  GEN3_HOENN_DEX_NATIONAL_ORDER.map((nationalDex, index) => [nationalDex, index + 1])
);

export function getGen3HoennDexNumber(nationalDex: number): number | undefined {
  return NATIONAL_TO_HOENN.get(nationalDex);
}
