/** Seconds until the next UTC midnight, when a new stage opens. */
export const secondsToNextStage = (now: number): number => {
  const d = new Date(now);
  const next = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1
  );
  return Math.max(0, Math.ceil((next - now) / 1000));
};

/** "5:07:09" style, hours not padded. */
export const formatCountdown = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
