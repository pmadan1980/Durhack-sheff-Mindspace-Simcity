import {
  actionState,
  createWorld,
  districts,
  elect,
  proposalsForDay,
  resolve,
  validatePolicy,
  validateSetup,
  type Allocation,
  type Config,
  type District,
  type Election,
  type Policy,
  type Round,
  type Setup,
  type State,
} from "./simulation";

// The journey presents and gates the simulation; simulation.ts stays the source of truth.
export type Scene =
  | "thought"
  | "clarify"
  | "briefing"
  | "introductions"
  | "debate"
  | "intervention"
  | "voting"
  | "result"
  | "consequences"
  | "reflection"
  | "summary"
  | "branch"
  | "comparison"
  | "free";

export const storySteps: { scene: Scene; label: string }[] = [
  { scene: "clarify", label: "Your answers" },
  { scene: "briefing", label: "Briefing" },
  { scene: "introductions", label: "Voices" },
  { scene: "debate", label: "Debate" },
  { scene: "intervention", label: "Your edit" },
  { scene: "voting", label: "Polls" },
  { scene: "result", label: "Result" },
  { scene: "consequences", label: "Consequences" },
  { scene: "reflection", label: "Reflection" },
];

export interface World {
  state: State;
  rules: Config;
  history: Round[];
  proposals: Policy[];
  elapsed: number;
  playing: boolean;
  speed: number;
}
/** Frozen when the polls open; the count only ever reveals this election. */
export interface Locked {
  day: number;
  start: State;
  proposals: Policy[];
  election: Election;
}
export interface Journey {
  scene: Scene;
  setup: Setup;
  world: World;
  line: number;
  edits: { day: number; policyId: string }[];
  locked: Locked | null;
  revealed: number;
  counting: boolean;
  exploring: boolean;
}
export type JourneyAction =
  | { type: "begin"; setup: Setup }
  | { type: "assume"; setup: Setup }
  | { type: "free" }
  | { type: "reset"; setup: Setup }
  | { type: "advance"; from: Scene }
  | { type: "back"; from: Scene }
  | { type: "line"; line: number }
  | { type: "edit"; policy: Policy }
  | { type: "reveal"; day: number }
  | { type: "count"; on: boolean }
  | { type: "revealAll" }
  | { type: "explore"; on: boolean }
  | { type: "play" }
  | { type: "pause" }
  | { type: "speed"; speed: number }
  | { type: "tick" }
  | { type: "step"; day: number }
  | { type: "worldEdit"; policy: Policy };

function newWorld(setup: Setup): World {
  const world = createWorld(setup);
  return {
    ...world,
    history: [],
    proposals: proposalsForDay(1, undefined, world.rules),
    elapsed: 0,
    playing: false,
    speed: 1,
  };
}
export function initialJourney(setup: Setup): Journey {
  return {
    scene: "thought",
    setup,
    world: newWorld(setup),
    line: 0,
    edits: [],
    locked: null,
    revealed: 0,
    counting: false,
    exploring: false,
  };
}
export const lastGuidedDay = (c: Config) => c.taskDeadlineDay;
export const roundFor = (history: Round[], day: number) =>
  history.find((r) => r.before.day === day);

/** Commit the locked election's day at most once; returns the same world if already resolved. */
function commit(j: Journey): World {
  const { world, locked } = j;
  if (!locked || roundFor(world.history, locked.day)) return world;
  if (world.state.day !== locked.day) return world;
  const round = resolve(world.state, locked.proposals, world.rules);
  return {
    ...world,
    state: round.after,
    history: [...world.history, round].slice(-world.rules.historyLimit),
    proposals: proposalsForDay(round.after.day, undefined, world.rules),
  };
}
function finishFree(w: World): World {
  if (w.state.day > w.rules.maxDays) return { ...w, playing: false };
  const round = resolve(w.state, w.proposals, w.rules);
  return {
    ...w,
    state: round.after,
    history: [...w.history, round].slice(-w.rules.historyLimit),
    proposals: proposalsForDay(round.after.day, undefined, w.rules),
    elapsed: 0,
    playing: w.playing && round.after.day <= w.rules.maxDays,
  };
}

export function journeyReducer(j: Journey, a: JourneyAction): Journey {
  const w = j.world;
  switch (a.type) {
    case "begin":
      return { ...initialJourney(a.setup), scene: "clarify" };
    case "reset":
      return initialJourney(a.setup);
    case "assume":
      return (j.scene === "clarify" || j.scene === "briefing") &&
        w.history.length === 0 &&
        !validateSetup(a.setup)
        ? { ...j, setup: a.setup, world: newWorld(a.setup) }
        : j;
    case "free":
      return { ...j, scene: "free", exploring: false, counting: false };
    case "line":
      return { ...j, line: Math.max(0, a.line) };
    case "explore":
      return { ...j, exploring: a.on, counting: a.on ? false : j.counting };
    case "edit": {
      if (j.scene !== "intervention" || validatePolicy(a.policy, w.rules))
        return j;
      return {
        ...j,
        world: {
          ...w,
          proposals: w.proposals.map((p) =>
            p.id === a.policy.id ? structuredClone(a.policy) : p,
          ),
        },
        edits: [
          ...j.edits.filter(
            (e) => !(e.day === w.state.day && e.policyId === a.policy.id),
          ),
          { day: w.state.day, policyId: a.policy.id },
        ],
      };
    }
    case "reveal": {
      const total = j.locked?.election.ballots.length ?? 0;
      if (
        j.scene !== "voting" ||
        !j.counting ||
        j.locked?.day !== a.day ||
        j.revealed >= total
      )
        return j;
      const revealed = j.revealed + 1;
      return { ...j, revealed, counting: revealed < total };
    }
    case "count":
      return j.scene === "voting" &&
        j.locked &&
        j.revealed < j.locked.election.ballots.length
        ? { ...j, counting: a.on }
        : j;
    case "revealAll":
      return j.scene === "voting" && j.locked
        ? {
            ...j,
            revealed: j.locked.election.ballots.length,
            counting: false,
          }
        : j;
    case "back":
      if (a.from !== j.scene) return j;
      if (j.scene === "consequences") return { ...j, scene: "result" };
      if (j.scene === "intervention") return { ...j, scene: "debate" };
      if (j.scene === "briefing" && w.history.length === 0)
        return { ...j, scene: "clarify" };
      return j;
    case "advance": {
      if (a.from !== j.scene) return j; // stale or repeated click
      const day = w.state.day;
      switch (j.scene) {
        case "clarify":
          return { ...j, scene: "briefing" };
        case "briefing":
          return {
            ...j,
            scene:
              day === 1 && w.history.length === 0 ? "introductions" : "debate",
            line: 0,
          };
        case "introductions":
          return { ...j, scene: "debate", line: 0 };
        case "debate":
          return { ...j, scene: "intervention", line: 0 };
        case "intervention": {
          if (w.proposals.some((p) => validatePolicy(p, w.rules))) return j;
          const start = actionState(w.state, w.rules);
          const proposals = structuredClone(w.proposals);
          return {
            ...j,
            scene: "voting",
            locked: {
              day,
              start,
              proposals,
              election: elect(start, proposals, w.rules),
            },
            revealed: 0,
            counting: true,
          };
        }
        case "voting":
          return j.locked && j.revealed >= j.locked.election.ballots.length
            ? { ...j, scene: "result", counting: false }
            : j;
        case "result":
          return { ...j, scene: "consequences", world: commit(j) };
        case "consequences":
          return { ...j, scene: "reflection" };
        case "reflection":
          return day > lastGuidedDay(w.rules)
            ? { ...j, scene: "summary" }
            : {
                ...j,
                scene: "briefing",
                locked: null,
                revealed: 0,
                counting: false,
                line: 0,
              };
        case "summary":
          return { ...j, scene: "branch" };
        case "branch":
          return { ...j, scene: "comparison" };
        case "comparison":
          return { ...j, scene: "free" };
        default:
          return j;
      }
    }
    // Free exploration keeps the original playback clock, and only there.
    case "play":
      return j.scene === "free"
        ? { ...j, world: { ...w, playing: w.state.day <= w.rules.maxDays } }
        : j;
    case "pause":
      return { ...j, world: { ...w, playing: false }, counting: false };
    case "speed":
      return { ...j, world: { ...w, speed: a.speed } };
    case "tick": {
      if (j.scene !== "free" || !w.playing) return j;
      const next = { ...w, elapsed: w.elapsed + 0.25 * w.speed };
      return {
        ...j,
        world: next.elapsed >= w.rules.daySeconds ? finishFree(next) : next,
      };
    }
    case "step":
      return j.scene === "free" && a.day === w.state.day
        ? { ...j, world: finishFree({ ...w, playing: false }) }
        : j;
    case "worldEdit":
      return j.scene === "free" &&
        !w.playing &&
        w.elapsed < w.rules.campaignSeconds &&
        !validatePolicy(a.policy, w.rules)
        ? {
            ...j,
            world: {
              ...w,
              proposals: w.proposals.map((p) =>
                p.id === a.policy.id ? structuredClone(a.policy) : p,
              ),
            },
          }
        : j;
  }
}

/** Deterministic reveal order that interleaves the four district groups. */
export function revealOrder(n: number): number[] {
  const group = Math.ceil(n / districts.length);
  return Array.from({ length: n }, (_, i) => i).sort(
    (x, y) =>
      (x % group) - (y % group) || Math.floor(x / group) - Math.floor(y / group),
  );
}
export function revealedBallots(locked: Locked, revealed: number) {
  return revealOrder(locked.election.ballots.length)
    .slice(0, revealed)
    .map((i) => locked.election.ballots[i]);
}
export function revealedCounts(locked: Locked, revealed: number): number[] {
  const counts = locked.proposals.map(() => 0);
  for (const b of revealedBallots(locked, revealed)) counts[b.choice]++;
  return counts;
}
export function leaders(counts: number[]): number[] {
  const top = Math.max(...counts);
  return top === 0 ? [] : counts.flatMap((c, i) => (c === top ? [i] : []));
}
/** A plan's accent is the district it funds most above the other plans. */
export function planAccent(p: Policy, ps: Policy[]): District {
  return districts.reduce((best, d) => {
    const lift = (k: District) =>
      p.allocation[k] - ps.reduce((s, q) => s + q.allocation[k], 0) / ps.length;
    return lift(d) > lift(best) + 1e-9 ? d : best;
  }, "A" as District);
}
export const sameAllocation = (a: Allocation, b: Allocation) =>
  districts.every((d) => a[d] === b[d]);

/** Truthful milestones from the revealed prefix only; newest last. */
export function commentary(locked: Locked, revealed: number): string[] {
  const names = locked.proposals.map((p) => p.name);
  const total = locked.election.ballots.length;
  const notes: string[] = [];
  let previous = "";
  for (let k = 1; k <= revealed; k++) {
    const counts = revealedCounts(locked, k);
    const lead = leaders(counts);
    const key = lead.join(",");
    if (k === 1) {
      notes.push(`First ballot counted: ${names[lead[0]]}.`);
    } else if (k === total) {
      break;
    } else if (key !== previous) {
      notes.push(
        lead.length > 1
          ? `${k} counted: a tie between ${lead.map((i) => names[i]).join(" and ")}.`
          : `${k} counted: ${names[lead[0]]} ${previous.includes(",") ? "breaks the tie" : "takes the lead"} with ${counts[lead[0]]}.`,
      );
    }
    previous = key;
  }
  if (revealed >= total && total > 0) {
    const e = locked.election;
    notes.push(
      e.tied
        ? `Final: tied at ${e.counts[e.winner]}. The model's rule gives ties to the first-listed plan, ${names[e.winner]}.`
        : `Final: ${names[e.winner]} wins with ${e.counts[e.winner]} of ${total}.`,
    );
  }
  return notes;
}

export const sceneRoom = {
  thought: "headquarters",
  clarify: "headquarters",
  briefing: "headquarters",
  introductions: "decision",
  debate: "decision",
  intervention: "decision",
  voting: "decision",
  result: "decision",
  consequences: "hub",
  reflection: "hub",
  summary: "memory",
  branch: "memory",
  comparison: "parallel",
  free: "decision",
} as const satisfies Record<Scene, string>;

/** What the 3D world should stage for the current scene. */
export interface Cue {
  scene: Scene;
  speaker: District | null;
  focus: District | null;
  plans: Policy[];
  votes: (number | null)[];
  counts: number[] | null;
  winner: number | null;
  flights: { key: string; allocation: Allocation } | null;
  thought: boolean;
  reactions: { d: District; kind: "cheer" | "sigh"; key: number }[];
}
