import { CITIES, type DayInfo } from '../../shared/content';
import { cityAt } from '../lib/geo';
import { TOUR, tourById } from '../../shared/tour';
import { AreaMap, WorldMap } from './PlaceMap';
import { tr } from '../i18n';

type Props = {
  day: DayInfo;
  /** A World Tour stop instead of the daily stage. */
  tourId?: string | undefined;
  stamps: string[];
};

/**
 * Where today's run is, on real maps: the world with every city of the rotation
 * (or every World Tour stop), then a close map of the city with the week's seven
 * stages at their real landmarks, today's highlighted.
 */
export const StageMaps = ({ day, tourId, stamps }: Props) => {
  const stop = tourId ? tourById(tourId) : undefined;
  if (stop) {
    const at = stop.stage.landmark.at;
    return (
      <div className="flex flex-col gap-2">
        <WorldMap
          label={tr(
            'World map with the {n} World Tour places; this run is at {place}, {country}.',
            {
              n: TOUR.length,
              place: tr(stop.stage.landmark.name),
              country: tr(stop.country),
            }
          )}
          pins={TOUR.flatMap((s) =>
            s.stage.landmark.at
              ? [
                  {
                    at: s.stage.landmark.at,
                    tone:
                      s.id === stop.id
                        ? ('now' as const)
                        : stamps.includes(s.id)
                          ? ('done' as const)
                          : ('other' as const),
                    title: `${tr(s.stage.landmark.name)}, ${tr(s.country)}`,
                    ...(s.id === stop.id
                      ? { label: s.stage.landmark.name }
                      : {}),
                  },
                ]
              : []
          )}
        />
        {at && (
          <AreaMap
            area={stop.id}
            label={tr('Map of {area}, {country}, with {place}.', {
              area: tr(stop.place),
              country: tr(stop.country),
              place: tr(stop.stage.landmark.name),
            })}
            pins={[
              {
                at,
                tone: 'now',
                title: stop.stage.landmark.name,
                label: stop.stage.landmark.name,
              },
            ]}
          />
        )}
      </div>
    );
  }

  const { city } = day;
  return (
    <div className="flex flex-col gap-2">
      <WorldMap
        path
        label={tr(
          'World map of the five-city rotation; this week is {city}, {country}.',
          { city: tr(city.name), country: tr(city.country) }
        )}
        pins={CITIES.map((c) => ({
          at: cityAt(c),
          tone: c.id === city.id ? 'now' : 'other',
          title: `${tr(c.name)}, ${tr(c.country)}`,
          ...(c.id === city.id ? { label: `${c.flag} ${tr(c.name)}` } : {}),
        }))}
      />
      <AreaMap
        area={city.id}
        path
        label={tr(
          "Map of {city} with this week's seven stages at their landmarks; today is stage {n}, {place}.",
          {
            city: tr(city.name),
            n: day.stageIndex + 1,
            place: tr(day.stage.landmark.name),
          }
        )}
        pins={city.stages.flatMap((s, i) =>
          s.landmark.at
            ? [
                {
                  at: s.landmark.at,
                  mark: String(i + 1),
                  tone:
                    i === day.stageIndex
                      ? ('now' as const)
                      : i < day.stageIndex
                        ? ('done' as const)
                        : ('other' as const),
                  title: tr('Stage {n}: {stage}, {place}', {
                    n: i + 1,
                    stage: tr(s.name),
                    place: tr(s.landmark.name),
                  }),
                  ...(i === day.stageIndex ? { label: s.landmark.name } : {}),
                },
              ]
            : []
        )}
      />
    </div>
  );
};
