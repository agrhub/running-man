import { KM_PER_STAGE } from './content';
import {
  ITEM_SECONDS,
  type CourseItem,
  type ItemKind,
  type Lane,
} from './course';
import { hashString } from './rng';
import { distanceAt } from './sim';

/*
 * The race, played in fixed steps of race-clock time. The client steps it live while the player steers; the server
 * steps it again with the recorded lane changes and the same rivals, and gets the same time to the tenth.
 *
 * Every runner follows their planned pace (the base timeline from the stamina simulation). Cones, puddles, dropped cups
 * and collisions add "debt": the runner limps and loses ground until it is paid off. High fives give negative debt:
 * a short burst of speed.
 */

/** Seconds of race clock per step. */
export const RACE_DT = 0.5;
/** A collision: both runners fall and lose the same beat. */
export const BUMP_SECONDS = 4;
/** No collisions in the start crowd, and not twice with the same runner within this many seconds. */
export const BUMP_GRACE_KM = 0.5;
/** Runners closer than this (km) in the same lane are touching. */
const TOUCH_KM = 0.0025;
export const MAX_RIVALS = 12;
export const MAX_MOVES = 400;

/** A lane change, applied at the start of race step `step`. */
export type Move = { step: number; lane: Lane };

export type Rival = { username: string; marks: number[]; moves?: Move[] };

export type RaceEvent =
  | { kind: ItemKind; step: number; km: number; seconds: number; item: number }
  | {
      kind: 'bump';
      step: number;
      km: number;
      /** Seconds this runner loses. */
      seconds: number;
      /** Seconds the other runner loses. */
      rivalSeconds: number;
      /** True when this runner ran into the other from behind. */
      atFault: boolean;
      rival: string;
    };

export type RaceState = {
  step: number;
  /** Race clock, seconds. */
  t: number;
  /** Position on the base timeline, seconds. */
  progress: number;
  km: number;
  lane: Lane;
  debt: number;
  moves: Move[];
  events: RaceEvent[];
  /** Race clock at each km mark 0..6, filled as they are crossed. */
  marks: number[];
  done: boolean;
  finalSeconds: number;
  nextItem: number;
  lastBump: Record<string, number>;
  side: Record<string, number>;
  /** Time each other runner still has to lose after a fall, and has lost so far. */
  rivalDebt: Record<string, number>;
  rivalLost: Record<string, number>;
};

export type RaceSetup = {
  base: number[];
  items: CourseItem[];
  rivals: Rival[];
  /** The player's start lane (see `startLane`). */
  startLane?: Lane;
};

const START_LANES: Lane[] = [-1, 0, 1];

/** Runners line up across all three lanes at the start; each runner's lane comes from their name. */
export const startLane = (username: string): Lane =>
  START_LANES[hashString(`lane:${username}`) % 3] ?? 0;

const isLane = (n: unknown): n is Lane => n === -1 || n === 0 || n === 1;

export const isValidMoves = (moves: unknown): moves is Move[] => {
  if (!Array.isArray(moves) || moves.length > MAX_MOVES) return false;
  let last = -1;
  for (const m of moves) {
    if (typeof m !== 'object' || m === null || !('step' in m) || !('lane' in m))
      return false;
    const { step, lane } = m;
    if (
      typeof step !== 'number' ||
      !Number.isInteger(step) ||
      step < 0 ||
      step <= last ||
      step > 100_000
    )
      return false;
    if (!isLane(lane)) return false;
    last = step;
  }
  return true;
};

/** A runner's lane at race-clock time `t`, from their start lane and lane changes. */
export const laneAtTime = (
  moves: Move[] | undefined,
  t: number,
  start: Lane = 0
): Lane => {
  let lane: Lane = start;
  if (!moves) return lane;
  const step = Math.floor(t / RACE_DT + 1e-9);
  for (const m of moves) {
    if (m.step > step) break;
    lane = m.lane;
  }
  return lane;
};

export const startRace = (lane: Lane = 0): RaceState => ({
  step: 0,
  t: 0,
  progress: 0,
  km: 0,
  lane,
  debt: 0,
  moves: [],
  events: [],
  marks: [0],
  done: false,
  finalSeconds: 0,
  nextItem: 0,
  lastBump: {},
  side: {},
  rivalDebt: {},
  rivalLost: {},
});

/** Where another runner is at race-clock time `t`, including any fall they had in this race. */
export const rivalKm = (s: RaceState, r: Rival, t = s.t): number =>
  distanceAt(r.marks, t - (s.rivalLost[r.username] ?? 0));

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Advances one step. `lane` is where the player wants to be for this step (live play); omit it to keep the lane.
 * Returns the events that happened during the step.
 */
export const stepRace = (
  s: RaceState,
  setup: RaceSetup,
  lane?: Lane
): RaceEvent[] => {
  if (s.done) return [];
  const total = setup.base[setup.base.length - 1] ?? 0;
  if (lane !== undefined && lane !== s.lane) {
    s.lane = lane;
    s.moves.push({ step: s.step, lane });
  }

  // Limp while paying off debt, sprint while spending a bonus.
  let advance = RACE_DT;
  if (s.debt > 0) {
    const pay = Math.min(s.debt, RACE_DT * 0.6);
    advance -= pay;
    s.debt -= pay;
  } else if (s.debt < 0) {
    const gain = Math.min(-s.debt, RACE_DT * 0.5);
    advance += gain;
    s.debt += gain;
  }

  const prevKm = s.km;
  const prevT = s.t;
  const prevProgress = s.progress;
  s.progress += advance;
  s.t = round1(s.t + RACE_DT);
  s.km = Math.min(KM_PER_STAGE, distanceAt(setup.base, s.progress));
  s.step += 1;

  // km marks (race clock), interpolated inside the step
  while (s.marks.length <= KM_PER_STAGE && s.km >= s.marks.length) {
    const k = s.marks.length;
    const f = s.km > prevKm ? (k - prevKm) / (s.km - prevKm) : 1;
    s.marks.push(round1(prevT + RACE_DT * Math.max(0, Math.min(1, f))));
  }

  const happened: RaceEvent[] = [];
  const step = s.step - 1;

  // Course items crossed during this step
  while (s.nextItem < setup.items.length) {
    const it = setup.items[s.nextItem];
    if (!it || it.km > s.km) break;
    if (it.lane === s.lane) {
      const seconds = ITEM_SECONDS[it.kind];
      s.debt += seconds;
      happened.push({
        kind: it.kind,
        step,
        km: it.km,
        seconds,
        item: s.nextItem,
      });
    }
    s.nextItem += 1;
  }

  // Other runners who fell limp too
  for (const r of setup.rivals) {
    const d = s.rivalDebt[r.username] ?? 0;
    if (d <= 0) continue;
    const pay = Math.min(d, RACE_DT * 0.6);
    s.rivalDebt[r.username] = d - pay;
    s.rivalLost[r.username] = (s.rivalLost[r.username] ?? 0) + pay;
  }

  // Collisions with other runners in the same lane. Runners steer round someone who is down, so nobody is hit
  // again while still getting up.
  if (s.km > BUMP_GRACE_KM && !s.done) {
    for (const r of setup.rivals) {
      const rKm = rivalKm(s, r);
      if (rKm >= KM_PER_STAGE) continue;
      const rLane = laneAtTime(r.moves, s.t, startLane(r.username));
      const gap = s.km - rKm;
      const prevSide = s.side[r.username];
      const side = gap >= 0 ? 1 : -1;
      s.side[r.username] = side;
      // (positions are tracked above even while someone is down, so getting up never counts as a collision)
      if (s.debt > 0 || rLane !== s.lane || (s.rivalDebt[r.username] ?? 0) > 0)
        continue;
      const crossed = prevSide !== undefined && prevSide !== side;
      if (!crossed && Math.abs(gap) > TOUCH_KM) continue;
      // After a crash two runners keep apart: each pair collides at most once a race.
      if (s.lastBump[r.username] !== undefined) continue;
      s.lastBump[r.username] = s.t;
      // Whoever was behind before the contact ran into the other.
      const atFault = (prevSide ?? side) < 0;
      const mine = BUMP_SECONDS;
      const theirs = BUMP_SECONDS;
      s.debt += mine;
      s.rivalDebt[r.username] = (s.rivalDebt[r.username] ?? 0) + theirs;
      happened.push({
        kind: 'bump',
        step,
        km: Math.round(s.km * 1000) / 1000,
        seconds: mine,
        rivalSeconds: theirs,
        atFault,
        rival: r.username,
      });
    }
  }

  if (s.progress >= total) {
    // the exact finish inside this step, plus whatever debt is left
    const f = advance > 0 ? (total - prevProgress) / advance : 1;
    s.finalSeconds = round1(
      prevT + RACE_DT * Math.max(0, Math.min(1, f)) + s.debt
    );
    while (s.marks.length <= KM_PER_STAGE) s.marks.push(s.finalSeconds);
    s.marks[KM_PER_STAGE] = s.finalSeconds;
    s.km = KM_PER_STAGE;
    s.done = true;
  }

  s.events.push(...happened);
  return happened;
};

/** Runs a whole race from recorded lane changes: the server's check, and the replay. */
export const replayRace = (setup: RaceSetup, moves: Move[]): RaceState => {
  const s = startRace(setup.startLane ?? 0);
  let i = 0;
  let lane: Lane = s.lane;
  let guard = 0;
  while (!s.done && guard++ < 50_000) {
    while (i < moves.length && (moves[i]?.step ?? Infinity) <= s.step) {
      lane = moves[i]?.lane ?? lane;
      i += 1;
    }
    stepRace(s, setup, lane);
  }
  return s;
};

/** Finishes the race without further steering (Skip). */
export const finishRace = (s: RaceState, setup: RaceSetup): RaceState => {
  let guard = 0;
  while (!s.done && guard++ < 50_000) stepRace(s, setup);
  return s;
};
