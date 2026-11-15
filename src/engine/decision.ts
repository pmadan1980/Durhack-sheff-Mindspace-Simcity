import { getScenario, listScenarios } from "./catalogue";
import { priorities, type Argument, type Assessment, type Ballot, type DecisionInput,
  type DecisionResult, type Scenario, type Scores } from "./types";

export interface RouteResult {
  status: "candidate" | "ambiguous" | "unsupported";
  candidates: { id: string; summary: string }[];
  requiresConfirmation: true;
}
/** Routing only proposes a family. It never turns a keyword into a confirmed fact. */
export function routeThought(text: string): RouteResult {
  if (typeof text !== "string" || text.length > 10_000) throw new Error("Use a thought of at most 10,000 characters.");
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const words = ` ${normalize(text)} `;
  const scenarios = listScenarios();
  const exact = scenarios.find(scenario =>
    [scenario.title, scenario.example].some(value =>
      normalize(value) === words.trim()));
  const matches = exact ? [exact] : scenarios.filter((s) => s.routing.every((group) =>
    group.some((phrase) => words.includes(` ${phrase} `)),
  ));
  const hasFamilyConflict = matches.some(scenario => scenario.id === "family-deadline");
  const candidates = matches
    .filter(scenario => !hasFamilyConflict || scenario.id !== "family-time")
    .map(({ id, summary }) => ({ id, summary }));
  return { status: candidates.length === 0 ? "unsupported" : candidates.length === 1 ? "candidate" : "ambiguous",
    candidates, requiresConfirmation: true };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function minutes(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 525_600;
}
function source(value: unknown): boolean { return value === "user" || value === "hypothetical"; }

/** Validate at runtime too: these functions can be called from an eventual HTTP adapter. */
export function validateDecision(input: unknown): string[] {
  if (!record(input)) return ["Decision input must be an object."];
  let scenario: Scenario;
  try { scenario = getScenario(String(input.scenarioId)); }
  catch { return ["Choose a supported scenario and confirm its summary."]; }
  const errors: string[] = [];
  if (!minutes(input.availableMinutes)) errors.push("Available minutes must be finite and nonnegative, at most one year.");
  if (!minutes(input.reservedMinutes)) errors.push("Reserved minutes must be finite and nonnegative, at most one year.");
  if (!record(input.facts)) errors.push("Facts must be an object.");
  else for (const [key, fact] of Object.entries(input.facts)) {
    if (!Object.hasOwn(scenario.questions, key)) errors.push(`Unknown fact: ${key}.`);
    if (!record(fact) || typeof fact.value !== "boolean" || !source(fact.source)) errors.push(`Invalid fact: ${key}.`);
  }
  if (!record(input.estimates)) errors.push("Estimates must be an object.");
  else for (const [key, estimate] of Object.entries(input.estimates)) {
    if (!scenario.options.some((o) => o.id === key)) errors.push(`Unknown option: ${key}.`);
    if (!record(estimate) || !minutes(estimate.minutes) || !source(estimate.source) || estimate.includesTravelAndSetup !== true)
      errors.push(`Estimate for ${key} must include all work, travel and setup, with a valid source and duration.`);
  }
  if (input.preferences !== undefined) {
    const preferences = input.preferences;
    if (!record(preferences) || Object.keys(preferences).length !== priorities.length ||
      priorities.some((p) => typeof preferences[p] !== "number" || !Number.isFinite(preferences[p]) || (preferences[p] as number) < 0 || (preferences[p] as number) > 100) ||
      priorities.reduce((sum, p) => sum + (preferences[p] as number), 0) <= 0)
      errors.push("Supply four finite preference weights between 0 and 100 with a positive total.");
  }
  return errors;
}

function assess(scenario: Scenario, input: DecisionInput): Assessment[] {
  return scenario.options.map((option) => {
    const reasons: string[] = [];
    let impossible = false;
    let missing = false;
    const estimate = input.estimates[option.id];
    const spareMinutes = estimate ? input.availableMinutes - input.reservedMinutes - estimate.minutes : null;
    if (!estimate) { missing = true; reasons.push("The total duration has not been supplied."); }
    if (input.reservedMinutes > input.availableMinutes || (spareMinutes !== null && spareMinutes < 0)) {
      impossible = true; reasons.push("This plan exceeds the available time after protected commitments.");
    }
    for (const requirement of option.requires ?? []) {
      const fact = input.facts[requirement];
      if (!fact) { missing = true; reasons.push(`Not confirmed: ${scenario.questions[requirement]}`); }
      else if (!fact.value) { impossible = true; reasons.push(`Required condition is false: ${scenario.questions[requirement]}`); }
    }
    const scores = { ...option.scores };
    const appliedRules: Assessment["appliedRules"] = [];
    for (const rule of option.rules) {
      const fact = input.facts[rule.fact];
      if (fact && fact.value === rule.equals) {
        for (const priority of priorities) scores[priority] += rule.changes[priority] ?? 0;
        appliedRules.push({ fact: rule.fact, source: fact.source, reason: rule.reason });
      }
    }
    return { optionId: option.id, label: option.label,
      status: impossible ? "infeasible" : missing ? "conditional" : "feasible",
      reasons, spareMinutes, scores, appliedRules };
  });
}

function council(scenario: Scenario, assessments: Assessment[]) {
  const feasible = assessments.filter((a) => a.status === "feasible");
  const ballots: Ballot[] = priorities.map((resident) => {
    const best = Math.max(...feasible.map((a) => a.scores[resident]));
    const tiedOptions = feasible.filter((a) => a.scores[resident] === best).map((a) => a.optionId);
    return { resident, choice: tiedOptions.length === 1 ? tiedOptions[0] : null, tiedOptions,
      reason: !tiedOptions.length ? "No confirmed feasible option is available." : tiedOptions.length > 1
        ? `“${feasible.filter(option => tiedOptions.includes(option.optionId)).map(option => option.label).join("” and “")}” serve this priority equally.`
        : "This feasible option best serves this priority under the authored rules and supplied context." };
  });
  const arguments_: Argument[] = ballots.map((ballot) => {
    const assessment = assessments.find((a) => a.optionId === ballot.choice);
    const option = scenario.options.find((o) => o.id === ballot.choice);
    const relevant = assessment?.appliedRules.filter(applied => option?.rules.some(rule =>
      rule.fact === applied.fact && rule.reason === applied.reason && rule.changes[ballot.resident] !== undefined)) ?? [];
    return { id: `opening-${ballot.resident}`, resident: ballot.resident, optionId: ballot.choice,
      text: option && assessment ? relevant.length ? relevant.map(r => r.reason).join(" ") : option.rationale[ballot.resident] : ballot.reason,
      factIds: relevant.map((r) => r.fact), basis: "authored-rule", replyTo: null };
  });
  // Rebuttals compare actual options and reference an existing opening; no invented dialogue.
  for (const ballot of ballots) {
    if (!ballot.choice) continue;
    const other = ballots.find((b) => b.choice !== null && b.choice !== ballot.choice);
    if (!other) continue;
    const mine = assessments.find((a) => a.optionId === ballot.choice)!;
    const theirs = assessments.find((a) => a.optionId === other.choice)!;
    const option = scenario.options.find((o) => o.id === ballot.choice)!;
    arguments_.push({ id: `reply-${ballot.resident}`, resident: ballot.resident, optionId: ballot.choice,
      replyTo: `opening-${other.resident}`, basis: "authored-rule", factIds: mine.appliedRules.map((r) => r.fact),
      text: `Your proposal is “${theirs.label}”. I’d choose “${mine.label}”. ${option.rationale[ballot.resident]}` });
  }
  return { ballots, arguments: arguments_ };
}

export function evaluateDecision(value: DecisionInput): DecisionResult {
  const errors = validateDecision(value);
  if (errors.length) throw new Error(errors.join(" "));
  const input = structuredClone(value);
  const scenario = getScenario(input.scenarioId);
  const assessments = assess(scenario, input);
  const { ballots, arguments: arguments_ } = council(scenario, assessments);
  const unknowns = [
    ...scenario.options.filter((o) => !input.estimates[o.id]).map((o) => `duration:${o.id}`),
    ...Object.keys(scenario.questions).filter((key) => !Object.hasOwn(input.facts, key)),
  ];
  const questions = unknowns.slice(0, 2).map((key) => key.startsWith("duration:")
    ? `How many total minutes does “${scenario.options.find((o) => o.id === key.slice(9))!.label}” require, including work, travel and setup?`
    : scenario.questions[key]);
  const feasible = assessments.filter((a) => a.status === "feasible");
  const alternatives = feasible.filter((candidate) => !feasible.some((other) =>
    priorities.every((p) => other.scores[p] >= candidate.scores[p]) &&
    priorities.some((p) => other.scores[p] > candidate.scores[p]),
  )).map((a) => a.optionId);
  const preferenceScores = feasible.map((a) => input.preferences
    ? priorities.reduce((sum, p) => sum + a.scores[p] * input.preferences![p], 0) : 0);
  const best = Math.max(...preferenceScores);
  return {
    engineVersion: "scenario-engine-v1", scenarioVersion: scenario.version, scenarioId: scenario.id,
    mode: "authored-simulation", input, assessments, unknowns, questions, arguments: arguments_, ballots,
    counts: Object.fromEntries(scenario.options.map((o) => [o.id, ballots.filter((b) => b.choice === o.id).length])),
    abstentions: ballots.filter((b) => b.choice === null).length,
    alternatives,
    preferenceLeaders: input.preferences ? feasible.filter((_, i) => Math.abs(preferenceScores[i] - best) < 1e-9).map((a) => a.optionId) : [],
    caveats: [
      "Authored simulation, not trained AI or a prediction of feelings, grades or other people's behaviour.",
      "Scores are transparent comparison units; resident votes are simulated, not community votes.",
      "Time feasibility checks total capacity only; confirm calendar windows and dependencies separately.",
      "All durations use the same planning horizon; every option estimate must include its entire plan.",
      ...(unknowns.length ? ["Some context is unknown. Unmatched rules were not applied; preferences may change after clarification."] : []),
      ...(Object.values(input.facts).some((f) => f.source === "hypothetical") || Object.values(input.estimates).some((e) => e.source === "hypothetical")
        ? ["This comparison includes explicitly hypothetical inputs."] : []),
    ],
  };
}

/** Compare independent snapshots. Both input states are returned for an auditable diff. */
export function compareDecisions(baseline: DecisionInput, alternative: DecisionInput) {
  if (baseline.scenarioId !== alternative.scenarioId) throw new Error("Compare alternatives within the same scenario.");
  const before = evaluateDecision(baseline);
  const after = evaluateDecision(alternative);
  const canonical = (value: unknown) => JSON.stringify(value, (_key, entry) => record(entry)
    ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);
  const keys = new Set([...Object.keys(baseline), ...Object.keys(alternative)] as (keyof DecisionInput)[]);
  const changedFields = [...keys].filter((key) => canonical(baseline[key]) !== canonical(alternative[key]));
  return { before, after, changedFields,
    changedBallots: priorities.filter((p) => before.ballots.find((b) => b.resident === p)!.choice !== after.ballots.find((b) => b.resident === p)!.choice) };
}

export interface Reflection {
  chosenOptionId: string;
  observation: string;
  /** User-confirmed facts, never inferred from the observation's wording. */
  updatedFacts?: DecisionInput["facts"];
}
export function reflectOnDecision(input: DecisionInput, reflection: Reflection) {
  const before = evaluateDecision(input);
  if (!reflection || !getScenario(input.scenarioId).options.some((o) => o.id === reflection.chosenOptionId)) throw new Error("Choose an option from this scenario.");
  if (typeof reflection.observation !== "string" || !reflection.observation.trim() || reflection.observation.length > 10_000) throw new Error("Supply a reflection of 1 to 10,000 characters.");
  if (reflection.updatedFacts !== undefined && (!record(reflection.updatedFacts) ||
    Object.values(reflection.updatedFacts).some((f) => !record(f) || f.source !== "user")))
    throw new Error("Reflections can update only explicitly user-reported facts.");
  const updated = { ...input, facts: { ...input.facts, ...reflection.updatedFacts } };
  const comparison = compareDecisions(input, updated);
  return { reflection: structuredClone(reflection), before, after: comparison.after,
    changedBallots: comparison.changedBallots,
    explanation: comparison.changedFields.length ? "Reconsidered using explicitly updated facts; the original choice is not judged wrong."
      : "No facts changed. The reflection is recorded without inventing new evidence or a different vote." };
}

export type { DecisionInput, DecisionResult, Scores };
