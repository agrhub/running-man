import { isPickup, type CourseItem, type Lane } from '../../shared/course';

/**
 * The first-run coach: four short lessons shown during your very first race,
 * each one when it is useful on the road, then never again.
 */
export type CoachStep = 'lanes' | 'snack' | 'runner' | 'chat' | 'done';

export type CoachState = {
  step: CoachStep;
  /** Race seconds when the current step started. */
  since: number;
  steers: number;
};

export type CoachView = {
  step: CoachStep;
  /** The lesson on screen right now, if any. */
  text: string | null;
  /** Which on-screen control the lesson points at. */
  point: 'steer' | 'chat' | null;
};

export type CoachInput = {
  /** Race clock, seconds. */
  t: number;
  km: number;
  lane: Lane;
  items: CourseItem[];
  /** Other runners; lane may be fractional while they change lanes. */
  rivals: { km: number; lane?: number }[];
  /** Events since the last frame. */
  grabbedSnack: boolean;
  crashed: boolean;
  chatOpened: boolean;
};

export const startCoach = (): CoachState => ({
  step: 'lanes',
  since: 0,
  steers: 0,
});

const LANE_NAME: Record<Lane, string> = {
  [-1]: 'left',
  0: 'middle',
  1: 'right',
};

const SNACK_LOOK = 0.14;
const RUNNER_LOOK = 0.07;

const go = (s: CoachState, step: CoachStep, t: number): CoachState => ({
  ...s,
  step,
  since: t,
});

/** Moves the coach on and says what to show. Pure, so the lessons can be tested. */
export const tickCoach = (
  s: CoachState,
  input: CoachInput
): [CoachState, CoachView] => {
  const { t, km, lane } = input;
  const age = t - s.since;
  if (s.step === 'lanes') {
    if (s.steers >= 2 || age > 9) return tickCoach(go(s, 'snack', t), input);
    return [
      s,
      {
        step: 'lanes',
        text: 'Swipe, or tap ◀ ▶, to change lanes. Try it twice!',
        point: 'steer',
      },
    ];
  }
  if (s.step === 'snack') {
    if (input.grabbedSnack || age > 14)
      return tickCoach(go(s, 'runner', t), input);
    const next = input.items.find(
      (i) => isPickup(i.kind) && i.km > km && i.km - km < SNACK_LOOK
    );
    if (!next) return [s, { step: 'snack', text: null, point: null }];
    const where =
      next.lane === lane
        ? 'right in your lane. Run through it'
        : `in the ${LANE_NAME[next.lane]} lane. Steer into it`;
    return [
      s,
      {
        step: 'snack',
        text: `🍰 Snack ahead, ${where} for a burst of speed!`,
        point: next.lane === lane ? null : 'steer',
      },
    ];
  }
  if (s.step === 'runner') {
    if (input.crashed || age > 16) return tickCoach(go(s, 'chat', t), input);
    const blocker = input.rivals.find(
      (r) =>
        Math.round(r.lane ?? 0) === lane && r.km > km && r.km - km < RUNNER_LOOK
    );
    if (!blocker) return [s, { step: 'runner', text: null, point: null }];
    return [
      s,
      {
        step: 'runner',
        text: '👟 A real runner is ahead in your lane. Change lanes to pass, or you both fall!',
        point: 'steer',
      },
    ];
  }
  if (s.step === 'chat') {
    if (input.chatOpened || age > 6) return [go(s, 'done', t), DONE];
    return [
      s,
      {
        step: 'chat',
        text: 'Tap 💬 to shout to the field. Runners after you will hear it.',
        point: 'chat',
      },
    ];
  }
  return [s, DONE];
};

const DONE: CoachView = { step: 'done', text: null, point: null };

/** Counts a lane change for the first lesson. */
export const coachSteered = (s: CoachState): CoachState =>
  s.step === 'lanes' ? { ...s, steers: s.steers + 1 } : s;
