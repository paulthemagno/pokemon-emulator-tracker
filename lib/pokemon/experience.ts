export const GROWTH_RATES = [
  "fast",
  "medium-fast",
  "medium-slow",
  "slow",
  "erratic",
  "fluctuating",
] as const;

export type GrowthRate = (typeof GROWTH_RATES)[number];

export function getExpForLevel(level: number, growthRate: string = "medium-slow"): number {
  const l = Math.max(1, Math.min(100, level));

  switch (growthRate) {
    case "fast":
      return Math.floor((4 * Math.pow(l, 3)) / 5);
    case "slow":
      return Math.floor((5 * Math.pow(l, 3)) / 4);
    case "medium-slow":
      return Math.floor((6 / 5) * Math.pow(l, 3) - 15 * Math.pow(l, 2) + 100 * l - 140);
    case "medium-fast":
      return Math.pow(l, 3);
    case "erratic":
      if (l <= 50) return Math.floor((Math.pow(l, 3) * (100 - l)) / 50);
      if (l <= 68) return Math.floor((Math.pow(l, 3) * (150 - l)) / 100);
      if (l <= 98) return Math.floor((Math.pow(l, 3) * Math.floor((1911 - 10 * l) / 3)) / 500);
      return Math.floor((Math.pow(l, 3) * (160 - l)) / 100);
    case "fluctuating":
      if (l <= 15) return Math.floor((Math.pow(l, 3) * (Math.floor((l + 1) / 3) + 24)) / 50);
      if (l <= 36) return Math.floor((Math.pow(l, 3) * (l + 14)) / 50);
      return Math.floor((Math.pow(l, 3) * (Math.floor(l / 2) + 32)) / 50);
    default:
      return Math.pow(l, 3);
  }
}

export function getExpWindow(level: number, experience: number, preferredGrowthRate?: string) {
  const candidates = GROWTH_RATES.map((growthRate) => {
    const current = getExpForLevel(level, growthRate);
    const next = level >= 100 ? current : getExpForLevel(level + 1, growthRate);
    const fits = experience >= current && (level >= 100 || experience < next);
    const distance = fits
      ? 0
      : Math.min(Math.abs(experience - current), Math.abs(experience - next));

    return {
      growthRate,
      current,
      next,
      fits,
      distance,
      preferred: growthRate === preferredGrowthRate,
    };
  });

  const exact = candidates
    .filter((candidate) => candidate.fits)
    .sort((a, b) => Number(b.preferred) - Number(a.preferred))[0];

  return exact ?? candidates.sort((a, b) => a.distance - b.distance)[0];
}
