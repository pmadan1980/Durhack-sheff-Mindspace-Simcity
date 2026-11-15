import { districts, type Config, type District, type Round, type TaskType } from "./simulation";

export const sceneProfiles: Record<TaskType, { work: string; doing: string; prop: "slides" | "notebook" | "charts" | "build" | "cards" | "board" | "checklist" }> = {
  presentation: { work: "Prepare slides", doing: "rehearsing the presentation", prop: "slides" },
  assignment: { work: "Assignment", doing: "working on the assignment", prop: "notebook" },
  report: { work: "Write report", doing: "writing the report", prop: "charts" },
  project: { work: "Build project", doing: "building the project", prop: "build" },
  "exam preparation": { work: "Study", doing: "preparing for the exam", prop: "cards" },
  revision: { work: "Revise", doing: "revising at the board", prop: "board" },
  task: { work: "Make progress", doing: "working through the task", prop: "checklist" },
};

/** A visual ordering of the recorded allocation, not a second resource simulation. */
export function planTrack(round: Round): District[] {
  return districts.flatMap((d) => Array.from({ length: round.policy.allocation[d] }, () => d));
}
export function splitBlock(a: Round, b: Round): number | null {
  const x = planTrack(a), y = planTrack(b);
  const index = x.findIndex((d, i) => d !== y[i]);
  return index < 0 ? null : index;
}
export function activityAt(round: Round, position: number): District | null {
  const track = planTrack(round);
  return position <= 0 ? null : track[Math.min(Math.ceil(position) - 1, track.length - 1)] ?? null;
}
export function activityCopy(d: District | null, round: Round, c: Config): string {
  if (!d) return "Ready for the day";
  if (d === "A") return sceneProfiles[c.taskType].doing;
  if (d === "C") return round.activity.connectionOpen && c.connectionLastOpenDay > 0 ? "spending time with a friend" : "the visit window is closed";
  if (d === "D") return "trying a different approach";
  return "taking a breather";
}
export function tileLabel(d: District, c: Config): string {
  return d === "A" ? sceneProfiles[c.taskType].work : d === "C" ? "Friend time" : d === "D" ? "New approach" : "Wind down";
}
