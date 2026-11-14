import { COIN, type Unlock } from '../../shared/economy';
import { tr } from '../i18n';

/** How an item or pet is unlocked, in the player's language. */
export const unlockText = (unlock: Unlock): string => {
  switch (unlock.kind) {
    case 'free':
      return tr('Free');
    case 'badges':
      return `${unlock.cost} ${COIN}`;
    case 'streak':
      return tr('{n}-day streak', { n: unlock.days });
    case 'cityFinish':
      return tr('Crew finishes {city}', {
        city: tr(unlock.city[0]!.toUpperCase() + unlock.city.slice(1)),
      });
    case 'finisher':
      return tr('Run 5 of 7 stages in one city');
    case 'weather':
      return tr('Run a {weather} stage', { weather: tr(unlock.weather) });
    case 'top10':
      return tr('Finish in the top 10% of a stage');
    case 'holiday':
      return tr('Run a stage in December');
  }
};
