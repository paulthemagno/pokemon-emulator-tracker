import type { GameEventFlag } from "./types";

// A League victory is active for this attempt, even though it is not a
// permanent completion milestone. Keep the badge and list filters consistent.
export function isEventStatusActive(flag: GameEventFlag): boolean {
  return flag.completed || (
    flag.category === "League challenge state"
    && flag.flowStatus === "state"
    && flag.rawSet === true
  );
}
