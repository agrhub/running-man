import { hashString, mulberry32 } from './rng';

/**
 * Three more mini games beside Snack Dash. Each round's course comes from the
 * date and the round number, the player's input is a short list of tap times,
 * and the server replays that input to score it, like every other result.
 */
export type ArcadeId = 'hurdle' | 'rhythm' | 'fetch';

export const ARCADE_IDS: ArcadeId[] = ['hurdle', 'rhythm', 'fetch'];

export const ARCADE_INFO: Record<
  ArcadeId,
  { name: string; icon: string; rules: string }
> = {
  hurdle: {
    name: 'Hurdle Hop',
    icon: '🏃‍♀️',
    rules:
      'Tap to jump the hurdles. Jump too early or too late and you trip. Clear five in a row for double points; it gets faster.',
  },
  rhythm: {
    name: 'Rhythm Steps',
    icon: '🥁',
    rules:
      'Tap on the beat as each footprint reaches the line: perfect 20, good 10. Stray taps cost 5. The beat speeds up.',
  },
  fetch: {
    name: 'Pet Fetch',
    icon: '🎾',
    rules:
      'Five throws. Tap to stop the power bar and throw the ball for your pet. Land it in the ring, mind the wind: up to 100 a throw.',
  },
};

export const ARCADE_PAID_ROUNDS = 3;
export const ARCADE_MAX_ROUNDS = 10;
export const ARCADE_MAX_REWARD = 40;

/** Coins for a round: the first rounds of the day only. */
export const arcadeReward = (score: number, round: number) =>
  round < ARCADE_PAID_ROUNDS
    ? Math.min(ARCADE_MAX_REWARD, Math.round(score / 8))
    : 0;

const rng = (game: ArcadeId, dateKey: string, round: number) =>
  mulberry32(hashString(`${game}:${dateKey}:${round}`));

const multiplier = (combo: number) => (combo >= 10 ? 3 : combo >= 5 ? 2 : 1);

/** Tap times are whole milliseconds since the round started, in order. */
export const isValidTaps = (
  taps: unknown,
  max: number,
  until: number
): taps is number[] => {
  if (!Array.isArray(taps) || taps.length > max) return false;
  let last = -1;
  for (const t of taps) {
    if (typeof t !== 'number' || !Number.isInteger(t)) return false;
    if (t < last || t < 0 || t > until) return false;
    last = t;
  }
  return true;
};

// ---------------------------------------------------------------- Hurdle Hop

export const HURDLE_MS = 20_000;
/** A jump lasts 600 ms; you are high enough to clear a hurdle from 90 to 510 ms. */
export const JUMP_MS = 600;
const CLEAR_FROM = 90;
const CLEAR_TO = 510;

/** When each hurdle reaches the runner (ms). */
export const hurdleCourse = (dateKey: string, round: number): number[] => {
  const rand = rng('hurdle', dateKey, round);
  const out: number[] = [];
  let t = 1600;
  while (t < HURDLE_MS - 300) {
    out.push(Math.round(t));
    // From about 1.4 s apart down to 0.75 s, with the odd quick pair.
    const gap = Math.max(750, 1400 - t / 30) + rand() * 350;
    t += rand() < 0.15 && t > 6000 ? 700 : gap;
  }
  return out;
};

export type ArcadeResult = {
  score: number;
  hits: number;
  misses: number;
  best: number;
};

/** Jumps that start while already in the air are ignored. */
export const jumpsFrom = (taps: number[]): number[] => {
  const jumps: number[] = [];
  for (const t of taps)
    if (jumps.length === 0 || t - (jumps.at(-1) ?? 0) >= JUMP_MS) jumps.push(t);
  return jumps;
};

export const scoreHurdles = (
  course: number[],
  taps: number[]
): ArcadeResult => {
  const jumps = jumpsFrom(taps);
  let score = 0;
  let combo = 0;
  let best = 0;
  let hits = 0;
  let misses = 0;
  for (const h of course) {
    const clear = jumps.some((j) => h - j >= CLEAR_FROM && h - j <= CLEAR_TO);
    if (clear) {
      combo += 1;
      hits += 1;
      best = Math.max(best, combo);
      score += 10 * multiplier(combo);
    } else {
      combo = 0;
      misses += 1;
    }
  }
  return { score, hits, misses, best };
};

// -------------------------------------------------------------- Rhythm Steps

export const RHYTHM_MS = 22_000;
export const PERFECT_MS = 60;
export const GOOD_MS = 130;

/** Note times (ms): the beat runs from 96 to 140 bpm, with rests and doubles. */
export const rhythmCourse = (dateKey: string, round: number): number[] => {
  const rand = rng('rhythm', dateKey, round);
  const notes: number[] = [];
  let t = 1800;
  while (t < RHYTHM_MS - 600) {
    const bpm = 96 + (44 * t) / RHYTHM_MS;
    const beat = 60_000 / bpm;
    const r = rand();
    if (r < 0.8) notes.push(Math.round(t));
    if (r > 0.88 && t > 6000) notes.push(Math.round(t + beat / 2));
    t += beat;
  }
  return notes.sort((a, b) => a - b);
};

export type NoteJudgement = 'perfect' | 'good' | 'miss';

/** Matches each tap to the closest note still open; returns the judgement per note too. */
export const scoreRhythm = (
  notes: number[],
  taps: number[]
): ArcadeResult & { judged: NoteJudgement[]; stray: number } => {
  const judged: NoteJudgement[] = notes.map(() => 'miss');
  const used = notes.map(() => false);
  let stray = 0;
  for (const tap of taps) {
    let bestI = -1;
    let bestD = Infinity;
    for (let i = 0; i < notes.length; i++) {
      if (used[i]) continue;
      const d = Math.abs((notes[i] ?? 0) - tap);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    if (bestI >= 0 && bestD <= GOOD_MS) {
      used[bestI] = true;
      judged[bestI] = bestD <= PERFECT_MS ? 'perfect' : 'good';
    } else stray += 1;
  }
  let score = 0;
  let combo = 0;
  let best = 0;
  let hits = 0;
  for (const j of judged) {
    if (j === 'miss') {
      combo = 0;
      continue;
    }
    hits += 1;
    combo += 1;
    best = Math.max(best, combo);
    score += (j === 'perfect' ? 20 : 10) * multiplier(combo);
  }
  score = Math.max(0, score - stray * 5);
  return { score, hits, misses: notes.length - hits, best, judged, stray };
};

// ------------------------------------------------------------------ Pet Fetch

export const FETCH_THROWS = 5;
/** Longest wait on one throw before the ball goes anyway (ms). */
export const FETCH_WINDOW = 4000;
export const FETCH_MAX_M = 36;

export type FetchThrow = {
  /** Where the ring is, metres away. */
  target: number;
  /** Wind along the throw, metres added (+) or taken off (−). */
  wind: number;
  /** One full sweep of the power bar up and down, ms. */
  period: number;
};

export const fetchCourse = (dateKey: string, round: number): FetchThrow[] => {
  const rand = rng('fetch', dateKey, round);
  return Array.from({ length: FETCH_THROWS }, (_, i) => ({
    target: Math.round(10 + rand() * 22),
    wind: Math.round((rand() * 2 - 1) * (2 + i) * 10) / 10,
    period: Math.round(1500 - i * 140 - rand() * 120),
  }));
};

/** Power 0..1 after holding for `ms`: the bar sweeps up and back down. */
export const fetchPower = (ms: number, period: number) => {
  const x = (ms % period) / period;
  return x < 0.5 ? x * 2 : 2 - x * 2;
};

export const fetchDistance = (ms: number, th: FetchThrow) =>
  Math.round((fetchPower(ms, th.period) * FETCH_MAX_M + th.wind) * 10) / 10;

export const fetchPoints = (distance: number, target: number) =>
  Math.max(0, Math.round(100 - Math.abs(distance - target) * 9));

/** `taps` holds the stop time of each throw, measured from that throw's start. */
export const scoreFetch = (
  course: FetchThrow[],
  taps: number[]
): ArcadeResult & { throws: { distance: number; points: number }[] } => {
  const throws = course.map((th, i) => {
    const ms = Math.min(FETCH_WINDOW, Math.max(0, taps[i] ?? FETCH_WINDOW));
    const distance = fetchDistance(ms, th);
    return { distance, points: fetchPoints(distance, th.target) };
  });
  const score = throws.reduce((s, t) => s + t.points, 0);
  const hits = throws.filter((t) => t.points >= 70).length;
  return {
    score,
    hits,
    misses: FETCH_THROWS - hits,
    best: Math.max(0, ...throws.map((t) => t.points)),
    throws,
  };
};

/** Validates input and scores one round of any of the three games. */
export const scoreArcade = (
  game: ArcadeId,
  dateKey: string,
  round: number,
  taps: unknown
): ArcadeResult | null => {
  if (game === 'hurdle') {
    if (!isValidTaps(taps, 80, HURDLE_MS)) return null;
    return scoreHurdles(hurdleCourse(dateKey, round), taps);
  }
  if (game === 'rhythm') {
    if (!isValidTaps(taps, 160, RHYTHM_MS)) return null;
    return scoreRhythm(rhythmCourse(dateKey, round), taps);
  }
  // Fetch taps are per throw, so they need not be in order overall.
  if (
    !Array.isArray(taps) ||
    taps.length !== FETCH_THROWS ||
    !taps.every(
      (t) =>
        typeof t === 'number' &&
        Number.isInteger(t) &&
        t >= 0 &&
        t <= FETCH_WINDOW
    )
  )
    return null;
  return scoreFetch(fetchCourse(dateKey, round), taps as number[]);
};

export const isArcadeId = (v: unknown): v is ArcadeId =>
  v === 'hurdle' || v === 'rhythm' || v === 'fetch';
