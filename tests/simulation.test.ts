import { describe, expect, it } from "vitest";
import {
  branch,
  config,
  createWorld,
  elect,
  forecast,
  judgeSetup,
  policies,
  proposalsForDay,
  resolve,
  validatePolicy,
  type Policy,
} from "../src/simulation";
import { mixGains, projectScore } from "../src/audio";

describe("the MINDSPACE contract", () => {
  it("rejects invalid configuration and budgets, and bounds finite resources", () => {
    for (const energyCap of [0, -1, Infinity, NaN])
      expect(() => createWorld({ ...judgeSetup, energyCap })).toThrow();
    expect(() => createWorld({ ...judgeSetup, energy: 13 })).toThrow();
    for (const A of [-1, 0.5, NaN, 5])
      expect(
        validatePolicy(
          { ...policies[0], allocation: { ...policies[0].allocation, A } },
          config,
        ),
      ).toBeTruthy();
    const { state, rules } = createWorld({
      ...judgeSetup,
      energy: 0,
      energyCap: 7,
    });
    const allRest: Policy = {
      ...policies[0],
      allocation: { A: 0, C: 0, D: 0, R: 6 },
    };
    const rest = resolve(state, [allRest], rules);
    expect(rest.after.energy).toBe(7);
    expect(rest.activity.restored).toBe(7);
    expect(
      resolve({ ...state, energy: 7 }, [allRest], rules).activity.restored,
    ).toBe(0);
    const allWork = { ...allRest, allocation: { A: 6, C: 0, D: 0, R: 0 } };
    const work = resolve(state, [allWork], rules);
    expect(work.after.energy).toBe(0);
    expect(work.after.taskProgress).toBe(3); // productivity floor, not zero
    expect(
      Object.values(work.activity)
        .filter((v) => typeof v === "number")
        .every(Number.isFinite),
    ).toBe(true);
    expect(
      forecast({ ...state, method: rules.methodCap }, policies[2], rules)
        .methodGain,
    ).toBe(0);
  });
  it("uses starting resources, delays Discovery, and latches end-of-day deadlines", () => {
    const { state, rules } = createWorld(judgeSetup);
    const first = resolve(state, policies, rules, "method");
    expect(first.activity.taskGain).toBe(3); // 2 × 2 × (0.25 + 0.75 × 8/12) × 1
    expect(first.after.method).toBeCloseTo(1.1);
    expect(first.after.energy).toBeCloseTo(5.9);
    expect(first.after.connectionResult).toBe(false);
    expect(first.after.taskResult).toBeNull();
    const second = resolve(first.after, policies, rules, "method");
    expect(second.start.energy).toBeCloseTo(6.9); // indexed morning event
    expect(second.activity.taskGain).toBeCloseTo(2.9975);
    expect(second.activity.connectionGain).toBe(0);
    expect(second.after.connectionResult).toBe(false);
    const deadline = resolve(
      { ...state, day: 3, taskProgress: 10 },
      policies,
      rules,
      "prepare",
    );
    expect(deadline.after.taskResult).toBe(true);
    const missed = resolve({ ...state, day: 3 }, [policies[1]], rules);
    expect(missed.after.taskResult).toBe(false);
    expect(
      resolve({ ...missed.after, taskProgress: 99 }, policies, rules).after
        .taskResult,
    ).toBe(false);
    expect(
      resolve(state, policies, rules, "visit").after.connectionResult,
    ).toBe(true);
  });
  it("replays an identical 14-day numerical history and stops at the bound", () => {
    const replay = () => {
      const { state, rules } = createWorld(judgeSetup);
      let current = state;
      const history = [];
      for (let day = 1; day <= rules.maxDays; day++) {
        const round = resolve(current, proposalsForDay(day), rules);
        history.push(round);
        current = round.after;
      }
      expect(() => resolve(current, policies, rules)).toThrow("last day");
      return history;
    };
    expect(replay()).toEqual(replay());
    expect(proposalsForDay(2)[1].allocation).toEqual({
      A: 4,
      C: 0,
      D: 0,
      R: 2,
    });
    expect(policies[1].allocation.C).toBe(2);
  });
  it("counts each resident once, uses preferences, and breaks ties by stable order", () => {
    const { state, rules } = createWorld(judgeSetup);
    const election = elect(state, policies, rules);
    expect(election.counts).toEqual([4, 12, 8]);
    expect(election.counts.reduce((a, b) => a + b, 0)).toBe(24);
    expect(new Set(election.ballots.map((b) => b.resident.id)).size).toBe(24);
    expect(
      election.ballots.every(
        (b) =>
          Math.abs(
            Object.values(b.resident.weights).reduce((a, v) => a + v, 0) - 1,
          ) < 1e-10,
      ),
    ).toBe(true);
    expect(
      elect({ ...state, taskProgress: 10 }, policies, rules).counts,
    ).toEqual([0, 16, 8]);
    // Achieved goals and a capped method remove those voting benefits.
    const finished = elect(
      { ...state, taskProgress: 20, connectionProgress: 3, method: 1.6 },
      policies,
      rules,
    );
    expect(
      finished.ballots.every((b) =>
        b.signals.every((s) => s.A === 0 && s.C === 0 && s.D === 0),
      ),
    ).toBe(true);
    // At 11.5 energy, exactly three of the six archetypes prefer each proposal.
    const tieRules = { ...rules, residentCount: 24 };
    const recovery = {
      ...policies[0],
      id: "rest",
      allocation: { A: 0, C: 0, D: 0, R: 6 },
    };
    const discover = { ...policies[2], allocation: { A: 0, C: 0, D: 6, R: 0 } };
    const tieState = { ...state, energy: 11.5 };
    const tie = elect(tieState, [recovery, discover], tieRules);
    expect(tie.counts).toEqual([12, 12]);
    expect(tie.tied).toBe(true);
    expect(tie.winner).toBe(0);
  });
  it("branches independently from the same event without rewriting the election", () => {
    const { state, rules } = createWorld(judgeSetup);
    const source = resolve(state, policies, rules);
    const before = JSON.stringify(source);
    const same = branch(source, source.policy.id, rules);
    expect({ ...same.after, id: source.after.id }).toEqual(source.after);
    const other = branch(source, "prepare", rules);
    expect(other.after.taskProgress).toBe(6);
    expect(other.after.connectionProgress).toBe(0);
    expect(source.after.taskProgress).toBe(3);
    expect(source.after.connectionProgress).toBe(3);
    expect(other.election).toEqual(source.election);
    expect(other.external).toEqual(source.external);
    expect(other.manual).toBe(true);
    other.before.energy = 999;
    other.policies[0].allocation.A = 999;
    expect(JSON.stringify(source)).toBe(before);
  });
  it("projects responsive scores and mixes audio without mutating either world", () => {
    const { state, rules } = createWorld(judgeSetup);
    const first = resolve(state, policies, rules, "method");
    const second = resolve(first.after, proposalsForDay(2), rules);
    const before = JSON.stringify([state, first, second]);
    expect(projectScore(first.after, first, undefined).methodLift).toBe(0);
    const score = projectScore(second.after, second, first);
    expect(score.methodLift).toBe(2);
    expect(score.density.D).toBeGreaterThan(0);
    expect(score.recoveryEcho).toBe(true);
    expect(projectScore(second.after, second, first).density.C).toBe(0);
    expect(mixGains(0)).toEqual([1, 0]);
    expect(mixGains(1)[0]).toBeCloseTo(0);
    expect(mixGains(1)[1]).toBe(1);
    const [a, b] = mixGains(0.39);
    expect(a * a + b * b).toBeCloseTo(1);
    expect(a).not.toBe(b);
    expect(JSON.stringify([state, first, second])).toBe(before);
  });
});
