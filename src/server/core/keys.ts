export const keys = {
  user: (username: string) => `user:${username}`,
  bibs: () => 'bibs',
  run: (dateKey: string, username: string) => `run:${dateKey}:${username}`,
  leaderboard: (dateKey: string) => `lb:${dateKey}`,
  tracks: (dateKey: string) => `tracks:${dateKey}`,
  crew: (season: number) => `crew:${season}`,
  cheers: (dateKey: string) => `cheers:${dateKey}`,
  postDate: (postId: string) => `post:${postId}`,
  dayPost: (dateKey: string) => `day:${dateKey}:post`,
  /** The pinned how-to-play post, created once on install. */
  welcomePost: () => 'welcome:post',
  votes: (season: number) => `votes:${season}`,
  /** Cached Reddit avatar URLs: username -> {url, day}. */
  avatars: () => 'avatars',
  /** A running club, by its join code. */
  club: (code: string) => `club:${code}`,
  /** Clubs ranked by stages run this week (stored negative). */
  clubWeek: (season: number) => `clubweek:${season}`,
  /** Best Snack Dash score per runner that day (stored negative: lowest rank is best). */
  dashBoard: (dateKey: string) => `dashlb:${dateKey}`,
  /** Stages run and total seconds this week, per runner. */
  week: (season: number) => `week:${season}`,
  /** This week's standings: more stages first, then less total time. */
  weekBoard: (season: number) => `weeklb:${season}`,
  voters: (season: number) => `voters:${season}`,
};
