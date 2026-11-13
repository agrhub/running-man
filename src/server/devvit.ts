import { context, reddit, redis } from '@devvit/web/server';
import { telemetry as journeys } from '@devvit/analytics/server/reddit';
import type { Deps, Telemetry } from './core/deps';

const subredditName = (): string => {
  const name = context.subredditName;
  if (!name) throw new Error('subredditName missing from Devvit context');
  return name;
};

const asT3 = (id: string): `t3_${string}` =>
  id.startsWith('t3_') ? (id as `t3_${string}`) : `t3_${id}`;

const telemetry: Telemetry = {
  start: async () => {
    const { journeyId } = await journeys.startJourney();
    return journeyId || null;
  },
  progress: async (journeyId, progress, action) => {
    await journeys.journeyProgress({ journeyId, progress, action });
  },
  interaction: async (journeyId, action, details) => {
    if (!journeyId) return;
    await journeys.journeyInteraction({
      journeyId,
      action,
      actionDetails: details ?? '',
    });
  },
  end: async (journeyId, game) => {
    await journeys.endJourney({ journeyId, complete: true, game });
  },
};

export const devvitDeps: Deps = {
  store: redis,
  now: () => new Date(),
  username: () => reddit.getCurrentUsername(),
  postId: () => context.postId,
  createPost: async ({ title, fallbackText, pinnedComment }) => {
    const post = await reddit.submitCustomPost({
      subredditName: subredditName(),
      title,
      entry: 'default',
      textFallback: { text: fallbackText },
    });
    try {
      const comment = await reddit.submitComment({
        id: post.id,
        text: pinnedComment,
        runAs: 'APP',
      });
      await comment.distinguish(true);
    } catch (error) {
      console.error('Could not pin the strategy comment', error);
    }
    return post.id;
  },
  createTextPost: async (title, text) => {
    const post = await reddit.submitPost({
      subredditName: subredditName(),
      title,
      text,
    });
    return post.id;
  },
  pin: async (postId, slot) => {
    const post = await reddit.getPostById(asT3(postId));
    await post.sticky(slot);
  },
  comment: async (postId, text) => {
    try {
      await reddit.submitComment({ id: asT3(postId), text, runAs: 'USER' });
      return true;
    } catch (error) {
      console.error('Could not post the result comment', error);
      return false;
    }
  },
  setFlair: async (username, text) => {
    await reddit.setUserFlair({
      subredditName: subredditName(),
      username,
      text,
      backgroundColor: '#ffd36e',
      textColor: 'dark',
    });
  },
  avatarUrl: async (username) => {
    try {
      return (await reddit.getSnoovatarUrl(username)) ?? null;
    } catch {
      return null;
    }
  },
  telemetry,
};
