import type { CityId } from './content';

/**
 * Achievements: long-term goals shown on the profile. Each pays coins once,
 * the moment the server sees it done. Progress comes from what the server
 * recorded, so none of it can be faked from the client.
 */
export type RunnerSummary = {
  runs: number;
  km: number;
  bestStreak: number;
  cities: CityId[];
  fives: number;
  snacks: number;
  crashes: number;
  chats: number;
  /** Best finishing place at the time of a run (1 = won the stage so far). */
  bestRank: number | null;
  finisher: boolean;
  inClub: boolean;
  friends: number;
  holidayRun: boolean;
  dashBest: number;
  /** Finish-time guesses within 3 seconds. */
  calledIt: number;
};

export type Achievement = {
  id: string;
  icon: string;
  name: string;
  /** What to do, in a few words. */
  goal: string;
  reward: number;
  target: number;
  value: (s: RunnerSummary) => number;
};

export const ACHIEVEMENT_REWARD = 50;

const a = (
  id: string,
  icon: string,
  name: string,
  goal: string,
  target: number,
  value: (s: RunnerSummary) => number,
  reward = ACHIEVEMENT_REWARD
): Achievement => ({ id, icon, name, goal, target, value, reward });

export const ACHIEVEMENTS: Achievement[] = [
  a(
    'first-steps',
    '👟',
    'First Steps',
    'Finish your first stage',
    1,
    (s) => s.runs
  ),
  a(
    'marathoner',
    '🏅',
    'Marathoner',
    'Run 42 km in total',
    42,
    (s) => s.km,
    100
  ),
  a(
    'week-warrior',
    '🔥',
    'Week Warrior',
    'Keep a 7-day streak',
    7,
    (s) => s.bestStreak,
    100
  ),
  a(
    'globetrotter',
    '🌏',
    'Globetrotter',
    'Run in all four cities',
    4,
    (s) => s.cities.length,
    150
  ),
  a('podium', '🥉', 'On the Podium', 'Finish a stage in the top 3', 1, (s) =>
    s.bestRank !== null && s.bestRank <= 3 ? 1 : 0
  ),
  a(
    'city-finisher',
    '🏙️',
    'City Finisher',
    'Run 5 stages of one city',
    1,
    (s) => (s.finisher ? 1 : 0)
  ),
  a(
    'high-five-hero',
    '🙌',
    'High Five Hero',
    'High-five 25 fans',
    25,
    (s) => s.fives
  ),
  a(
    'snack-attack',
    '🍰',
    'Snack Attack',
    'Grab 25 snacks',
    25,
    (s) => s.snacks
  ),
  a('bumper-car', '💥', 'Bumper Car', 'Be in 10 crashes', 10, (s) => s.crashes),
  a(
    'chatterbox',
    '💬',
    'Chatterbox',
    'Shout 20 quick-chat lines',
    20,
    (s) => s.chats
  ),
  a(
    'dash-master',
    '🎮',
    'Dash Master',
    'Score 150 in Snack Dash',
    150,
    (s) => s.dashBest
  ),
  a('team-player', '🤝', 'Team Player', 'Join a running club', 1, (s) =>
    s.inClub ? 1 : 0
  ),
  a(
    'social-runner',
    '👥',
    'Social Runner',
    'Add 3 friends',
    3,
    (s) => s.friends
  ),
  a(
    'called-it',
    '🔮',
    'Called It',
    'Guess your time within 3 seconds',
    1,
    (s) => s.calledIt,
    100
  ),
  a('snow-runner', '❄️', 'Snow Runner', 'Run a stage in December', 1, (s) =>
    s.holidayRun ? 1 : 0
  ),
];

export const achievementById = (id: string) =>
  ACHIEVEMENTS.find((x) => x.id === id);

export type AchievementState = {
  id: string;
  value: number;
  target: number;
  done: boolean;
};

export const achievementStates = (
  s: RunnerSummary,
  earned: string[]
): AchievementState[] =>
  ACHIEVEMENTS.map((x) => {
    const value = Math.min(x.target, x.value(s));
    return {
      id: x.id,
      value,
      target: x.target,
      done: earned.includes(x.id) || value >= x.target,
    };
  });

/** Ids newly completed by this summary, not yet in `earned`. */
export const newlyEarned = (s: RunnerSummary, earned: string[]): string[] =>
  ACHIEVEMENTS.filter(
    (x) => !earned.includes(x.id) && x.value(s) >= x.target
  ).map((x) => x.id);
