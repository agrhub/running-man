# Chibi City Marathon

A daily running game for Reddit. Every day the subreddit gets one new 6 km stage through the streets of a famous
city. You plan your pace, then steer your chibi runner down a busy 3D avenue: dodge cones and puddles, high-five fans,
and get past the other redditors who ran today without crashing into them. Every finish adds to the crew's shared goal:
ten marathons in each city, one city a week.

Built on [Devvit Web](https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_overview) for
[Reddit's Daily Games Hackathon](https://redditgameofday2026.devpost.com/).

| Feed card                                       | Make your runner                              | Start corral                                    | Race                                        |
| ----------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| ![Feed card](docs/screenshots/01-feed-card.png) | ![Register](docs/screenshots/08-register.png) | ![Corral](docs/screenshots/09-start-corral.png) | ![Race](docs/screenshots/03-race-tokyo.png) |

| Quick chat                                  | Beach stage, Dubai                            | Desert stage, Dubai                             | Result                                        |
| ------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| ![Chat](docs/screenshots/10-quick-chat.png) | ![Beach](docs/screenshots/11-beach-dubai.png) | ![Desert](docs/screenshots/12-desert-dubai.png) | ![Result](docs/screenshots/06-result-bib.png) |

## How to play

1. **Make your runner.** The first time you open the game you pick skin, hair style and colour, a shirt and a running
   buddy, and get your own race bib number. Your Reddit username is your account; there is nothing else to sign up for.
2. **Read the stage.** Each stage is 6 km with its own terrain (city streets, park, forest, zoo, hills, beach or
   desert), hills, water stations, landmark and weather. Everyone gets the same stage and the same weather that day.
3. **Plan your pace.** Tap each kilometre to switch between Easy, Steady and Push, and choose where to stop for water.
   The gold line shows your stamina. Push too hard and you will walk.
4. **Line up and race.** The start corral shows your bib, your start lane and who is on the road with you. Then a
   third-person run down a closed road with three lanes. Swipe, tap ◀ ▶ or use the arrow keys to change lanes. Cones,
   puddles and dropped cups cost seconds; water bottles, soda, cake, candy and high fives from the crowd give a burst
   of speed. Tap 💬 to shout one of eight quick-chat lines; other runners see it above your head when they run.
   The other runners on the road are today's real players, running exactly where they ran. Run into one, or let one
   run into you, and you **both fall and lose 4 seconds**, and the crash is written into both official times.
5. **Share and come back.** Your result is a race bib with your rank. Share it to the comments, cheer another runner,
   keep your streak, and help the crew finish the city.

One counted run per person per day. A new stage opens at 00:00 UTC.

## Features

- **Daily stages:** 4 cities (Tokyo, Paris, Hanoi, Dubai) x 7 stages, rotating weekly, across 7 terrains (city,
  park, forest, zoo, hills, beach, desert), with 5 weather types picked by a date-seeded random so everyone gets the
  same conditions.
- **Runner and race bib:** a short character creator on first launch (skin, 4 hair styles, hair colour, shirt, pet),
  a bib number that is yours for good and printed on your runner's back, and a start corral before each race.
- **Strategy first, then steering:** a deterministic stamina model (pace, grade, weather, water) decides most of your
  time; steering decides the rest (a few dozen seconds at most).
- **A real field, real crashes:** today's runners race on the road with you in their own lanes and outfits. Collisions
  knock both runners down; the other runner's leaderboard time, splits and result card are updated too, with a race
  report of who ran into whom. Runners line up across all three lanes at the start, and nobody runs into someone who is
  still getting up. The same two runners crash at most once per race, and runners between the camera and you fade so
  you never lose your runner in a crowded start.
- **Snacks on the road:** water bottles, soda, cake and candy speed you up; cones, puddles and cups slow you down.
  Every item is placed by the date, so everyone faces the same road.
- **Quick chat:** eight friendly preset lines (no free text, so nothing to moderate) shown as speech bubbles, saved
  with your run and replayed for everyone who runs after you, plus automatic reactions when you crash or grab a snack.- **Cheat-proof:** the client sends only the plan and the lane changes. The server replays the whole race step by step
  (same course, same runners) and records the time it computes.
- **Crew marathon:** every runner adds 6 km to the subreddit's goal of ten marathons (421.95 km) per city. When the crew
  finishes, everyone who ran that week gets badges and the city's hat.
- **A living world:** floor-scale buildings in each city's style, shops, street trees, park lawns and ponds, forest,
  zoo animals behind fences, rolling hills, a beach with sea, boats and umbrellas, desert dunes with a camel caravan,
  traffic on the cross streets that
  queues at the marshals and turns round, waving crowds, birds, balloons, a TV motorbike filming the leaders, confetti
  at the finish, and a landmark moment on every stage.
- **Race bib result card:** rank, time, splits, streak and rewards on one screen, with share and cheer buttons.
- **Locker:** 20 cosmetic items and 4 pets that run with you (corgi, tabby cat, shiba, penguin), earned by streaks,
  city finishes and weather, or bought with badges. Cosmetics never change race times.
- **Reddit-native:** one post per day created by the scheduler with a pinned strategy thread, result sharing as a
  comment, a "City Finisher" user flair, and Devvit Journeys events for analytics.

## Tech

- Devvit Web: Interactive Post with a light inline feed card (`splash.html`) and an expanded game (`game.html`).
- Client: React 19, Tailwind CSS 4, three.js (all 3D is procedural; no model files).
- Server: Hono on Devvit's serverless Node, Redis for state, Devvit scheduler, Reddit API, `@devvit/analytics` journeys.
- Shared: the stage content, the race simulation and the economy run on both client and server.

```
src/
  shared/     content (cities, stages, weather), sim (stamina model), course (cones, fans), race (the step-by-step
              race with lanes and collisions, run by client and server), chat (quick-chat lines), economy (items, pets,
              rewards), api types
  server/     core/game.ts (all game rules), core/store.ts (Redis interface + in-memory store), routes, devvit.ts
  client/     splash.tsx (feed card), game.tsx (app), screens/, components/, three/ (city, terrain, chibi, world)
  dev/        local harness: the real API with an in-memory Redis and a browser mock of @devvit/web/client
tests/e2e/    browser end-to-end script (Playwright)
```

## Develop

Requires Node 22+ (Devvit's CLI recommends Node 24).

```bash
npm install
npm run test:unit      # 58 unit tests: simulation, race replay, collisions, rules, API, daily posts
npm run test:types     # TypeScript
npm run lint
npm run dev:local      # play the whole game at http://localhost:5178 without Reddit
```

The local harness seeds four days of fake runners. Query parameters (kept as cookies) pick who and when you are:
`?user=alice` (empty for a logged-out guest), `?date=2026-11-13`, `?post=t3_dev1`. It also has helpers:
`POST /__dev/seed`, `POST /__dev/badges?n=1000`, `POST /__dev/crew?meters=400000`, `GET /__dev/state`.

Browser end-to-end check (26 checks: register, corral, steering, chat, result, replay, locker; needs Playwright for Python):

```bash
npm run dev:local
python3 tests/e2e/play.py e2e-out/
```

## Run it on Reddit

```bash
npm run login                       # devvit login
npm run build
npx devvit upload                   # uploads a private app version (do not publish during the hackathon)
npx devvit playtest r/YourTestSub   # live reload on your test subreddit
```

Step-by-step instructions for the hackathon upload are in [docs/DEPLOY.md](docs/DEPLOY.md). The full game design is in [docs/DESIGN.md](docs/DESIGN.md).

Installing the app creates today's post. Moderators can also use the subreddit menu item
**Post today's marathon stage**. After that the `daily-stage` scheduler task posts a new stage every day at 00:01 UTC.

## Credits and licences

- Fonts: Baloo 2 and Nunito (SIL Open Font License) via Fontsource.
- Project template: Reddit's Devvit Web React template (BSD-3-Clause), see `LICENSE`.
- The city's facade technique (one floor-by-bay facade module repeated by UV, tinted per building, merged per material)
  is inspired by [my-office](https://github.com/khanh020905/my-office) (MIT).
- Landmarks are simplified, stylised shapes. All shop signs and brands in the game are fictional.
