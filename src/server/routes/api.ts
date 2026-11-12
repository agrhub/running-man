import { Hono, type Context } from 'hono';
import type {
  CheerRequest,
  ErrorResponse,
  ItemRequest,
  JourneyRequest,
  PetRequest,
  ProfileResponse,
  RunRequest,
  ShareResponse,
} from '../../shared/api';
import type { Deps } from '../core/deps';
import {
  GameError,
  buyItem,
  carePet,
  cheer,
  choosePet,
  equipItem,
  init,
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
          body.rivals ?? []
        )
      );
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
      const petId = body.petId;
      if (
        petId !== 'corgi' &&
        petId !== 'cat' &&
        petId !== 'shiba' &&
        petId !== 'penguin'
      ) {
        throw new GameError('That pet does not exist.', 404);
      }
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
