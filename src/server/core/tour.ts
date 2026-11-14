import type {
  RunnerTrack,
  TourResponse,
  TourRow,
  TourRunResponse,
  TourStopResponse,
} from '../../shared/api';
import { courseItems } from '../../shared/course';
import {
  MAX_MOVES,
  MAX_RIVALS,
  isValidMoves,
  replayRace,
  startLane,
} from '../../shared/race';
import { checkpoints, isValidPlan, simulate } from '../../shared/sim';
import {
  TOUR,
  TOUR_STAMP_REWARD,
  featuredStop,
  tourById,
  tourDay,
  tourKey,
  type TourStop,
} from '../../shared/tour';
import type { Deps } from './deps';
import {
  GameError,
  ensureBib,
  gameSettings,
  loadProfile,
  parse,
  requireUser,
  saveProfile,
} from './game';
import { updateFlair } from './flair';
import { keys } from './keys';
import { toDateKey } from '../../shared/content';

const findStop = (id: unknown): TourStop => {
  const stop = typeof id === 'string' ? tourById(id) : undefined;
  if (!stop) throw new GameError('That place is not on the World Tour.', 404);
  return stop;
};

/** Every stop, with your status and the fastest runner there. */
export const tourList = async (deps: Deps): Promise<TourResponse> => {
  const username = await requireUser(deps);
  const profile = await loadProfile(deps.store, username);
  const featured = featuredStop(toDateKey(deps.now())).id;
  const stops: TourRow[] = await Promise.all(
    TOUR.map(async (stop) => {
      const board = keys.tourBoard(stop.id);
      const [best, rank, runners, top] = await Promise.all([
        deps.store.zScore(board, username),
        deps.store.zRank(board, username),
        deps.store.zCard(board),
        deps.store.zRange(board, 0, 0, { by: 'rank' }),
      ]);
      const first = top[0];
      return {
        id: stop.id,
        unlocked:
          profile.tourUnlocked.includes(stop.id) || stop.id === featured,
        stamped: profile.tourStamps.includes(stop.id),
        best: best ?? null,
        rank: rank === undefined ? null : rank + 1,
        runners,
        top: first ? { username: first.member, seconds: first.score } : null,
      };
    })
  );
  return { type: 'tour', stops, profile, featured };
};

export const unlockTour = async (
  deps: Deps,
  id: unknown
): Promise<TourResponse> => {
  const username = await requireUser(deps);
  const stop = findStop(id);
  const profile = await loadProfile(deps.store, username);
  if (profile.tourUnlocked.includes(stop.id))
    throw new GameError('You already unlocked this place.', 409);
  if (profile.badges < stop.cost)
    throw new GameError('Not enough coins yet. Keep running!');
  profile.badges -= stop.cost;
  profile.tourUnlocked.push(stop.id);
  await saveProfile(deps.store, profile);
  return tourList(deps);
};

/** The fastest runs at a stop (not yours): they share the road as ghosts. */
export const tourStop = async (
  deps: Deps,
  id: unknown
): Promise<TourStopResponse> => {
  const username = await requireUser(deps);
  const stop = findStop(id);
  const board = keys.tourBoard(stop.id);
  const top = await deps.store.zRange(board, 0, MAX_RIVALS, { by: 'rank' });
  const names = top.map((t) => t.member).filter((n) => n !== username);
  const runners = names.length
    ? (await deps.store.hMGet(keys.tourTracks(stop.id), names))
        .map((r) => parse<RunnerTrack>(r))
        .filter((t): t is RunnerTrack => t !== null)
        .slice(0, MAX_RIVALS)
    : [];
  const best = await deps.store.zScore(board, username);
  return { type: 'tourStop', id: stop.id, runners, best: best ?? null };
};

/**
 * Runs a stop. The server replays the race exactly as it does the daily stage,
 * against the same ghosts the client was shown. Only your best time is kept,
 * and the first finish stamps your passport.
 */
export const tourRun = async (
  deps: Deps,
  id: unknown,
  planInput: unknown,
  movesInput: unknown,
  rivalsInput: unknown
): Promise<TourRunResponse> => {
  const { store } = deps;
  const username = await requireUser(deps);
  const stop = findStop(id);
  const profile = await loadProfile(store, username);
  const free = featuredStop(toDateKey(deps.now())).id === stop.id;
  if (!free && !profile.tourUnlocked.includes(stop.id))
    throw new GameError('Unlock this place first.');
  const day = tourDay(stop);
  if (!isValidPlan(day.stage, planInput))
    throw new GameError('That race plan is not valid.');
  if (!isValidMoves(movesInput))
    throw new GameError('That run could not be checked.');
  const plan = planInput;
  const moves = movesInput;

  const rivalNames = Array.isArray(rivalsInput)
    ? rivalsInput
        .filter((n): n is string => typeof n === 'string' && n !== username)
        .slice(0, MAX_RIVALS)
    : [];
  const rivals = rivalNames.length
    ? (await store.hMGet(keys.tourTracks(stop.id), rivalNames))
        .map((r) => parse<RunnerTrack>(r))
        .filter((t): t is RunnerTrack => t !== null)
    : [];

  const options = await gameSettings(deps);
  const sim = simulate(day.stage, day.weather.id, plan, day.time, false);
  const race = replayRace(
    {
      base: checkpoints(sim.splits),
      items: courseItems(tourKey(stop), day.stage, day.weather.id, {
        city: day.city.id,
        time: day.time,
        triathlon: false,
        life: options.roadLife,
      }),
      rivals,
      startLane: startLane(username),
    },
    moves
  );
  const seconds = race.finalSeconds;

  if (!profile.registered) profile.registered = true;
  await ensureBib(store, profile);

  const board = keys.tourBoard(stop.id);
  const previous = await store.zScore(board, username);
  const improved = previous === undefined || seconds < previous;
  if (improved) {
    await store.zAdd(board, { member: username, score: seconds });
    const track: RunnerTrack = {
      username,
      look: profile.look,
      bib: profile.bib,
      marks: race.marks,
      seconds,
      moves: moves.slice(0, MAX_MOVES),
    };
    await store.hSet(keys.tourTracks(stop.id), {
      [username]: JSON.stringify(track),
    });
  }

  const stamped = !profile.tourStamps.includes(stop.id);
  if (stamped) {
    profile.tourStamps.push(stop.id);
    profile.badges += TOUR_STAMP_REWARD;
  }
  await saveProfile(store, profile);
  if (stamped) await updateFlair(deps, profile);

  const [rankIndex, total] = await Promise.all([
    store.zRank(board, username),
    store.zCard(board),
  ]);
  return {
    type: 'tourRun',
    id: stop.id,
    profile,
    seconds,
    best: improved ? seconds : (previous ?? seconds),
    improved,
    rank: (rankIndex ?? 0) + 1,
    total,
    stamped,
    reward: stamped ? TOUR_STAMP_REWARD : 0,
  };
};
