# Devpost submission kit

Everything needed to submit Running Man to
[Reddit's Daily Games Hackathon](https://redditgameofday2026.devpost.com/). Deadline: **Dec 8, 2026, 6:00pm PST**
(Dec 9, 9:00am in Vietnam). Aim to submit a day early.

## 1. Before you submit

- [ ] `npm run test:unit`, `npm run test:types`, `npm run lint` and `npm run build` all pass.
- [ ] `npx devvit upload` done (see [DEPLOY.md](DEPLOY.md)); the app page exists at `https://developers.reddit.com/apps/running-man`.
      Do **not** run `devvit publish`: the hackathon asks for unpublished apps.
- [ ] A public demo subreddit (for example r/ChibiCityMarathon) with the app installed.
- [ ] Today's stage post exists (install trigger, or the mod menu item **Post today's marathon stage**), and the
      scheduler has created posts for a few days in a row so judges see the daily loop.
- [ ] Ask 8 to 15 friends to run the stage on several days, so the leaderboard, the road and the crew bar are busy.
      Ask them to share their results in the comments too.
- [ ] Pin the subreddit's welcome post with one line on how to play and a link to today's stage.
- [ ] Open the demo post on a phone and in a desktop browser, logged in and logged out. Everything should fit in
      the post without scrolling sideways.
- [ ] Record the demo video (script below) and upload it to YouTube (unlisted is fine).
- [ ] Fill in the optional [developer satisfaction survey](https://forms.gle/dW45UgK6SctevE756) for the
      Feedback award.
- [ ] Help others in r/Devvit and the Devvit Discord during the hackathon (Devvit Helper award).

## 2. Devpost form

**Project name:** Running Man

**Elevator pitch (under 200 characters):**

> A daily 6 km chibi marathon through Tokyo, Paris, Hanoi and Dubai. Plan your pace, grab snacks, dodge cones and
> today's real runners. Crash into one and you both fall.

**Links:**

- App listing: `https://developers.reddit.com/apps/running-man`
- Demo post: `https://www.reddit.com/r/<your-subreddit>/comments/<today's post id>/`
- Code: `https://github.com/agrhub/running-man`
- Video: `<YouTube link>`

**Built with:** devvit, devvit-web, reddit, typescript, react, three.js, tailwindcss, hono, redis, vite, vitest,
playwright

**Category note:** this is an original game, not a port (do not tick Best Ported Daily Game).

### About the project

**Inspiration**

Running clubs post their weekend splits, argue about negative splits and cheer each other on. We wanted that energy
in a Reddit post you can play in two minutes: a race where the decision is yours, the legs are a cute chibi's, and the
finish line is something the whole subreddit reaches together.

**What it does**

Every day at 00:00 UTC a new post opens one 6 km stage of a city marathon. Tokyo, Paris, Hanoi and Dubai take turns,
one city a week, seven stages each. Stages run through different terrain: city avenues, parks, a forest, a zoo,
hills, a beach and the desert. Each has its own hills, water stations, a landmark and the day's weather (cool, heat,
rain, headwind or tailwind), and everyone gets exactly the same conditions.

The first time you open it you make your runner (skin, hair style and colour, shirt, a corgi to run with) and get a
race bib number that is printed on your runner's back and stays yours. Your Reddit account is your login.

You plan the race in about 30 seconds: tap each kilometre to choose Easy, Steady or Push and pick your water stops.
A live stamina line shows where you would run out. In the start corral you see your bib, your start lane and who is on
the road with you. Then you race it in 3D, from behind your runner, down a closed road with three lanes. Swipe or tap
to change lanes: cones, puddles and dropped cups cost seconds; water bottles, soda, cake, candy and high fives from
the crowd give a burst of speed. Tap the chat button to shout one of eight friendly lines ("Let's go! 🔥", "See you
at the finish 🏁"); they float above your head and replay for everyone who runs the stage after you.

The other runners on the road are today's real players, running exactly the lanes and pace they ran. You cannot run
through them: run into one, or let one run into you, and you both fall and lose a beat (4 seconds). The crash is
real on both sides: the other player's official time, splits and leaderboard place change too, and both result cards
list it in a race report. The landmark of the stage comes into view on the way, and the city lives around you:
traffic queues at the marshals and turns round, crowds wave, a TV motorbike films the leaders and confetti falls at
the finish. On the beach there are boats and umbrellas, in the desert a camel caravan, and at the zoo the animals
watch you go by.

The result is a race bib: your rank among today's runners, your time and splits, your streak and the badges you
earned. One tap shares it to the comments, where the pinned strategy thread is already arguing about where to push.
You can send one cheer a day to another runner, and once a week you vote on which city the crew should get next.

Everything has sound, all synthesised in the browser: footsteps that follow your pace, the crowd in town, waves on the
beach, wind in the desert, a bonk for a cone, a chime for cake, a thud when two runners go down, and a fanfare at the
finish. Phones buzz on a crash.

Every finished stage adds 6 km to the crew's goal of ten marathons in the city. When the crew finishes, everyone who
ran that week gets badges and the city's hat (a hachimaki, a beret, a leaf hat or a sun visor). Badges, streaks and weather unlock
21 outfit pieces and 4 pets that run beside you: a corgi, a tabby cat that keeps stopping, a shiba and a penguin.
Pets and outfits never change race times.

**How we built it**

- Devvit Web Interactive Post: a light React feed card, and an expanded React and three.js game.
- All 3D is procedural three.js: chibis, pets, landmarks and the city. Buildings are built at real floor scale from
  a canvas-drawn facade module repeated by UV, tinted per building and merged per material, so a whole city costs a
  handful of draw calls on a phone. Each city has its own look: glass towers and vertical signs in Tokyo,
  Haussmann blocks with slate roofs in Paris, narrow colourful tube houses with balconies and cables in Hanoi, sand
  towers in Dubai. Seven procedural terrains replace the city blocks on park, forest, zoo, hills, beach and desert
  stages.
- The race is shared code run by both sides: a stamina simulation for the pace plan, and a fixed-step race engine for
  lanes, course items and collisions. The client steps it live while you steer and sends only your plan and lane
  changes (and its quick-chat lines). The server replays the race step by step with the same course and the same runners and records the time
  it gets, so nobody can post a fake result, and it writes each crash into the other runner's record.
- Hono API on Devvit's serverless runtime with Redis: daily leaderboards in sorted sets, every runner's track (time at
  each km and lane changes), crew progress, profiles, streaks and cheers.
- The Devvit scheduler posts each day's stage with a pinned strategy comment. Results are shared as comments,
  City Finishers get a user flair, and Devvit Journeys track start, plan, finish and every interaction.
- A local harness runs the real API with an in-memory Redis and a browser mock of the client SDK, so the whole game
  can be played and tested without Reddit: 61 unit tests and a 30-check Playwright run cover the full loop.

**Challenges we ran into**

- Making a strategy game fair and still interesting: we brute-forced every pace plan for each stage and weather to
  make sure the best plan changes from day to day, and that going all-out usually fails.
- A crew goal that is reachable but not trivial: one marathon per city finished in eight runs, so the goal became ten
  marathons a week.
- A third-person camera in a narrow portrait post: landmarks sit beside the road, outside the view. The camera now
  widens and pans gently on the approach, and the race slows down while you pass.
- Keeping a dense 3D city fast on phones: merged geometry, instanced lane marks and no texture downloads.
- Making crashes feel real but fair in an asynchronous daily game: everyone lines up across the three lanes at the
  start, there are no crashes in the first 500 m, nobody runs into someone who is still getting up, and both runners
  lose the same beat. The same two runners crash at most once per race, and runners between the camera and you fade
  out so you never lose sight of yourself.
- Chat in a game where players never run at the same time: quick-chat lines are stored with the run at the step they
  were said, so the next runner sees the bubble at the same place on the road. Preset lines only, so there is nothing
  to moderate.

**Accomplishments that we're proud of**

The race bib result card, the moment the crowd and the landmark come into view, and a daily loop that takes two
minutes but still gives the comments something to argue about.

**What we learned**

Daily games live or die by the reason to come back tomorrow. A personal streak alone is not enough; a shared goal
that only the community can finish works better.

**What's next for Running Man**

Building the cities the crew votes for (London, New York, Seoul, Rio), mountain trail and snow stages, weekly "half marathon" weekend specials,
sub-communities racing as clubs, and premium cosmetics through Reddit's payments once eligible.

## 3. Demo video script (about 2 minutes)

| Time | Show                                                | Say                                                                                        |
| ---- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 0:00 | The feed card in the subreddit                      | "Every day, one new stage of a city marathon, right in your Reddit feed."                  |
| 0:05 | Make your runner, get bib #0019                     | "Make your chibi, pick a buddy, get your race bib."                                        |
| 0:10 | The plan screen                                     | "Each stage has hills, water stops and the day's weather. Same for everyone."              |
| 0:20 | Tap km buttons, gold line drops, "walking!" appears | "Push is fast but drains stamina. Push too much and you walk."                             |
| 0:35 | Countdown, steering past cones, a high five         | "Then you run it. Swipe to change lanes, dodge cones, high-five the crowd."                |
| 0:45 | Crash into another runner, both fall                | "These are today's real runners. Crash into one and you both fall, and both times change." |
| 0:50 | Tap 💬, "Let's go! 🔥" bubble, grab a soda          | "Shout to the field, grab a snack for a burst of speed."                                   |
| 0:55 | The landmark moment and the km gantries             | "Each stage passes a landmark: today, the Forest Shrine in Tokyo."                         |
| 1:10 | Finish, the race bib                                | "Your result is a race bib: rank, time, splits, streak."                                   |
| 1:20 | Share to comments, the comment thread               | "Share it, compare plans in the strategy thread, cheer another runner."                    |
| 1:35 | Crew bar                                            | "Every run adds 6 km to the subreddit's goal: ten marathons in each city, every week."     |
| 1:45 | Locker: outfits and pets                            | "Streaks and city finishes unlock outfits and pets. They never change your time."          |
| 1:55 | Beach and desert stages in Dubai                    | "Parks, zoos, beaches, desert: Paris, Hanoi, Dubai. See you at the start line tomorrow."   |

## 4. Screenshots for the gallery

In `docs/screenshots/` (portrait, 2x):

1. `01-feed-card.png`: the inline post in the feed
2. `02-race-plan.png`: planning the race
3. `03-race-tokyo.png`: the third-person race with today's runners and a crash
4. `04-landmark-hanoi.png`: the landmark moment in Hanoi
5. `05-race-hanoi-obstacles.png`: cones, a high-five fan and the TV motorbike in Hanoi
6. `06-result-bib.png`: the race bib result with the race report
7. `07-locker-pets.png`: pets in the locker
8. `08-register.png`: making your runner
9. `09-start-corral.png`: the start corral with your bib and today's field
10. `10-quick-chat.png`: quick-chat bubbles in a crowded race
11. `11-beach-dubai.png`: a beach stage in Dubai
12. `12-desert-dubai.png`: a desert stage in Dubai
13. `13-zoo.png`: a zoo stage
14. `14-city-vote.png`: the next-city vote on the result screen

Devpost shows the first image as the thumbnail: use `03-race-tokyo.png` or `10-quick-chat.png`.

Retake them on Reddit itself once the demo subreddit is live, so judges see the real post chrome.
