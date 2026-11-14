import { describe, expect, it } from "vitest";
import { branch, createWorld, judgeSetup, policies, proposalsForDay, resolve, taskTypes } from "../src/simulation";
import { comparisonMeasures, impactMoments, networkStrength, sameState, worldCaption } from "../src/parallelStory";

describe("parallel-world visual storytelling", () => {
  it("uses the confirmed task type and only shows configured outcomes", () => {
    for (const taskType of taskTypes) {
      const { state, rules } = createWorld({ ...judgeSetup, taskType, visitLastDay: 0 });
      const round = resolve(state, proposalsForDay(1, undefined, rules), rules);
      const alternative = branch(round, round.policies.find(policy => policy.id !== round.policy.id)!.id, rules);
      const measures = comparisonMeasures(round.after, alternative.after, rules);
      expect(measures.map(measure => measure.district)).toEqual(["A", "D", "R"]);
      expect(measures[0].label.toLowerCase()).toBe(taskType);
      expect(comparisonMeasures(state, state, rules).every(measure => !measure.changed)).toBe(true);
    }
  });

  it("shows a deadline status change even when the amount of work matches", () => {
    const { state, rules } = createWorld(judgeSetup);
    const met = { ...state, taskProgress: rules.taskGoal, taskResult: true };
    const pending = { ...met, taskResult: null };
    expect(sameState(met, pending)).toBe(false);
    expect(comparisonMeasures(met, pending, rules)[0]).toMatchObject({
      changed: true, a: { result: true }, b: { result: null },
    });
  });
  it("ties highlights and artwork to the actual outcomes without mutating them", () => {
    const { state, rules } = createWorld({ ...judgeSetup, taskType: "assignment" });
    const a = resolve(state, policies, rules);
    const b = branch(a, "prepare", rules);
    const before = JSON.stringify([a, b]);
    const moments = impactMoments(a, b, rules);
    expect(moments.find((m) => m.id === "visit")!.detail).toContain("visit was missed");
    expect(networkStrength(a, rules).C).toBe(1);
    expect(networkStrength(b, rules).C).toBe(0);
    expect(networkStrength(b, rules).A).toBeGreaterThan(networkStrength(a, rules).A);
    expect(worldCaption(a, rules)).toContain("assignment");
    expect(JSON.stringify([a, b])).toBe(before);
  });
  it("does not invent a dramatic difference for matching outcomes or tiny changes", () => {
    const { state, rules } = createWorld(judgeSetup);
    const a = resolve(state, policies, rules);
    expect(impactMoments(a, branch(a, a.policy.id, rules), rules)[0].id).toBe("converge");
    const b = structuredClone(a);
    b.after.energy += 0.01;
    expect(impactMoments(a, b, rules)[0].id).toBe("subtle");
  });
  it("keeps pending goals distinct from missed goals", () => {
    const { state, rules } = createWorld({ ...judgeSetup, visitLastDay: 0 });
    const a = resolve(state, policies, rules, "prepare");
    expect(worldCaption(a, rules)).toContain("still taking shape");
    expect(worldCaption(a, rules)).not.toContain("missed");
    expect(worldCaption(a, rules)).not.toContain("friend");
  });
});
