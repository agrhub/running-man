/**
 * Quick chat during the race: preset lines only, so there is nothing to moderate. Lines are recorded with the race
 * step they were said at, and replay over the runner's head for everyone who races them later.
 */
export const QUICK_CHAT = [
  'On your left! 👋',
  'Nice pace! 👍',
  "Let's go! 🔥",
  'Sorry! 🙏',
  'Water ahead 💧',
  'Almost there! 💪',
  'Look at that view 😍',
  'See you at the finish 🏁',
] as const;

/** Lines other runners say on their own when something happens to them. */
export const REACTIONS = {
  bumped: ['Ouch! 😵', 'Watch it! 😤', 'Oof! 🤕'],
  snack: ['Yum! 😋', 'Sugar rush! ⚡'],
} as const;

export type Chat = { step: number; line: number };

export const MAX_CHATS = 20;
/** No more than one line every 4 seconds of race clock (8 steps). */
export const CHAT_GAP_STEPS = 8;

export const isValidChat = (chat: unknown): chat is Chat[] => {
  if (!Array.isArray(chat) || chat.length > MAX_CHATS) return false;
  let last = -Infinity;
  for (const c of chat) {
    if (typeof c !== 'object' || c === null || !('step' in c) || !('line' in c))
      return false;
    const { step, line } = c;
    if (typeof step !== 'number' || !Number.isInteger(step) || step < 0)
      return false;
    if (
      typeof line !== 'number' ||
      !Number.isInteger(line) ||
      line < 0 ||
      line >= QUICK_CHAT.length
    )
      return false;
    if (step - last < CHAT_GAP_STEPS) return false;
    last = step;
  }
  return true;
};
