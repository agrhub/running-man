import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { context, createServer, getServerPort } from '@devvit/web/server';
import { devvitDeps } from './devvit';
import { createApi } from './routes/api';
import { createInternal } from './routes/internal';

const app = new Hono();

app.route('/api', createApi(devvitDeps));
app.route(
  '/internal',
  createInternal(
    devvitDeps,
    (postId) =>
      `https://reddit.com/r/${context.subredditName}/comments/${postId}`
  )
);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
