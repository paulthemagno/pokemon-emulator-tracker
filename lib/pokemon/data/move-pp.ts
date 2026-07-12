// Generation-specific base PP extracted from the pinned pret move tables recorded in
// docs/source-lockfile.md. Move IDs are array indexes; index 0 is MOVE_NONE.
const GEN1_BASE_PP = [
  0,35,25,10,15,20,20,15,15,15,35,30,5,10,30,30,35,35,20,15,20,20,10,20,30,5,25,15,15,15,25,20,5,35,15,20,20,20,15,30,35,20,20,30,25,40,20,15,20,20,20,30,25,15,30,25,5,15,10,5,20,20,20,5,35,20,25,20,20,20,15,20,10,10,40,25,10,35,30,15,20,40,10,15,30,15,20,10,15,10,5,10,10,25,10,20,40,30,30,20,20,15,10,40,15,20,30,20,20,10,40,40,30,30,30,20,30,10,10,20,5,10,30,20,20,20,5,15,10,20,15,15,35,20,15,10,20,30,15,40,20,15,10,5,10,30,10,15,20,15,40,40,10,5,15,10,10,10,15,30,30,10,10,20,10,10,
] as const;

const GEN2_NEW_MOVE_PP = [
  1,10,10,10,5,15,25,15,10,15,30,5,40,15,10,25,10,30,10,20,10,10,10,10,10,20,5,40,5,5,15,5,10,5,15,10,5,10,20,20,40,15,10,20,20,25,5,15,10,5,20,15,20,25,20,5,30,5,10,20,40,5,20,40,20,15,35,10,5,5,5,15,5,20,5,5,15,20,10,5,5,15,15,15,15,10,
] as const;

const GEN3_NEW_MOVE_PP = [
  10,10,10,10,10,10,10,15,15,15,10,20,20,10,20,20,20,20,20,10,10,10,20,20,5,15,10,10,15,10,20,5,5,10,10,20,5,10,20,10,20,20,20,5,5,15,20,10,15,20,15,10,10,15,10,5,5,10,15,10,5,20,25,5,40,10,5,40,15,20,20,5,15,20,30,15,15,5,10,30,20,30,15,5,40,15,5,20,5,15,25,40,15,20,15,20,15,20,10,20,20,5,5,
] as const;

const GEN2_BASE_PP = [...GEN1_BASE_PP.slice(0, 165), 1, ...GEN2_NEW_MOVE_PP] as const;
const GEN3_BASE_PP = [...GEN2_BASE_PP, ...GEN3_NEW_MOVE_PP] as const;

export function getBaseMovePP(moveId: number, generation: number): number {
  const table = generation <= 1 ? GEN1_BASE_PP : generation === 2 ? GEN2_BASE_PP : GEN3_BASE_PP;
  return table[moveId] ?? 0;
}

export function getMaxMovePP(moveId: number, generation: number, ppUps = 0): number {
  const basePP = getBaseMovePP(moveId, generation);
  const appliedPPUps = Math.max(0, Math.min(3, Math.trunc(ppUps)));
  return basePP + Math.floor(basePP / 5) * appliedPPUps;
}

export function decodePackedMovePP(rawPP: number, moveId: number, generation: 1 | 2) {
  const ppUps = (rawPP >> 6) & 0x03;
  return {
    pp: rawPP & 0x3f,
    ppUps,
    maxPP: getMaxMovePP(moveId, generation, ppUps),
  };
}
