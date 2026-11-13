import type { GameSettings } from '../../shared/api';
import type { Store } from './store';

export type GameResult = { win: boolean; score: number };

/** Journey telemetry. Every call is best-effort and must never break gameplay. */
export type Telemetry = {
  start(): Promise<string | null>;
  progress(journeyId: string, progress: number, action: string): Promise<void>;
  interaction(
    journeyId: string | null,
    action: string,
    details?: string
  ): Promise<void>;
  end(journeyId: string, game: GameResult): Promise<void>;
};

export type NewPost = {
  title: string;
  fallbackText: string;
  /** App comment pinned under the post to start the strategy thread. */
  pinnedComment: string;
};

/**
 * Everything the game needs from the outside world. Devvit wires the real
 * implementations; tests and the local harness wire in-memory ones.
 */
export type Deps = {
  store: Store;
  now(): Date;
  username(): Promise<string | undefined>;
  postId(): string | undefined;
  createPost(post: NewPost): Promise<string>;
  /** Posts a plain text post as the app (the subreddit's how-to-play guide). */
  createTextPost?(title: string, text: string): Promise<string>;
  /** Replaces the body of a text post the app made (the guide's link to today's stage). */
  editTextPost?(postId: string, text: string): Promise<void>;
  /** Pins a post to a sticky slot; slot 1 is the top of the subreddit. Best-effort. */
  pin?(postId: string, slot: 1 | 2): Promise<void>;
  /** Posts a comment, preferably as the player. Returns false when it could not post. */
  comment(postId: string, text: string): Promise<boolean>;
  /** Posts a comment as the app (the daily recap). Returns the comment id. */
  appComment?(postId: string, text: string): Promise<string>;
  setFlair(username: string, text: string): Promise<void>;
  /** The subreddit's moderator settings; missing values mean the default. */
  settings?(): Promise<Partial<GameSettings>>;
  /** The player's own Reddit avatar image, when they have one. */
  avatarUrl?(username: string): Promise<string | null>;
  telemetry: Telemetry;
};

export const noTelemetry: Telemetry = {
  start: async () => null,
  progress: async () => undefined,
  interaction: async () => undefined,
  end: async () => undefined,
};
