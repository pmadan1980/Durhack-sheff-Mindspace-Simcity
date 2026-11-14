export const districts = ["A", "C", "D", "R"] as const;
export type District = (typeof districts)[number];
export type Allocation = Record<District, number>;
export const districtInfo = {
  A: {
    name: "Achievement",
    color: "#ffc531",
    symbol: "△",
    voice: "Melody",
    purpose: "Turn time into progress.",
  },
  C: {
    name: "Connection",
    color: "#ff7f8f",
    symbol: "◎",
    voice: "Call & response",
    purpose: "Make room for someone.",
  },
  D: {
    name: "Discovery",
    color: "#4a90ff",
    symbol: "✧",
    voice: "Counterline",
    purpose: "Find a different way.",
  },
  R: {
    name: "Recovery",
    color: "#5fe3b4",
    symbol: "≈",
    voice: "Bass & sustain",
    purpose: "Replenish what is shared.",
  },
};
export const taskTypes = ["presentation", "assignment", "report", "project", "exam preparation", "revision", "task"] as const;
export type TaskType = typeof taskTypes[number];
export function inferTaskType(text: string): TaskType {
  const match = text.match(/\b(presentation|assignment|essay|report|project|exam|revision)\b/i)?.[1].toLowerCase();
  return match === "essay" ? "assignment" : match === "exam" ? "exam preparation" : (match as TaskType | undefined) ?? "task";
}
/** Use the confirmed task identity everywhere, preserving sentence/title casing. */
export function taskText(c: { taskType: TaskType }, text: string): string {
  return text.replace(/\bpresentation\b/gi, (word) =>
    word === word.toUpperCase() ? c.taskType.toUpperCase() :
    word[0] === word[0].toUpperCase() ? c.taskType[0].toUpperCase() + c.taskType.slice(1) : c.taskType);
}

export const config = {
  taskType: "presentation" as TaskType,
  modelVersion: "mindspace-v1",
  dailyBudget: 6,
  energyCap: 12,
  taskGoal: 12,
  taskDeadlineDay: 3,
  connectionGoal: 3,
  connectionLastOpenDay: 1,
  methodCap: 1.6,
  residentCount: 24,
  campaignSeconds: 18,
  voteSeconds: 4,
  resolutionSeconds: 8,
  guidedCountSeconds: 10,
  daySeconds: 30,
  speedOptions: [0.5, 1, 2],
  maxDays: 14,
  historyLimit: 14,
  seed: 4242,
  achievementRate: 2,
  energyFactorFloor: 0.25,
  energyFactorRange: 0.75,
  connectionRate: 1.5,
  recoveryRate: 1.5,
  achievementEnergyCost: 0.9,
  connectionEnergyCost: 0.4,
  discoveryEnergyCost: 0.7,
  discoveryMethodGain: 0.05,
};
export type Config = typeof config;
export interface Setup {
  taskType: TaskType;
  scenarioId: string;
  energy: number;
  taskProgress: number;
  energyCap: number;
  /** Confirmed in the clarification step: the presentation is due at the end of this day. */
  taskDeadlineDay: number;
  /** Last day a competing visit is possible; 0 means there is no visit. */
  visitLastDay: number;
}
export const maxDeadlineDay = 5;
export const scenarios = [
  {
    id: "presentation-and-friend",
    label: "A task & a visit",
    taskProgress: 0,
    summary:
      "Your task is due in three days. A friend is in town for just one. How will your world make room for both?",
  },
  {
    id: "almost-prepared",
    label: "A little head start",
    taskProgress: 10,
    summary:
      "The same deadline and visit, with most of your task already done.",
  },
];
export const judgeSetup: Setup = {
  taskType: "presentation",
  scenarioId: scenarios[0].id,
  energy: 8,
  taskProgress: 0,
  energyCap: 12,
  taskDeadlineDay: config.taskDeadlineDay,
  visitLastDay: config.connectionLastOpenDay,
};
// Literal, disclosed keyword rules for the authored dilemma; not semantic AI interpretation.
export function thoughtSignals(text: string) {
  return {
    prepared: /\b(almost done|nearly done|head start|already prepared)\b/i.test(text),
    tired: /\b(tired|exhausted|burnt out|burned out)\b/i.test(text),
    visit: /\b(friend|friends|visit|visiting|visitor|guest)\b/i.test(text),
  };
}
export function setupForThought(text: string, setup: Setup): Setup {
  const { prepared, tired } = thoughtSignals(text);
  return {
    ...setup,
    taskType: inferTaskType(text),
    scenarioId: scenarios[prepared ? 1 : 0].id,
    taskProgress: prepared ? 10 : 0,
    energy: tired ? Math.min(4, setup.energyCap) : setup.energy,
  };
}
export interface Policy {
  id: string;
  name: string;
  description: string;
  allocation: Allocation;
}
export const policies: Policy[] = [
  {
    id: "prepare",
    name: "Prepare now",
    description: "Give your task a head start.",
    allocation: { A: 4, C: 0, D: 0, R: 2 },
  },
  {
    id: "visit",
    name: "Protect the visit",
    description: "Progress, with room for your friend.",
    allocation: { A: 2, C: 2, D: 0, R: 2 },
  },
  {
    id: "method",
    name: "Improve the method",
    description: "Trade a little today for a different tomorrow.",
    allocation: { A: 2, C: 1, D: 2, R: 1 },
  },
];
export interface State {
  id: string;
  day: number;
  energy: number;
  taskProgress: number;
  connectionProgress: number;
  method: number;
  taskResult: boolean | null;
  connectionResult: boolean | null;
}
export interface Activity {
  energyFactor: number;
  taskGain: number;
  connectionGain: number;
  energyDelta: number;
  restored: number;
  methodGain: number;
  connectionOpen: boolean;
}
export interface Resident {
  id: string;
  district: District;
  weights: Allocation;
}
// Archetypes are mixed across district identities; membership never determines a vote.
const archetypes: Allocation[] = [
  { A: 0.65, C: 0.12, D: 0.08, R: 0.15 },
  { A: 0.15, C: 0.65, D: 0.05, R: 0.15 },
  { A: 0.2, C: 0.1, D: 0.6, R: 0.1 },
  { A: 0.18, C: 0.17, D: 0.1, R: 0.55 },
  { A: 0.35, C: 0.35, D: 0.1, R: 0.2 },
  { A: 0.4, C: 0.15, D: 0.3, R: 0.15 },
];
export function residents(c: Config): Resident[] {
  return Array.from({ length: c.residentCount }, (_, i) => ({
    id: `resident-${i + 1}`,
    district: districts[Math.floor(i / 6) % 4],
    weights: { ...archetypes[(i + c.seed) % archetypes.length] },
  }));
}
export function validateSetup(s: Setup): string | null {
  if (!taskTypes.includes(s.taskType)) return "Choose a supported task type.";
  if (!scenarios.some((x) => x.id === s.scenarioId))
    return "Choose an authored scenario.";
  if (!Number.isFinite(s.energyCap) || s.energyCap <= 0 || s.energyCap > 30)
    return "Energy capacity must be greater than 0 and at most 30.";
  if (!Number.isFinite(s.energy) || s.energy < 0 || s.energy > s.energyCap)
    return "Starting energy must be between 0 and its capacity.";
  if (
    !Number.isFinite(s.taskProgress) ||
    s.taskProgress < 0 ||
    s.taskProgress > config.taskGoal
  )
    return `Starting progress must be between 0 and ${config.taskGoal}.`;
  if (
    !Number.isInteger(s.taskDeadlineDay) ||
    s.taskDeadlineDay < 1 ||
    s.taskDeadlineDay > maxDeadlineDay
  )
    return `The deadline must be a day from 1 to ${maxDeadlineDay}.`;
  if (
    !Number.isInteger(s.visitLastDay) ||
    s.visitLastDay < 0 ||
    s.visitLastDay > s.taskDeadlineDay
  )
    return "The visit must end on or before the deadline day.";
  return null;
}
export function validatePolicy(p: Policy, c: Config): string | null {
  const values = districts.map((d) => p.allocation[d]);
  if (values.some((v) => !Number.isFinite(v) || !Number.isInteger(v) || v < 0))
    return "Use nonnegative whole time blocks.";
  return values.reduce((a, b) => a + b, 0) === c.dailyBudget
    ? null
    : `Allocate exactly ${c.dailyBudget} time blocks.`;
}
export function createWorld(setup: Setup): { state: State; rules: Config } {
  const error = validateSetup(setup);
  if (error) throw new Error(error);
  return {
    rules: {
      ...config,
      taskType: setup.taskType,
      energyCap: setup.energyCap,
      taskDeadlineDay: setup.taskDeadlineDay,
      connectionLastOpenDay: setup.visitLastDay,
      connectionGoal: setup.visitLastDay > 0 ? config.connectionGoal : 0,
    },
    state: {
      id: "world-a",
      day: 1,
      energy: setup.energy,
      taskProgress: setup.taskProgress,
      connectionProgress: 0,
      method: 1,
      taskResult: setup.taskProgress >= config.taskGoal ? true : null,
      connectionResult: null,
    },
  };
}
const clamp = (x: number, min: number, max: number) =>
  Math.max(min, Math.min(max, x));
export function externalEvent(day: number, c: Config = config) {
  if (day === c.taskDeadlineDay && day > 1)
    return {
      id: "the-final-stretch",
      name: "The final stretch",
      detail: "Last-minute logistics use 1 energy token before the election.",
      energy: -1,
    };
  if (day === 2)
    return {
      id: "a-quiet-morning",
      name: "A quiet morning",
      detail:
        "An unexpected free moment adds 1 energy token before the election.",
      energy: 1,
    };
  const visit =
    c.connectionLastOpenDay < 1
      ? ""
      : c.connectionLastOpenDay === 1
        ? "The visit is available today only. "
        : `The visit is available until the end of day ${c.connectionLastOpenDay}. `;
  return {
    id: `ordinary-${day}`,
    name: day === 1 ? (visit ? "A friend arrives" : "Day one") : "An open day",
    detail:
      day === 1
        ? taskText(c, `${visit}The presentation is due at the end of day ${c.taskDeadlineDay}.`)
        : "No external resource changes today.",
    energy: 0,
  };
}
export function actionState(state: State, c: Config): State {
  return {
    ...state,
    energy: clamp(
      state.energy + externalEvent(state.day, c).energy,
      0,
      c.energyCap,
    ),
  };
}
export function proposalsForDay(
  day: number,
  source = policies,
  c: Config = config,
): Policy[] {
  // Without any visit, the authored visit plan is not offered at all.
  return source
    .filter((p) => c.connectionLastOpenDay > 0 || p.id !== "visit")
    .map((p) => ({
    ...p,
    allocation:
      day > c.connectionLastOpenDay
        ? { ...p.allocation, A: p.allocation.A + p.allocation.C, C: 0 }
        : { ...p.allocation },
  }));
}
/** Terminal worlds stay inspectable, but cannot start another simulated day. */
export function isWorldComplete(s: State, c: Config): boolean {
  return s.taskResult !== null || s.taskProgress >= c.taskGoal ||
    s.day > Math.min(c.taskDeadlineDay, c.maxDays);
}

export function forecast(s: State, p: Policy, c: Config): Activity {
  const a = p.allocation;
  const energyFactor =
    c.energyFactorFloor + (c.energyFactorRange * s.energy) / c.energyCap;
  const cost =
    c.achievementEnergyCost * a.A +
    c.connectionEnergyCost * a.C +
    c.discoveryEnergyCost * a.D;
  const delta = c.recoveryRate * a.R - cost;
  return {
    energyFactor,
    taskGain: Math.min(
      Math.max(0, c.taskGoal - s.taskProgress),
      c.achievementRate * a.A * energyFactor * s.method,
    ),
    connectionGain:
      s.day <= c.connectionLastOpenDay
        ? Math.min(Math.max(0, c.connectionGoal - s.connectionProgress), c.connectionRate * a.C)
        : 0,
    energyDelta: clamp(s.energy + delta, 0, c.energyCap) - s.energy,
    // Audible/visual replenishment is the contribution that survives the cap.
    restored:
      clamp(s.energy + delta, 0, c.energyCap) -
      clamp(s.energy - cost, 0, c.energyCap),
    methodGain:
      Math.min(c.methodCap, s.method + c.discoveryMethodGain * a.D) - s.method,
    connectionOpen: s.day <= c.connectionLastOpenDay,
  };
}
export interface Ballot {
  resident: Resident;
  utilities: number[];
  choice: number;
  signals: Allocation[];
}
export interface Election {
  counts: number[];
  winner: number;
  ballots: Ballot[];
  tied: boolean;
}
export function elect(s: State, ps: Policy[], c: Config): Election {
  if (ps.length === 0 || ps.some((p) => validatePolicy(p, c)))
    throw new Error("Election needs valid proposals.");
  const safe = (value: number, bound: number) =>
    bound > 0 ? value / bound : 0;
  const signals = ps.map((p) => {
    const f = forecast(s, p, c);
    return {
      A: safe(
        Math.min(f.taskGain, Math.max(0, c.taskGoal - s.taskProgress)),
        c.achievementRate *
          c.dailyBudget *
          (c.energyFactorFloor + c.energyFactorRange) *
          c.methodCap,
      ),
      C: safe(
        Math.min(
          f.connectionGain,
          Math.max(0, c.connectionGoal - s.connectionProgress),
        ),
        c.connectionRate * c.dailyBudget,
      ),
      D: safe(f.methodGain, c.discoveryMethodGain * c.dailyBudget),
      R: safe(f.energyDelta, c.recoveryRate * c.dailyBudget),
    };
  });
  const ballots = residents(c).map((resident) => {
    const utilities = signals.map((sig) =>
      districts.reduce((sum, d) => sum + resident.weights[d] * sig[d], 0),
    );
    return {
      resident,
      utilities,
      signals,
      choice: utilities.indexOf(Math.max(...utilities)),
    };
  });
  const counts = ps.map((_, i) => ballots.filter((b) => b.choice === i).length);
  const highest = Math.max(...counts);
  return {
    ballots,
    counts,
    winner: counts.indexOf(highest),
    tied: counts.filter((v) => v === highest).length > 1,
  };
}
export interface Round {
  id: string;
  before: State;
  start: State;
  after: State;
  policies: Policy[];
  election: Election;
  policy: Policy;
  activity: Activity;
  external: ReturnType<typeof externalEvent>;
  manual: boolean;
  events: {
    id: string;
    label: string;
    amount: number;
    unit: string;
    district: District;
  }[];
}
export function resolve(
  state: State,
  ps: Policy[],
  c: Config,
  intervention?: string,
): Round {
  if (state.day > c.maxDays)
    throw new Error("This world has reached its last day.");
  if (isWorldComplete(state, c))
    throw new Error("This scenario is complete; start a new thought to play again.");
  const start = actionState(state, c);
  const election = elect(start, ps, c);
  const policy = intervention
    ? ps.find((p) => p.id === intervention)
    : ps[election.winner];
  if (!policy || validatePolicy(policy, c))
    throw new Error("Choose a valid proposal.");
  const activity = forecast(start, policy, c);
  const after: State = {
    ...start,
    day: start.day + 1,
    energy: start.energy + activity.energyDelta,
    taskProgress: Math.min(c.taskGoal, start.taskProgress + activity.taskGain),
    connectionProgress: Math.min(c.connectionGoal, start.connectionProgress + activity.connectionGain),
    method: start.method + activity.methodGain,
    taskResult:
      start.taskResult ??
      (start.taskProgress + activity.taskGain >= c.taskGoal
        ? true
        : start.day >= c.taskDeadlineDay ? false : null),
    connectionResult:
      start.connectionResult ??
      (start.day === c.connectionLastOpenDay
        ? start.connectionProgress + activity.connectionGain >= c.connectionGoal
        : null),
  };
  const id = `${state.id}-day-${state.day}${intervention ? `-branch-${intervention}` : ""}`;
  return structuredClone({
    id,
    before: state,
    start,
    after,
    policies: ps,
    election,
    policy,
    activity,
    external: externalEvent(state.day, c),
    manual: intervention !== undefined,
    events: [
      {
        id: `${id}-task`,
        label: taskText(c, "Presentation advanced"),
        amount: activity.taskGain,
        unit: "points",
        district: "A",
      },
      {
        id: `${id}-visit`,
        label: activity.connectionOpen
          ? "Visit advanced"
          : "Visit window closed",
        amount: activity.connectionGain,
        unit: "points",
        district: "C",
      },
      {
        id: `${id}-method`,
        label: "Method acquired for future days",
        amount: activity.methodGain,
        unit: "×",
        district: "D",
      },
      {
        id: `${id}-energy`,
        label: "Net shared energy change",
        amount: activity.energyDelta,
        unit: "tokens",
        district: "R",
      },
    ],
  } satisfies Round);
}
export function branch(round: Round, policyId: string, c: Config): Round {
  const result = resolve(
    structuredClone(round.before),
    round.policies,
    c,
    policyId,
  );
  result.after.id = "world-b";
  return result;
}
// A counterfactual horizon: force one recorded day's policy, then let residents
// vote normally on the same recorded proposals for every later baseline day.
export function replay(
  history: Round[],
  day: number,
  policyId: string,
  c: Config,
  lastDay = c.taskDeadlineDay,
): { a: Round[]; b: Round[] } {
  const a = history.filter(
    (r) => r.before.day >= day && r.before.day <= lastDay,
  );
  if (!a.length || a[0].before.day !== day)
    throw new Error("Choose a completed day to change.");
  const b = [branch(a[0], policyId, c)];
  for (const r of a.slice(1)) {
    if (isWorldComplete(b.at(-1)!.after, c)) break;
    b.push(resolve(structuredClone(b.at(-1)!.after), r.policies, c));
  }
  // Compare only the shared active horizon; never run a completed branch again.
  return { a: structuredClone(a.slice(0, b.length)), b };
}
export const fmt = (n: number, places = 1) =>
  Number(n.toFixed(places)).toLocaleString("en-GB", {
    maximumFractionDigits: places,
  });
