import { dayIndexOf } from './content';

/**
 * Rest days protect a streak: buy one with coins, and when you miss a day it is
 * used up on its own so your streak carries on. You can hold a couple at most,
 * so a streak still means showing up.
 */
export const REST_DAY_COST = 150;
export const MAX_REST_DAYS = 2;

/** Days missed between your last run and `today` (not counting either day). */
export const missedDays = (
  lastRunDate: string | null,
  today: string
): number =>
  lastRunDate === null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, dayIndexOf(today) - dayIndexOf(lastRunDate) - 1);

/** Whether a streak is still alive today, counting the rest days you hold. */
export const streakAlive = (
  p: { lastRunDate: string | null; restDays?: number },
  today: string
): boolean => missedDays(p.lastRunDate, today) <= (p.restDays ?? 0);
