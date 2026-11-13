/**
 * The holiday season: every stage in December gets snow, lights and trees,
 * December runs earn the Santa hats, and Christmas Day is the Christmas Run
 * with double coins.
 */
export const isHolidaySeason = (dateKey: string): boolean =>
  dateKey.slice(5, 7) === '12';

export const isChristmasRun = (dateKey: string): boolean =>
  dateKey.slice(5) === '12-25';

/** Coins multiplier for a run on this day. */
export const holidayMultiplier = (dateKey: string): number =>
  isChristmasRun(dateKey) ? 2 : 1;

/** One short line for the feed card. */
export const holidayShort = (dateKey: string): string | null =>
  isChristmasRun(dateKey)
    ? '🎄 Christmas Run: double coins'
    : isHolidaySeason(dateKey)
      ? '❄️ Holiday lights all December'
      : null;

export const holidayBanner = (dateKey: string): string | null =>
  isChristmasRun(dateKey)
    ? '🎄 Christmas Run: double coins today, and snow on the road.'
    : isHolidaySeason(dateKey)
      ? '❄️ Holiday season: lights on every stage, snow where it gets cold, and Santa hats for anyone who runs in December.'
      : null;
