import { describe, expect, it } from "vitest";
import { judgeSetup, validatePolicy, replay, config } from "../src/simulation";
import {
  initialJourney,
  journeyReducer as reduce,
  revealedCounts,
  type Journey,
  type JourneyAction,
} from "../src/journey";

const run = (j: Journey, ...actions: JourneyAction[]) => actions.reduce(reduce, j);
const toPolls = () =>
  run(
    initialJourney(judgeSetup),
    { type: "begin", setup: judgeSetup },
    { type: "advance", from: "clarify" },
    { type: "advance", from: "briefing" },
    { type: "advance", from: "introductions" },
    { type: "advance", from: "debate" },
    { type: "advance", from: "intervention" },
  );
const countAll = (j: Journey) => {
  while (j.counting) j = reduce(j, { type: "reveal", day: j.locked!.day });
  return j;
};

describe("the guided journey", () => {
  it("reveals the real locked ballots and finishes at the committed result", () => {
    let j = toPolls();
    expect(j.scene).toBe("voting");
    expect(revealedCounts(j.locked!, 0)).toEqual([0, 0, 0]);
    expect(reduce(j, { type: "advance", from: "voting" }).scene).toBe("voting"); // not before the count ends
    j = countAll(j);
    expect(j.revealed).toBe(config.residentCount);
    expect(revealedCounts(j.locked!, j.revealed)).toEqual(j.locked!.election.counts);
    j = run(j, { type: "advance", from: "voting" }, { type: "advance", from: "result" });
    const round = j.world.history[0];
    expect(round.election.counts).toEqual(j.locked!.election.counts);
    expect(round.policy.id).toBe(j.locked!.proposals[j.locked!.election.winner].id);
  });
  it("commits a day exactly once across double clicks and revisits", () => {
    let j = countAll(toPolls());
    j = run(
      j,
      { type: "advance", from: "voting" },
      { type: "advance", from: "result" },
      { type: "advance", from: "result" }, // stale double click
      { type: "back", from: "consequences" },
      { type: "advance", from: "result" }, // revisit replays, never re-resolves
    );
    expect(j.scene).toBe("consequences");
    expect(j.world.history).toHaveLength(1);
    expect(j.world.state.day).toBe(2);
    j = run(j, { type: "advance", from: "consequences" }, { type: "advance", from: "reflection" });
    expect(j.scene).toBe("briefing");
    expect(j.locked).toBeNull();
    expect(reduce(j, { type: "advance", from: "briefing" }).scene).toBe("debate"); // no repeat introductions
  });
  it("pause, exploring and reset stop stale progression; the clock never runs in guided mode", () => {
    let j = toPolls();
    j = reduce(j, { type: "reveal", day: 1 });
    j = reduce(j, { type: "count", on: false });
    expect(reduce(j, { type: "reveal", day: 1 }).revealed).toBe(1);
    j = run(j, { type: "count", on: true }, { type: "explore", on: true });
    expect(reduce(j, { type: "reveal", day: 1 }).revealed).toBe(1);
    const fresh = reduce(j, { type: "reset", setup: judgeSetup });
    expect(reduce(fresh, { type: "reveal", day: 1 })).toBe(fresh);
    expect(fresh.locked).toBeNull();
    expect(run(j, { type: "play" }, { type: "tick" }, { type: "step", day: 1 }).world.state.day).toBe(1);
  });
  it("accepts only valid plan edits, and only before the polls open", () => {
    let j = run(toPolls(), { type: "reset", setup: judgeSetup }, { type: "begin", setup: judgeSetup }, { type: "advance", from: "clarify" });
    j = run(j, { type: "advance", from: "briefing" }, { type: "advance", from: "introductions" }, { type: "advance", from: "debate" });
    const p = j.world.proposals[0];
    const bad = { ...p, allocation: { ...p.allocation, A: p.allocation.A + 1 } };
    expect(validatePolicy(bad, j.world.rules)).toBeTruthy();
    expect(reduce(j, { type: "edit", policy: bad })).toBe(j);
    const good = { ...p, allocation: { A: 3, C: 1, D: 0, R: 2 } };
    j = reduce(j, { type: "edit", policy: good });
    expect(j.world.proposals[0].allocation).toEqual(good.allocation);
    j = reduce(j, { type: "advance", from: "intervention" });
    expect(reduce(j, { type: "edit", policy: p }).world.proposals[0].allocation).toEqual(good.allocation);
  });
});

// Play the whole guided story with unedited plans; returns the final journey.
function playStory(setup: typeof judgeSetup) {
  let j = run(initialJourney(setup), { type: "begin", setup }, { type: "advance", from: "clarify" });
  for (let guard = 0; guard < 20 && j.scene !== "summary"; guard++) {
    j = run(j, { type: "advance", from: "briefing" }, { type: "advance", from: "introductions" }, { type: "advance", from: "debate" }, { type: "advance", from: "intervention" });
    j = run(countAll(j), { type: "advance", from: "voting" }, { type: "advance", from: "result" }, { type: "advance", from: "consequences" }, { type: "advance", from: "reflection" });
  }
  return j;
}

describe("clarified assumptions", () => {
  it("ends a nearly finished story on day 1 and blocks free-play advancement", () => {
    const j = playStory({ ...judgeSetup, taskProgress: 10 });
    expect(j.scene).toBe("summary");
    expect(j.world.history).toHaveLength(1);
    expect(j.world.state.taskProgress).toBe(12);
    expect(j.world.state.taskResult).toBe(true);
    const free = reduce(j, { type: "free" });
    const later = run(free, { type: "play" }, { type: "tick" }, { type: "step", day: free.world.state.day });
    expect(later.world.state).toEqual(free.world.state);
    expect(later.world.history).toEqual(free.world.history);
    expect(later.world.playing).toBe(false);
  });
  it("an already complete starting presentation goes straight to summary", () => {
    const j = playStory({ ...judgeSetup, taskProgress: 12 });
    expect(j.scene).toBe("summary");
    expect(j.world.history).toHaveLength(0);
    expect(j.world.state.taskResult).toBe(true);
  });
  it("a two-day deadline with no visit ends the story after day 2 and never offers a visit", () => {
    const setup = { ...judgeSetup, taskDeadlineDay: 2, visitLastDay: 0 };
    const start = run(initialJourney(setup), { type: "begin", setup });
    expect(start.scene).toBe("clarify");
    expect(start.world.proposals.map((p) => p.id)).toEqual(["prepare", "method"]);
    expect(start.world.proposals.every((p) => p.allocation.C === 0)).toBe(true);
    const j = playStory(setup);
    expect(j.scene).toBe("summary");
    expect(j.world.history.map((r) => r.before.day)).toEqual([1, 2]);
    expect(j.world.state.taskResult).not.toBeNull(); // latched on day 2
    expect(j.world.state.connectionResult).toBeNull();
    expect(j.world.state.connectionProgress).toBe(0);
    expect(j.world.history[1].external.id).toBe("the-final-stretch");
    expect(replay(j.world.history, 1, "method", j.world.rules).b).toHaveLength(2);
  });
  it("a four-day deadline with a two-day visit stops early when the presentation finishes", () => {
    const setup = { ...judgeSetup, taskDeadlineDay: 4, visitLastDay: 2 };
    const j = playStory(setup);
    const h = j.world.history;
    expect(h.map((r) => r.before.day)).toEqual([1, 2, 3]);
    expect(h[1].policies.some((p) => p.allocation.C > 0)).toBe(true);
    expect(h[2].policies.every((p) => p.allocation.C === 0)).toBe(true);
    expect(h[0].after.connectionResult).toBeNull();
    expect(h[1].after.connectionResult).not.toBeNull();
    expect(h[2].after.taskResult).toBe(true);
    expect(h[2].after.taskProgress).toBe(12);
  });
  it("confirmed answers can change before day 1 starts, and invalid answers are refused", () => {
    let j = run(initialJourney(judgeSetup), { type: "begin", setup: judgeSetup });
    const bad = { ...judgeSetup, taskDeadlineDay: 2, visitLastDay: 3 };
    expect(reduce(j, { type: "assume", setup: bad })).toBe(j);
    j = reduce(j, { type: "assume", setup: { ...judgeSetup, taskDeadlineDay: 1, visitLastDay: 1 } });
    expect(j.world.rules.taskDeadlineDay).toBe(1);
    j = run(j, { type: "advance", from: "clarify" }, { type: "back", from: "briefing" });
    expect(j.scene).toBe("clarify");
  });
});

describe("counterfactual replay", () => {
  it("covers the same days as the baseline and matches it when the policy is unchanged", () => {
    const j = playStory(judgeSetup);
    expect(j.scene).toBe("summary");
    const h = j.world.history;
    const same = replay(h, 1, h[0].policy.id, j.world.rules);
    expect(same.b).toHaveLength(same.a.length);
    expect(same.b.at(-1)!.after.taskProgress).toBeCloseTo(same.a.at(-1)!.after.taskProgress);
    const other = h[0].policies.find((p) => p.id !== h[0].policy.id)!;
    const alt = replay(h, 1, other.id, j.world.rules);
    expect(alt.b.map((r) => r.before.day)).toEqual([1, 2]);
    expect(alt.a.map((r) => r.before.day)).toEqual([1, 2]);
    expect(alt.b.at(-1)!.after.taskResult).toBe(true);
    expect(alt.b[0].policy.id).toBe(other.id);
  });
});
