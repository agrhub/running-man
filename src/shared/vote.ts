/**
 * The crew votes on which city to build next. One vote per runner per season
 * (a season is one city's week), counted on the server.
 */
export const NEXT_CITIES = [
  {
    id: 'london',
    name: 'London',
    flag: '🇬🇧',
    blurb: 'Red buses and the river',
  },
  {
    id: 'newyork',
    name: 'New York',
    flag: '🇺🇸',
    blurb: 'Bridges and yellow cabs',
  },
  { id: 'seoul', name: 'Seoul', flag: '🇰🇷', blurb: 'Palaces and neon alleys' },
  { id: 'rio', name: 'Rio', flag: '🇧🇷', blurb: 'Beaches and green hills' },
] as const;

export type NextCityId = (typeof NEXT_CITIES)[number]['id'];

export type CityVote = {
  season: number;
  counts: Record<NextCityId, number>;
  total: number;
  /** The city this runner voted for this season, if any. */
  mine: NextCityId | null;
};

export const isNextCity = (id: unknown): id is NextCityId =>
  NEXT_CITIES.some((c) => c.id === id);

export const emptyCounts = (): Record<NextCityId, number> => ({
  london: 0,
  newyork: 0,
  seoul: 0,
  rio: 0,
});

/** The city ahead, or null on a tie at the top or with no votes. */
export const voteLeader = (vote: CityVote): NextCityId | null => {
  let best: NextCityId | null = null;
  let tie = false;
  for (const c of NEXT_CITIES) {
    const n = vote.counts[c.id];
    if (n === 0) continue;
    if (!best || n > vote.counts[best]) {
      best = c.id;
      tie = false;
    } else if (n === vote.counts[best]) tie = true;
  }
  return tie ? null : best;
};
