import { districts, type Config, type District, type Round } from "./simulation";

export interface Impact { id: string; title: string; detail: string; district: District }
const outcome = (result: boolean | null, pending: string, met: string, missed: string) =>
  result === null ? pending : result ? met : missed;

export function worldCaption(r: Round, c: Config): string {
  const task = outcome(r.after.taskResult, `Your ${c.taskType} is still taking shape`, `Your ${c.taskType} is ready`, `The ${c.taskType} deadline was missed`);
  const visit = c.connectionLastOpenDay === 0 ? "" : outcome(r.after.connectionResult, "the visit is still an open possibility", "you made room for your friend", "the visit slipped away");
  return `${task}${visit ? `; ${visit}` : ""}.`;
}

/** Editorial moments only describe differences present in the recorded outcomes. */
export function impactMoments(a: Round, b: Round, c: Config): Impact[] {
  const moments: Impact[] = [];
  if (a.after.taskResult !== b.after.taskResult || Math.abs(a.after.taskProgress - b.after.taskProgress) > 0.5)
    moments.push({ id: "task", district: "A", title: "The finish line shifts.", detail: `What happened: ${outcome(a.after.taskResult, "work still in progress", "task completed", "deadline missed")}. Your alternative: ${outcome(b.after.taskResult, "work still in progress", "task completed", "deadline missed")}.${a.after.taskResult === b.after.taskResult ? ` The alternative leaves ${b.after.taskProgress > a.after.taskProgress ? "more" : "less"} of your ${c.taskType} ready.` : ""}` });
  if (c.connectionLastOpenDay > 0 && (a.after.connectionResult !== b.after.connectionResult || Math.abs(a.after.connectionProgress - b.after.connectionProgress) > 0.1))
    moments.push({ id: "visit", district: "C", title: "Some moments don't wait.", detail: `What happened: ${outcome(a.after.connectionResult, "the visit is still possible", "the visit was protected", "the visit was missed")}. Your alternative: ${outcome(b.after.connectionResult, "the visit is still possible", "the visit was protected", "the visit was missed")}.${a.after.connectionResult === b.after.connectionResult ? " The amount of time made for your friend differs." : ""}` });
  const energy = b.after.energy - a.after.energy;
  if (Math.abs(energy) >= 0.75)
    moments.push({ id: "energy", district: "R", title: "The rhythm of recovery changes.", detail: `Your alternative ends this day with ${energy > 0 ? "more" : "less"} shared energy. Watch the mint halo ${energy > 0 ? "brighten" : "soften"}.` });
  if (Math.abs(b.after.method - a.after.method) >= 0.049)
    moments.push({ id: "method", district: "D", title: "A different route opens.", detail: `Your alternative has a ${b.after.method > a.after.method ? "stronger" : "smaller"} method multiplier. Blue branches show the method available for future work, not extra work already completed.` });
  if (!moments.length) moments.push(sameWorld(a, b)
    ? { id: "converge", district: "D", title: "These paths converge.", detail: "At this point, both worlds have the same task, visit, energy and method outcomes. A different plan doesn't always create a different destination." }
    : { id: "subtle", district: "D", title: "Small choices, subtle ripples.", detail: "The resource differences here are small. Explore the networks or inspect the model to see the traces they leave." });
  return moments;
}

export function networkStrength(r: Round, c: Config): Record<District, number> {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return { A: clamp(r.after.taskProgress / c.taskGoal), C: c.connectionGoal ? clamp(r.after.connectionProgress / c.connectionGoal) : 0, D: clamp((r.after.method - 1) / Math.max(0.001, c.methodCap - 1)), R: clamp(r.after.energy / c.energyCap) };
}
export const sameWorld = (a: Round, b: Round) => districts.every((d) => {
  const key = ({ A: "taskProgress", C: "connectionProgress", D: "method", R: "energy" } as const)[d];
  return Math.abs(a.after[key] - b.after[key]) < 1e-8;
});
