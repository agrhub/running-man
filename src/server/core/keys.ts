/**
 * How long the heavy per-day data lives: ghost tracks, run records, chat and
 * event stats, cheers, challenges, relays and arcade boards. A little longer
 * than the six weeks the archive shows, so every listed stage still has its
 * ghosts. Leaderboards, day posts and recaps are small and stay.
 */
export const RETAIN_DAYS = 60;
export const RETAIN_SECONDS = RETAIN_DAYS * 24 * 60 * 60;

export const keys = {
  /** Runners a moderator stopped from racing: lower-case username -> JSON {name, by, at}. */
  banned: () => 'mod:banned',
  user: (username: string) => `user:${username}`,
  /** A runner's past stages: dateKey -> {seconds, rank, runners}. */
  history: (username: string) => `history:${username}`,
  bibs: () => 'bibs',
  run: (dateKey: string, username: string) => `run:${dateKey}:${username}`,
  leaderboard: (dateKey: string) => `lb:${dateKey}`,
  tracks: (dateKey: string) => `tracks:${dateKey}`,
  crew: (season: number) => `crew:${season}`,
  cheers: (dateKey: string) => `cheers:${dateKey}`,
  postDate: (postId: string) => `post:${postId}`,
  dayPost: (dateKey: string) => `day:${dateKey}:post`,
  /** The date of this subreddit's first stage post: its Day 1. */
  firstDay: () => 'sub:firstDay',
  /** World Tour: best times per stop, and each runner's best run there. */
  tourBoard: (id: string) => `tour:${id}:board`,
  tourTracks: (id: string) => `tour:${id}:tracks`,
  /** Archive replays of a past stage: best time per runner (never the day's own board). */
  archiveBoard: (dateKey: string) => `archive:${dateKey}:board`,
  /** Best times at the free stop during its week (Monday date key), and the week's prizes once paid. */
  tourWeek: (monday: string) => `tour:week:${monday}`,
  tourWeekPaid: (monday: string) => `tour:week:${monday}:paid`,
  /** Counters for the day's recap: crashes per runner, snacks, high fives, chat lines. */
  dayStats: (dateKey: string) => `stats:${dateKey}`,
  /** Set once the day's recap comment is posted. */
  recap: (dateKey: string) => `recap:${dateKey}`,
  /** Challenges per day: lower-case username -> JSON list of {from, seconds}. */
  challenges: (dateKey: string) => `challenges:${dateKey}`,
  /** The post celebrating a finished city, once per season. */
  celebration: (season: number) => `celebrate:${season}`,
  /** The pinned how-to-play post, created once on install. */
  welcomePost: () => 'welcome:post',
  /** The stage post the guide links to now, so it is edited once a day. */
  welcomeStage: () => 'welcome:stage',
  votes: (season: number) => `votes:${season}`,
  /** Cached Reddit avatar URLs: username -> {url, day}. */
  avatars: () => 'avatars',
  /** A running club, by its join code. */
  club: (code: string) => `club:${code}`,
  /** Clubs ranked by stages run this week (stored negative). */
  clubWeek: (season: number) => `clubweek:${season}`,
  /** Today's relay legs per club: code -> legs. */
  relay: (dateKey: string) => `relay:${dateKey}`,
  /** Today's finished relays, by total time. */
  relayBoard: (dateKey: string) => `relaylb:${dateKey}`,
  /** Best Snack Dash score per runner that day (stored negative: lowest rank is best). */
  dashBoard: (dateKey: string) => `dashlb:${dateKey}`,
  /** Best score per runner that day in Hurdle Hop, Rhythm Steps or Pet Fetch. */
  arcadeBoard: (game: string, dateKey: string) => `arcadelb:${game}:${dateKey}`,
  /** Stages run and total seconds this week, per runner. */
  week: (season: number) => `week:${season}`,
  /** This week's standings: more stages first, then less total time. */
  weekBoard: (season: number) => `weeklb:${season}`,
  /** The closed week's podium and prizes, written once when the week ends. */
  weekResult: (season: number) => `weeklb:${season}:result`,
  voters: (season: number) => `voters:${season}`,
};
