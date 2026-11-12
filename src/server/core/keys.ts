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
  votes: (season: number) => `votes:${season}`,
  voters: (season: number) => `voters:${season}`,
};
