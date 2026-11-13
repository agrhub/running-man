/**
 * Running clubs: a group of up to 20 runners who share a road and a weekly total.
 * Names are built from word lists, so there is no free text to moderate.
 */
export const CLUB_ADJECTIVES = [
  'Speedy',
  'Sleepy',
  'Midnight',
  'Sunrise',
  'Turbo',
  'Cozy',
  'Thunder',
  'Bubbly',
  'Lucky',
  'Mighty',
  'Rainy',
  'Golden',
] as const;

export const CLUB_NOUNS = [
  'Pandas',
  'Comets',
  'Noodles',
  'Otters',
  'Sneakers',
  'Foxes',
  'Dumplings',
  'Pigeons',
  'Rockets',
  'Turtles',
  'Llamas',
  'Waffles',
] as const;

export const CLUB_MAX_MEMBERS = 20;
export const CLUB_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const clubName = (adjective: number, noun: number): string | null => {
  const a = CLUB_ADJECTIVES[adjective];
  const n = CLUB_NOUNS[noun];
  return a && n ? `${a} ${n}` : null;
};

export const isClubCode = (code: unknown): code is string =>
  typeof code === 'string' &&
  code.length === 6 &&
  [...code].every((ch) => CLUB_CODE_CHARS.includes(ch));
