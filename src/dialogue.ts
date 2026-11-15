import { taskText } from "./simulation";
import {
  districtInfo,
  districts,
  fmt,
  forecast,
  type Activity,
  type Config,
  type District,
  type Policy,
  type Round,
  type State,
} from "./simulation";

/** Authored voices; every number they quote elsewhere comes from the model's forecasts. */
export const voices: Record<
  District,
  { line: string; wants: string; guards: string }
> = {
  A: {
    line: "Let's make progress before the deadline.",
    wants: "Turn today's time into task progress.",
    guards: "Task points",
  },
  C: {
    line: "There’s an opportunity to spend time together today. That chance closes tonight.",
    wants: "Make room for the visit while it is still possible.",
    guards: "Visit points",
  },
  D: {
    line: "A better method could make tomorrow's work easier.",
    wants: "Invest in a method that speeds up future work.",
    guards: "Method multiplier",
  },
  R: {
    line: "We share one energy reserve. Leave something for tomorrow.",
    wants: "Protect the shared energy every plan draws on.",
    guards: "Energy tokens",
  },
};

export function introLine(d: District, c: Config, day = 1): string {
  if (d !== "C") return voices[d].line;
  if (c.connectionLastOpenDay === 0) return "No visit is competing for time today.";
  if (day > c.connectionLastOpenDay) return "The visit window has closed.";
  return day === c.connectionLastOpenDay
    ? "The visit is possible today. This chance closes tonight."
    : `The visit is possible until the end of day ${c.connectionLastOpenDay}.`;
}

export type Speaker = District | "N";
export interface Line {
  speaker: Speaker;
  text: string;
  policy?: number;
  mood?: "cheer" | "sigh";
}
export const speakerName = (s: Speaker) =>
  s === "N" ? "Narrator" : districtInfo[s].name;
const signed = (n: number, places = 1) => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n), places)}`;
const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs));

/** Forecasts for the post-event start state, exactly what the election uses. */
export const forecasts = (start: State, ps: Policy[], c: Config) =>
  ps.map((p) => forecast(start, p, c));

export function debate(start: State, ps: Policy[], c: Config): Line[] {
  const f = forecasts(start, ps, c);
  const pa = argmax(ps.map((p) => p.allocation.A));
  const pc = argmax(ps.map((p) => p.allocation.C));
  const pd = argmax(ps.map((p) => p.allocation.D));
  const pr = argmax(f.map((x) => x.energyDelta));
  const A = ps[pa], fa = f[pa];
  const remaining = Math.max(0, c.taskGoal - start.taskProgress);
  const daysLeft = c.taskDeadlineDay - start.day;
  const lines: Line[] = [];
  const deadline =
    daysLeft > 0
      ? `The deadline is the end of day ${c.taskDeadlineDay}: ${daysLeft + 1} days including today.`
      : daysLeft === 0
        ? "Today is the deadline."
        : "The deadline has already passed.";
  lines.push({
    speaker: "A",
    policy: pa,
    text:
      remaining <= 0
        ? taskText(c, `The presentation is already at ${fmt(start.taskProgress)} of ${c.taskGoal} points, so it's done. I'd still back ${A.name}, but I won't pretend we're behind.`)
        : taskText(c, `Let's back ${A.name}. Its ${A.allocation.A} presentation blocks add ${fmt(fa.taskGain)} points today, ${start.taskProgress + fa.taskGain >= c.taskGoal ? "which finishes the presentation" : `leaving ${fmt(remaining - fa.taskGain)} of ${c.taskGoal} still to do`}. ${deadline}`),
  });
  if (c.connectionLastOpenDay === 0) {
    lines.push({
      speaker: "C",
      text: "You told us there's no visit competing for time, so I won't ask for visit blocks. I'm listening for what the plans cost the rest of us.",
    });
  } else if (start.day <= c.connectionLastOpenDay) {
    const need = Math.max(0, c.connectionGoal - start.connectionProgress);
    lines.push({
      speaker: "C",
      policy: pc,
      text:
        ps[pc].allocation.C === 0
          ? `No plan gives the visit any time, and the window closes ${start.day === c.connectionLastOpenDay ? "tonight" : `after day ${c.connectionLastOpenDay}`}.`
          : A.allocation.C === 0
            ? `That leaves no time for the visit${start.day === c.connectionLastOpenDay ? " before it closes tonight" : ` today, and it's only possible until day ${c.connectionLastOpenDay}`}. ${ps[pc].name} gives it ${ps[pc].allocation.C} blocks: +${fmt(f[pc].connectionGain)} of the ${fmt(need)} visit points still needed.`
            : `${A.name} gives the visit ${A.allocation.C} blocks, +${fmt(fa.connectionGain)} points. ${ps[pc].name} gives ${ps[pc].allocation.C}: +${fmt(f[pc].connectionGain)} of the ${fmt(need)} still needed.`,
    });
  } else {
    lines.push({
      speaker: "C",
      text: `The visit window closed on day ${c.connectionLastOpenDay}${start.connectionResult ? ", and we made it count" : ", and we didn't reach it"}. No plan can change that now, so I won't ask for visit blocks.`,
    });
  }
  const energyLine = (p: Policy, x: Activity) =>
    `${p.name} ${x.energyDelta < 0 ? "uses" : x.energyDelta > 0 ? "adds" : "leaves unchanged"} ${x.energyDelta === 0 ? "" : `${fmt(Math.abs(x.energyDelta))} `}shared energy: ${fmt(start.energy)} → ${fmt(start.energy + x.energyDelta)} of ${c.energyCap} tokens.`;
  lines.push({
    speaker: "R",
    policy: pr,
    text: `${start.energy === 0 ? `We're at zero. Work still happens, just at a ${fmt(fa.energyFactor, 2)}× pace. ` : ""}${energyLine(A, fa)}${pr !== pa && f[pr].energyDelta > fa.energyDelta ? ` ${energyLine(ps[pr], f[pr])}` : ""}`,
  });
  const D = ps[pd], fd = f[pd];
  lines.push({
    speaker: "D",
    policy: D.allocation.D > 0 ? pd : undefined,
    text:
      D.allocation.D === 0
        ? "None of today's plans invest in method. If tomorrow's work should be easier, edit a plan to add Discovery blocks."
        : start.method >= c.methodCap
          ? `Our method is already at its ${c.methodCap}× ceiling, so extra Discovery blocks add nothing now.`
          : start.day >= c.taskDeadlineDay
            ? `${D.name} improves the method by ${signed(fd.methodGain, 2)}×, but that only applies from tomorrow, after the deadline.`
            : taskText(c, `${D.name} puts ${D.allocation.D} blocks into method: ${signed(fd.methodGain, 2)}× on presentation work from tomorrow, not today. Today it adds ${fmt(fd.taskGain)} presentation points, against ${fmt(fa.taskGain)} for ${A.name}.`),
  });
  lines.push({
    speaker: "N",
    text: taskText(c, `Six blocks can't buy everything. Each plan trades presentation progress, ${c.connectionLastOpenDay ? "the visit, " : ""}shared energy and future method differently. Next you can change a plan, and then ${c.residentCount} residents vote.`),
  });
  return lines;
}

/** Day 2+ recap: what has changed since yesterday. */
export function sinceYesterday(prev: Round, start: State, c: Config): string[] {
  const notes: string[] = [];
  if (prev.before.day === c.connectionLastOpenDay)
    notes.push(
      `The visit window has closed. It ended at ${fmt(prev.after.connectionProgress)} of ${c.connectionGoal} points: ${prev.after.connectionResult ? "goal met" : "goal missed"}.`,
    );
  notes.push(
    start.taskProgress >= c.taskGoal
      ? taskText(c, `The presentation is complete at ${fmt(start.taskProgress)} of ${c.taskGoal} points.`)
      : taskText(c, `The presentation is at ${fmt(start.taskProgress)} of ${c.taskGoal} points, due at the end of day ${c.taskDeadlineDay}${start.day === c.taskDeadlineDay ? " (today)" : ""}.`),
  );
  notes.push(
    `Energy ended yesterday at ${fmt(prev.after.energy)} tokens. This morning: ${start.energy === prev.after.energy ? "no change" : `${signed(start.energy - prev.after.energy)} token${Math.abs(start.energy - prev.after.energy) === 1 ? "" : "s"}`}, so we start at ${fmt(start.energy)} of ${c.energyCap}.`,
  );
  if (start.method > 1)
    notes.push(
      taskText(c, `The method investment carries forward: presentation work now runs at ${fmt(start.method, 2)}×.`),
    );
  return notes;
}

export const questions = ["Why do you care today?", "What do we give up?"];
export function answer(
  d: District,
  q: number,
  start: State,
  ps: Policy[],
  c: Config,
): string {
  const f = forecasts(start, ps, c);
  const backed = argmax(ps.map((p) => d === "R" ? f[ps.indexOf(p)].energyDelta : p.allocation[d]));
  const p = ps[backed],
    x = f[backed];
  if (q === 0) {
    if (d === "A")
      return start.taskProgress >= c.taskGoal
        ? taskText(c, "Honestly, the presentation is already done. I care about keeping it that way.")
        : `We have ${fmt(start.taskProgress)} of ${c.taskGoal} points and the deadline is day ${c.taskDeadlineDay}. Every block I get today is worth ${fmt(x.energyFactor * start.method * c.achievementRate, 2)} points.`;
    if (d === "C")
      return c.connectionLastOpenDay === 0
        ? "There's no visit in this story. I still care that the plan doesn't drain the energy you share with everyone around you."
        : start.day <= c.connectionLastOpenDay
        ? `${start.day === c.connectionLastOpenDay ? "The opportunity to spend time together ends tonight." : `There’s time to meet until day ${c.connectionLastOpenDay}.`} We need ${c.connectionGoal} visit points, and each block gives ${c.connectionRate}. Once the window closes, no plan can buy this back.`
        : "The visit has passed. I still care that the plans we choose don't run you down for the people who stay.";
    if (d === "D")
      return start.method >= c.methodCap
        ? `The method is at its ${c.methodCap}× ceiling. I've done my part.`
        : taskText(c, `The method multiplier is ${fmt(start.method, 2)}×. Each Discovery block adds ${c.discoveryMethodGain}× to every presentation block from tomorrow on.`);
    return taskText(c, `Energy sets the pace. At ${fmt(start.energy)} of ${c.energyCap} tokens, each presentation block works at ${fmt(x.energyFactor, 2)}× strength. Recovery blocks restore ${c.recoveryRate} tokens each, up to the cap.`);
  }
  const best = (k: (a: Activity) => number) => argmax(f.map(k));
  const gaps = [
    { k: taskText(c, "presentation points"), v: (a: Activity) => a.taskGain },
    { k: "visit points", v: (a: Activity) => a.connectionGain },
    { k: "energy tokens", v: (a: Activity) => a.energyDelta },
    { k: "method", v: (a: Activity) => a.methodGain * 20 },
  ]
    .map((g) => ({ ...g, i: best(g.v), gap: g.v(f[best(g.v)]) - g.v(x) }))
    .filter((g) => g.gap > 0.001)
    .sort((a, b) => b.gap - a.gap);
  if (!gaps.length)
    return `${p.name}, the plan I back, doesn't lose anything measurable against the others today.`;
  const g = gaps[0];
  const amount = g.k === "method" ? `${fmt(g.gap / 20, 2)}× of method` : `${fmt(g.gap)} ${g.k}`;
  return `If ${p.name} wins, we give up ${amount} compared with ${ps[g.i].name}. That's the honest cost.`;
}

/** A short reaction when the user changes a plan; no promise that votes will move. */
export function reaction(before: Policy, after: Policy, start: State, c: Config): Line {
  const d = districts.reduce((m, k) =>
    Math.abs(after.allocation[k] - before.allocation[k]) >
    Math.abs(after.allocation[m] - before.allocation[m])
      ? k
      : m,
  );
  const [fb, fa] = [forecast(start, before, c), forecast(start, after, c)];
  const n = after.allocation[d] - before.allocation[d];
  const more = `${Math.abs(n)} ${n > 0 ? "more" : "fewer"} ${districtInfo[d].name} block${Math.abs(n) === 1 ? "" : "s"}`;
  const text =
    d === "A"
      ? taskText(c, `${more}: today's presentation forecast goes from ${fmt(fb.taskGain)} to ${fmt(fa.taskGain)} points.`)
      : d === "C"
        ? fa.connectionOpen
          ? `${more}: the visit forecast goes from ${fmt(fb.connectionGain)} to ${fmt(fa.connectionGain)} points.`
          : `${more}, but the visit window has closed, so they add nothing.`
        : d === "D"
          ? `${more}: the method gain goes from ${signed(fb.methodGain, 2)}× to ${signed(fa.methodGain, 2)}×, from tomorrow.`
          : `${more}: the energy change goes from ${signed(fb.energyDelta)} to ${signed(fa.energyDelta)} tokens.`;
  return { speaker: d, text: `${text} The residents will decide whether that changes anything.` };
}

/** Mixed reactions to the winning plan; a plan governs, not a persona. */
export function reactions(winner: number, ps: Policy[], start: State, c: Config): Line[] {
  const w = ps[winner],
    f = forecast(start, w, c);
  const pool = districts.filter((d) => d !== "C" || start.day <= c.connectionLastOpenDay);
  const fan = pool.reduce((m, d) => (w.allocation[d] > w.allocation[m] ? d : m));
  const loss = pool
    .map((d) => ({ d, gap: Math.max(...ps.map((p) => p.allocation[d])) - w.allocation[d] }))
    .sort((a, b) => b.gap - a.gap)[0];
  const says = (d: District) =>
    d === "A"
      ? taskText(c, `+${fmt(f.taskGain)} presentation points today`)
      : d === "C"
        ? `+${fmt(f.connectionGain)} visit points before tonight`
        : d === "D"
          ? `${signed(f.methodGain, 2)}× method from tomorrow`
          : `${signed(f.energyDelta)} energy tokens`;
  const lines: Line[] = [
    { speaker: fan, mood: "cheer", text: `${w.name} gives me ${w.allocation[fan]} of the ${c.dailyBudget} blocks: ${says(fan)}.` },
  ];
  if (loss && loss.gap > 0 && loss.d !== fan)
    lines.push({
      speaker: loss.d,
      mood: "sigh",
      text: `Another plan offered me ${loss.gap} more block${loss.gap === 1 ? "" : "s"}. With ${w.allocation[loss.d]}, it's ${says(loss.d)}. I'll live with it.`,
    });
  if (fan !== "R" && loss?.d !== "R")
    lines.push({ speaker: "R", text: `Either way, we end today with ${fmt(start.energy + f.energyDelta)} of ${c.energyCap} energy tokens.` });
  return lines;
}
