/**
 * Challenges: after your run you can call out another redditor in today's
 * post. The mention notifies them, and beating your time pays them coins.
 */
export const MAX_CHALLENGES = 3;
export const CHALLENGE_REWARD = 30;
/** At most this many beaten challenges pay out in one run. */
export const MAX_CHALLENGE_PAYOUTS = 3;

/** A Reddit username from what was typed ("u/Name", "/u/name", "@name"), or null. */
export const cleanUsername = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/^@|^\/?u\//i, '');
  return /^[A-Za-z0-9_-]{3,20}$/.test(name) ? name : null;
};

export type Challenge = { from: string; seconds: number };
export type ChallengeResult = Challenge & { beaten: boolean };
