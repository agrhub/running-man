import { Hono, type Context } from 'hono';
import type {
  CheerRequest,
  ErrorResponse,
  ItemRequest,
  JourneyRequest,
  RegisterRequest,
  PetRequest,
  ProfileResponse,
  RunRequest,
  ShareResponse,
  VoteRequest,
  QuestClaimRequest,
  ClubRequest,
  ClubResponse,
  FriendRequest,
  FriendsResponse,
  DashRequest,
  DashResponse,
  DashBoardResponse,
  QuestsResponse,
  VoteResponse,
} from '../../shared/api';
import type { Deps } from '../core/deps';
import { petById } from '../../shared/economy';
import { toDateKey } from '../../shared/content';
import {
  GameError,
  buyItem,
  castVote,
  checkIn,
  claimQuest,
  createClub,
  joinClub,
  leaveClub,
  myClub,
  addFriend,
  friendsOf,
  removeFriend,
  dashBoard,
  playDash,
  loadProfile,
  questStates,
  carePet,
  cheer,
  choosePet,
  equipItem,
  init,
  register,
  run,
  share,
  splash,
} from '../core/game';

const readJson = async <T extends object>(c: Context): Promise<Partial<T>> => {
  try {
    const body: unknown = await c.req.json();
    return typeof body === 'object' && body !== null
      ? (body as Partial<T>)
      : {};
  } catch {
    return {};
  }
};

const fail = (c: Context, error: unknown) => {
  if (error instanceof GameError) {
    return c.json<ErrorResponse>(
      { status: 'error', message: error.message },
      error.status
    );
  }
  console.error('Unexpected API error', error);
  return c.json<ErrorResponse>(
    { status: 'error', message: 'Something went wrong. Try again.' },
    500
  );
};

const track = (
  deps: Deps,
  journeyId: string | null | undefined,
  action: string,
  details?: string
) =>
  deps.telemetry
    .interaction(journeyId ?? null, action, details)
    .catch(() => undefined);

export const createApi = (deps: Deps): Hono => {
  const api = new Hono();

  api.get('/splash', async (c) => {
    try {
      return c.json(await splash(deps));
    } catch (e) {
      return fail(c, e);
    }
  });

  api.get('/init', async (c) => {
    try {
      return c.json(await init(deps));
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/run', async (c) => {
    try {
      const body = await readJson<RunRequest>(c);
      return c.json(
        await run(
          deps,
          body.plan,
          body.journeyId ?? null,
          body.moves ?? [],
          body.rivals ?? [],
          body.chat ?? []
        )
      );
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/register', async (c) => {
    try {
      const body = await readJson<RegisterRequest>(c);
      const profile = await register(deps, body);
      await track(deps, body.journeyId, 'runner_registered');
      return c.json<ProfileResponse>({
        type: 'profile',
        profile,
        message: `Bib #${String(profile.bib ?? 0).padStart(4, '0')} is yours!`,
      });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/shop/buy', async (c) => {
    try {
      const body = await readJson<ItemRequest>(c);
      const profile = await buyItem(deps, String(body.itemId ?? ''));
      await track(deps, body.journeyId, 'item_bought', body.itemId);
      return c.json<ProfileResponse>({
        type: 'profile',
        profile,
        message: 'Unlocked!',
      });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/shop/equip', async (c) => {
    try {
      const body = await readJson<ItemRequest>(c);
      const profile = await equipItem(deps, String(body.itemId ?? ''));
      await track(deps, body.journeyId, 'item_equipped', body.itemId);
      return c.json<ProfileResponse>({ type: 'profile', profile });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/pet/choose', async (c) => {
    try {
      const body = await readJson<PetRequest>(c);
      const pet = petById(String(body.petId ?? ''));
      if (!pet) throw new GameError('That pet does not exist.', 404);
      const petId = pet.id;
      const profile = await choosePet(deps, petId);
      await track(deps, body.journeyId, 'pet_chosen', petId);
      return c.json<ProfileResponse>({ type: 'profile', profile });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/pet/care', async (c) => {
    try {
      const body = await readJson<JourneyRequest>(c);
      const { profile, message } = await carePet(deps);
      await track(deps, body.journeyId, 'pet_cared');
      return c.json<ProfileResponse>({ type: 'profile', profile, message });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.get('/club', async (c) => {
    try {
      return c.json<ClubResponse>({ type: 'club', ...(await myClub(deps)) });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/club/create', async (c) => {
    try {
      const body = await readJson<ClubRequest>(c);
      const res = await createClub(deps, body.adjective, body.noun);
      await track(deps, body.journeyId, 'club_created');
      return c.json<ClubResponse>({ type: 'club', ...res });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/club/join', async (c) => {
    try {
      const body = await readJson<ClubRequest>(c);
      const res = await joinClub(deps, body.code);
      await track(deps, body.journeyId, 'club_joined');
      return c.json<ClubResponse>({ type: 'club', ...res });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/club/leave', async (c) => {
    try {
      return c.json<ClubResponse>({ type: 'club', ...(await leaveClub(deps)) });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.get('/friends', async (c) => {
    try {
      return c.json<FriendsResponse>({
        type: 'friends',
        ...(await friendsOf(deps)),
      });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/friends/add', async (c) => {
    try {
      const body = await readJson<FriendRequest>(c);
      const res = await addFriend(deps, String(body.username ?? ''));
      await track(deps, body.journeyId, 'friend_added');
      return c.json<FriendsResponse>({ type: 'friends', ...res });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/friends/remove', async (c) => {
    try {
      const body = await readJson<FriendRequest>(c);
      const res = await removeFriend(deps, String(body.username ?? ''));
      return c.json<FriendsResponse>({ type: 'friends', ...res });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.get('/dash', async (c) => {
    try {
      const username = (await deps.username()) ?? null;
      const board = await dashBoard(
        deps.store,
        toDateKey(deps.now()),
        username
      );
      return c.json<DashBoardResponse>({ type: 'dashBoard', board });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/dash', async (c) => {
    try {
      const body = await readJson<DashRequest>(c);
      const res = await playDash(deps, body.round, body.moves);
      await track(deps, body.journeyId, 'dash_played', String(res.score));
      return c.json<DashResponse>({ type: 'dash', ...res });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.get('/quests', async (c) => {
    try {
      const username = await deps.username();
      if (!username)
        throw new GameError('Log in to Reddit to see your quests.', 401);
      const profile = await loadProfile(deps.store, username);
      const quests = await questStates(
        deps.store,
        profile,
        toDateKey(deps.now())
      );
      return c.json<QuestsResponse>({ type: 'quests', quests, profile });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/quest/claim', async (c) => {
    try {
      const body = await readJson<QuestClaimRequest>(c);
      const res = await claimQuest(deps, String(body.questId ?? ''));
      await track(deps, body.journeyId, 'quest_claimed', String(body.questId));
      return c.json<QuestsResponse>({ type: 'quests', ...res });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/checkin', async (c) => {
    try {
      const body = await readJson<JourneyRequest>(c);
      const { profile, message } = await checkIn(deps);
      await track(
        deps,
        body.journeyId,
        'checked_in',
        String(profile.checkInDay)
      );
      return c.json<ProfileResponse>({ type: 'profile', profile, message });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/cheer', async (c) => {
    try {
      const body = await readJson<CheerRequest>(c);
      const { profile, message } = await cheer(
        deps,
        String(body.username ?? '')
      );
      await track(deps, body.journeyId, 'cheer_sent');
      return c.json<ProfileResponse>({ type: 'profile', profile, message });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/vote', async (c) => {
    try {
      const body = await readJson<VoteRequest>(c);
      const { vote, message } = await castVote(deps, String(body.cityId ?? ''));
      await track(deps, body.journeyId, 'city_voted', String(body.cityId));
      return c.json<VoteResponse>({ type: 'vote', vote, message });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/share', async (c) => {
    try {
      const body = await readJson<JourneyRequest>(c);
      const result = await share(deps);
      await track(deps, body.journeyId, 'result_shared');
      return c.json<ShareResponse>({ type: 'share', ...result });
    } catch (e) {
      return fail(c, e);
    }
  });

  return api;
};
