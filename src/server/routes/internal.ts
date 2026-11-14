import { awardTourWeek } from '../core/tour';
import { featuredUntil, featuredWeek } from '../../shared/tour';
import { Hono, type Context } from 'hono';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import type { Deps } from '../core/deps';
import { toDateKey, addDays, dayInfo } from '../../shared/content';
import {
  dayNumber,
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

  const stageLink = async (postId: string): Promise<StageLink> => {
    const dateKey = toDateKey(deps.now());
    return {
      postId,
      title: postTitle(dayInfo(dateKey), await dayNumber(deps, dateKey)),
      url: postUrl(postId.replace(/^t3_/, '')),
    };
  };
  const pointGuide = (postId: string) =>
    stageLink(postId)
      .then((link) => refreshWelcomePost(deps, link))
      .catch((error: unknown) => {
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
      // A free World Tour week ends on Sunday: pay its podium.
      const tourWeek =
        featuredUntil(yesterday) === yesterday
          ? await awardTourWeek(deps, featuredWeek(yesterday)).catch(
              (error: unknown) => {
                console.error('Could not close the World Tour week', error);
                return null;
              }
            )
          : null;
      await postRecap(deps, yesterday, tourWeek).catch((error: unknown) => {
        console.error('Could not post the recap', error);
      });
      return c.json({ status: 'ok', postId }, 200);
    } catch (error) {
      console.error('Daily stage job failed', error);
      return c.json({ status: 'error' }, 500);
    }
  });

  // Install and every upgrade make sure today's stage and the guide exist,
  // and point the guide at the stage, so an upload needs no menu click.
  const setUp = (label: string) => async (c: Context) => {
    try {
      const postId = await ensureDailyPost(deps);
      await ensureWelcomePost(deps, await stageLink(postId)).catch(
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
      console.error(`${label} trigger failed`, error);
      return c.json<TriggerResponse>(
        { status: 'error', message: 'Failed to create post' },
        400
      );
    }
  };
  internal.post('/triggers/on-app-install', setUp('Install'));
  internal.post('/triggers/on-app-upgrade', setUp('Upgrade'));

  return internal;
};
