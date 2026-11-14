/** Backend/domain contracts. No React, network, storage or clock dependencies. */
export const priorities = ["achievement", "recovery", "discovery", "connection"] as const;
export type Priority = (typeof priorities)[number];
export type Scores = Record<Priority, number>;
export type Source = "user" | "hypothetical";
export interface Fact { value: boolean; source: Source }
export interface Estimate {
  minutes: number;
  source: Source;
  /** Duration covers the entire option, including travel, setup and required work. */
  includesTravelAndSetup: true;
}
export interface Rule {
  fact: string;
  equals: boolean;
  changes: Partial<Scores>;
  reason: string;
}
export interface Option {
  id: string;
  label: string;
  description: string;
  /** Authored comparison units, never probabilities or psychological measurements. */
  scores: Scores;
  rationale: Record<Priority, string>;
  requires?: string[];
  rules: Rule[];
}
export interface Scenario {
  id: string;
  version: 1;
  title: string;
  summary: string;
  example: string;
  /** Each group must match; a single keyword cannot select a family. */
  routing: string[][];
  questions: Record<string, string>;
  options: Option[];
  reflection: string;
}
export interface DecisionInput {
  scenarioId: string;
  availableMinutes: number;
  reservedMinutes: number;
  facts: Record<string, Fact>;
  estimates: Record<string, Estimate>;
  /** Optional user preference weights, independent of the four resident ballots. */
  preferences?: Scores;
}
export interface Assessment {
  optionId: string;
  label: string;
  status: "feasible" | "conditional" | "infeasible";
  reasons: string[];
  spareMinutes: number | null;
  scores: Scores;
  appliedRules: { fact: string; source: Source; reason: string }[];
}
export interface Argument {
  id: string;
  resident: Priority;
  optionId: string | null;
  text: string;
  basis: "authored-rule";
  factIds: string[];
  replyTo: string | null;
}
export interface Ballot {
  resident: Priority;
  choice: string | null;
  tiedOptions: string[];
  reason: string;
}
export interface DecisionResult {
  engineVersion: "scenario-engine-v1";
  scenarioVersion: 1;
  scenarioId: string;
  mode: "authored-simulation";
  input: DecisionInput;
  assessments: Assessment[];
  unknowns: string[];
  questions: string[];
  arguments: Argument[];
  ballots: Ballot[];
  counts: Record<string, number>;
  abstentions: number;
  /** All nondominated feasible alternatives, not a winner chosen by popularity. */
  alternatives: string[];
  /** Only present when the user supplies preferences; ties remain ties. */
  preferenceLeaders: string[];
  caveats: string[];
}
