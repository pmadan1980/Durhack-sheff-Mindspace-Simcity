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
  const aliases: Record<string, TaskType> = {
    presentation: "presentation", slides: "presentation", talk: "presentation",
    assignment: "assignment", coursework: "assignment", essay: "assignment",
    report: "report", project: "project", exam: "exam preparation", test: "exam preparation",
    revision: "revision", revising: "revision",
  };
  const matches = text.toLowerCase().match(/\b(presentation|slides|talk|assignment|coursework|essay|report|project|exam|test|revision|revising)\b/g) ?? [];
  const options = [...new Set(matches.map(match => aliases[match]))];
  return options.length === 1 ? options[0] : "task";
}
/** Use the confirmed task identity everywhere, preserving sentence/title casing. */
export function taskText(c: { taskType: TaskType }, text: string): string {
  return text.replace(/\bpresentation\b/gi, (word) =>
    word === word.toUpperCase() ? c.taskType.toUpperCase() :
    word[0] === word[0].toUpperCase() ? c.taskType[0].toUpperCase() + c.taskType.slice(1) : c.taskType);
}

export const config = {
  taskType: "presentation" as TaskType,
  modelVersion: "mindspace-v2-residents",
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
// Suggest editable context from explicit phrases. Ambiguous wording stays at the default.
export function thoughtSignals(text: string) {
  const words = text.toLowerCase().replace(/’/g, "'");
  const noVisit = /\b(?:no|without)\s+(?:(?:a|any|my)\s+)?(?:friends?|visits?|visitors?|guests?)\b|\bnot\s+visiting\b|\bvisit\s+(?:is\s+)?(?:cancelled|canceled)\b/;
  const visit = /\b(?:a|the|our|my|their) visit\b|\bvisiting (?:me|us|today|tomorrow)\b|\b(?:friends?|visitors?|guests?)\b[^.!?;]{0,18}\b(?:is (?:only )?here|are (?:only )?here|is visiting|are visiting|in town|is leaving|are leaving|leaves|leave|coming over)\b|\b(?:meet|see|visit) (?:my|a) friend\b/;
  const familyTime = /\b(?:time|dinner|lunch|evening) with (?:my |our |the )?(?:family|parents|siblings|relatives)\b|\bfamily (?:occasion|dinner|event|gathering)\b/;
  const noFamilyTime = /\b(?:no|without) (?:time|dinner|lunch|evening) with\b|\b(?:cannot|can't|won't) (?:spend time|have dinner|have lunch) with\b|\bfamily (?:occasion|dinner|event|gathering) (?:was |is )?(?:cancelled|canceled)\b/;
  const invitation = /\b(?:friend|friends) invited (?:me|us)\b/;
  const suggestedDay = words.match(/\b(?:due|deadline(?: is)?|hand (?:it )?in|submit(?: it)?)\s+(?:(?:by|on)\s+)?(today|tonight|tomorrow|in (?:[1-9]\d*|one|two|three|four|five) days?)\b/) ??
    words.match(/\b(?:exam|test|presentation) (?:is )?(today|tonight|tomorrow)\b/);
  const relative = suggestedDay?.[1];
  const days = ["one", "two", "three", "four", "five"];
  const amount = relative?.split(" ")[1];
  const day = relative === "today" || relative === "tonight" ? 1 : relative === "tomorrow" ? 2 :
    amount ? (Number(amount) || days.indexOf(amount) + 1) + 1 : undefined;
  return {
    prepared: !/\b(?:not|nowhere near)\s+(?:almost |nearly |already )?(?:done|finished|prepared|ready)\b/.test(words) &&
      /\b(almost done|nearly done|almost finished|nearly finished|head start|already prepared)\b/.test(words),
    tired: !/\b(?:not|never|(?:is|are|was|were|do|does|am)n['’]t)\s+(?:really |very |that )?(?:tired|exhausted|drained)\b/.test(words) &&
      /\b(tired|exhausted|drained|burnt out|burned out|low on energy)\b/.test(words),
    visit: !noVisit.test(words) && (visit.test(words) || invitation.test(words) ||
      (familyTime.test(words) && !noFamilyTime.test(words))),
    deadline: day !== undefined && day <= maxDeadlineDay ? day : undefined,
  };
}
export function setupForThought(text: string, setup: Setup): Setup {
  const { prepared, tired, visit, deadline } = thoughtSignals(text);
  const taskDeadlineDay = deadline ?? setup.taskDeadlineDay;
  return {
    ...setup,
    taskType: inferTaskType(text),
    taskDeadlineDay,
    visitLastDay: visit ? Math.max(1, Math.min(setup.visitLastDay || 1, taskDeadlineDay)) : 0,
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
    description: "Progress, with room for time together.",
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
  name: string;
  background: string;
  district: District;
  weights: Allocation;
}
const residentNames=["Ari","Mina","Theo","Zara","Kai","Nia","Leo","Isha","Noor","Finn","Remy","Luca","Ada","Ravi","Esme","Jules","Sami","Mei","Otis","Lina","Eden","Rory","Yara","Alex"];
const residentMotives:Record<District,string[]>={
  A:["Likes to finish one thing before starting another.","Feels better with a clear plan for the deadline.","Protects focused time when something matters.","Would rather make steady progress than rush later.","Likes turning a difficult task into small wins.","Wants commitments to have a clear finish line."],
  C:["Makes room for time that cannot be rescheduled.","Values showing up when someone is counting on them.","Protects opportunities to spend time together.","Tries to keep relationships from becoming an afterthought.","Cares about making shared plans work.","Values a conversation that might otherwise be missed."],
  D:["Enjoys finding a less repetitive way to work.","Likes testing a new approach before settling on one.","Will invest time now if it makes later work easier.","Looks for a useful idea in an unfamiliar method.","Prefers learning something reusable over repeating a struggle.","Wants space to experiment with how things get done."],
  R:["Protects a little energy for what comes next.","Prefers a pace that can be sustained.","Cares about having enough room to recover.","Avoids plans that leave no breathing room.","Values a break before the reserve runs empty.","Tries to balance effort with the chance to recharge."],
};
/** Seeded individual preferences, independent of names and district membership. */
export function residents(c: Config): Resident[] {
  let seed=(c.seed ^ 0x6d2b79f5)>>>0;
  const random=()=>{seed=(seed+0x6d2b79f5)>>>0;let value=seed;value=Math.imul(value^(value>>>15),value|1);value^=value+Math.imul(value^(value>>>7),value|61);return ((value^(value>>>14))>>>0)/4294967296;};
  return Array.from({length:c.residentCount},(_,i)=>{
    const leaning=districts[i%4];
    const focus=.36+random()*.53;
    const others=districts.filter(d=>d!==leaning);
    const secondary=others[Math.floor(random()*others.length)];
    const raw=Object.fromEntries(others.map(d=>[d,.08+random()+(d===secondary ? .8 : 0)])) as Allocation;
    const total=others.reduce((sum,d)=>sum+raw[d],0);
    const weights=Object.fromEntries(districts.map(d=>[d,d===leaning?focus:(1-focus)*raw[d]/total])) as Allocation;
    const ranked=[...districts].sort((a,b)=>weights[b]-weights[a]);
    const name=residentNames[i%residentNames.length]+(i>=residentNames.length?` ${Math.floor(i/residentNames.length)+1}`:"");
    return {id:`resident-${i+1}`,name,background:residentMotives[ranked[0]][Math.floor(i/4)%6]+` Also values ${districtInfo[ranked[1]].name.toLowerCase()}.`,district:districts[Math.floor(i/6)%4],weights};
  });
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
    name: day === 1 ? (visit ? "A chance to spend time together" : "Day one") : "An open day",
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
