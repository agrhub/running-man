import { hashString, mulberry32 } from './rng';

/**
 * Snack Dash: a 20-second mini game on three lanes. Snacks and obstacles come down
 * the road; you change lanes to catch the snacks and miss the cones. The course comes
 * from the date and the round, and the server replays your lane changes to score it.
 */

export type DashLane = -1 | 0 | 1;
export type DashKind = 'candy' | 'soda' | 'bottle' | 'cake' | 'cone' | 'puddle';

export const DASH_STEP = 0.05; // seconds per step
export const DASH_STEPS = 400; // 20 seconds
/** Steps an item takes from the horizon to your runner. */
export const DASH_TRAVEL = 32;
export const DASH_MAX_MOVES = 300;
/** Rounds per day that pay coins, and rounds per day in all. */
export const DASH_PAID_ROUNDS = 3;
export const DASH_MAX_ROUNDS = 10;
export const DASH_MAX_REWARD = 50;

export type DashItem = {
  id: number;
  lane: DashLane;
  kind: DashKind;
  /** The step at which it reaches the runner. */
  hitStep: number;
};

export type DashMove = { step: number; lane: DashLane };

export const DASH_POINTS: Record<DashKind, number> = {
  candy: 10,
  soda: 10,
  bottle: 10,
  cake: 30,
  cone: -20,
  puddle: 0,
};

export const isDashSnack = (k: DashKind) =>
  k === 'candy' || k === 'soda' || k === 'bottle' || k === 'cake';

const LANES: DashLane[] = [-1, 0, 1];

/** The course for one round of one day: the same for everyone. */
export const dashCourse = (dateKey: string, round: number): DashItem[] => {
  const rand = mulberry32(hashString(`dash:${dateKey}:${round}`));
  const items: DashItem[] = [];
  let id = 0;
  let step = 20;
  const pick = () => LANES[Math.floor(rand() * 3)] ?? 0;
  while (step < DASH_STEPS - 4) {
    const r = rand();
    const kind: DashKind =
      r < 0.18
        ? 'candy'
        : r < 0.36
          ? 'soda'
          : r < 0.52
            ? 'bottle'
            : r < 0.6
              ? 'cake'
              : r < 0.9
                ? 'cone'
                : 'puddle';
    const lane = pick();
    items.push({ id: id++, lane, kind, hitStep: step });
    // Later on, a cone often guards the lane next to a snack.
    if (step > 120 && isDashSnack(kind) && rand() < 0.45) {
      const other =
        LANES.filter((l) => l !== lane)[Math.floor(rand() * 2)] ?? 0;
      items.push({ id: id++, lane: other, kind: 'cone', hitStep: step });
    }
    // Faster and faster: from about every 0.8 s down to every 0.35 s.
    const gap = Math.max(7, 16 - Math.floor(step / 45));
    step += gap + Math.floor(rand() * 4);
  }
  return items;
};

export type DashState = {
  step: number;
  lane: DashLane;
  score: number;
  combo: number;
  best: number;
  caught: number;
  hits: number;
  moves: DashMove[];
  done: boolean;
};

export type DashEvent = {
  item: DashItem;
  kind: 'catch' | 'hit' | 'miss';
  points: number;
  combo: number;
};

export const startDash = (): DashState => ({
  step: 0,
  lane: 0,
  score: 0,
  combo: 0,
  best: 0,
  caught: 0,
  hits: 0,
  moves: [],
  done: false,
});

/** Combo multiplier: x2 after 5 snacks in a row, x3 after 10. */
export const dashMultiplier = (combo: number) =>
  combo >= 10 ? 3 : combo >= 5 ? 2 : 1;

/** Advance one step. A lane change takes effect on this step. */
export const stepDash = (
  s: DashState,
  course: DashItem[],
  lane?: DashLane
): DashEvent[] => {
  if (s.done) return [];
  if (lane !== undefined && lane !== s.lane) {
    s.lane = lane;
    s.moves.push({ step: s.step, lane });
  }
  const events: DashEvent[] = [];
  for (const item of course) {
    if (item.hitStep !== s.step) continue;
    if (item.lane === s.lane) {
      if (isDashSnack(item.kind)) {
        s.combo += 1;
        const points = DASH_POINTS[item.kind] * dashMultiplier(s.combo);
        s.score += points;
        s.caught += 1;
        s.best = Math.max(s.best, s.combo);
        events.push({ item, kind: 'catch', points, combo: s.combo });
      } else {
        s.combo = 0;
        s.hits += 1;
        s.score = Math.max(0, s.score + DASH_POINTS[item.kind]);
        events.push({
          item,
          kind: 'hit',
          points: DASH_POINTS[item.kind],
          combo: 0,
        });
      }
    } else if (isDashSnack(item.kind)) {
      // A snack that gets past you breaks the combo.
      s.combo = 0;
      events.push({ item, kind: 'miss', points: 0, combo: 0 });
    }
  }
  s.step += 1;
  if (s.step >= DASH_STEPS) s.done = true;
  return events;
};

export const isValidDashMoves = (moves: unknown): moves is DashMove[] => {
  if (!Array.isArray(moves) || moves.length > DASH_MAX_MOVES) return false;
  let last = -1;
  for (const m of moves) {
    if (typeof m !== 'object' || m === null) return false;
    const { step, lane } = m as Record<string, unknown>;
    if (typeof step !== 'number' || !Number.isInteger(step)) return false;
    if (step < last || step < 0 || step >= DASH_STEPS) return false;
    if (lane !== -1 && lane !== 0 && lane !== 1) return false;
    last = step;
  }
  return true;
};

/** Replays a round from its lane changes: what the server uses to score it. */
export const replayDash = (
  course: DashItem[],
  moves: DashMove[]
): DashState => {
  const s = startDash();
  let i = 0;
  while (!s.done) {
    let lane: DashLane | undefined;
    while (i < moves.length && (moves[i]?.step ?? Infinity) <= s.step) {
      lane = moves[i]?.lane;
      i += 1;
    }
    stepDash(s, course, lane);
  }
  return s;
};

/** Coins for a round: paid for the first rounds of the day only. */
export const dashReward = (score: number, round: number) =>
  round < DASH_PAID_ROUNDS
    ? Math.min(DASH_MAX_REWARD, Math.round(score / 6))
    : 0;
