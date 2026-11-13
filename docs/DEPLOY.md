# Putting Running Man on Reddit

How to get the game from this repo onto a real subreddit for the hackathon. It takes about 20 minutes the first time.
The hackathon wants an **uploaded** app, not a published one: never run `devvit publish`.

## What you need

- Node 22 or newer (Devvit recommends Node 24) and npm.
- A Reddit account that will own the app. The app name `running-man` is claimed by the first account that
  uploads it; if it is already taken, change `name` in `devvit.json` (lowercase letters, numbers and dashes).
- A subreddit you moderate with **fewer than 200 members**. Uploaded (unpublished) apps can only be installed on small
  subreddits. Create a new one for the demo, for example r/ChibiCityMarathon.

## 1. Check the build

```bash
npm install
npm run test:unit       # 58 tests
npm run test:types
npm run lint
npm run build           # writes dist/client and dist/server
```

All four must pass before you upload. Optional: play the whole game locally with `npm run dev:local` and open
http://localhost:5178.

## 2. Log in to Devvit

```bash
npm run login           # same as: npx devvit login
```

A browser window opens on reddit.com. Approve the Devvit CLI with the account that will own the app.

## 3. Try it on a test subreddit (playtest)

```bash
npx devvit playtest r/YourTestSub
```

This installs a development build on the subreddit and reloads it every time you save. Logs stream in the terminal.
Open the subreddit, then:

1. Open the subreddit's **⋯** mod menu and choose **Post today's marathon stage**. A post with the feed card appears,
   with a pinned strategy comment.
2. Tap **Run today's stage**: make your runner, plan, line up, race, share the result.
3. Stop the playtest with Ctrl+C when you are happy.

## 4. Upload the app

```bash
npm run deploy          # type check + lint + npx devvit upload
```

The first upload asks you to confirm the app name and creates the app page at
`https://developers.reddit.com/apps/running-man`. Every later upload bumps the version. **Do not publish.**

## 5. Install it on the demo subreddit

```bash
npx devvit install r/ChibiCityMarathon running-man
```

Installing runs the `onAppInstall` trigger, which creates today's stage post. From then on the `daily-stage`
scheduler task creates a new post every day at 00:01 UTC. If a post is ever missing, a moderator can use the mod menu
item **Post today's marathon stage** (it never creates a second post for the same day).

To install a newer upload later, run the same command again; it installs the latest version.

## 6. Make the demo look alive

The game is about running with other redditors, so judges should see a busy road:

- Start the demo subreddit at least 5 days before the deadline so there are several daily posts in a row.
- Invite 8 to 15 friends (the subreddit must stay under 200 members). Ask each to run the stage on several days, use
  the quick chat, and share their result to the comments.
- Pin a short welcome post: "One new 6 km stage every day. Plan your pace, steer past cones and other runners, help
  the crew run ten marathons in each city."
- Open the post on a phone (Reddit app) and in a desktop browser, logged in and logged out, and check that nothing
  scrolls sideways.

## 7. Watch it

```bash
npx devvit logs r/ChibiCityMarathon
```

shows server logs and errors. Journeys (start, plan, finish and every interaction) appear in the app's analytics on
the developer portal.

## Troubleshooting

| Problem                                          | Fix                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `devvit install` says the subreddit is too large | Uploaded apps only install on subreddits with fewer than 200 members. Use a smaller one.     |
| No post after installing                         | Use the mod menu item **Post today's marathon stage**.                                       |
| App name already taken                           | Change `name` in `devvit.json`, then upload again.                                           |
| A visitor sees "Log in to Reddit to run."        | Expected for logged-out visitors: they can see the stage and the crew bar, not run.          |
| Upload fails on type check or lint               | Run `npm run test:types` and `npm run lint` and fix what they report, then `npm run deploy`. |

When everything is live, fill in the Devpost form with the links from [SUBMISSION.md](SUBMISSION.md).
