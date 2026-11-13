import {
  KM_PER_STAGE,
  type Stage,
  type TimeOfDay,
  type WeatherId,
} from './content';

export type Pace = 'easy' | 'steady' | 'push';

export const PACES: Pace[] = ['easy', 'steady', 'push'];

export const PACE_LABEL: Record<Pace, string> = {
  easy: 'Easy',
  steady: 'Steady',
  push: 'Push',
};

export type Plan = {
  paces: Pace[];
  /** Km marks (1-based) where the runner stops to drink. Must be water stations. */
  drinks: number[];
};

export type KmSplit = {
  km: number;
  pace: Pace;
  grade: number;
  seconds: number;
  /** Stamina at the end of this km, after drinking. */
  stamina: number;
  /** Fraction of this km spent walking because stamina ran out. */
  walked: number;
  drank: boolean;
};

export type SimResult = {
  totalSeconds: number;
  splits: KmSplit[];
  walkedKm: number;
};

const BASE_SECONDS: Record<Pace, number> = {
  easy: 372,
  steady: 318,
  push: 270,
};
const BASE_DRAIN: Record<Pace, number> = { easy: 5, steady: 12, push: 26 };
const WALK_SECONDS = 640;
const DRINK_SECONDS = 9;
const START_STAMINA = 100;
const HEAVY_LEGS_BELOW = 25;

export const defaultPlan = (stage: Stage): Plan => ({
  paces: Array.from({ length: KM_PER_STAGE }, () => 'steady'),
  drinks: [...stage.waterAfterKm],
});

export const isValidPlan = (stage: Stage, plan: unknown): plan is Plan => {
  if (typeof plan !== 'object' || plan === null) return false;
  if (!('paces' in plan) || !('drinks' in plan)) return false;
  const { paces, drinks } = plan;
  if (!Array.isArray(paces) || paces.length !== KM_PER_STAGE) return false;
  if (!paces.every((p) => p === 'easy' || p === 'steady' || p === 'push')) {
    return false;
  }
  if (!Array.isArray(drinks) || drinks.length > stage.waterAfterKm.length) {
    return false;
  }
  const seen = new Set<number>();
  for (const d of drinks) {
    if (
      typeof d !== 'number' ||
      !stage.waterAfterKm.includes(d) ||
      seen.has(d)
    ) {
      return false;
    }
    seen.add(d);
  }
  return true;
};

const kmSeconds = (pace: Pace, grade: number, weather: WeatherId): number => {
  let s = BASE_SECONDS[pace];
  if (grade > 0) s += grade * (pace === 'push' ? 14 : 11);
  if (grade < 0) s += grade * (pace === 'easy' ? 6 : 9);
  if (weather === 'headwind') s += 10 + Math.max(0, grade) * 4;
  if (weather === 'tailwind') s -= 10;
  if (weather === 'rain') {
    s += 4;
    if (grade < 0 && pace === 'push') s += 26;
  }
  if (weather === 'storm') {
    s += 9 + Math.max(0, grade) * 2;
    if (grade < 0 && pace === 'push') s += 30;
  }
  return s;
};

/** The sun's share: noon drains stamina faster, an evening run is easier. */
export const TIME_DRAIN: Record<TimeOfDay, number> = {
  morning: 1,
  noon: 1.12,
  afternoon: 1.05,
  evening: 0.94,
};

const kmDrain = (pace: Pace, grade: number, weather: WeatherId): number => {
  let d = BASE_DRAIN[pace];
  if (grade > 0) d += grade * (pace === 'push' ? 3.5 : 2.5);
  if (grade < 0) d = Math.max(2, d + grade * 1.2);
  if (weather === 'hot') d *= 1.35;
  if (weather === 'cool') d *= 0.88;
  if (weather === 'storm') d *= 1.1;
  return d;
};

const drinkGain = (weather: WeatherId): number => (weather === 'hot' ? 26 : 18);

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Simulates one stage. Pure and deterministic: the same stage, weather and
 * plan always give the same result, so the server can re-check every run.
 */
export const simulate = (
  stage: Stage,
  weather: WeatherId,
  plan: Plan,
  time: TimeOfDay = 'morning'
): SimResult => {
  let stamina = START_STAMINA;
  let total = 0;
  let walkedKm = 0;
  const splits: KmSplit[] = [];

  for (let i = 0; i < KM_PER_STAGE; i++) {
    const km = i + 1;
    const pace = plan.paces[i] ?? 'steady';
    const grade = stage.grades[i] ?? 0;
    let seconds = kmSeconds(pace, grade, weather);
    if (stamina < HEAVY_LEGS_BELOW) seconds *= 1.1;
    const drain = kmDrain(pace, grade, weather) * TIME_DRAIN[time];

    let walked = 0;
    if (drain <= stamina) {
      stamina -= drain;
    } else {
      const runFraction = stamina / drain;
      walked = 1 - runFraction;
      seconds = seconds * runFraction + WALK_SECONDS * walked;
      stamina = 0;
    }

    const drank = plan.drinks.includes(km) && stage.waterAfterKm.includes(km);
    if (drank) {
      stamina = Math.min(START_STAMINA, stamina + drinkGain(weather));
      seconds += DRINK_SECONDS;
    }

    seconds = round1(seconds);
    total += seconds;
    walkedKm += walked;
    splits.push({
      km,
      pace,
      grade,
      seconds,
      stamina: round1(stamina),
      walked: round1(walked),
      drank,
    });
  }

  return { totalSeconds: round1(total), splits, walkedKm: round1(walkedKm) };
};

/** Cumulative seconds at the end of each km, starting with 0 at the start line. */
export const checkpoints = (splits: Pick<KmSplit, 'seconds'>[]): number[] => {
  const out = [0];
  let t = 0;
  for (const s of splits) {
    t += s.seconds;
    out.push(round1(t));
  }
  return out;
};

/** Distance in km covered at time `t` (seconds), interpolated within each km. */
export const distanceAt = (marks: number[], t: number): number => {
  if (t <= 0) return 0;
  for (let i = 1; i < marks.length; i++) {
    const prev = marks[i - 1] ?? 0;
    const next = marks[i] ?? prev;
    if (t <= next) {
      const span = next - prev;
      return i - 1 + (span > 0 ? (t - prev) / span : 1);
    }
  }
  return marks.length - 1;
};

export const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const ss = r.toString().padStart(2, '0');
  // Weekly totals run past an hour: 1:33:56 rather than 93:56.
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
