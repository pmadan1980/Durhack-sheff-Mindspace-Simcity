import { taskText } from "./simulation";
import { fmt, type Config, type District, type Round } from "./simulation";

export interface Memory {
  id: string;
  district: District;
  day: number;
  choice: string;
  manual: boolean;
  title: string;
  outcome: string;
}

// Only completed numerical events enter the wall, never campaign forecasts.
export function memoriesFor(rounds: Round[], c: Config): Memory[] {
  return rounds.flatMap((r) => {
    const memories: Memory[] = [];
    const add = (district: District, title: string, outcome: string) =>
      memories.push({
        id: `${r.id}-${district}`,
        district,
        day: r.before.day,
        choice: r.policy.name,
        manual: r.manual,
        title,
        outcome,
      });
    const milestone = [c.taskGoal, c.taskGoal / 2].find(
      (n) => r.start.taskProgress < n && r.after.taskProgress >= n,
    );
    if (milestone !== undefined)
      add(
        "A",
        milestone === c.taskGoal
          ? taskText(c, `Presentation ready on day ${r.before.day}`)
          : taskText(c, `Presentation halfway on day ${r.before.day}`),
        taskText(c, `${fmt(r.after.taskProgress)} / ${c.taskGoal} presentation points. ${r.after.taskResult === false ? `The day-${c.taskDeadlineDay} deadline was missed.` : `Reached on day ${r.before.day}; deadline: day ${c.taskDeadlineDay}.`}`),
      );
    if (r.activity.connectionGain > 0)
      add(
        "C",
        r.after.connectionProgress >= c.connectionGoal
          ? `Visit goal met (+${fmt(r.activity.connectionGain)})`
          : `Time with your friend (+${fmt(r.activity.connectionGain)})`,
        `+${fmt(r.activity.connectionGain)} visit points; ${fmt(r.after.connectionProgress)} / ${c.connectionGoal} reached before the window closed.`,
      );
    if (r.activity.methodGain > 0)
      add(
        "D",
        `Method improved to ${fmt(r.after.method, 2)}×`,
        `${fmt(r.start.method, 2)}× → ${fmt(r.after.method, 2)}× method. Available from the next day, not retroactively.`,
      );
    if (r.activity.restored > 0)
      add(
        "R",
        `${fmt(r.activity.restored)} energy restored`,
        `${fmt(r.activity.restored)} energy replenished after costs and the cap. Net change: ${r.activity.energyDelta >= 0 ? "+" : ""}${fmt(r.activity.energyDelta)}; ended at ${fmt(r.after.energy)} / ${c.energyCap}.`,
      );
    return memories;
  });
}
