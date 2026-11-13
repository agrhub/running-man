import { Hono } from 'hono';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import type { Deps } from '../core/deps';
import { toDateKey, addDays, dayInfo } from '../../shared/content';
import {
  ensureDailyPost,
  ensureWelcomePost,
  postRecap,
  postTitle,
  refreshWelcomePost,
  type StageLink,
} from '../core/game';

export const createInternal = (
  deps: Deps,
  postUrl: (postId: string) => string
): Hono => {
  const internal = new Hono();

  const stageLink = (postId: string): StageLink => ({
    postId,
    title: postTitle(dayInfo(toDateKey(deps.now()))),
    url: postUrl(postId.replace(/^t3_/, '')),
  });
  const pointGuide = (postId: string) =>
    refreshWelcomePost(deps, stageLink(postId)).catch((error: unknown) => {
      console.error('Could not update the how-to-play link', error);
    });

  internal.post('/menu/post-today', async (c) => {
    try {
      const postId = await ensureDailyPost(deps);
      await pointGuide(postId);
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
      await pointGuide(postId);
      const yesterday = addDays(toDateKey(deps.now()), -1);
      await postRecap(deps, yesterday).catch((error: unknown) => {
        console.error('Could not post the recap', error);
      });
      return c.json({ status: 'ok', postId }, 200);
    } catch (error) {
      console.error('Daily stage job failed', error);
      return c.json({ status: 'error' }, 500);
    }
  });

  internal.post('/triggers/on-app-install', async (c) => {
    try {
      const postId = await ensureDailyPost(deps);
      await ensureWelcomePost(deps, stageLink(postId)).catch(
        (error: unknown) => {
          console.error('Could not post the how-to-play guide', error);
        }
      );
      await pointGuide(postId);
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
