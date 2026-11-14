import { CITIES, type DayInfo } from '../../shared/content';
import { cityAt } from '../lib/geo';
import { TOUR, tourById } from '../../shared/tour';
import { AreaMap, WorldMap } from './PlaceMap';

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
          label={`World map with the ${TOUR.length} World Tour places; this run is at ${stop.stage.landmark.name}, ${stop.country}.`}
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
                    title: `${s.stage.landmark.name}, ${s.country}`,
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
            label={`Map of ${stop.place}, ${stop.country}, with ${stop.stage.landmark.name}.`}
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
        label={`World map of the five-city rotation; this week is ${city.name}, ${city.country}.`}
        pins={CITIES.map((c) => ({
          at: cityAt(c),
          tone: c.id === city.id ? 'now' : 'other',
          title: `${c.name}, ${c.country}`,
          ...(c.id === city.id ? { label: `${c.flag} ${c.name}` } : {}),
        }))}
      />
      <AreaMap
        area={city.id}
        path
        label={`Map of ${city.name} with this week's seven stages at their landmarks; today is stage ${day.stageIndex + 1}, ${day.stage.landmark.name}.`}
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
                  title: `Stage ${i + 1}: ${s.name}, ${s.landmark.name}`,
                  ...(i === day.stageIndex ? { label: s.landmark.name } : {}),
                },
              ]
            : []
        )}
      />
    </div>
  );
};
