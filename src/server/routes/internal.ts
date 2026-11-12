import { Hono } from 'hono';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import type { Deps } from '../core/deps';
import { ensureDailyPost } from '../core/game';

export const createInternal = (
  deps: Deps,
  postUrl: (postId: string) => string
): Hono => {
  const internal = new Hono();

  internal.post('/menu/post-today', async (c) => {
    try {
      const postId = await ensureDailyPost(deps);
      return c.json<UiResponse>({ navigateTo: postUrl(postId) }, 200);
    } catch (error) {
      console.error('Failed to create today’s post', error);
      return c.json<UiResponse>(
        { showToast: 'Could not create today’s post' },
        400
      );
    }
  });

  internal.post('/scheduler/daily-stage', async (c) => {
    try {
      const postId = await ensureDailyPost(deps);
      console.log(`Daily stage post ready: ${postId}`);
      return c.json({ status: 'ok', postId }, 200);
    } catch (error) {
      console.error('Daily stage job failed', error);
      return c.json({ status: 'error' }, 500);
    }
  });

  internal.post('/triggers/on-app-install', async (c) => {
    try {
      const postId = await ensureDailyPost(deps);
      return c.json<TriggerResponse>(
        { status: 'success', message: `Today's stage post: ${postId}` },
        200
      );
    } catch (error) {
      console.error('Install trigger failed', error);
      return c.json<TriggerResponse>(
        { status: 'error', message: 'Failed to create post' },
        400
      );
    }
  });

  return internal;
};
