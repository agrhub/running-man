# Game design

Running Man is a daily running game played inside a Reddit post. Each day the subreddit gets one 6 km stage of
a city marathon. You plan your pace, then steer a 3D chibi runner down the road past obstacles, snacks and the other
redditors who ran that day. Every finish adds to a shared goal the whole subreddit runs toward.

## Goals

- **Contest:** Reddit's Daily Games Hackathon. Deadline Dec 8, 2026, 6:00pm PST. Judged on delightful UX, polish,
  how Reddit-y it is, and daily content.
- **Platform:** Devvit Web Interactive Post. React for the interface, three.js for the 3D, all built in code.
- **Players:** redditors, mostly on phones. People who like running, travel and cozy games.
- **Strategy first, steering second:** the pace plan decides most of your time. Steering decides the rest, a few
  dozen seconds at most. You win by deciding well; reflexes are a bonus.
- **No real brands or ads:** Reddit does not allow ads in apps. Every shop sign and brand in the game is made up.

| Judging criterion | How the game meets it                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Delightful UX     | Cute 3D chibis, a pet beside you, a palette per city, a living city, sound and haptics                          |
| Polish            | Small scope done well: 5 cities, 8 terrains, 7 pets, 21 outfit items, traffic, crowds, birds and a TV motorbike |
| Reddit-y          | The subreddit is one running club; real redditors share the road and crashes hurt both; quick chat; bibs; flair |
| Daily content     | A new stage every day with its own terrain, landmark and weather; a new city every week                         |

## The daily loop

One session takes 2 to 3 minutes: about 30 seconds to plan, 60 to 90 seconds to run, then the result.

### First time: make your runner

- Your Reddit account is your login. There is no sign-up form. Logged-out visitors can see the stage and the crew
  bar; tapping Run asks them to log in.
- The **Make your runner** screen: skin tone, one of four hair styles (Short, Spiky, Bob, Bun), hair colour, shirt
  colour, and a running buddy once you have adopted one in the shop. **Get my race bib** gives you a bib number that is yours for good, printed
  on your runner's back.

### Plan (about 30 seconds)

- See the route map (the course coloured by grade, km marks, water stops, the landmark, boosters, and how many
  obstacles and snacks each km holds), the 6 km elevation profile, the terrain, today's weather and the start time.
- Yesterday's podium sits under the start button: the same recap the app posts in the comments.
- Tap each kilometre to switch between Easy, Steady and Push, and choose where to drink. The default is all Steady,
  so a new player can run straight away.
- A gold stamina line shows where you would run out. Run out and you walk.

### Start corral

- Your bib, your start lane (runners are spread over the three lanes by username) and the list of runners from today
  who will be on the road with you. Then a countdown.

### Run (60 to 90 seconds)

- Third person, from behind your runner and pet, down a closed road with three lanes. Swipe, tap ◀ ▶ or use the
  arrow keys to change lanes.
- Cones (4 s), puddles (3 s) and dropped cups (2 s) slow you down. High fives from fans (−2 s), water bottles (−2 s),
  soda (−3 s), cake (−2 s) and candy (−1 s) speed you up. Items are placed from the date, so everyone faces the same
  road.
- **Life on the road:** people crossing (3 s), cyclists, motorbikes and Hanoi's cyclos (4 s), taxis (5 s),
  ambulances and fire engines with flashing lights (6 s, you stop to make way), and dogs, cats, chickens and pigs
  (2 to 4 s). Who turns up depends on the city, the terrain and the hour: motorbikes and cyclos in Hanoi, taxis in
  Dubai, farm animals in the hills, more people out in the evening. Each moves, reacts when you meet it and answers
  with its own horn, siren, bark or cluck.
- **Boosters:** roller skates (−4 s), a skateboard (−5 s) and, rarest, a bicycle (−7 s) wait in a glowing ring. Run
  through one and your runner rides it for a few seconds.
- **First race coach:** a new player's first race shows four short tips, each when it is useful: change lanes, steer
  into the next snack, pass a real runner in your lane, shout with quick chat. The control each tip is about pulses.
- **No ghosts.** The other runners look and act like real people: today's players, in their outfits and bibs, running
  exactly the lanes and pace they ran. Run into one, or let one run into you, and **both fall and lose 4 seconds**.
  The crash is written into both official times. Rules that keep it fair: no crashes in the first 500 m, nobody
  runs into a runner who is still getting up, and the same two runners crash at most once per race.
- Runners between the camera and you fade out, so you never lose sight of your runner in a crowded start.
- **Quick chat:** the 💬 button opens eight preset lines ("On your left! 👋", "Let's go! 🔥", "See you at the
  finish 🏁"…). Lines are saved at the step you said them and shown as speech bubbles to everyone who runs the stage
  after you. Crashes and snacks trigger short automatic reactions. There is no free text, so nothing to moderate.
- On the approach to the stage's landmark the camera widens and pans and the race slows for a moment.
- **Sound and vibration**, all synthesised in the browser: countdown beeps, footsteps that follow your pace, a
  soundscape per terrain (crowd in town, waves, desert wind, birds in the green stages), a thud for a crash, a bonk
  for a cone, a splash for a puddle, chimes for snacks and high fives, a bell at each km gate and a finish fanfare.
  Phones buzz on a crash. The 🔊 button mutes it all, remembered on that device.
- **Finish without steering** skips to the end with your plan alone.
- **Comfort options** (Me tab, kept in the browser): calm motion (no lightning flashes, a quarter of the rain, snow
  and leaves, a steady camera; on by default when the phone asks for reduced motion), bigger steering buttons,
  vibration, and both arrows on the left or the right for one-thumb play.

### Triathlon Finale (stage 7 of every city)

- Swim the first km, bike km 2 to 4, run the last two, with 30 s at each change (T1, T2).
- Every leg has its own speeds: swimming drains stamina fast, the bike lets the legs recover a little, hills count
  for half on the bike and not at all in the water.
- On the road, the first km is a pool with lane ropes and marker buoys (3 s); everyone swims, then everyone rides a
  bike from the T1 gate to T2.

### Result (one screen)

- A race bib: time, rank among today's runners, splits, streak and the kilometres you added to the crew.
- A race report of every crash, who ran into whom.
- Badges earned and progress to the next item.
- Share to the comments, cheer another runner, open the locker, watch the replay.
- One counted run per person per day.

## Community

The whole subreddit is one running club. Every finished stage adds 6 km to the crew's goal of **ten marathons
(421.95 km) per city**. The first version asked for one marathon, but eight runs finished it, so the goal became ten.

- **Crew bar** on the feed card and the plan screen: "Crew goal: 10 marathons in Tokyo, 306 / 422 km".
- **A season is one city:** seven days, seven stages. If the crew finishes early, the remaining stages stay open.
- **City finish:** everyone who ran that week gets 200 coins and the city's hat (Tokyo hachimaki, Paris beret,
  Hanoi leaf hat, Dubai sun visor). Runners get a "🏅 Tokyo Finisher" user flair.
- **Real runners on the road:** up to 12 of today's runners share the road with you.
- **The comments are the strategy room:** each stage post pins a "Today's strategy?" comment, and sharing a result
  posts a compact result card as a comment.
- **Cheers:** one free cheer a day for another runner (+5 coins to you).
- **Daily recap:** when a new stage opens, the app comments under the closed day's post: the podium, how far the
  field ran together, snacks, high fives and crashes, the most crashes, the most shouted line, the crew's progress
  and what is next.
- **Pinned posts:** each day's stage is pinned at the top of the subreddit (it replaces yesterday's), and a
  how-to-play guide is posted and pinned once on install.
- **Club relay:** the first three clubmates to run each day are the club's relay legs (times as they finished). When
  the third leg finishes, the total goes on today's relay board and all three get 25 coins.
- **Call your time:** in the start corral, guess your finish (within three minutes of the plan's projection). Within
  10 seconds pays 30 coins, within 3 seconds 60, and the first call within 3 seconds earns the Called It
  achievement.
- **City celebration:** when the crew crosses ten marathons, the app posts a celebration once: who crossed the line,
  how many ran, the reward and next week's city.
- **Next-city vote:** on the result screen, everyone who ran a stage that week gets one vote for the next city to
  build: London, New York, Seoul or Rio. Votes are counted on the server, one per runner per week, with live
  percentages and the city in the lead.
- **Leaderboards:** today's top 10, this week's standings (most stages, then the lowest total time, crash penalties
  included) and a Friends board, all with each player's own Reddit avatar.
- **Friends:** add runners by Reddit username or from today's runners (up to 50). Their day shows on the Friends tab
  (time, rank, streak), friends who ran today join your road first with teal tags, and the result screen has a
  Friends board.
- **Running clubs (group runs):** start a club, named from two word lists ("Speedy Pandas") so there is no free text
  to moderate, and share its 6-character join code; up to 20 members, one club each. Clubmates who ran today share
  your road with purple tags. A club's week is the sum of its members' stages, and the top clubs of the week are
  ranked by km. When the owner leaves, the next member takes over.

## Between races: the tab bar

The game view has a bottom tab bar: **Race** (plan or result), **Quests**, **Play**, **Friends**, **Shop** and **Me**. The
race itself, registration and the corral stay full screen. A dot on Quests means a check-in or a finished quest is
waiting.

### Daily check-in

A 7-day calendar: 20, 30, 40, 50, 60, 80 and 150 coins on consecutive UTC days. After day 7, or after a missed day,
it starts again at day 1.

### Quests

Three daily quests, the same for everyone and picked by the date: always "Run today's stage", plus two of grab 3
snacks, high-five 2 fans, finish without a crash, finish without a cone, quick chat, cheer, share, pet treat, top half
or a round of Snack Dash. Weekly quests: run 3 stages (150), run 5 stages (300), vote for the next city (50). The
server works out progress from what really happened (the run record, cheers, votes, mini game rounds), and each quest
pays once.

### Snack Dash (mini game)

Twenty seconds on three lanes, drawn on a 2D canvas: candy, soda and water are worth 10, cake 30, a cone costs 20 and
a puddle breaks the combo. Five snacks in a row double the points, ten triple them; a missed snack or a hit resets the
combo. Each round's course comes from the date and the round number, so everyone plays the same rounds in the same
order, and the server replays the lane changes to score them. The first three rounds a day pay up to 50 coins
(score ÷ 6); up to ten rounds a day in all, for the daily top five.

### Three more mini games

The Play tab is a hub of four games. The three newer ones work the same way as Snack Dash: the course comes from the
date and the round, the client sends only its tap times, the server replays them, the first three rounds a day pay up
to 40 coins (score ÷ 8), and each game has its own daily top five.

- **Hurdle Hop:** a side view of the track. Tap to jump; a jump lasts 0.6 s and clears a hurdle only from 90 to
  510 ms after take-off, so jumping too early or too late trips you. Hurdles come from every 1.4 s down to every
  0.75 s, with quick pairs late on. 10 points a hurdle, doubled after five in a row, tripled after ten.
- **Rhythm Steps:** footprints fall to a line on a beat that rises from 96 to 140 bpm, with rests and double steps.
  Within 60 ms is perfect (20), within 130 ms good (10); stray taps cost 5 and break the combo.
- **Pet Fetch:** five throws. A power bar sweeps up and down, faster each throw; tap to throw, and your pet runs to
  the ball and brings it back. Wind adds or takes off metres. Up to 100 points a throw, by how close the ball lands
  to the ring.

### World Tour

Waiting a day for the next stage is the point of the daily loop, so the next stage never opens early. For players who
want more running, the Play tab has a World Tour: famous places outside the calendar, run any time.

- Twelve stops in three kinds: ancient wonders (Great Wall, Pyramids of Giza, Machu Picchu, Colosseum, Angkor Wat,
  Stonehenge, Petra, the Moai), natural wonders (Ha Long Bay, Grand Canyon, Niagara Falls) and world landmarks (Taj
  Mahal). Each has a 6 km stage with its own grades, water stops, terrain, fixed weather and hour, and a low-poly
  3D model of the place beside the road. Out in the open (`wild`), no hotels or skyline are built.
- Unlock a stop once with coins (200 to 350). Then run it as often as you like with the same plan, route map, race
  and server replay as the daily stage. The fastest runs at a stop share the road as ghosts.
- Only your best time per stop is kept, on that stop's own board. The first finish stamps your passport and pays 60
  coins; later runs pay nothing, so the tour cannot be farmed for coins.
- Tour runs never touch the daily leaderboard, streak, quests, crew goal or weekly standings.

### Me: profile and achievements

- Your numbers (stages, km, best streak, best place), the last four weeks as a run calendar, and your best time in
  each city.
- Fourteen achievements with progress bars (First Steps, Marathoner, Week Warrior, Globetrotter, On the Podium, High
  Five Hero, Snack Attack, Bumper Car, Chatterbox, Dash Master, Team Player, Social Runner, Snow Runner…). Each pays
  50 to 150 coins once, the moment the server sees it done; the result screen lists the ones a run earned.

## Holiday season (December)

- Every December stage has falling snow under a winter sky, string lights on the km gates and decorated trees.
- Running any December stage earns a Santa hat and a pet Santa hat; reindeer antlers and a snowflake trail are in
  the shop.
- Christmas Day is the **Christmas Run**: the post title says so and finishers get double coins.

## Runner, outfits and pets

One low-poly chibi model with swappable slots, plus seven pets with their own animations and gear of their own.

- Big head, short body. Hair styles, top, hat, shoes, accessory and a running trail.
- Animations: run, tired run, fall and get up, finish celebration, idle sway.
- The name tag is the Reddit username; the bib number is on the back.

### Items

| Item                     | Slot      | How to get it              |
| ------------------------ | --------- | -------------------------- |
| Five coloured tees       | Top       | Free                       |
| Clear Raincoat           | Top       | Run a rainy stage          |
| Finisher Tee             | Top       | Run 5 of a city's 7 stages |
| Running Cap              | Hat       | 400 coins                  |
| Tokyo Hachimaki          | Hat       | Crew finishes Tokyo        |
| Paris Beret              | Hat       | Crew finishes Paris        |
| Hanoi Leaf Hat           | Hat       | Crew finishes Hanoi        |
| Dubai Sun Visor          | Hat       | Crew finishes Dubai        |
| Finish-Line Top Hat      | Hat       | 14-day streak              |
| Daily Runners            | Shoes     | Free                       |
| Kumo Glow Runners        | Shoes     | 600 coins                  |
| Striped Headband         | Accessory | 3-day streak               |
| Sport Shades             | Accessory | 300 coins                  |
| Wool Scarf               | Accessory | 500 coins                  |
| Sakura Trail             | Trail     | Top 10% of a stage         |
| Golden Leaves            | Trail     | 7-day streak               |
| Sparkle Trail            | Trail     | 900 coins                  |
| More tees and shoes      | Top/Shoes | 150 to 250 coins           |
| Navy Cap                 | Hat       | 300 coins                  |
| Bunny Ears               | Hat       | 550 coins                  |
| Party Crown              | Hat       | 1,200 coins                |
| Rose Shades, Mint Scarf  | Accessory | 350 / 450 coins            |
| Mint Bubbles, Pink Puffs | Trail     | 700 / 800 coins            |

### Pets

Nobody starts with a pet: every pet is adopted in the shop with coins, and you can own several and pick which one
runs with you (or leave them at home). Without a pet the daily treat quest is left out of your quests.

| Pet       | How it runs                             | Price       |
| --------- | --------------------------------------- | ----------- |
| Corgi     | Bounces along, barks at every km marker | 300 coins   |
| Bunny     | Hops, ears flop on every bounce         | 450 coins   |
| Tabby Cat | Sprints, stops, stares at you, sprints  | 600 coins   |
| Shiba     | Very serious about pacing, curly tail   | 750 coins   |
| Fox       | Sly sprinter with a big fluffy tail     | 1,000 coins |
| Penguin   | Waddles uphill, belly-slides downhill   | 1,200 coins |
| Panda     | Rolls along, in no hurry at all         | 1,500 coins |

**Pet gear** (one at a time, worn by whichever pet runs with you): Bell Collar 100, Bandana 150, Big Bow 200, Tiny
Cap 300, Pet Shades 350, Tiny Crown 900 coins.

- Pets and outfits **never change race times**, so the leaderboard stays fair.
- Light care loop: pet or feed your buddy after a stage. Skip a few days and it is only a little sad.
- Friendship grows with every stage you run together.

## Economy

One currency, coins 🪙, earned only by playing. (Profiles store it under the older name `badges`.)

| Action                                                          | Coins                           |
| --------------------------------------------------------------- | ------------------------------- |
| Finish a stage                                                  | 50                              |
| Rank: top 10% / top 50%                                         | +50 / +20                       |
| Streak                                                          | +10 per streak day, at most +70 |
| Crew finishes the city (each runner)                            | 200                             |
| Cheer another runner                                            | 5                               |
| Daily check-in (day 1 to 7)                                     | 20, 30, 40, 50, 60, 80, 150     |
| Daily quests                                                    | 20 to 60 each                   |
| Weekly quests                                                   | 50 to 300 each                  |
| Snack Dash (first 3 rounds a day)                               | up to 50 each                   |
| Hurdle Hop, Rhythm Steps, Pet Fetch (first 3 rounds a day each) | up to 40 each                   |

A regular player who runs, checks in and does the quests earns about 250 to 400 coins a day and can buy a
mid-priced item every day or two; the crown and the panda take about a week.

**After the hackathon:** Reddit Developer Funds reward daily engagement, which streaks and seasons fit. Premium
cosmetics through Reddit's payments once eligible. Hard rules: no loot boxes, no paid speed or stamina, no payments
outside Reddit, no ads, no real logos.

## Content: cities, terrains, weather

Five places with seven stages each, one a week; the seventh is the Triathlon Finale. Weather and the start
time change by day, so the same stage plays differently.

| City   | Palette                  | Stylised landmarks                                                               | Character                          |
| ------ | ------------------------ | -------------------------------------------------------------------------------- | ---------------------------------- |
| Tokyo  | Cherry pink, night grey  | Thunder Gate, Sky Tower, the Scramble, Five-Storey Pagoda                        | Glass towers, vertical signs       |
| Paris  | Cream, navy              | Iron Lady, Triumph Arch, White Basilica, Glass Pyramid                           | Haussmann blocks, slate roofs      |
| Hanoi  | Sunny yellow, moss green | Turtle Tower, Iron River Bridge, Temple of Scholars                              | Narrow tube houses, cables         |
| Dubai  | Sand gold, turquoise     | Needle Tower, Sail Hotel, Giant Wheel, Desert Fort                               | Sand towers, beach and desert      |
| Amazon | Leaf green, river brown  | Amazon Theatre, Giant Kapok, Canopy Walkway, Stilt Houses, Meeting of the Waters | Colonial Manaus, rainforest, river |

Next: whichever of London, New York, Seoul and Rio the crew votes for; then mountain trail and snow stages.

### Terrains

| Terrain       | Scenery                                                                        | Example stages                                      |
| ------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| 🌿 Rainforest | Tall rainforest trees, palms, banana plants, a brown river with canoes, macaws | Rainforest Trail, Canopy Climb, Stilt Village       |
| 🏙️ City       | Floor-scale buildings, shops, cross streets, traffic                           | Shibuya Scramble, Champs Sprint, Old Quarter Alleys |
| 🌳 Park       | Lawns, ponds, benches, people strolling                                        | Imperial Gardens, Sword Lake Loop                   |
| 🌲 Forest     | Dense pines, no street lamps                                                   | Meiji Forest, Vincennes Woods                       |
| 🦒 Zoo        | Fenced enclosures, giraffes, zebras, elephants that move                       | Ueno Zoo Loop, Safari Park                          |
| ⛰️ Hills      | Rolling green hills, climbs                                                    | Montmartre Climb                                    |
| 🏖️ Beach      | Sea, surf, boats, umbrellas, beach hotels                                      | Jumeirah Beach, Bluewaters Boardwalk                |
| 🏜️ Desert     | Dunes, tents, a camel caravan, date palms                                      | Desert Dunes                                        |

The desert uses date palms, shrubs, tents and camels rather than cacti: cacti belong to American deserts, not Dubai.

### Every 6 km stage has

- An elevation profile: flat, uphill and downhill sections.
- Two or three water stations.
- A landmark moment: a short caption as you pass. A visual reward, no quiz.

### Weather of the day

Picked by a random generator seeded with the date, so everyone gets the same weather.

| Weather      | Effect                                                       | On the road                     |
| ------------ | ------------------------------------------------------------ | ------------------------------- |
| Sunny, cool  | Stamina lasts longer, a fast day                             | Clear sky                       |
| Heat         | Stamina drains faster, water matters more                    | Hazy, warm light                |
| Rain         | Slippery: pushing downhill costs time; puddles               | Rain streaks, grey sky          |
| Thunderstorm | Slower everywhere, more puddles, wet downhills punish a push | Dark sky, lightning and thunder |
| Headwind     | Slower on straights and bridges                              | Leaves blowing at you           |
| Tailwind     | Faster on straights                                          | Leaves blowing with you         |

### Start time

Also picked by the date: **morning** (6:30 am), **noon** (stamina drains 12% faster), **afternoon** (5% faster,
more traffic) or **evening** (6% slower drain, lamps and shop windows glow under a dusk sky). The sky, the sun and
the soundscape follow the clock.

We brute-forced every pace plan for each stage and weather to make sure the best plan changes from day to day.

## Technology

- **Client:** React for the interface, three.js for the runners, pets, cities and terrains. All 3D is procedural
  (no model files). Geometry is merged per material, so a whole city is about 270 draw calls on a phone.
- **Server (Devvit Web, Hono):** receives the pace plan, the lane changes and the chat lines, replays the whole race
  step by step with the same items and the same runners, and records the time it computes, including the time
  added to anyone you crashed into. The client only displays; it never decides a score.
- **Scheduler:** every day at 00:01 UTC, posts and pins the new stage with a pinned strategy comment, and posts the
  recap of the day before.
- **Moderator settings** (Devvit subreddit settings, all on by default): quick chat, people/traffic/animals on the
  road, pinning each day's stage, the daily recap, and the how-to-play and celebration posts. The server applies
  them to every run and post.
- **Loading:** three.js and the procedural city load as their own chunk, fetched in idle time, so the first screen
  needs about 100 KB gzipped. In a race the world watches the frame rate and drops to a lower resolution, then no
  shadows, on slow phones.
- **Devvit Journeys:** start, plan, finish and every interaction are tracked.
- **Reddit API:** the Finisher user flair and result comments.

### Redis keys

| Key                      | Type       | Contents                                                            |
| ------------------------ | ---------- | ------------------------------------------------------------------- |
| `user:{name}`            | string     | Profile: badges, streak, look, items, pet, bib                      |
| `lb:{date}`              | sorted set | Everyone's official time that day                                   |
| `tracks:{date}`          | hash       | Each runner's track: time at each km, lane changes, chat, bib, look |
| `run:{date}:…`           | string     | Each runner's full record, including crashes                        |
| `crew:{season}`          | hash       | Crew kilometres and finish state for that city's week               |
| `cheers:{date}`          | hash       | Cheers each runner received that day                                |
| `post:{postId}`          | string     | Which day a post belongs to                                         |
| `bibs`                   | counter    | The next bib number                                                 |
| `day:{date}:post`        | string     | The stage post for that day                                         |
| `votes:{season}`         | hash       | Next-city vote counts for that week                                 |
| `voters:{season}`        | hash       | Who voted for which city that week (one vote each)                  |
| `week:{season}`          | hash       | Stages and total seconds this week per runner                       |
| `weeklb:{season}`        | sorted set | This week's standings                                               |
| `dashlb:{date}`          | sorted set | Best Snack Dash score per runner that day                           |
| `arcadelb:{game}:{date}` | sorted set | Best Hurdle Hop, Rhythm Steps or Pet Fetch score that day           |
| `club:{code}`            | string     | A running club: name, owner, members                                |
| `clubweek:{season}`      | sorted set | Clubs ranked by stages this week                                    |
| `avatars`                | hash       | Reddit avatar URLs, refreshed once a day                            |
| `history:{name}`         | hash       | A runner's past stages: time, place, field size                     |
| `stats:{date}`           | hash       | The day's counters for the recap: crashes, snacks, chat lines       |
| `recap:{date}`           | string     | The recap comment, once posted                                      |
| `welcome:post`           | string     | The pinned how-to-play post                                         |
| `celebrate:{season}`     | string     | The city celebration post                                           |
| `sub:firstDay`           | string     | The date of this subreddit's first stage (its Day 1)                |
| `tour:{id}:board`        | sorted set | Best World Tour time per runner at that stop                        |
| `tour:{id}:tracks`       | hash       | Each runner's best run at that stop, replayed as a ghost            |

### Stage simulation (deterministic, runs on client and server)

- Six one-kilometre segments, each Easy, Steady or Push.
- Stamina drains by pace, grade, weather and start time; drinking at a station restores some.
- On a Triathlon Finale each km has its leg (swim, bike, run) with its own speeds and drain, plus 30 s at T1 and T2.
- At zero stamina the runner walks and loses a lot of time.
- On top of that, a fixed-step race engine (0.5 s steps) handles lanes, items and collisions.
- The same plan, lane changes and seed always give the same time, so the server can check it.

## Risks

| Risk                                   | Warning sign                         | Response                                                                   |
| -------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| 3D stutters on mid-range phones        | Under 30 fps in testing              | Fewer runners on the road, no shadows, lower render resolution             |
| Scope grows too large                  | Full loop not done by week 2         | Cut in order: fourth city, cheers, fourth pet                              |
| Stages too easy or only one right plan | Everyone plays the same plan         | Tune stamina and weather; run the best-plan checker                        |
| Judges see an empty subreddit          | Only a few players in the demo       | Run the demo for 5–7 days; invite friends before the deadline              |
| Seen as generic "AI slop"              | Generic look, walls of text          | A palette per city, our own fonts, show don't tell                         |
| Breaking Devvit rules                  | Real logos, ads, outside payments    | Fictional brands only; check the rules before submitting                   |
| Faked times                            | Odd times on the leaderboard         | The server replays every race; the client never sends a time               |
| Pile-ups at the start                  | Repeated crashes between two runners | Spread start lanes, 500 m grace, one crash per pair, no hitting the fallen |
