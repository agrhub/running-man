import { cleanUsername } from '../../shared/challenge';
import { dayInfo, toDateKey } from '../../shared/content';
import { featuredWeek } from '../../shared/tour';
import type { Deps } from './deps';
import { GameError } from './game';
import { keys } from './keys';

/**
 * Moderators can stop a runner from racing in their community (spam accounts,
 * someone gaming the boards). A banned runner can still open the posts, but
 * every action that needs an account refuses them, and they are taken off
 * today's leaderboard, today's ghosts and this week's boards. Past days are
 * left as they were. Unbanning lets them race again from the next run.
 */
export const banRunner = async (
  deps: Deps,
  raw: unknown,
  by: string
): Promise<string> => {
  const name = cleanUsername(raw);
  if (!name) throw new GameError('That is not a Reddit username.');
  const { store } = deps;
  const today = toDateKey(deps.now());
  const day = dayInfo(today);
  await store.hSet(keys.banned(), {
    [name.toLowerCase()]: JSON.stringify({ name, by, at: today }),
  });
  // Boards key runners by their exact Reddit name, and Reddit names ignore
  // case, so find the spelling today's board actually holds.
  const lower = name.toLowerCase();
  const onBoard = async (key: string) =>
    (await store.zRange(key, 0, -1, { by: 'rank' })).find(
      (r) => r.member.toLowerCase() === lower
    )?.member ?? name;
  const [todayName, weekName, tourName] = await Promise.all([
    onBoard(keys.leaderboard(today)),
    onBoard(keys.weekBoard(day.season)),
    onBoard(keys.tourWeek(featuredWeek(today))),
  ]);
  await Promise.all([
    store.zRem(keys.leaderboard(today), [todayName]),
    store.hDel(keys.tracks(today), [todayName]),
    store.zRem(keys.weekBoard(day.season), [weekName]),
    store.hDel(keys.week(day.season), [weekName]),
    store.zRem(keys.tourWeek(featuredWeek(today)), [tourName]),
  ]);
  return `u/${name} can no longer race here, and is off today's and this week's boards.`;
};

/** The banned runners as they were typed, for the moderator form. */
export const bannedRunners = async (deps: Deps): Promise<string[]> =>
  Object.entries(await deps.store.hGetAll(keys.banned()))
    .map(([lower, raw]) => {
      try {
        return (JSON.parse(raw) as { name?: string }).name ?? lower;
      } catch {
        return lower;
      }
    })
    .sort((a, b) => a.localeCompare(b));

/** One line for the form: who is banned now. */
export const bannedLine = (names: string[]): string =>
  names.length === 0
    ? 'Nobody is banned right now.'
    : names.length <= 12
      ? `Banned now: ${names.map((n) => `u/${n}`).join(', ')}.`
      : `Banned now: ${names
          .slice(0, 12)
          .map((n) => `u/${n}`)
          .join(', ')} and ${names.length - 12} more.`;

export const unbanRunner = async (
  deps: Deps,
  raw: unknown
): Promise<string> => {
  const name = cleanUsername(raw);
  if (!name) throw new GameError('That is not a Reddit username.');
  await deps.store.hDel(keys.banned(), [name.toLowerCase()]);
  return `u/${name} can race here again.`;
};
