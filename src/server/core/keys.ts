export const keys = {
  user: (username: string) => `user:${username}`,
  run: (dateKey: string, username: string) => `run:${dateKey}:${username}`,
  leaderboard: (dateKey: string) => `lb:${dateKey}`,
  ghosts: (dateKey: string) => `ghosts:${dateKey}`,
  crew: (season: number) => `crew:${season}`,
  cheers: (dateKey: string) => `cheers:${dateKey}`,
  postDate: (postId: string) => `post:${postId}`,
  dayPost: (dateKey: string) => `day:${dateKey}:post`,
};
