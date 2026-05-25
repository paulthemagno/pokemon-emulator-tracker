// Source: pret/pokefirered include/constants/pokedex.h defines
// KANTO_DEX_COUNT as NATIONAL_DEX_MEW, and src/pokedex.c counts Kanto
// entries by checking National Dex numbers i + 1 for i < KANTO_DEX_COUNT.
export const GEN3_KANTO_DEX_COUNT = 151;

export const GEN3_KANTO_DEX_NATIONAL_ORDER = Array.from(
  { length: GEN3_KANTO_DEX_COUNT },
  (_, index) => index + 1
);

export function getGen3KantoDexNumber(nationalDex: number): number | undefined {
  if (nationalDex < 1 || nationalDex > GEN3_KANTO_DEX_COUNT) return undefined;
  return nationalDex;
}
