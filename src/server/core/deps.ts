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
  /** Posts a comment, preferably as the player. Returns false when it could not post. */
  comment(postId: string, text: string): Promise<boolean>;
  setFlair(username: string, text: string): Promise<void>;
  telemetry: Telemetry;
};

export const noTelemetry: Telemetry = {
  start: async () => null,
  progress: async () => undefined,
  interaction: async () => undefined,
  end: async () => undefined,
};
