import type { Profile } from '../../shared/api';
import { EPOCH, FINISHER_STAGES, addDays, dayInfo } from '../../shared/content';
import type { Deps } from './deps';
import { gameSettings } from './game';

/** Reddit cuts user flair at 64 characters. */
export const FLAIR_MAX = 64;

/** The city of the latest season where this runner ran enough stages to finish it. */
export const finisherCity = (profile: Profile): string | null => {
  const seasons = Object.entries(profile.stagesBySeason)
    .filter(([, n]) => n >= FINISHER_STAGES)
    .map(([s]) => Number(s))
    .filter((s) => Number.isInteger(s) && s >= 0);
  if (!seasons.length) return null;
  const last = Math.max(...seasons);
  return dayInfo(addDays(EPOCH, last * 7)).city.name;
};

/**
 * A runner's user flair, e.g. "🏃 #0019 · 12 stages · 🛂 3 · 🏅 Tokyo Finisher".
 * Parts drop off from the end when it would not fit. Plain text with no commas,
 * so it is safe for Reddit's flair API.
 */
export const flairText = (profile: Profile): string | null => {
  if (profile.bib === null) return null;
  const runs = profile.totalRuns;
  const parts = [
    `🏃 #${String(profile.bib).padStart(4, '0')}`,
    runs > 0 ? `${runs} ${runs === 1 ? 'stage' : 'stages'}` : 'New runner',
  ];
  const stamps = profile.tourStamps.length;
  if (stamps > 0) parts.push(`🛂 ${stamps}`);
  const city = finisherCity(profile);
  if (city) parts.push(`🏅 ${city} Finisher`);
  while (parts.length > 1 && parts.join(' · ').length > FLAIR_MAX) parts.pop();
  return parts.join(' · ').replace(/,/g, '').slice(0, FLAIR_MAX);
};

/**
 * Updates the runner's user flair when moderators allow it. Best-effort: a
 * flair that fails to set must never fail a run.
 */
export const updateFlair = async (
  deps: Deps,
  profile: Profile
): Promise<void> => {
  const text = flairText(profile);
  if (!text) return;
  try {
    if (!(await gameSettings(deps)).runnerFlair) return;
    await deps.setFlair(profile.username, text);
  } catch (error) {
    console.error('Could not set the runner flair', error);
  }
};
