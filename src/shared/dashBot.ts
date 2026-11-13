import { dashCourse, isDashSnack, type DashLane, type DashMove } from './dash';

/** A bot that heads for the snack (or a free lane) on every beat. */
export const botMoves = (date: string, round: number): DashMove[] => {
  const course = dashCourse(date, round);
  const moves: DashMove[] = [];
  let lane: DashLane = 0;
  const steps = [...new Set(course.map((i) => i.hitStep))].sort(
    (a, b) => a - b
  );
  for (const step of steps) {
    const here = course.filter((i) => i.hitStep === step);
    const snack = here.find((i) => isDashSnack(i.kind));
    const blocked = new Set(
      here.filter((i) => !isDashSnack(i.kind)).map((i) => i.lane)
    );
    const target: DashLane = snack
      ? snack.lane
      : blocked.has(lane)
        ? (([-1, 0, 1] as DashLane[]).find((l) => !blocked.has(l)) ?? lane)
        : lane;
    if (target !== lane) {
      moves.push({ step, lane: target });
      lane = target;
    }
  }
  return moves;
};
